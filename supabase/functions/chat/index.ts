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

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ChatRequest {
  message: string
  client_id?: string
  context_documents?: string[]
}

serve(async (req) => {
  const requestId = generateRequestId();
  const baseHeaders = { ...corsHeaders, 'X-Request-ID': requestId } as Record<string, string>;

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: baseHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', request_id: requestId }),
        { status: 401, headers: { ...baseHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { message, client_id, context_documents }: ChatRequest = await req.json()

    if (!message?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Message is required', request_id: requestId }),
        { status: 400, headers: { ...baseHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[${requestId}] Processing chat request for user:`, maskPII(user.id))

    // Build context message for the assistant
    let contextMessage = message.trim()

    // Add client context if available
    if (client_id) {
      const { data: client } = await supabaseClient
        .from('clients')
        .select('name, entity_type, tax_year')
        .eq('id', client_id)
        .single()

      if (client) {
        contextMessage = `Client Context:\n- Client: ${client.name}\n- Entity Type: ${client.entity_type}\n- Tax Year: ${client.tax_year}\n\nUser Question: ${message.trim()}`
      }
    }

    // Add document context if available
    if (context_documents && context_documents.length > 0) {
      const { data: documents } = await supabaseClient
        .from('documents')
        .select('original_filename, document_type, ocr_text, ai_summary, file_size, created_at')
        .in('id', context_documents)
        .limit(5)

      if (documents && documents.length > 0) {
        let docContext = '\n\nUploaded Documents for Analysis:'
        documents.forEach(doc => {
          docContext += `\n\n📄 Document: ${doc.original_filename}`
          docContext += `\n   Type: ${doc.document_type}`
          docContext += `\n   Size: ${(doc.file_size / 1024 / 1024).toFixed(2)} MB`
          docContext += `\n   Uploaded: ${new Date(doc.created_at).toLocaleDateString()}`
          if (doc.ai_summary) docContext += `\n   AI Summary: ${doc.ai_summary}`
          if (doc.ocr_text && doc.ocr_text.length > 0) {
            const ocrPreview = doc.ocr_text.length > 2000 ? doc.ocr_text.substring(0, 2000) + '...' : doc.ocr_text;
            docContext += `\n   Extracted Text:\n${ocrPreview}`
          }
        })
        contextMessage += docContext
      }
    }

    console.log(`[${requestId}] Creating OpenAI thread...`)

    // Step 1: Create a thread
    const threadResponse = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({}),
    })

    if (!threadResponse.ok) {
      const errorData = await threadResponse.text()
      console.error(`[${requestId}] OpenAI Thread creation error:`, maskPII(errorData))
      throw new Error(`OpenAI Thread API error: ${threadResponse.status}`)
    }

    const threadData = await threadResponse.json()
    const threadId = threadData.id

    // Step 2: Add message to thread
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({ role: 'user', content: contextMessage }),
    })

    if (!messageResponse.ok) {
      const errorData = await messageResponse.text()
      console.error(`[${requestId}] OpenAI Message creation error:`, maskPII(errorData))
      throw new Error(`OpenAI Message API error: ${messageResponse.status}`)
    }

    // Step 3: Run the assistant
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({ assistant_id: 'asst_HqIS3BqKjEPdNf27JbURKFMa' }),
    })

    if (!runResponse.ok) {
      const errorData = await runResponse.text()
      console.error(`[${requestId}] OpenAI Run creation error:`, maskPII(errorData))
      throw new Error(`OpenAI Run API error: ${runResponse.status}`)
    }

    const runData = await runResponse.json()
    const runId = runData.id

    // Step 4: Poll for completion
    let runStatus = 'queued'
    let attempts = 0
    const maxAttempts = 30

    while (runStatus !== 'completed' && runStatus !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      attempts++

      const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      })

      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        runStatus = statusData.status
        console.log(`[${requestId}] Run status: ${runStatus} (attempt ${attempts})`)
      }
    }

    if (runStatus !== 'completed') {
      throw new Error(`Assistant run failed or timed out. Status: ${runStatus}`)
    }

    // Step 5: Get response
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'OpenAI-Beta': 'assistants=v2',
      },
    })

    if (!messagesResponse.ok) {
      const errorData = await messagesResponse.text()
      console.error(`[${requestId}] OpenAI Messages retrieval error:`, maskPII(errorData))
      throw new Error(`OpenAI Messages API error: ${messagesResponse.status}`)
    }

    const messagesData = await messagesResponse.json()
    const assistantMessages = messagesData.data.filter((msg: any) => msg.role === 'assistant')
    if (assistantMessages.length === 0) throw new Error('No response from assistant')
    const latestMessage = assistantMessages[0]
    const assistantMessage = latestMessage.content[0]?.text?.value
    if (!assistantMessage) throw new Error('No text content in assistant response')

    console.log(`[${requestId}] Got response from OpenAI Assistant`)

    // Save messages
    const { error: userMessageError } = await supabaseClient
      .from('chat_messages')
      .insert({
        user_id: user.id,
        client_id: client_id || null,
        role: 'user',
        content: message,
        context_documents: context_documents || null,
        ai_model: 'asst_HqIS3BqKjEPdNf27JbURKFMa',
      })
    if (userMessageError) console.error(`[${requestId}] Error saving user message:`, maskPII(userMessageError))

    const { error: assistantMessageError } = await supabaseClient
      .from('chat_messages')
      .insert({
        user_id: user.id,
        client_id: client_id || null,
        role: 'assistant',
        content: assistantMessage,
        context_documents: context_documents || null,
        ai_model: 'asst_HqIS3BqKjEPdNf27JbURKFMa',
      })
    if (assistantMessageError) console.error(`[${requestId}] Error saving assistant message:`, maskPII(assistantMessageError))

    // Return the assistant's response
    return new Response(
      JSON.stringify({ message: assistantMessage, request_id: requestId }),
      { headers: { ...baseHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    try { Sentry.captureException(error, { extra: { request_id: requestId } }); } catch (_) {}
    await Sentry.flush(2000);
    console.error(`[${requestId}] Chat function error:`, maskPII((error as any)?.message || error))
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', request_id: requestId }),
      {
        status: 500,
        headers: { ...baseHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})