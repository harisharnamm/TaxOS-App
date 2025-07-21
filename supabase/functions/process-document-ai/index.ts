import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { document_id, user_id, client_id } = await req.json()

    if (!document_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('🔄 Initiating document processing for:', document_id)

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the document details
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('storage_path, document_type')
      .eq('id', document_id)
      .single()

    if (docError || !document) {
      console.error('❌ Document not found:', docError)
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('📄 Document found:', document.storage_path)

    // Get signed URL for the document
    const bucketName = document.document_type === 'irs_notice' ? 'irs-notices' : 'client-documents'
    const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
      .from(bucketName)
      .createSignedUrl(document.storage_path, 3600) // URL valid for 1 hour

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('❌ Error creating signed URL:', signedUrlError)
      return new Response(
        JSON.stringify({ error: 'Failed to create signed URL for document' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const file_url = signedUrlData.signedUrl
    console.log('🔗 Signed URL generated:', file_url)

    const EDEN_AI_API_KEY = Deno.env.get('EDEN_AI_API_KEY')
    if (!EDEN_AI_API_KEY) {
      throw new Error('EDEN_AI_API_KEY is not set in environment variables.')
    }

    // Step 1: OCR Text Extraction
    console.log('🤖 Calling Eden AI OCR (ocr_async)...')
    const ocrResponse = await fetch('https://api.edenai.run/v2/ocr/ocr_async', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${EDEN_AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        providers: ['mistral'],
        file_url: file_url,
        show_original_response: false,
        send_webhook_data: false // We will handle the callback manually if needed, or poll
      }),
    })

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text()
      console.error('❌ Eden AI OCR error:', errorText)
      throw new Error(`Eden AI OCR failed: ${ocrResponse.statusText} - ${errorText}`)
    }

    const ocrResult = await ocrResponse.json()
    const ocr_job_id = ocrResult.public_id
    console.log('✅ Eden AI OCR job started, ID:', ocr_job_id)

    // Poll for OCR result (simplified polling for demonstration)
    let ocr_status = 'pending'
    let extracted_text = ''
    let pollAttempts = 0
    const maxPollAttempts = 10 // Poll for up to 10 seconds

    while (ocr_status !== 'finished' && ocr_status !== 'failed' && pollAttempts < maxPollAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
      pollAttempts++

      const pollResponse = await fetch(`https://api.edenai.run/v2/ocr/ocr_async/${ocr_job_id}`, {
        headers: { 'Authorization': `Bearer ${EDEN_AI_API_KEY}` },
      })

      if (!pollResponse.ok) {
        const errorText = await pollResponse.text()
        console.error('❌ Eden AI OCR poll error:', errorText)
        throw new Error(`Eden AI OCR polling failed: ${pollResponse.statusText} - ${errorText}`)
      }

      const pollResult = await pollResponse.json()
      ocr_status = pollResult.status
      console.log(`🔄 OCR job status: ${ocr_status} (attempt ${pollAttempts})`)

      if (ocr_status === 'finished') {
        extracted_text = pollResult.results.mistral.text
        console.log('✅ OCR text extracted successfully.')
      } else if (ocr_status === 'failed') {
        throw new Error(`OCR job failed: ${JSON.stringify(pollResult.error)}`)
      }
    }

    if (ocr_status !== 'finished') {
      throw new Error('OCR job timed out or did not finish.')
    }

    // Save extracted raw_text to database ocr_text column
    const { error: ocrUpdateError } = await supabaseClient
      .from('documents')
      .update({ ocr_text: extracted_text })
      .eq('id', document_id)

    if (ocrUpdateError) {
      console.error('❌ Error updating document with OCR text:', ocrUpdateError)
    } else {
      console.log('✅ Document updated with OCR text.')
    }

    // Step 2: Document Classification
    console.log('🤖 Calling Eden AI Classification API...')
    const classificationResponse = await fetch('https://api.edenai.run/v2/prompts/ocr-classification-api', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${EDEN_AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        promptContext: { ocr_text: extracted_text },
        params: { temperature: 0.1 }, // Lower temperature for more deterministic classification
      }),
    })

    if (!classificationResponse.ok) {
      const errorText = await classificationResponse.text()
      console.error('❌ Eden AI Classification error:', errorText)
      throw new Error(`Eden AI Classification failed: ${classificationResponse.statusText} - ${errorText}`)
    }

    const classificationResult = await classificationResponse.json()
    const classification = classificationResult.results.eden_ai.generated_text.trim()
    console.log('✅ Document classified as:', classification)

    // Update document with classification
    const { error: classificationUpdateError } = await supabaseClient
      .from('documents')
      .update({ eden_ai_classification: classification })
      .eq('id', document_id)

    if (classificationUpdateError) {
      console.error('❌ Error updating document with classification:', classificationUpdateError)
    } else {
      console.log('✅ Document updated with classification.')
    }

    // Return classification result to frontend for approval/manual override
    return new Response(
      JSON.stringify({
        success: true,
        document_id: document_id,
        ocr_text: extracted_text,
        classification: classification,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error processing document:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})