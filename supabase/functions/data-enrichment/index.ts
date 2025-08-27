// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Supabase client
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

// Finicity Data Enrichment API configuration
const baseUrl = Deno.env.get("OPEN_BANKING_BASE_URL")?.replace(/\/$/, "") || "https://api.finicity.com";
const appKey = Deno.env.get("OPEN_BANKING_APP_KEY");

// Types for Data Enrichment API
type EnrichmentRequest = {
  transactions: Array<{
    externalCustomerId: string;
    externalAccountId: string;
    accountType: string;
    externalTransactionId: string;
    postedTimestamp: string;
    transactionTimestamp: string;
    description: string;
    memo?: string;
    amount: number;
    transactionFee?: number;
    type: string;
    directionIndicator: string;
    additionalDetails?: Record<string, any>;
  }>;
};

type EnrichmentResponse = {
  transactions: Array<{
    externalTransactionId: string;
    postedTimestamp: string;
    transactionTimestamp: string;
    description: string;
    memo: string;
    amount: number;
    transactionFee: number;
    type: string;
    transactionCategory: string;
    transactionCategoryScore: number;
    transactionCategoryGroup: string;
    entities: Array<{
      id: string;
      name: string;
      website?: string;
      logoUrl?: string;
      entityStandardizationConfidenceScore: number;
    }>;
    address?: {
      line1: string;
      line2: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      latitude: number;
      longitude: number;
    };
    additionalDetails?: Record<string, any>;
    externalCustomerId: string;
    externalAccountId: string;
    accountType: string;
    directionIndicator: string;
  }>;
};

// Get Finicity partner token for API calls
async function fetchPartnerToken(): Promise<string> {
  const partnerId = Deno.env.get("OPEN_BANKING_PARTNER_ID");
  const partnerSecret = Deno.env.get("OPEN_BANKING_PARTNER_SECRET");
  
  if (!partnerId || !partnerSecret || !appKey) {
    throw new Error("Missing required Open Banking env vars");
  }

  const url = `${baseUrl}/aggregation/v2/partners/authentication`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Finicity-App-Key": appKey,
      "User-Agent": "TaxOS/1.0 (+preview.trytaxos.com)",
    },
    body: JSON.stringify({ partnerId, partnerSecret }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Partner auth failed: ${res.status} ${res.statusText} - ${text}`);
  }

  const json = await res.json() as { token: string };
  if (!json?.token) throw new Error("Partner auth ok but missing token");
  return json.token;
}

// Enrich transactions using Mastercard Data Enrichment API
async function enrichTransactions(transactions: any[]): Promise<EnrichmentResponse> {
  try {
    console.log(`Enriching ${transactions.length} transactions with Data Enrichment API`);
    
    const token = await fetchPartnerToken();
    console.log('Successfully obtained Finicity partner token');
    
    const url = `${baseUrl}/data-enrichment/transactions`;
    
    // Transform our transaction data to match Data Enrichment API format
    const enrichmentRequest: EnrichmentRequest = {
      transactions: transactions.map(tx => ({
        externalCustomerId: tx.customerId || tx.client_id || "default",
        externalAccountId: tx.accountId || tx.account_id || "default",
        accountType: tx.accountType || "checking",
        externalTransactionId: tx.id || tx.tx_id_ext || `tx_${Date.now()}`,
        postedTimestamp: tx.postedDate || tx.date_posted || new Date().toISOString(),
        transactionTimestamp: tx.transactionDate || tx.date_posted || new Date().toISOString(),
        description: tx.description || tx.raw_description || "",
        memo: tx.memo || "",
        amount: tx.amount || 0,
        transactionFee: 0,
        type: tx.type || "DEBIT",
        directionIndicator: tx.amount > 0 ? "Credit" : "Debit",
        additionalDetails: {}
      }))
    };

    console.log('Sending enrichment request:', JSON.stringify(enrichmentRequest, null, 2));

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Finicity-App-Token": token,
        "Finicity-App-Key": appKey,
        "User-Agent": "TaxOS/1.0 (+preview.trytaxos.com)",
      },
      body: JSON.stringify(enrichmentRequest),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Data Enrichment API error: ${res.status} ${res.statusText} - ${text}`);
      throw new Error(`Data Enrichment API failed: ${res.status} ${res.statusText} - ${text}`);
    }

    const enrichmentData = await res.json() as EnrichmentResponse;
    console.log(`Successfully enriched ${enrichmentData.transactions.length} transactions`);
    
    return enrichmentData;
  } catch (error) {
    console.error('Error enriching transactions:', error);
    throw error;
  }
}

// Update transactions in database with enriched data
async function updateTransactionsWithEnrichment(
  transactions: any[], 
  enrichmentData: EnrichmentResponse
): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;

  for (const tx of transactions) {
    try {
      // Find matching enriched transaction
      const enrichedTx = enrichmentData.transactions.find(
        et => et.externalTransactionId === tx.id || et.externalTransactionId === tx.tx_id_ext
      );

      if (!enrichedTx) {
        console.warn(`No enrichment data found for transaction ${tx.id}`);
        continue;
      }

      // Prepare update data
      const updateData = {
        // Enhanced categorization
        category_suggested: enrichedTx.transactionCategory || null,
        category_group: enrichedTx.transactionCategoryGroup || null,
        category_confidence: enrichedTx.transactionCategoryScore ? enrichedTx.transactionCategoryScore / 100 : null, // Convert 0-100 to 0-1
        
        // Enhanced merchant data - safely access entities array
        normalized_merchant: (enrichedTx.entities && enrichedTx.entities.length > 0 && enrichedTx.entities[0]?.name) || tx.normalized_merchant || null,
        merchant_entity_id: (enrichedTx.entities && enrichedTx.entities.length > 0 && enrichedTx.entities[0]?.id) || null,
        merchant_website: (enrichedTx.entities && enrichedTx.entities.length > 0 && enrichedTx.entities[0]?.website) || null,
        merchant_logo: (enrichedTx.entities && enrichedTx.entities.length > 0 && enrichedTx.entities[0]?.logoUrl) || null,
        merchant_confidence: (enrichedTx.entities && enrichedTx.entities.length > 0 && enrichedTx.entities[0]?.entityStandardizationConfidenceScore) ? enrichedTx.entities[0].entityStandardizationConfidenceScore / 100 : null,
        
        // Enhanced location data - safely access address
        merchant_city: enrichedTx.address?.city || null,
        merchant_state: enrichedTx.address?.state || null,
        merchant_coordinates: (enrichedTx.address?.latitude && enrichedTx.address?.longitude) 
          ? `${enrichedTx.address.latitude},${enrichedTx.address.longitude}` 
          : null,
        
        // Metadata
        enrichment_source: 'mastercard_data_enrichment',
        enrichment_timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Update the transaction
      const { error: updateError } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', tx.id);

      if (updateError) {
        console.error(`Error updating transaction ${tx.id}:`, updateError);
        errors++;
      } else {
        console.log(`Successfully updated transaction ${tx.id} with enrichment data`);
        updated++;
      }

    } catch (error) {
      console.error(`Error processing transaction ${tx.id}:`, error);
      errors++;
    }
  }

  return { updated, errors };
}

// Main handler for enriching transactions
async function handleEnrichTransactions(transactionIds: string[]) {
  try {
    console.log(`Starting enrichment for ${transactionIds.length} transactions`);

    // Fetch transactions from database
    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .in('id', transactionIds);

    if (fetchError) {
      throw new Error(`Database fetch error: ${fetchError.message}`);
    }

    if (!transactions || transactions.length === 0) {
      throw new Error('No transactions found for enrichment');
    }

    console.log(`Found ${transactions.length} transactions to enrich`);

    // Enrich transactions using Data Enrichment API
    const enrichmentData = await enrichTransactions(transactions);

    // Update transactions with enriched data
    const { updated, errors } = await updateTransactionsWithEnrichment(transactions, enrichmentData);

    return {
      success: true,
      message: `Successfully enriched ${updated} transactions with ${errors} errors`,
      updated,
      errors,
      enrichmentData
    };

  } catch (error) {
    console.error('Error in handleEnrichTransactions:', error);
    return {
      success: false,
      error: error.message,
      updated: 0,
      errors: 0
    };
  }
}

// Serve the Edge Function
serve(async (req) => {
  console.log('🚀 Data enrichment function called');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight handled');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('📥 Request body:', JSON.stringify(body, null, 2));
    
    const { action, transactionIds } = body;

    switch (action) {
      case 'enrich_transactions':
        if (!transactionIds || !Array.isArray(transactionIds)) {
          console.error('❌ Invalid transactionIds:', transactionIds);
          return new Response(
            JSON.stringify({ success: false, error: 'transactionIds array required' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        console.log(`🔄 Processing ${transactionIds.length} transactions for enrichment`);
        const result = await handleEnrichTransactions(transactionIds);
        console.log('✅ Enrichment result:', JSON.stringify(result, null, 2));
        
        return new Response(
          JSON.stringify(result),
          { 
            status: result.success ? 200 : 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );

      default:
        console.error('❌ Invalid action:', action);
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

  } catch (error) {
    console.error('💥 Edge Function error:', error);
    console.error('💥 Error stack:', error.stack);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
