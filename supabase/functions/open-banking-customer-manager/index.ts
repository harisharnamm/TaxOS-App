import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get partner access token
async function fetchPartnerToken(): Promise<string> {
  const baseUrl = Deno.env.get("OPEN_BANKING_BASE_URL")?.replace(/\/$/, "") || "https://api.finicity.com";
  const partnerId = Deno.env.get("OPEN_BANKING_PARTNER_ID");
  const partnerSecret = Deno.env.get("OPEN_BANKING_PARTNER_SECRET");
  const appKey = Deno.env.get("OPEN_BANKING_APP_KEY");

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

// Create or get existing Finicity customer
async function getOrCreateCustomer(
  platformClientId: string,
  clientEmail: string,
  clientName: string
): Promise<string> {
  try {
    // Check if we already have a customer mapping
    const { data: existingCustomer } = await supabase
      .from("open_banking_customers")
      .select("finicity_customer_id")
      .eq("platform_client_id", platformClientId)
      .single();

    if (existingCustomer) {
      console.log(`Using existing Finicity customer: ${existingCustomer.finicity_customer_id}`);
      return existingCustomer.finicity_customer_id;
    }

    // Create new testing customer in Finicity
    const token = await fetchPartnerToken();
    const baseUrl = Deno.env.get("OPEN_BANKING_BASE_URL")?.replace(/\/$/, "") || "https://api.finicity.com";
    
    // Create compliant username: alphanumeric only, no special chars
    const cleanName = clientName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const timestamp = Date.now();
    const username = `${cleanName}${timestamp}`;
    
    const url = `${baseUrl}/aggregation/v2/customers/testing`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Finicity-App-Key": Deno.env.get("OPEN_BANKING_APP_KEY")!,
        "Finicity-App-Token": token,
        "User-Agent": "TaxOS/1.0 (+preview.trytaxos.com)",
      },
      body: JSON.stringify({
        username: username
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Create customer failed: ${res.status} ${res.statusText} - ${text}`);
    }

    const customerData = await res.json() as { id: string; username: string; createdDate: number };
    const finicityCustomerId = customerData.id;

    // Store the customer mapping
    const { error: insertError } = await supabase
      .from("open_banking_customers")
      .insert({
        platform_client_id: platformClientId,
        finicity_customer_id: finicityCustomerId,
      });

    if (insertError) {
      console.error("Failed to store customer mapping:", insertError);
      throw insertError;
    }

    console.log(`Created new Finicity customer: ${finicityCustomerId} for platform client: ${platformClientId}`);
    return finicityCustomerId;

  } catch (error) {
    console.error("Error in getOrCreateCustomer:", error);
    throw error;
  }
}

// Send bank authentication email
async function sendBankAuthEmail(
  finicityCustomerId: string,
  clientEmail: string,
  clientName: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const token = await fetchPartnerToken();
    const baseUrl = Deno.env.get("OPEN_BANKING_BASE_URL")?.replace(/\/$/, "") || "https://api.finicity.com";
    const redirectUri = Deno.env.get("OPEN_BANKING_REDIRECT_URI");
    const webhookUrl = Deno.env.get("OPEN_BANKING_WEBHOOK_URL");

    if (!redirectUri || !webhookUrl) {
      throw new Error("Missing redirect URI or webhook URL configuration");
    }

    const url = `${baseUrl}/connect/v2/send/email`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Finicity-App-Key": Deno.env.get("OPEN_BANKING_APP_KEY")!,
        "Finicity-App-Token": token,
        "User-Agent": "TaxOS/1.0 (+preview.trytaxos.com)",
      },
      body: JSON.stringify({
        partnerId: Deno.env.get("OPEN_BANKING_PARTNER_ID"),
        customerId: finicityCustomerId,
        language: "en",
        redirectUri,
        webhook: webhookUrl,
        webhookContentType: "application/json",
        email: {
          to: clientEmail,
          subject: "Please link your bank account to TaxOS",
          firstName: clientName.split(" ")[0] || "Client",
          institutionName: "TaxOS",
          institutionAddress: "United States",
          supportPhone: "800-555-5555",
          signature: [
            "TaxOS Team",
            "Certified Public Accountants",
            "Direct: 800-555-5555"
          ]
        },
        singleUseUrl: true
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Send email failed: ${res.status} ${res.statusText} - ${text}`);
    }

    const data = await res.json();
    return { success: true, data };

  } catch (error) {
    console.error("Error sending bank auth email:", error);
    return { success: false, error: (error as Error).message };
  }
}

// Main handler
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

    const body = await req.json();
    const { action, platformClientId, clientEmail, clientName } = body;

    if (!action || !platformClientId || !clientEmail || !clientName) {
      return new Response(JSON.stringify({ 
        error: "Missing required fields: action, platformClientId, clientEmail, clientName" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: unknown;

    switch (action) {
      case "send_bank_auth_email":
        // Get or create customer, then send email
        const finicityCustomerId = await getOrCreateCustomer(platformClientId, clientEmail, clientName);
        const emailResult = await sendBankAuthEmail(finicityCustomerId, clientEmail, clientName);
        
        if (emailResult.success) {
          result = {
            success: true,
            finicityCustomerId,
            message: "Bank authentication email sent successfully",
            data: emailResult.data
          };
        } else {
          throw new Error(emailResult.error || "Failed to send bank auth email");
        }
        break;

      case "get_customer_status":
        // Get customer status and linked accounts info
        const { data: customer } = await supabase
          .from("open_banking_customers")
          .select("finicity_customer_id, created_at, status, updated_at")
          .eq("platform_client_id", platformClientId)
          .single();

        if (!customer) {
          result = { status: "not_linked", message: "No Open Banking customer found" };
        } else {
          // Get the actual accounts from the accounts table
          const { data: accounts, error: accountsError } = await supabase
            .from("open_banking_accounts")
            .select("id, name, type, balance, currency, status")
            .eq("finicity_customer_id", customer.finicity_customer_id)
            .eq("status", "active");

          if (accountsError) {
            console.error("Error fetching accounts:", accountsError);
          }

          // Use the status from the database (updated by webhooks)
          const status = customer.status || "pending";
          
          result = {
            status: status,
            finicityCustomerId: customer.finicity_customer_id,
            linkedAt: customer.updated_at || customer.created_at,
            accountCount: accounts?.length || 0,
            accounts: accounts || []
          };
        }
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Customer manager error:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error", 
      details: (error as Error).message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
