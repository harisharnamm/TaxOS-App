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
    const { document_id, ocr_text } = await req.json()

    if (!document_id || !ocr_text) {
      return new Response(
        JSON.stringify({ error: 'Missing document_id or ocr_text parameter' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('🔄 Processing identity document:', document_id)

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const EDEN_AI_API_KEY = Deno.env.get('EDEN_AI_API_KEY')

    // Call Eden AI Identity OCR Processing API
    console.log('🤖 Calling Eden AI Identity OCR Processing API...')
    const identityResponse = await fetch('https://api.edenai.run/v2/prompts/identity-ocr-processing-api', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${EDEN_AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        promptContext: { ocr_text: ocr_text },
        params: { temperature: 0.1 }
      }),
    })

    if (!identityResponse.ok) {
      const errorText = await identityResponse.text()
      console.error('❌ Eden AI Identity Processing error:', errorText)
      throw new Error(`Eden AI Identity Processing failed: ${identityResponse.statusText} - ${errorText}`)
    }

    const identityResult = await identityResponse.json()
    console.log('✅ Identity processing result:', identityResult)

    // Update document with identity processing results in separate column
    const { error: updateError } = await supabaseClient
      .from('documents')
      .update({ 
        identity_processing_response: identityResult,
        processing_status: 'completed'
      })
      .eq('id', document_id)

    if (updateError) {
      console.error('❌ Error updating document with identity data:', updateError)
    } else {
      console.log('✅ Document updated with identity processing data.')
    }

    return new Response(
      JSON.stringify({
        success: true,
        document_id: document_id,
        processed_data: identityResult,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error in process-identity function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})