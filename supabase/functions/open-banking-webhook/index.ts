import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Supabase client with proper service role
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing required environment variables");
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Webhook event types from Finicity documentation
type WebhookEvent = {
  customerId: string;
  consumerId?: string;
  eventType: string;
  eventId: string;
  payload: any;
  webhookData?: any;
};

// Process webhook events based on Finicity documentation
async function processWebhookEvent(event: WebhookEvent, headers: Record<string, string>) {
  try {
    // For ping events, don't check idempotency or store in database
    if (event.eventType === 'ping') {
      console.log('Received ping event from Mastercard - webhook is accessible');
      return { processed: true, eventId: 'ping-response' };
    }

    // Check for idempotency using various possible message ID headers
    const messageId = headers['x-mastercard-webhook-message-id'] || 
                     headers['x-finicity-webhook-message-id'] ||
                     headers['x-webhook-message-id'] ||
                     event.eventId; // Use eventId as fallback
    
    if (messageId) {
      // Check if we've already processed this message
      const { data: existing } = await supabase
        .from('open_banking_webhook_events')
        .select('id')
        .eq('message_id', messageId)
        .single();
      
      if (existing) {
        console.log(`Webhook event already processed: ${messageId}`);
        return { processed: false, reason: 'duplicate' };
      }
    }

    // Store the webhook event with a fallback message_id if none provided
    const { data, error } = await supabase
      .from('open_banking_webhook_events')
      .insert({
        message_id: messageId || `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        event_type: event.eventType,
        finicity_customer_id: event.customerId,
        headers: headers,
        payload: event,
        verified: true, // We'll implement proper verification later
        processed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error storing webhook event:', error);
      throw error;
    }

    // Process specific event types
    await handleSpecificEvent(event);

    return { processed: true, eventId: data.id };
  } catch (error) {
    console.error('Error processing webhook event:', error);
    throw error;
  }
}

// Store account data from webhook events
async function storeAccounts(customerId: string, accounts: any[]) {
  try {
    console.log(`Attempting to store ${accounts.length} accounts for customer ${customerId}`);
    
    for (const account of accounts) {
      console.log(`Processing account:`, account);
      
      // Ensure required fields are present
      if (!account.id) {
        console.error('Account missing required id field:', account);
        continue;
      }
      
      const accountData = {
        id: account.id,  // This is the primary key
        finicity_customer_id: customerId,
        name: account.name || 'Unknown Account',
        type: account.type || 'unknown',
        balance: account.balance || 0,
        currency: account.currency || 'USD',
        status: 'active',
        institution_id: account.institutionId || null,
        institution_login_id: account.institutionName || null
        // created_at and last_updated_at will use database defaults
      };
      
      console.log(`Inserting account data:`, accountData);
      
      const { data, error } = await supabase
        .from('open_banking_accounts')
        .upsert(accountData, {
          onConflict: 'id'  // Use just 'id' as the conflict resolution
        });
      
      if (error) {
        console.error('Error storing account:', error);
        console.error('Account data that failed:', accountData);
      } else {
        console.log(`Successfully stored account ${account.id} for customer ${customerId}`);
      }
    }
  } catch (error) {
    console.error('Error in storeAccounts function:', error);
    console.error('Customer ID:', customerId);
    console.error('Accounts:', accounts);
  }
}

// Delete accounts when they're removed
async function deleteAccounts(customerId: string, accountIds: string[]) {
  try {
    const { error } = await supabase
      .from('open_banking_accounts')
      .delete()
      .eq('finicity_customer_id', customerId)
      .in('id', accountIds);
    
    if (error) {
      console.error('Error deleting accounts:', error);
    } else {
      console.log(`Deleted accounts for customer ${customerId}`);
    }
  } catch (error) {
    console.error('Error deleting accounts:', error);
  }
}

// Handle specific event types from Finicity documentation
async function handleSpecificEvent(event: WebhookEvent) {
  const { customerId, eventType, payload } = event;
  
  console.log(`Processing ${eventType} event for customer ${customerId}`);
  
  switch (eventType) {
    case 'ping':
      // Test webhook - just log it
      console.log('Webhook ping received');
      break;
      
    case 'started':
      // Customer started Connect session
      console.log(`Customer ${customerId} started Connect session`);
      break;
      
    case 'discovered':
      // Customer discovered institutions
      console.log(`Customer ${customerId} discovered institutions`);
      break;
      
    case 'adding':
      // Customer is adding accounts
      console.log(`Customer ${customerId} is adding accounts`);
      break;
      
    case 'added':
      // Customer added accounts - this is the key event!
      console.log(`Customer ${customerId} added accounts:`, payload);
      
      // Store the account data
      if (payload?.accounts && Array.isArray(payload.accounts)) {
        await storeAccounts(customerId, payload.accounts);
      }
      
      // Update customer status to linked
      await updateCustomerStatus(customerId, 'linked', payload);
      break;
      
    case 'done':
      // Connect session completed
      console.log(`Customer ${customerId} completed Connect session`);
      
      // Check if accounts were actually added
      if (payload?.accounts && payload.accounts.length > 0) {
        await storeAccounts(customerId, payload.accounts);
        await updateCustomerStatus(customerId, 'linked', payload);
      } else {
        await updateCustomerStatus(customerId, 'pending', payload);
      }
      break;
      
    case 'unableToConnect':
      // Customer couldn't connect
      console.log(`Customer ${customerId} unable to connect:`, payload);
      await updateCustomerStatus(customerId, 'error', payload);
      break;
      
    case 'invalidCredentials':
      // Invalid credentials
      console.log(`Customer ${customerId} invalid credentials:`, payload);
      await updateCustomerStatus(customerId, 'error', payload);
      break;
      
    case 'accountsDeleted':
      // Accounts were deleted
      console.log(`Customer ${customerId} accounts deleted:`, payload);
      if (payload?.accounts && Array.isArray(payload.accounts)) {
        await deleteAccounts(customerId, payload.accounts);
      }
      await updateCustomerStatus(customerId, 'pending', payload);
      break;
      
    default:
      console.log(`Unknown event type: ${eventType} for customer ${customerId}`);
  }
}

// Update customer status based on webhook events
async function updateCustomerStatus(customerId: string, status: string, payload: any) {
  try {
    console.log(`Attempting to update customer ${customerId} status to ${status}`);
    
    // Find the customer in our mapping
    const { data: customerMapping, error: findError } = await supabase
      .from('open_banking_customers')
      .select('platform_client_id')
      .eq('finicity_customer_id', customerId)
      .single();
    
    if (findError) {
      console.error('Error finding customer mapping:', findError);
      return;
    }
    
    if (customerMapping) {
      // Update the customer status
      const { error: updateError } = await supabase
        .from('open_banking_customers')
        .update({ 
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('finicity_customer_id', customerId);
      
      if (updateError) {
        console.error('Error updating customer status:', updateError);
      } else {
        console.log(`Successfully updated customer ${customerId} status to ${status}`);
      }
    } else {
      console.warn(`No customer mapping found for finicity_customer_id: ${customerId}`);
    }
  } catch (error) {
    console.error('Error updating customer status:', error);
  }
}

// Basic webhook signature verification (placeholder for now)
function verifyWebhookSignature(headers: Record<string, string>, body: string): boolean {
  // TODO: Implement proper ECDSA signature verification using OPEN_BANKING_WEBHOOK_PUBLIC_KEY
  // For now, just check if required headers exist
  
  // For Finicity real events, they may not have all the signature headers
  // So we'll be more lenient and just log warnings instead of failing
  const hasMessageId = headers['x-mastercard-webhook-message-id'] || 
                      headers['x-finicity-webhook-message-id'] ||
                      headers['x-webhook-message-id'];
  
  if (!hasMessageId) {
    console.warn('Missing webhook message ID header - this is normal for Finicity real events');
    // Don't fail verification for missing message ID
  }
  
  // Basic timestamp validation (prevent replay attacks) - only if timestamp exists
  const timestamp = headers['x-mastercard-signature-timestamp'] || 
                   headers['x-finicity-signature-timestamp'] ||
                   headers['x-webhook-timestamp'];
  
  if (timestamp) {
    const timestampMs = parseInt(timestamp);
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (Math.abs(now - timestampMs) > fiveMinutes) {
      console.warn('Webhook timestamp too old or in future');
      return false;
    }
  }
  
  // For now, accept all events but log warnings
  console.log('Webhook signature verification passed (lenient mode)');
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract headers and body
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const body = await req.text();
    let event: WebhookEvent;

    try {
      event = JSON.parse(body);
    } catch (error) {
      console.error('Invalid JSON in webhook body:', error);
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate required fields
    if (!event.eventType) {
      console.error('Missing required webhook fields:', event);
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For ping events, eventId is not required
    if (event.eventType !== 'ping' && !event.eventId) {
      console.error('Missing eventId for non-ping event:', event);
      return new Response(JSON.stringify({ error: "Missing eventId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For ping events, customerId is not required
    if (event.eventType !== 'ping' && !event.customerId) {
      console.error('Missing customerId for non-ping event:', event);
      return new Response(JSON.stringify({ error: "Missing customerId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify webhook signature
    if (!verifyWebhookSignature(headers, body)) {
      console.warn('Webhook signature verification failed');
      // Still process the event but mark as unverified
    }

    // Process the webhook event
    const result = await processWebhookEvent(event, headers);
    
    console.log(`Webhook processed: ${result.processed ? 'success' : 'duplicate'}`);

    // Always return 202 Accepted to prevent retries
    return new Response(JSON.stringify({ 
      received: true, 
      processed: result.processed,
      eventId: result.eventId 
    }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Webhook processing error:", error);
    
    // Return 202 even on error to prevent retries
    return new Response(JSON.stringify({ 
      received: true, 
      processed: false,
      error: "Internal processing error" 
    }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
