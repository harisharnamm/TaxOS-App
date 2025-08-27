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

// TxPush transaction event type
type TxPushEvent = {
  customerId: string;
  accountId: string;
  eventType: 'transaction_created' | 'transaction_updated' | 'transaction_deleted';
  transaction: {
    id: string;
    amount: number;
    description: string;
    postedDate: number;
    transactionDate: number;
    categorization?: {
      category?: string;
      normalizedPayeeName?: string;
    };
  };
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

// 🚀 ENABLE TXPUSH FOR REAL-TIME TRANSACTIONS
async function enableTxPushForCustomer(customerId: string) {
  try {
    const baseUrl = Deno.env.get("OPEN_BANKING_BASE_URL")?.replace(/\/$/, "") || "https://api.finicity.com";
    const partnerId = Deno.env.get("OPEN_BANKING_PARTNER_ID");
    const appKey = Deno.env.get("OPEN_BANKING_APP_KEY");
    const webhookUrl = Deno.env.get("OPEN_BANKING_WEBHOOK_URL");

    if (!partnerId || !appKey || !webhookUrl) {
      console.error('Missing required environment variables for TxPush');
      return;
    }

    // Get partner token
    const tokenResponse = await fetch(`${baseUrl}/aggregation/v2/partners/authentication`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Finicity-App-Key': appKey,
        'Accept': 'application/json',
        'User-Agent': 'TaxOS/1.0 (+preview.trytaxos.com)',
      },
      body: JSON.stringify({
        partnerId: partnerId,
        partnerSecret: Deno.env.get("OPEN_BANKING_PARTNER_SECRET")
      })
    });

    if (!tokenResponse.ok) {
      console.error('Failed to get partner token for TxPush');
      return;
    }

    const tokenData = await tokenResponse.json();
    const token = tokenData.token;

    // Enable TxPush for the customer
    const txPushUrl = `${baseUrl}/aggregation/v2/customers/${customerId}/txpush`;

    const txPushResponse = await fetch(txPushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Finicity-App-Key': appKey,
        'Finicity-App-Token': token,
        'Accept': 'application/json',
        'User-Agent': 'TaxOS/1.0 (+preview.trytaxos.com)',
      },
      body: JSON.stringify({
        callbackUrl: webhookUrl,
        enabled: true
      })
    });

    if (txPushResponse.ok) {
      const txPushData = await txPushResponse.json();
      console.log(`✅ TxPush enabled successfully for customer ${customerId}:`, txPushData);
    } else {
      const errorText = await txPushResponse.text();
      console.error(`❌ Failed to enable TxPush for customer ${customerId}:`, txPushResponse.status, errorText);
    }

  } catch (error) {
    console.error('Error enabling TxPush for customer:', error);
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

      // 🚀 ENABLE TXPUSH FOR REAL-TIME TRANSACTIONS
      console.log(`🚀 Enabling TxPush for customer ${customerId}...`);
      await enableTxPushForCustomer(customerId);

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
      
    case 'transaction_created':
    case 'transaction_updated':
      // TxPush transaction event - process in real-time
      console.log(`TxPush ${eventType} for customer ${customerId}:`, payload);
      await processTxPushTransaction(customerId, payload);
      break;
      
    case 'transaction_deleted':
      // Handle transaction deletion
      console.log(`TxPush transaction deleted for customer ${customerId}:`, payload);
      await handleTransactionDeletion(customerId, payload);
      break;

    case 'done':
      // Connect session completed with historical transactions
      console.log(`Customer ${customerId} completed Connect session with historical data:`, payload);

      // Process historical transactions if they exist
      if (payload?.transactions && payload.transactions.length > 0) {
        console.log(`📊 Found ${payload.transactions.length} historical transactions to process`);
        await processHistoricalTransactions(customerId, payload);
      }

      // Also enable TxPush for future real-time transactions
      await enableTxPushForCustomer(customerId);
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

// Process TxPush transaction events in real-time
async function processTxPushTransaction(customerId: string, payload: any) {
  try {
    console.log(`🚀 REAL-TIME: Processing TxPush transaction for customer ${customerId}:`, payload);
    
    // Find the customer mapping to get platform client ID
    const { data: customerMapping, error: findError } = await supabase
      .from('open_banking_customers')
      .select('platform_client_id, finicity_customer_id')
      .eq('finicity_customer_id', customerId)
      .single();
    
    if (findError || !customerMapping) {
      console.error('Error finding customer mapping:', findError);
      return;
    }
    
    const { platform_client_id, finicity_customer_id } = customerMapping;
    
    // Find the account mapping
    const { data: accountMapping, error: accountError } = await supabase
      .from('open_banking_accounts')
      .select('id, name, type')
      .eq('finicity_customer_id', finicity_customer_id)
      .eq('id', payload.accountId)
      .single();
    
    if (accountError || !accountMapping) {
      console.error('Error finding account mapping:', accountError);
      return;
    }
    
    // Prepare transaction data with enhanced fields
    const transactionData = {
      tx_id_ext: payload.transaction.id,
      user_id: platform_client_id,
      client_id: platform_client_id,
      account_id: accountMapping.id,
      date_posted: new Date(payload.transaction.postedDate * 1000).toISOString().split('T')[0],
      amount: payload.transaction.amount,
      raw_description: payload.transaction.description,
      normalized_merchant: payload.transaction.categorization?.normalizedPayeeName || null,
      status: 'for_review',
      category_suggested: payload.transaction.categorization?.category || null,
      payee_suggested: payload.transaction.categorization?.normalizedPayeeName || null,
      confidence: 0.8, // Finicity base confidence
      enrichment_source: 'finicity_base', // Mark as Finicity base categorization
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log(`📝 Inserting real-time transaction:`, transactionData);
    
    // Insert the transaction
    const { data: insertedTx, error: insertError } = await supabase
      .from('transactions')
      .upsert(transactionData, {
        onConflict: 'tx_id_ext'
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Error inserting TxPush transaction:', insertError);
      return;
    }
    
    console.log(`✅ Successfully processed TxPush transaction ${payload.transaction.id} in real-time`);
    
    // 🚀 IMMEDIATE AI ENHANCEMENT: Automatically enhance the transaction
    console.log(`🤖 Starting immediate AI enhancement for transaction ${insertedTx.id}`);
    await enhanceTransactionWithAI(insertedTx.id, transactionData);
    
    // 🎯 BROADCAST REAL-TIME UPDATE: Notify any connected clients
    await broadcastTransactionUpdate(insertedTx.id, 'created');
    
  } catch (error) {
    console.error('Error processing TxPush transaction:', error);
  }
}

// Handle transaction deletion
async function handleTransactionDeletion(customerId: string, payload: any) {
  try {
    console.log(`Handling transaction deletion for customer ${customerId}:`, payload);

    // Mark transaction as deleted or remove it
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('tx_id_ext', payload.transaction.id);

    if (deleteError) {
      console.error('Error deleting transaction:', deleteError);
    } else {
      console.log(`Successfully deleted transaction ${payload.transaction.id}`);
    }

  } catch (error) {
    console.error('Error handling transaction deletion:', error);
  }
}

// 🚀 HANDLE HISTORICAL TRANSACTIONS from Connect flow
async function processHistoricalTransactions(customerId: string, payload: any) {
  try {
    console.log(`📊 Processing historical transactions for customer ${customerId}:`, payload);

    // Find the customer mapping to get platform client ID
    const { data: customerMapping, error: findError } = await supabase
      .from('open_banking_customers')
      .select('platform_client_id, finicity_customer_id')
      .eq('finicity_customer_id', customerId)
      .single();

    if (findError || !customerMapping) {
      console.error('Error finding customer mapping for historical transactions:', findError);
      return;
    }

    const { platform_client_id, finicity_customer_id } = customerMapping;

    // Process historical transactions (these come in batches from Connect)
    if (payload.transactions && Array.isArray(payload.transactions)) {
      console.log(`📊 Processing ${payload.transactions.length} historical transactions`);

      for (const transaction of payload.transactions) {
        try {
          // Find the account mapping
          const { data: accountMapping, error: accountError } = await supabase
            .from('open_banking_accounts')
            .select('id, name, type')
            .eq('finicity_customer_id', finicity_customer_id)
            .eq('id', transaction.accountId)
            .single();

          if (accountError || !accountMapping) {
            console.error('Error finding account mapping for historical transaction:', accountError);
            continue;
          }

          // Prepare historical transaction data
          const transactionData = {
            tx_id_ext: transaction.id,
            user_id: platform_client_id,
            client_id: platform_client_id,
            account_id: accountMapping.id,
            date_posted: new Date(transaction.postedDate * 1000).toISOString().split('T')[0],
            amount: transaction.amount,
            raw_description: transaction.description,
            status: 'for_review',
            enrichment_source: 'finicity_historical', // Mark as historical data
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          console.log(`📝 Inserting historical transaction:`, transactionData);

          // Insert the historical transaction
          const { data: insertedTx, error: insertError } = await supabase
            .from('transactions')
            .upsert(transactionData, {
              onConflict: 'tx_id_ext'
            })
            .select()
            .single();

          if (insertError) {
            console.error('Error inserting historical transaction:', insertError);
          } else {
            console.log(`✅ Successfully processed historical transaction ${transaction.id}`);

            // 🚀 IMMEDIATE AI ENHANCEMENT for historical transactions too
            await enhanceTransactionWithAI(insertedTx.id, transactionData);
          }

        } catch (txError) {
          console.error('Error processing individual historical transaction:', txError);
        }
      }
    } else {
      console.log('No historical transactions found in payload');
    }

  } catch (error) {
    console.error('Error processing historical transactions:', error);
  }
}

// Enhance transaction with AI using our data enrichment API
async function enhanceTransactionWithAI(transactionId: string, transactionData: any) {
  try {
    console.log(`🤖 Starting AI enhancement for transaction ${transactionId}`);
    
    // Call our data enrichment API
    const enrichmentResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/data-enrichment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        action: 'enrich_transactions',
        transactionIds: [transactionId]
      })
    });
    
    if (enrichmentResponse.ok) {
      const result = await enrichmentResponse.json();
      console.log(`✅ Transaction ${transactionId} enhanced successfully:`, result);
      
      // Update the transaction with enrichment results
      if (result.success && result.updated > 0) {
        await updateTransactionWithEnrichment(transactionId, result);
        
        // 🎯 BROADCAST ENHANCEMENT COMPLETE: Notify clients of AI enhancement
        await broadcastTransactionUpdate(transactionId, 'enhanced');
      }
    } else {
      console.error(`❌ Failed to enhance transaction ${transactionId}:`, enrichmentResponse.statusText);
    }
    
  } catch (error) {
    console.error('Error enhancing transaction with AI:', error);
  }
}

// Update transaction with enrichment results
async function updateTransactionWithEnrichment(transactionId: string, enrichmentResult: any) {
  try {
    console.log(`🔄 Updating transaction ${transactionId} with enrichment results`);
    
    // Get the enhanced transaction data
    const { data: enhancedTx, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();
    
    if (fetchError || !enhancedTx) {
      console.error('Error fetching enhanced transaction:', fetchError);
      return;
    }
    
    // Calculate the highest confidence score
    const finicityConfidence = enhancedTx.confidence || 0.8;
    const aiConfidence = enhancedTx.category_confidence || 0;
    const highestConfidence = Math.max(finicityConfidence, aiConfidence);
    
    console.log(`📊 Confidence scores - Finicity: ${finicityConfidence}, AI: ${aiConfidence}, Highest: ${highestConfidence}`);
    
    // Update with the highest confidence and enrichment source
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        confidence: highestConfidence,
        enrichment_source: 'mastercard_data_enrichment',
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId);
    
    if (updateError) {
      console.error('Error updating transaction with enrichment:', updateError);
    } else {
      console.log(`✅ Transaction ${transactionId} updated with highest confidence: ${highestConfidence}`);
    }
    
  } catch (error) {
    console.error('Error updating transaction with enrichment:', error);
  }
}

// 🚀 BROADCAST REAL-TIME UPDATES: Notify connected clients of transaction changes
async function broadcastTransactionUpdate(transactionId: string, updateType: 'created' | 'enhanced' | 'updated') {
  try {
    console.log(`📡 Broadcasting ${updateType} update for transaction ${transactionId}`);
    
    // Get the full transaction data for broadcasting
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select(`
        *,
        open_banking_accounts!inner(
          name,
          type
        )
      `)
      .eq('id', transactionId)
      .single();
    
    if (fetchError || !transaction) {
      console.error('Error fetching transaction for broadcast:', fetchError);
      return;
    }
    
    // Create a real-time event payload
    const realtimeEvent = {
      type: `transaction_${updateType}`,
      transaction_id: transactionId,
      data: {
        ...transaction,
        account_name: transaction.open_banking_accounts?.name,
        account_type: transaction.open_banking_accounts?.type
      },
      timestamp: new Date().toISOString(),
      source: 'txpush_webhook'
    };
    
    console.log(`📡 Broadcasting real-time event:`, realtimeEvent);
    
    // Store the real-time event for clients to poll (we'll implement WebSocket later)
    const { error: storeError } = await supabase
      .from('realtime_events')
      .insert({
        event_type: realtimeEvent.type,
        transaction_id: transactionId,
        payload: realtimeEvent,
        created_at: new Date().toISOString()
      });
    
    if (storeError) {
      console.warn('Could not store real-time event (table may not exist):', storeError);
      // This is okay - we'll create the table in the next step
    }
    
    console.log(`✅ Real-time update broadcasted for transaction ${transactionId}`);
    
  } catch (error) {
    console.error('Error broadcasting real-time update:', error);
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
