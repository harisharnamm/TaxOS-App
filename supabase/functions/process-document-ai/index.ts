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
    const { document_id, user_id, client_id } = await req.json()

    // Initialize fullClassificationData at the beginning to avoid temporal dead zone
    let fullClassificationData = null

    if (!document_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters', request_id: requestId }),
        { 
          status: 400, 
          headers: { ...baseHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`[${requestId}] Initiating document processing for:`, maskPII(document_id))

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
      console.error(`[${requestId}] Document not found:`, maskPII(docError))
      return new Response(
        JSON.stringify({ error: 'Document not found', request_id: requestId }),
        { 
          status: 404, 
          headers: { ...baseHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`[${requestId}] Document found:`, maskPII(document.storage_path))

    // Get signed URL for the document
    const bucketName = document.document_type === 'irs_notice' ? 'irs-notices' : 'client-documents'
    const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
      .from(bucketName)
      .createSignedUrl(document.storage_path, 3600) // URL valid for 1 hour

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error(`[${requestId}] Error creating signed URL:`, maskPII(signedUrlError))
      return new Response(
        JSON.stringify({ error: 'Failed to create signed URL for document', request_id: requestId }),
        { 
          status: 500, 
          headers: { ...baseHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const file_url = signedUrlData.signedUrl
    console.log(`[${requestId}] Signed URL generated`)

    const EDEN_AI_API_KEY = Deno.env.get('EDEN_AI_API_KEY')
    if (!EDEN_AI_API_KEY) {
      throw new Error('EDEN_AI_API_KEY is not set in environment variables.')
    }

    // Step 1: OCR Text Extraction
    console.log(`[${requestId}] Calling Eden AI OCR (ocr_async)...`)
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
        send_webhook_data: false
      }),
    })

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text()
      console.error(`[${requestId}] Eden AI OCR error:`, maskPII(errorText))
      throw new Error(`Eden AI OCR failed: ${ocrResponse.statusText}`)
    }

    const ocrResult = await ocrResponse.json()
    const ocr_job_id = ocrResult.public_id
    console.log(`[${requestId}] Eden AI OCR job started, ID:`, maskPII(ocr_job_id))

    // Poll for OCR result (simplified)
    let ocr_status = 'pending'
    let extracted_text = ''
    let pollAttempts = 0
    const maxPollAttempts = 10 // Poll for up to 10 seconds

    while (ocr_status !== 'finished' && ocr_status !== 'failed' && pollAttempts < maxPollAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      pollAttempts++

      const pollResponse = await fetch(`https://api.edenai.run/v2/ocr/ocr_async/${ocr_job_id}`, {
        headers: {
          'Authorization': `Bearer ${EDEN_AI_API_KEY}`,
        }
      })

      if (!pollResponse.ok) {
        const errorText = await pollResponse.text()
        console.error(`[${requestId}] Eden AI OCR poll error:`, maskPII(errorText))
        throw new Error(`Eden AI OCR polling failed: ${pollResponse.statusText}`)
      }

      const pollResult = await pollResponse.json()
      ocr_status = pollResult.status
      console.log(`[${requestId}] OCR job status: ${ocr_status} (attempt ${pollAttempts})`)

      if (ocr_status === 'finished') {
        // Extract text from various shapes
        if (pollResult.results?.mistral?.text) {
          extracted_text = pollResult.results.mistral.text
        } else if (pollResult.results?.mistral?.extracted_text) {
          extracted_text = pollResult.results.mistral.extracted_text
        } else if (pollResult.results?.mistral?.raw_text) {
          extracted_text = pollResult.results.mistral.raw_text
        } else if (typeof pollResult.results === 'string') {
          extracted_text = pollResult.results
        } else {
          const findRawText = (obj: any): string | null => {
            if (typeof obj === 'string') return obj
            if (typeof obj !== 'object' || obj === null) return null
            if (obj.raw_text && typeof obj.raw_text === 'string') return obj.raw_text
            for (const key in obj) {
              const res = findRawText(obj[key]);
              if (res) return res;
            }
            return null
          }
          const foundText = findRawText(pollResult)
          if (foundText) {
            extracted_text = foundText
            console.log(`[${requestId}] Found raw_text in response structure`)
          } else {
            throw new Error('Could not extract text from OCR result')
          }
        }
        console.log(`[${requestId}] OCR text extracted successfully. length=`, extracted_text.length)
      } else if (ocr_status === 'failed') {
        throw new Error('OCR job failed')
      }
    }

    if (ocr_status !== 'finished') {
      throw new Error('OCR job timed out or did not finish.')
    }

    // Save extracted raw_text to database ocr_text column
    console.log(`[${requestId}] Saving OCR text to database, length:`, extracted_text.length)
    const { error: ocrUpdateError } = await supabaseClient
      .from('documents')
      .update({ ocr_text: extracted_text })
      .eq('id', document_id)

    if (ocrUpdateError) {
      console.error(`[${requestId}] Error updating document with OCR text:`, maskPII(ocrUpdateError))
      throw new Error('Failed to save OCR text')
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
    prompt_context: { ocr_text: extracted_text },
    params: { temperature: 0.1 }, // Lower temperature for more deterministic classification
  }),
})

if (!classificationResponse.ok) {
  const errorText = await classificationResponse.text()
  console.error('❌ Eden AI Classification error:', errorText)
  throw new Error(`Eden AI Classification failed: ${classificationResponse.statusText} - ${errorText}`)
}

const classificationResult = await classificationResponse.json()
console.log('🔍 Full classification response:', JSON.stringify(classificationResult, null, 2))

// Assign the result immediately after getting it
fullClassificationData = classificationResult

// Parse the classification response properly
let primaryClassification = 'unknown'
let secondaryClassification = null
let reasoning = null
let confidence = null

try {
  let parsedResult = classificationResult
  if (typeof classificationResult === 'string') {
    try {
      parsedResult = JSON.parse(classificationResult)
      fullClassificationData = parsedResult
    } catch (parseError) {
      console.error('❌ Failed to parse classification result as JSON:', parseError)
      parsedResult = classificationResult
      fullClassificationData = classificationResult
    }
  }

  // New expected structure
  if (parsedResult?.primary_classification) {
    primaryClassification = parsedResult.primary_classification.category || 'unknown'
    reasoning = parsedResult.primary_classification.reasoning || null
    confidence = parsedResult.primary_classification.confidence || null
    // Secondary classification
    if (parsedResult.secondary_classification) {
      secondaryClassification = parsedResult.secondary_classification.type || null
    }
    fullClassificationData = parsedResult
  } else {
    // Fallbacks for legacy/other formats
    if (parsedResult?.document_classification) {
      const docClass = parsedResult.document_classification
      primaryClassification = docClass.primary_category || 'unknown'
      reasoning = docClass.reasoning || null
      confidence = docClass.confidence || null
      fullClassificationData = parsedResult
    } else if (parsedResult?.primary_category) {
      primaryClassification = parsedResult.primary_category
      reasoning = parsedResult.reasoning || null
      confidence = parsedResult.confidence || null
      fullClassificationData = parsedResult
    } else if (parsedResult?.generated_text) {
      try {
        const generatedData = JSON.parse(parsedResult.generated_text)
        if (generatedData?.document_classification) {
          const docClass = generatedData.document_classification
          primaryClassification = docClass.primary_category || 'unknown'
          reasoning = docClass.reasoning || null
          confidence = docClass.confidence || null
          fullClassificationData = generatedData
        } else {
          primaryClassification = parsedResult.generated_text.trim()
          fullClassificationData = parsedResult
        }
      } catch {
        primaryClassification = parsedResult.generated_text.trim()
        fullClassificationData = parsedResult
      }
    } else {
      console.warn('⚠️ Unexpected classification response structure')
      primaryClassification = 'parsing_failed'
      fullClassificationData = parsedResult
    }
  }

  console.log('✅ Document classified as:', primaryClassification)
  console.log('📝 Classification reasoning:', reasoning)
  console.log('📊 Classification confidence:', confidence)
  console.log('🏷️ Secondary classification:', secondaryClassification)
} catch (extractionError) {
  console.error('❌ Error extracting classification:', extractionError)
  console.log('📋 Full response structure:', JSON.stringify(classificationResult, null, 2))
  primaryClassification = 'extraction_failed'
  fullClassificationData = classificationResult
}

// Update document with classification and full data
const { error: classificationUpdateError } = await supabaseClient
  .from('documents')
  .update({ 
    eden_ai_classification: primaryClassification,
    classification_api_response: fullClassificationData,
    secondary_classification: secondaryClassification,
    processing_status: 'classified'
  })
  .eq('id', document_id)

if (classificationUpdateError) {
  console.error('❌ Error updating document with classification:', classificationUpdateError)
} else {
  console.log('✅ Document updated with classification.')
}

    // Auto-process if classification is known, otherwise return for manual review
    if (primaryClassification && primaryClassification !== 'unknown' && primaryClassification !== 'parsing_failed' && primaryClassification !== 'extraction_failed') {
      console.log('🚀 Auto-processing document based on classification:', primaryClassification)
      
      // Update processing status
      await supabaseClient
        .from('documents')
        .update({ processing_status: 'processing' })
        .eq('id', document_id)
      
      // Determine which processing function to call based on classification
      let processingFunction = ''
      if (primaryClassification.toLowerCase().includes('financial')) {
        processingFunction = 'process-financial'
      } else if (primaryClassification.toLowerCase().includes('identity')) {
        processingFunction = 'process-identity'
      } else if (primaryClassification.toLowerCase().includes('tax')) {
        processingFunction = 'process-tax'
      } else {
        // Default to financial processing for unknown specific types
        processingFunction = 'process-financial'
      }
      
      console.log(`🔄 Calling ${processingFunction} for document:`, document_id)
      
      // Call the appropriate processing function
      try {
        const processingResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/${processingFunction}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            document_id: document_id,
            ocr_text: extracted_text
          }),
        })
        
        if (!processingResponse.ok) {
          const errorText = await processingResponse.text()
          console.error(`❌ ${processingFunction} failed:`, errorText)
          
          // Update status to failed
          await supabaseClient
            .from('documents')
            .update({ 
              processing_status: 'failed',
              is_processed: true
            })
            .eq('id', document_id)
        } else {
          const processingResult = await processingResponse.json()
          console.log(`✅ ${processingFunction} completed successfully:`, processingResult)
          
          // Update status to completed
          await supabaseClient
            .from('documents')
            .update({ 
              processing_status: 'completed',
              is_processed: true
            })
            .eq('id', document_id)
        }
      } catch (processingError) {
        console.error(`❌ Error calling ${processingFunction}:`, processingError)
        
        // Update status to failed
        await supabaseClient
          .from('documents')
          .update({ 
            processing_status: 'failed',
            is_processed: true
          })
          .eq('id', document_id)
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          document_id: document_id,
          ocr_text: extracted_text,
          classification: primaryClassification,
          auto_processed: true,
          processing_function: processingFunction
        }),
        { 
          headers: { ...baseHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      // Classification is unknown - return for manual review
      console.log('❓ Classification unknown, requiring manual review:', primaryClassification)
      
      // Update processing status to classified (waiting for manual review)
      await supabaseClient
        .from('documents')
        .update({ 
          processing_status: 'classified',
          is_processed: true
        })
        .eq('id', document_id)
      
      return new Response(
        JSON.stringify({
          success: true,
          document_id: document_id,
          ocr_text: extracted_text,
          classification: primaryClassification,
          requires_manual_review: true
        }),
        { 
          headers: { ...baseHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error) {
    try { Sentry.captureException(error, { extra: { request_id: requestId } }); } catch (_) {}
    await Sentry.flush(2000);
    console.error(`[${requestId}] Error processing document:`, maskPII((error as any)?.message || error))
    return new Response(
      JSON.stringify({ error: 'Internal server error', request_id: requestId }),
      { 
        status: 500, 
        headers: { ...baseHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})