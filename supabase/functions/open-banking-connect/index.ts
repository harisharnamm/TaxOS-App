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

const port = parseInt(Deno.env.get("PORT") ?? "8002");

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

    const baseUrl = Deno.env.get("OPEN_BANKING_BASE_URL")?.replace(/\/$/, "") || "https://api.finicity.com";
    const partnerId = Deno.env.get("OPEN_BANKING_PARTNER_ID");
    const appKey = Deno.env.get("OPEN_BANKING_APP_KEY");
    const redirectUri = Deno.env.get("OPEN_BANKING_REDIRECT_URI");
    const webhookUrl = Deno.env.get("OPEN_BANKING_WEBHOOK_URL");
    const emailFrom = Deno.env.get("OPEN_BANKING_EMAIL_FROM") || "banking@trytaxos.com";

    if (!partnerId || !appKey || !redirectUri || !webhookUrl) {
      return new Response(JSON.stringify({
        error: "Missing required env (OPEN_BANKING_PARTNER_ID, OPEN_BANKING_APP_KEY, OPEN_BANKING_REDIRECT_URI, OPEN_BANKING_WEBHOOK_URL)",
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const finicityCustomerId: string = body?.customerId;
    const emailTo: string = body?.emailTo;
    const firstName: string = body?.firstName || "Client";
    const institutionName: string = body?.institutionName || "Your CPA";
    const institutionAddress: string = body?.institutionAddress || "";
    const singleUseUrl: boolean = body?.singleUseUrl ?? true;

    if (!finicityCustomerId || !emailTo) {
      return new Response(JSON.stringify({ error: "Missing customerId or emailTo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await fetchPartnerToken();
    const url = `${baseUrl}/connect/v2/send/email`;

    const payload = {
      language: "en",
      partnerId,
      customerId: finicityCustomerId,
      redirectUri,
      webhook: webhookUrl,
      webhookContentType: "application/json",
      email: {
        to: emailTo,
        from: emailFrom,
        supportPhone: body?.supportPhone || undefined,
        subject: body?.subject || "Please link your bank account",
        firstName,
        institutionName,
        institutionAddress,
        signature: body?.signature || undefined,
      },
      singleUseUrl,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Finicity-App-Key": appKey,
        "Finicity-App-Token": token,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: "Send Connect email failed", details: text }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    return new Response(JSON.stringify({ sent: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("open-banking-connect error", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}, { port });


