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

// Utilities
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

// Simple HMAC-SHA256 verification compatible with Svix/Resend
async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signedPayload = `${timestamp}.${payload}`;
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return signature === expectedSignature;
  } catch {
    return false;
  }
}

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  const requestId = generateRequestId();
  const baseHeaders = { ...corsHeaders, 'X-Request-ID': requestId } as Record<string, string>;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: baseHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify webhook signature
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response(
        JSON.stringify({ error: 'Missing webhook headers', request_id: requestId }),
        { status: 400, headers: { ...baseHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = await req.text();
    const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')!;

    const isValid = await verifyWebhookSignature(payload, svixSignature, webhookSecret, svixTimestamp);
    if (!isValid) {
      console.error(`[${requestId}] Webhook signature verification failed`);
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature', request_id: requestId }),
        { status: 401, headers: { ...baseHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let event: any;
    try {
      event = JSON.parse(payload);
    } catch (err) {
      console.error(`[${requestId}] Invalid JSON in webhook body:`, maskPII(err));
      return new Response(
        JSON.stringify({ error: 'Invalid JSON', request_id: requestId }),
        { status: 400, headers: { ...baseHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${requestId}] Processing webhook event:`, maskPII(event.type), maskPII(event.data?.id));

    // Update email communication status
    const { data: communication, error: fetchError } = await supabase
      .from('email_communications')
      .select('*')
      .eq('resend_message_id', event.data.id)
      .single();

    if (fetchError || !communication) {
      console.log(`[${requestId}] No communication record for:`, maskPII(event.data?.id));
      return new Response(
        JSON.stringify({ success: true, message: 'No communication record found', request_id: requestId }),
        { headers: { ...baseHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let status = 'sent';
    let updateData: any = {};

    switch (event.type) {
      case 'email.delivered':
        status = 'delivered';
        break;
      case 'email.opened':
        status = 'opened';
        updateData.opened_at = new Date().toISOString();
        break;
      case 'email.clicked':
        status = 'clicked';
        updateData.clicked_at = new Date().toISOString();
        break;
      case 'email.bounced':
        status = 'bounced';
        updateData.bounced_at = new Date().toISOString();
        break;
      case 'email.complained':
        status = 'complained';
        break;
      default:
        console.log(`[${requestId}] Unhandled event type:`, maskPII(event.type));
        return new Response(
          JSON.stringify({ success: true, message: 'Event type not handled', request_id: requestId }),
          { headers: { ...baseHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const { error: updateError } = await supabase
      .from('email_communications')
      .update({ status, ...updateData, updated_at: new Date().toISOString() })
      .eq('id', communication.id);

    if (updateError) {
      console.error(`[${requestId}] Failed to update communication status:`, maskPII(updateError));
      return new Response(
        JSON.stringify({ error: 'Failed to update communication status', request_id: requestId }),
        { status: 500, headers: { ...baseHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${requestId}] Updated communication status:`, maskPII(communication.id), '->', status);

    return new Response(
      JSON.stringify({ success: true, request_id: requestId }),
      { headers: { ...baseHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    try { Sentry.captureException(error, { extra: { request_id: requestId } }); } catch (_) {}
    await Sentry.flush(2000);
    console.error(`[${requestId}] Webhook processing error:`, maskPII((error as any)?.message || error));
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed', request_id: requestId }),
      { status: 500, headers: { ...baseHeaders, 'Content-Type': 'application/json' } }
    );
  }
}); 