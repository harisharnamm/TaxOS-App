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

async function createTestCustomer(username: string, partnerToken: string) {
  const baseUrl = Deno.env.get("OPEN_BANKING_BASE_URL")?.replace(/\/$/, "") || "https://api.finicity.com";
  const appKey = Deno.env.get("OPEN_BANKING_APP_KEY");
  if (!appKey) throw new Error("Missing OPEN_BANKING_APP_KEY");

  const url = `${baseUrl}/aggregation/v2/customers/testing`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Finicity-App-Key": appKey,
      "Finicity-App-Token": partnerToken,
    },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create test customer failed: ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}

const port = parseInt(Deno.env.get("PORT") ?? "8001");

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

    const body = await req.json().catch(() => ({}));
    const username: string = body?.username || `taxos_test_${Date.now()}`;

    const token = await fetchPartnerToken();
    const customer = await createTestCustomer(username, token);

    return new Response(
      JSON.stringify({ customer, username }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("open-banking-customer error", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}, { port });


