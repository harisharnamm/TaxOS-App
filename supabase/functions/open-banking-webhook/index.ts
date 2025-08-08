import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Note: Mastercard docs specify SHA256withECDSA with a public key. In Deno, use crypto.subtle with ECDSA P-256.
async function verifySignature(body: string, headers: Headers): Promise<boolean> {
  try {
    const signature = headers.get("x-mastercard-signature");
    const timestamp = headers.get("x-mastercard-signature-timestamp");
    const algorithm = headers.get("x-mastercard-signature-algorithm");
    if (!signature || !timestamp) return false;
    if (algorithm && algorithm !== "SHA256withECDSA") return false;

    const publicKeyPem = Deno.env.get("OPEN_BANKING_WEBHOOK_PUBLIC_KEY");
    if (!publicKeyPem) return false;

    const data = new TextEncoder().encode(`${body}.${timestamp}`);

    // Import ECDSA public key from PEM
    const pem = publicKeyPem.replace(/-----BEGIN PUBLIC KEY-----/g, "").replace(/-----END PUBLIC KEY-----/g, "").replace(/\s+/g, "");
    const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      "spki",
      der,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );

    const sigBytes = Uint8Array.from(Buffer.from(signature, "hex"));
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      key,
      sigBytes,
      data,
    );
    return ok;
  } catch (_e) {
    return false;
  }
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

    const rawBody = await req.text();

    // Immediately acknowledge to avoid retries under load
    const ack = new Response(null, { status: 202, headers: corsHeaders });

    // Verify signature (best-effort; processing can be async via queue if needed)
    const verified = await verifySignature(rawBody, req.headers);
    if (!verified) {
      // Optionally return 202 still, and mark unverified internally
      console.warn("Webhook signature verification failed");
    }

    // TODO: Persist event with idempotency on X-Mastercard-Webhook-Message-Id
    // For now, log safely
    console.log("OB webhook received", {
      verified,
      messageId: req.headers.get("x-mastercard-webhook-message-id"),
      eventType: (() => {
        try { const j = JSON.parse(rawBody); return j?.eventType; } catch { return undefined; }
      })(),
    });

    return ack;
  } catch (error) {
    console.error("open-banking-webhook error", error);
    return new Response(null, { status: 202, headers: corsHeaders });
  }
});


