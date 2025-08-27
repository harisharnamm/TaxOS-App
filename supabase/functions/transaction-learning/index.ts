// Transaction Learning System - Adding Supabase client back
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

console.log('Environment check:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseServiceRoleKey,
  urlLength: supabaseUrl?.length,
  keyLength: supabaseServiceRoleKey?.length
});

let supabase: any = null;

if (supabaseUrl && supabaseServiceRoleKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('✅ Supabase client initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Supabase client:', error);
  }
} else {
  console.error('❌ Missing Supabase environment variables');
}

// Types for learning system
type UserFeedback = {
  transactionId: string;
  userId: string;
  action: 'accepted' | 'rejected' | 'modified';
  originalSuggestion: {
    category: string;
    payee: string;
    confidence: number;
  };
  userChoice: {
    category: string;
    payee: string;
  };
  feedbackReason?: string;
  timestamp: string;
};

// Store user feedback for learning
async function storeUserFeedback(feedback: UserFeedback): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🔄 Storing user feedback:', JSON.stringify(feedback, null, 2));
    
    // Check if Supabase client is available
    if (!supabase) {
      console.error('❌ Supabase client not initialized');
      return { success: false, error: 'Database client not available' };
    }
    
    // Validate required fields
    if (!feedback.transactionId || !feedback.userId || !feedback.action) {
      console.error('❌ Missing required fields in feedback:', feedback);
      return { success: false, error: 'Missing required fields' };
    }

    const insertData = {
      transaction_id: feedback.transactionId,
      user_id: feedback.userId,
      action: feedback.action,
      original_category: feedback.originalSuggestion?.category || null,
      original_payee: feedback.originalSuggestion?.payee || null,
      original_confidence: feedback.originalSuggestion?.confidence || null,
      user_category: feedback.userChoice?.category || null,
      user_payee: feedback.userChoice?.payee || null,
      feedback_reason: feedback.feedbackReason || null,
      created_at: feedback.timestamp
    };

    console.log('🔄 Inserting feedback data:', JSON.stringify(insertData, null, 2));

    const { data, error } = await supabase
      .from('user_feedback')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error storing user feedback:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return { success: false, error: `Database error: ${error.message}` };
    }

    console.log('✅ User feedback stored successfully:', data);
    
    // Now update learning patterns based on this feedback
    try {
      await updateLearningPatterns(feedback);
      console.log('✅ Learning patterns updated successfully');
    } catch (patternError) {
      console.error('⚠️ Error updating learning patterns (non-critical):', patternError);
      // Don't fail the whole operation if pattern update fails
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ Exception in storeUserFeedback:', error);
    return { success: false, error: `Exception: ${error.message}` };
  }
}

// Update learning patterns based on user feedback
async function updateLearningPatterns(feedback: UserFeedback): Promise<void> {
  try {
    const { userId, action, userChoice } = feedback;
    console.log('🧠 Updating learning patterns for user:', userId);
    
    // Extract merchant pattern from transaction description
    const merchantPattern = await extractMerchantPattern(feedback.transactionId);
    if (!merchantPattern) {
      console.warn('⚠️ No merchant pattern extracted, skipping pattern update');
      return;
    }
    
    console.log('🧠 Extracted merchant pattern:', merchantPattern);

    // Get existing pattern or create new one
    const { data: existingPattern, error: fetchError } = await supabase
      .from('learning_patterns')
      .select('*')
      .eq('user_id', userId)
      .eq('merchant_pattern', merchantPattern)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error fetching learning pattern:', fetchError);
      return;
    }

    if (existingPattern) {
      // Update existing pattern
      const newUsageCount = existingPattern.usage_count + 1;
      const newSuccessRate = action === 'accepted' 
        ? (existingPattern.success_rate * existingPattern.usage_count + 1) / newUsageCount
        : (existingPattern.success_rate * existingPattern.usage_count) / newUsageCount;

      const { error: updateError } = await supabase
        .from('learning_patterns')
        .update({
          category: userChoice.category,
          payee: userChoice.payee,
          confidence: Math.min(existingPattern.confidence + 0.1, 1.0), // Increase confidence on success
          usage_count: newUsageCount,
          last_used: new Date().toISOString(),
          success_rate: newSuccessRate
        })
        .eq('id', existingPattern.id);

      if (updateError) {
        console.error('❌ Error updating learning pattern:', updateError);
      } else {
        console.log('✅ Learning pattern updated successfully');
      }
    } else {
      // Create new pattern
      const { error: insertError } = await supabase
        .from('learning_patterns')
        .insert({
          user_id: userId,
          merchant_pattern: merchantPattern,
          category: userChoice.category,
          payee: userChoice.payee,
          confidence: 0.7, // Start with moderate confidence
          usage_count: 1,
          last_used: new Date().toISOString(),
          success_rate: action === 'accepted' ? 1.0 : 0.0
        });

      if (insertError) {
        console.error('❌ Error creating learning pattern:', insertError);
      } else {
        console.log('✅ New learning pattern created successfully');
      }
    }
  } catch (error) {
    console.error('❌ Error updating learning patterns:', error);
  }
}

// Extract merchant pattern from transaction
async function extractMerchantPattern(transactionId: string): Promise<string | null> {
  try {
    console.log(`🔍 Extracting merchant pattern for transaction: ${transactionId}`);
    
    // First check if the transaction exists
    const { data: transaction, error } = await supabase
      .from('transactions')
      .select('raw_description, normalized_merchant')
      .eq('id', transactionId)
      .single();

    if (error) {
      console.error('❌ Error fetching transaction for pattern extraction:', error);
      // If transaction doesn't exist, try to use a fallback pattern
      return `transaction_${transactionId.substring(0, 8)}`;
    }

    if (!transaction) {
      console.warn(`⚠️ Transaction ${transactionId} not found, using fallback pattern`);
      return `transaction_${transactionId.substring(0, 8)}`;
    }

    // Use normalized merchant if available, otherwise extract from description
    const merchantText = transaction.normalized_merchant || transaction.raw_description;
    
    if (!merchantText) {
      console.warn(`⚠️ No merchant text found for transaction ${transactionId}, using fallback`);
      return `transaction_${transactionId.substring(0, 8)}`;
    }
    
    // Simple pattern extraction - normalize text for matching
    const pattern = merchantText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 50); // Limit length for pattern matching
    
    console.log(`🔍 Extracted pattern: ${pattern}`);
    return pattern;
  } catch (error) {
    console.error('❌ Error extracting merchant pattern:', error);
    // Return a fallback pattern to prevent function failure
    return `transaction_${transactionId.substring(0, 8)}`;
  }
}

// Serve the Edge Function
Deno.serve(async (req) => {
  console.log('🧠 Transaction Learning System - Database Test called');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight handled');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('📥 About to parse request body...');
    
    const body = await req.json();
    console.log('📥 Request body parsed successfully:', JSON.stringify(body, null, 2));
    
    const { action, ...data } = body;
    console.log('📥 Action extracted:', action);

    if (!action) {
      throw new Error('Action is required');
    }

    // Handle different actions
    let result: any;
    
    switch (action) {
      case 'store_feedback':
      case 'accepted':
      case 'rejected':
      case 'modified':
        console.log(`🔄 Processing ${action} action`);
        
        // Convert the action to the expected format for UserFeedback
        const feedback: UserFeedback = {
          ...data,
          action: action === 'store_feedback' ? data.action : action as 'accepted' | 'rejected' | 'modified'
        };
        
        const storeResult = await storeUserFeedback(feedback);
        
        result = {
          success: storeResult.success,
          message: storeResult.success ? 'Feedback stored successfully' : 'Failed to store feedback',
          error: storeResult.error,
          action: action,
          timestamp: new Date().toISOString()
        };
        break;
        
      case 'get_suggestions':
        console.log('🔄 Processing get_suggestions action - not implemented yet');
        result = { 
          success: true, 
          message: 'Suggestions not implemented yet',
          suggestions: null,
          action: action,
          timestamp: new Date().toISOString()
        };
        break;
        
      case 'get_analytics':
        console.log('🔄 Processing get_analytics action - not implemented yet');
        result = { 
          success: true, 
          message: 'Analytics not implemented yet',
          analytics: { totalPatterns: 0, highConfidencePatterns: 0, averageSuccessRate: 0, recentImprovements: 0 },
          action: action,
          timestamp: new Date().toISOString()
        };
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    console.log('✅ Returning result:', result);
    
    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('💥 Learning system error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});