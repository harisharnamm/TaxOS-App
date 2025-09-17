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
      // mask emails
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
      // mask bearer tokens/keys
      .replace(/(authorization:\s*bearer\s+)[a-z0-9._-]+/gi, '$1[token]')
      .replace(/(api[-_ ]?key|secret|token)[=:"'\s]+[^\s,"']+/gi, '$1=[redacted]');
  } catch {
    return '[unserializable]';
  }
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const requestId = generateRequestId();
  const baseHeaders = { ...corsHeaders, 'X-Request-ID': requestId } as Record<string, string>;

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: baseHeaders })
  }

  try {
    const { document_id, ocr_text } = await req.json()

    if (!document_id || !ocr_text) {
      return new Response(
        JSON.stringify({ error: 'Missing document_id or ocr_text parameter', request_id: requestId }),
        { 
          status: 400, 
          headers: { ...baseHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`[${requestId}] Processing tax document:`, maskPII(document_id))

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const EDEN_AI_API_KEY = Deno.env.get('EDEN_AI_API_KEY')

    // Call Eden AI Text Summarization
    console.log(`[${requestId}] Calling Eden AI Text Summarization...`)
    const summarizeResponse = await fetch('https://api.edenai.run/v2/text/summarize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${EDEN_AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        providers: ['openai/gpt-4o-mini'],
        text: ocr_text,
        output_sentences: 1,
        response_as_dict: true
      }),
    })

    if (!summarizeResponse.ok) {
      const errorText = await summarizeResponse.text()
      console.error(`[${requestId}] Eden AI Summarization error:`, maskPII(errorText))
      throw new Error(`Eden AI Summarization failed: ${summarizeResponse.statusText}`)
    }

    const summarizeResult = await summarizeResponse.json()
    console.log(`[${requestId}] Tax document summarization result received`)

    // Update document with tax processing results in separate column
    const { error: updateError } = await supabaseClient
      .from('documents')
      .update({ 
        tax_processing_response: summarizeResult,
        processing_status: 'completed'
      })
      .eq('id', document_id)

    if (updateError) {
      console.error(`[${requestId}] Error updating document with tax data:`, maskPII(updateError))
    } else {
      console.log(`[${requestId}] Document updated with tax processing data.`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id: requestId,
        document_id: document_id,
        processed_data: summarizeResult,
      }),
      { 
        headers: { ...baseHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    try { Sentry.captureException(error, { extra: { request_id: requestId } }); } catch (_) {}
    await Sentry.flush(2000);
    console.error(`[${requestId}] Error in process-tax function:`, maskPII((error as any)?.message || error))
    return new Response(
      JSON.stringify({ error: 'Internal server error', request_id: requestId }),
      { 
        status: 500, 
        headers: { ...baseHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})