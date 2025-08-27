import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PartnerAuthResponse = { token: string };

async function fetchPartnerToken(): Promise<string> {
  const baseUrl = Deno.env.get("OPEN_BANKING_BASE_URL")?.replace(/\/$/, "") || "https://api.finicity.com";
  const partnerId = Deno.env.get("OPEN_BANKING_PARTNER_ID");
  const partnerSecret = Deno.env.get("OPEN_BANKING_PARTNER_SECRET");
  const appKey = Deno.env.get("OPEN_BANKING_APP_KEY");

  if (!partnerId || !partnerSecret || !appKey) {
    throw new Error("Missing required Open Banking env vars (OPEN_BANKING_PARTNER_ID, OPEN_BANKING_PARTNER_SECRET, OPEN_BANKING_APP_KEY)");
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
  const json = (await res.json()) as PartnerAuthResponse;
  if (!json?.token) throw new Error("Partner auth ok but missing token");
  return json.token;
}

async function getCustomerAccounts(finicityCustomerId: string): Promise<any> {
  const baseUrl = Deno.env.get("OPEN_BANKING_BASE_URL")?.replace(/\/$/, "") || "https://api.finicity.com";
  const appKey = Deno.env.get("OPEN_BANKING_APP_KEY");
  
  if (!appKey) {
    throw new Error("Missing OPEN_BANKING_APP_KEY");
  }

  const token = await fetchPartnerToken();
  const url = `${baseUrl}/aggregation/v1/customers/${finicityCustomerId}/accounts`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Finicity-App-Key": appKey,
      "Finicity-App-Token": token,
      "User-Agent": "TaxOS/1.0 (+preview.trytaxos.com)",
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      // No accounts found yet
      return { accounts: [] };
    }
    const text = await res.text();
    throw new Error(`Failed to fetch accounts: ${res.status} ${res.statusText} - ${text}`);
  }

  const data = await res.json();
  return data;
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

    const body = await req.json();
    const finicityCustomerId: string = body?.finicityCustomerId;

    if (!finicityCustomerId) {
      return new Response(JSON.stringify({ error: "Missing finicityCustomerId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const accountsData = await getCustomerAccounts(finicityCustomerId);
      
      return new Response(JSON.stringify({
        success: true,
        finicityCustomerId,
        accounts: accountsData.accounts || [],
        accountCount: (accountsData.accounts || []).length,
        hasAccounts: (accountsData.accounts || []).length > 0,
        status: (accountsData.accounts || []).length > 0 ? 'linked' : 'pending'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching customer accounts:", error);
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to fetch customer accounts",
        details: (error as Error).message,
        finicityCustomerId,
        accounts: [],
        accountCount: 0,
        hasAccounts: false,
        status: 'pending'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("open-banking-accounts error", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
