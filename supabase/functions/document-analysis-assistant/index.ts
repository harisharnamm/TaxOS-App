import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface DocumentAnalysisRequest {
  document_id: string
  document_content: string
  document_type: string
  filename: string
  classification?: string
  secondary_classification?: string
  client_id?: string
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
    const { document_id, document_content, document_type, filename, classification, secondary_classification, client_id }: DocumentAnalysisRequest = await req.json()

    if (!document_id || !document_content) {
      return new Response(
        JSON.stringify({ error: 'Document ID and content are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔄 Processing document analysis for document:', document_id)

    // Get client context if available
    let clientContext = ''
    if (client_id) {
      const { data: client } = await supabaseClient
        .from('clients')
        .select('name, entity_type, tax_year')
        .eq('id', client_id)
        .single()

      if (client) {
        clientContext = `Client Context:
- Client: ${client.name}
- Entity Type: ${client.entity_type}
- Tax Year: ${client.tax_year}

`
      }
    }

    // Build the analysis prompt
    const analysisPrompt = `${clientContext}Please analyze the following ${document_type} document and provide a structured response in JSON format.

Document Details:
- Filename: ${filename}
- Type: ${document_type}
- Classification: ${classification || 'N/A'}
- Secondary Classification: ${secondary_classification || 'N/A'}

Document Content:${document_content}

Please provide your analysis in the following JSON structure:
{
  "document_summary": "A comprehensive summary of the document content, including key details like amounts, dates, parties involved, and purpose",
  "vendor_name": "Name of the vendor or counterparty if applicable",
  "transaction_date": "YYYY-MM-DD format if available",
  "total_amount": "Numeric amount if available",
  "line_items": [
    {
      "description": "Item description",
      "quantity": "Numeric quantity",
      "unit_price": "Numeric unit price",
      "amount": "Numeric line item amount"
    }
  ],
  "suggested_tax_category": "Suggested tax category for this document",
  "deduction_opportunities": [
    "List of potential deduction opportunities"
  ],
  "compliance_consideration": "Compliance considerations and requirements",
  "anomaly_flag": "Boolean indicating if there are any anomalies",
  "anomaly_reason": "Explanation of anomalies if any",
  "tax_implication": "Detailed tax implications",
  "scenario_prediction": {
    "estimated_tax_saving": "Numeric estimate of potential tax savings",
    "note": "Additional notes about the prediction"
  }
}

IMPORTANT: Return ONLY valid JSON. Do not include any additional text or explanations outside the JSON structure.`

    // Call OpenAI Assistant API directly
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    const ASSISTANT_ID = 'asst_IpqDfv3iOMDGhRjsNyAdd9uq'

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in environment variables')
    }

    console.log('🤖 Calling OpenAI Assistant for document analysis...')

    // Create a thread
    const threadResponse = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
    })

    if (!threadResponse.ok) {
      const errorText = await threadResponse.text()
      console.error('❌ Error creating thread:', errorText)
      throw new Error(`Failed to create thread: ${threadResponse.statusText}`)
    }

    const { id: threadId } = await threadResponse.json()
    console.log('✅ Thread created:', threadId)

    // Add message to thread
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        role: 'user',
        content: analysisPrompt,
      }),
    })

    if (!messageResponse.ok) {
      const errorText = await messageResponse.text()
      console.error('❌ Error adding message:', errorText)
      throw new Error(`Failed to add message: ${messageResponse.statusText}`)
    }

    console.log('✅ Message added to thread')

    // Run the assistant
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        assistant_id: ASSISTANT_ID,
      }),
    })

    if (!runResponse.ok) {
      const errorText = await runResponse.text()
      console.error('❌ Error creating run:', errorText)
      throw new Error(`Failed to create run: ${runResponse.statusText}`)
    }

    const { id: runId } = await runResponse.json()
    console.log('✅ Run created:', runId)

    // Poll for completion
    let runStatus = 'queued'
    let attempts = 0
    const maxAttempts = 30 // 30 seconds timeout

    while (runStatus !== 'completed' && runStatus !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second

      const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      })

      if (!statusResponse.ok) {
        throw new Error(`Failed to check run status: ${statusResponse.statusText}`)
      }

      const runData = await statusResponse.json()
      runStatus = runData.status
      attempts++

      console.log(`🔄 Run status: ${runStatus} (attempt ${attempts})`)
    }

    if (runStatus !== 'completed') {
      throw new Error(`Run failed or timed out. Status: ${runStatus}`)
    }

    console.log('✅ Run completed successfully')

    // Get the messages
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
    })

    if (!messagesResponse.ok) {
      throw new Error(`Failed to get messages: ${messagesResponse.statusText}`)
    }

    const { data: messages } = await messagesResponse.json()

    // Get the assistant's response (last message)
    const assistantMessage = messages[0] // Messages are returned in reverse chronological order

    if (!assistantMessage || assistantMessage.role !== 'assistant') {
      throw new Error('No assistant response found')
    }

    // Parse the JSON response
    let analysisResult
    try {
      const content = assistantMessage.content[0]?.text?.value || ''
      analysisResult = JSON.parse(content)
    } catch (parseError) {
      console.error('❌ Error parsing JSON response:', parseError)
      throw new Error('Invalid JSON response from assistant')
    }

    console.log('✅ Analysis completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        data: analysisResult,
        document_id: document_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in document analysis assistant:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
