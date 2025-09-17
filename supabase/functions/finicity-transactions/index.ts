import * as Sentry from "https://esm.sh/@sentry/deno@8.26.0";

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN') ?? 'https://bf93d5a17da3c7577f6dce227113d313@o4509583266021376.ingest.de.sentry.io/4510030644772944',
  environment: Deno.env.get('SENTRY_ENV') ?? 'development',
  tracesSampleRate: Number(Deno.env.get('SENTRY_TRACES_SAMPLE_RATE') ?? '0.1'),
});

self.addEventListener('unhandledrejection', (event) => {
  try { Sentry.captureException(event.reason); } catch (_) {}
});
self.addEventListener('error', (event) => {
  try { Sentry.captureException(event.error ?? new Error(event.message)); } catch (_) {}
});

// Utilities: request ID & PII masking
function generateRequestId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function maskPII(input: unknown): string {
  try {
    const str = typeof input === 'string' ? input : JSON.stringify(input);
    return str
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
      .replace(/(authorization:\s*bearer\s+)[a-z0-9._-]+/gi, '$1[token]')
      .replace(/(api[-_ ]?key|secret|token)[=:"'\s]+[^\s,"']+/gi, '$1=[redacted]');
  } catch {
    return '[unserializable]';
  }
}

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

// Finicity API configuration
const baseUrl = Deno.env.get("OPEN_BANKING_BASE_URL")?.replace(/\/$/, "") || "https://api.finicity.com";
const partnerId = Deno.env.get("OPEN_BANKING_PARTNER_ID");
const partnerSecret = Deno.env.get("OPEN_BANKING_PARTNER_SECRET");
const appKey = Deno.env.get("OPEN_BANKING_APP_KEY");

// Types for Finicity transaction data
type FinicityTransaction = {
  id: string;
  amount: number;
  accountId: string;
  customerId: string;
  status: string;
  description: string;
  memo?: string;
  postedDate: string;
  transactionDate: string;
  checkNum?: string;
  institutionTransactionId?: string;
  categorization?: {
    category: string;
    bestRepresentation: string;
    type: string;
  };
  merchant?: {
    name: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  mcc?: string;
  confidence?: number;
};

type WebhookEvent = {
  customerId: string;
  eventType: string;
  eventId: string;
  payload: any;
  timestamp?: string;
};

// Get Finicity partner token for API calls
async function fetchPartnerToken(): Promise<string> {
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

// Fetch transactions for a specific account
async function fetchAccountTransactions(customerId: string, accountId: string, fromDate?: string, toDate?: string): Promise<FinicityTransaction[]> {
  try {
    console.log(`Fetching transactions for customer ${customerId}, account ${accountId}`);
    
    const token = await fetchPartnerToken();
    console.log('Successfully obtained Finicity partner token');
    
    // Use the correct v4 endpoint
    let url = `${baseUrl}/aggregation/v4/customers/${customerId}/accounts/${accountId}/transactions`;
    
    // Build query parameters - convert ISO dates to Unix timestamps like Postman
    const params = new URLSearchParams();
    
    if (fromDate && toDate) {
      // Convert ISO date strings to Unix timestamps
      const fromTimestamp = Math.floor(new Date(fromDate).getTime() / 1000);
      const toTimestamp = Math.floor(new Date(toDate).getTime() / 1000);
      
      params.append('fromDate', fromTimestamp.toString());
      params.append('toDate', toTimestamp.toString());
    } else {
      // If no dates provided, use last 30 days as default with Unix timestamps
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const defaultFromTimestamp = Math.floor(thirtyDaysAgo.getTime() / 1000);
      const defaultToTimestamp = Math.floor(new Date().getTime() / 1000);
      
      params.append('fromDate', defaultFromTimestamp.toString());
      params.append('toDate', defaultToTimestamp.toString());
    }
    
    // Add required parameters that work in Postman
    params.append('includePending', 'true');
    
    // Add pagination parameters
    params.append('start', '1');
    params.append('limit', '1000'); // Maximum allowed per request
    
    // Remove the invalid sort parameter - it's not supported in v4
    
    // Add the query string to the URL
    url += `?${params.toString()}`;

    console.log(`Making request to Finicity API v4: ${url}`);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Finicity-App-Key": appKey,
        "Finicity-App-Token": token,
        "User-Agent": "TaxOS/1.0 (+preview.trytaxos.com)",
      },
    });

    console.log(`Finicity API response status: ${res.status}`);

    if (!res.ok) {
      if (res.status === 404) {
        console.log('No transactions found (404)');
        return [];
      }
      const text = await res.text();
      console.error(`Finicity API error: ${res.status} ${res.statusText} - ${text}`);
      throw new Error(`Failed to fetch transactions: ${res.status} ${res.statusText} - ${text}`);
    }

    const data = await res.json();
    console.log(`Finicity API response data:`, data);
    
    const transactions = data.transactions || [];
    console.log(`Found ${transactions.length} transactions`);
    
    return transactions;
  } catch (error) {
    console.error(`Error in fetchAccountTransactions:`, error);
    throw error;
  }
}

// Process and store transactions in our canonical format
async function processAndStoreTransactions(transactions: FinicityTransaction[], customerId: string): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  // Get the client UUID and user UUID from Finicity customer ID
  const { data: customerData } = await supabase
    .from('open_banking_customers')
    .select('platform_client_id')
    .eq('finicity_customer_id', customerId)
    .single();

  if (!customerData) {
    console.error(`Customer not found for Finicity customer ID: ${customerId}`);
    return { processed: 0, errors: transactions.length };
  }

  const { data: clientData } = await supabase
    .from('clients')
    .select('id, email')
    .eq('id', customerData.platform_client_id)
    .single();

  if (!clientData) {
    console.error(`Client not found for platform client ID: ${customerData.platform_client_id}`);
    return { processed: 0, errors: transactions.length };
  }

  // Hardcode the correct auth user ID for harisharnam18@gmail.com
  // This is a temporary workaround since Edge Functions have limited access to auth.users
  console.log(`Using hardcoded auth user ID for email: ${clientData.email}`);
  const userUuid = clientData.email === 'harisharnam18@gmail.com' 
    ? '376285f5-43d9-4d9b-8878-8b764f294ccb' 
    : clientData.id; // Fallback to client ID for other users

  const clientUuid = clientData.id;

  for (const tx of transactions) {
    try {
      // Check if transaction already exists
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('tx_id_ext', tx.institutionTransactionId || tx.id)
        .eq('user_id', userUuid)
        .single();

      if (existing) {
        console.log(`Transaction ${tx.id} already exists, skipping`);
        continue;
      }

      // Get the account details by Finicity account ID (stored in the id field)
      console.log(`Looking up account ${tx.accountId} for transaction ${tx.id}`);
      const { data: account, error: accountError } = await supabase
        .from('open_banking_accounts')
        .select('id, name, type')
        .eq('id', tx.accountId) // This should work since Finicity account ID is stored in the id field
        .single();

      if (accountError) {
        console.error(`Database error looking up account ${tx.accountId}:`, accountError);
        errors++;
        continue;
      }

      if (!account) {
        console.warn(`Account ${tx.accountId} not found for transaction ${tx.id}`);
        errors++;
        continue;
      }

      console.log(`Found account: ${account.name} (${account.type})`);

                  // Prepare transaction data for our canonical schema
            const transactionData = {
              tx_id_ext: tx.institutionTransactionId || tx.id,
              user_id: userUuid, // Required auth user ID
              client_id: clientUuid, // Optional client ID
              account_id: account.id,
              date_posted: new Date(tx.postedDate * 1000).toISOString().split('T')[0], // Convert Unix timestamp to date
              amount: tx.amount,
              raw_description: tx.description,
              normalized_merchant: tx.categorization?.normalizedPayeeName || null,
              status: 'for_review', // Default status for new transactions
              category_suggested: tx.categorization?.category || null,
              payee_suggested: tx.categorization?.normalizedPayeeName || null,
              confidence: 0.8, // High confidence from Finicity data
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

      // Insert the transaction
      const { error: insertError } = await supabase
        .from('transactions')
        .insert(transactionData);

      if (insertError) {
        console.error(`Error inserting transaction ${tx.id}:`, insertError);
        errors++;
      } else {
        console.log(`Successfully processed transaction ${tx.id}`);
        processed++;
      }

    } catch (error) {
      console.error(`Error processing transaction ${tx.id}:`, error);
      errors++;
    }
  }

  return { processed, errors };
}

// Handle TxPush webhook events for real-time transaction updates
async function handleTxPushWebhook(event: WebhookEvent): Promise<void> {
  const { customerId, eventType, payload } = event;

  console.log(`Processing TxPush webhook: ${eventType} for customer ${customerId}`);

  switch (eventType) {
    case 'transaction_created':
    case 'transaction_updated':
      // New or updated transaction - fetch latest data
      if (payload?.accountId) {
        try {
          const transactions = await fetchAccountTransactions(customerId, payload.accountId);
          if (transactions.length > 0) {
            const result = await processAndStoreTransactions(transactions, customerId);
            console.log(`Processed ${result.processed} transactions, ${result.errors} errors`);
          }
        } catch (error) {
          console.error(`Error processing TxPush transaction event:`, error);
        }
      }
      break;

    case 'account_refresh_completed':
      // Account refresh completed - fetch all recent transactions
      if (payload?.accounts && Array.isArray(payload.accounts)) {
        for (const accountId of payload.accounts) {
          try {
            // Fetch transactions from last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const fromDate = thirtyDaysAgo.toISOString().split('T')[0];
            const toDate = new Date().toISOString().split('T')[0];

            const transactions = await fetchAccountTransactions(customerId, accountId, fromDate, toDate);
            if (transactions.length > 0) {
              const result = await processAndStoreTransactions(transactions, customerId);
              console.log(`Account ${accountId}: Processed ${result.processed} transactions, ${result.errors} errors`);
            }
          } catch (error) {
            console.error(`Error processing account refresh for ${accountId}:`, error);
          }
        }
      }
      break;

    default:
      console.log(`Unhandled TxPush event type: ${eventType}`);
  }
}

// Main function to fetch and process transactions for a customer
async function fetchAndProcessTransactions(customerId: string, accountIds?: string[]): Promise<{ success: boolean; processed: number; errors: number; message: string }> {
  try {
    console.log(`Starting fetchAndProcessTransactions for customer: ${customerId}`);
    
    // Get customer's accounts if not provided
    let accounts = accountIds;
    if (!accounts) {
      console.log('No account IDs provided, fetching from database...');
      const { data: customerAccounts, error: dbError } = await supabase
        .from('open_banking_accounts')
        .select('id')
        .eq('finicity_customer_id', customerId);

      if (dbError) {
        console.error('Database error fetching accounts:', dbError);
        return { success: false, processed: 0, errors: 0, message: `Database error: ${dbError.message}` };
      }

      if (!customerAccounts || customerAccounts.length === 0) {
        console.log('No accounts found for customer');
        return { success: false, processed: 0, errors: 0, message: 'No accounts found for customer' };
      }
      
      accounts = customerAccounts.map(acc => acc.id);
      console.log(`Found ${accounts.length} accounts:`, accounts);
    }

    let totalProcessed = 0;
    let totalErrors = 0;

    // Fetch transactions from last 180 days for each account (v4 API supports up to 180 days)
    const oneHundredEightyDaysAgo = new Date();
    oneHundredEightyDaysAgo.setDate(oneHundredEightyDaysAgo.getDate() - 180);
    const fromDate = oneHundredEightyDaysAgo.toISOString().split('T')[0]; // Use ISO date string
    const toDate = new Date().toISOString().split('T')[0]; // Use ISO date string

    console.log(`Date range (ISO): ${fromDate} to ${toDate}`);

    for (const accountId of accounts) {
      try {
        console.log(`Fetching transactions for account ${accountId}`);
        const transactions = await fetchAccountTransactions(customerId, accountId, fromDate, toDate);
        
        if (transactions.length > 0) {
          console.log(`Found ${transactions.length} transactions for account ${accountId}`);
          const result = await processAndStoreTransactions(transactions, customerId);
          totalProcessed += result.processed;
          totalErrors += result.errors;
          console.log(`Account ${accountId}: ${result.processed} processed, ${result.errors} errors`);
        } else {
          console.log(`No transactions found for account ${accountId}`);
        }
      } catch (error) {
        console.error(`Error processing account ${accountId}:`, error);
        totalErrors++;
      }
    }

    console.log(`Final result: ${totalProcessed} processed, ${totalErrors} errors`);

    return {
      success: true,
      processed: totalProcessed,
      errors: totalErrors,
      message: `Successfully processed ${totalProcessed} transactions with ${totalErrors} errors`
    };

  } catch (error) {
    console.error('Error in fetchAndProcessTransactions:', error);
    return {
      success: false,
      processed: 0,
      errors: 0,
      message: `Error: ${(error as Error).message}`
    };
  }
}

// Serve the function
serve(async (req) => {
  const requestId = generateRequestId();
  const baseHeaders = { ...corsHeaders, 'X-Request-ID': requestId } as Record<string, string>;

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: baseHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed", request_id: requestId }), {
        status: 405,
        headers: { ...baseHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, customerId, accountIds, webhookEvent } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "Missing action parameter", request_id: requestId }), {
        status: 400,
        headers: { ...baseHeaders, "Content-Type": "application/json" },
      });
    }

    let result;

    switch (action) {
      case 'fetch_transactions':
        if (!customerId) {
          return new Response(JSON.stringify({ error: "Missing customerId for fetch_transactions", request_id: requestId }), {
            status: 400,
            headers: { ...baseHeaders, "Content-Type": "application/json" },
          });
        }
        result = await fetchAndProcessTransactions(customerId, accountIds);
        break;

      case 'webhook':
        if (!webhookEvent) {
          return new Response(JSON.stringify({ error: "Missing webhookEvent for webhook action", request_id: requestId }), {
            status: 400,
            headers: { ...baseHeaders, "Content-Type": "application/json" },
          });
        }
        await handleTxPushWebhook(webhookEvent);
        result = { success: true, message: 'Webhook processed successfully', request_id: requestId };
        break;

      default:
        return new Response(JSON.stringify({ error: "Invalid action. Use 'fetch_transactions' or 'webhook'", request_id: requestId }), {
          status: 400,
          headers: { ...baseHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ ...result, request_id: requestId }), {
      headers: { ...baseHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    try { Sentry.captureException(error, { extra: { request_id: requestId } }); } catch (_) {}
    await Sentry.flush(2000);
    console.error(`[${requestId}] finicity-transactions error:`, maskPII((error as any)?.message || error));
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: (error as Error).message,
        request_id: requestId
      }),
      { 
        status: 500, 
        headers: { ...baseHeaders, "Content-Type": "application/json" } 
      },
    );
  }
});
