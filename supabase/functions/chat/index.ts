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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { message, client_id, context_documents }: ChatRequest = await req.json()

    if (!message?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔄 Processing chat request for user:', user.id)

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
        contextMessage = `Client Context:
- Client: ${client.name}
- Entity Type: ${client.entity_type}
- Tax Year: ${client.tax_year}

User Question: ${message.trim()}`
      }
    }

    // Add document context if available
    if (context_documents && context_documents.length > 0) {
      const { data: documents } = await supabaseClient
        .from('documents')
        .select('original_filename, document_type, ocr_text, ai_summary, file_size, created_at')
        .in('id', context_documents)
        .limit(5) // Limit to avoid token overflow

      if (documents && documents.length > 0) {
        let docContext = '\n\nUploaded Documents for Analysis:'
        documents.forEach(doc => {
          docContext += `\n\n📄 Document: ${doc.original_filename}`
          docContext += `\n   Type: ${doc.document_type}`
          docContext += `\n   Size: ${(doc.file_size / 1024 / 1024).toFixed(2)} MB`
          docContext += `\n   Uploaded: ${new Date(doc.created_at).toLocaleDateString()}`
          
          if (doc.ai_summary) {
            docContext += `\n   AI Summary: ${doc.ai_summary}`
          }
          
          if (doc.ocr_text && doc.ocr_text.length > 0) {
            // Include OCR text for analysis, but limit length to avoid token overflow
            const ocrPreview = doc.ocr_text.length > 2000 
              ? doc.ocr_text.substring(0, 2000) + '...' 
              : doc.ocr_text;
            docContext += `\n   Extracted Text:\n${ocrPreview}`
          }
        })
        
        docContext += '\n\nPlease analyze these documents and provide insights about potential tax deductions, compliance issues, or other relevant tax implications.'
        contextMessage += docContext
      }
    }

    console.log('🤖 Creating thread and calling OpenAI Assistant...')

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
      console.error('❌ OpenAI Thread creation error:', errorData)
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
      body: JSON.stringify({
        role: 'user',
        content: contextMessage,
      }),
    })

    if (!messageResponse.ok) {
      const errorData = await messageResponse.text()
      console.error('❌ OpenAI Message creation error:', errorData)
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
      body: JSON.stringify({
        assistant_id: 'asst_HqIS3BqKjEPdNf27JbURKFMa',
      }),
    })

    if (!runResponse.ok) {
      const errorData = await runResponse.text()
      console.error('❌ OpenAI Run creation error:', errorData)
      throw new Error(`OpenAI Run API error: ${runResponse.status}`)
    }

    const runData = await runResponse.json()
    const runId = runData.id

    // Step 4: Poll for completion
    let runStatus = 'queued'
    let attempts = 0
    const maxAttempts = 30 // 30 seconds timeout

    while (runStatus !== 'completed' && runStatus !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
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
        console.log(`🔄 Run status: ${runStatus} (attempt ${attempts})`)
      }
    }

    if (runStatus !== 'completed') {
      throw new Error(`Assistant run failed or timed out. Status: ${runStatus}`)
    }

    // Step 5: Get the assistant's response
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'OpenAI-Beta': 'assistants=v2',
      },
    })

    if (!messagesResponse.ok) {
      const errorData = await messagesResponse.text()
      console.error('❌ OpenAI Messages retrieval error:', errorData)
      throw new Error(`OpenAI Messages API error: ${messagesResponse.status}`)
    }

    const messagesData = await messagesResponse.json()
    const assistantMessages = messagesData.data.filter((msg: any) => msg.role === 'assistant')
    
    if (assistantMessages.length === 0) {
      throw new Error('No response from assistant')
    }

    // Get the latest assistant message
    const latestMessage = assistantMessages[0]
    const assistantMessage = latestMessage.content[0]?.text?.value

    if (!assistantMessage) {
      throw new Error('No text content in assistant response')
    }

    console.log('✅ Got response from OpenAI Assistant')

    // Save user message to database
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

    if (userMessageError) {
      console.error('❌ Error saving user message:', userMessageError)
    }

    // Save assistant message to database
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

    if (assistantMessageError) {
      console.error('❌ Error saving assistant message:', assistantMessageError)
    }

    console.log('✅ Chat messages saved to database')

    // Return the assistant's response
    return new Response(
      JSON.stringify({
        message: assistantMessage,
        assistant_id: 'asst_HqIS3BqKjEPdNf27JbURKFMa',
        thread_id: threadId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('❌ Chat function error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})