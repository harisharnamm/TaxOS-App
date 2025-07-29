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
    const { document_id } = await req.json()

    if (!document_id) {
      return new Response(
        JSON.stringify({ error: 'Missing document_id parameter' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('🔄 Processing financial document:', document_id)

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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

    const bucketName = document.document_type === 'irs_notice' ? 'irs-notices' : 'client-documents';
    const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
      .from(bucketName)
      .createSignedUrl(document.storage_path, 3600)

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
    const EDEN_AI_API_KEY = Deno.env.get('EDEN_AI_API_KEY')

    // Call Eden AI Financial Parser
    console.log('🤖 Calling Eden AI Financial Parser...')
    const financialResponse = await fetch('https://api.edenai.run/v2/ocr/financial_parser', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${EDEN_AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        providers: ['microsoft'],
        fallback_providers: ['amazon'],
        file_url: file_url,
        response_as_dict: true
      }),
    })

    if (!financialResponse.ok) {
      const errorText = await financialResponse.text()
      console.error('❌ Eden AI Financial Parser error:', errorText)
      throw new Error(`Eden AI Financial Parser failed: ${financialResponse.statusText} - ${errorText}`)
    }

    const financialResult = await financialResponse.json()
    console.log('✅ Financial processing result:', financialResult)

    // Update document with financial processing results in separate column
    const { error: updateError } = await supabaseClient
      .from('documents')
      .update({ 
        financial_processing_response: financialResult,
        processing_status: 'completed'
      })
      .eq('id', document_id)

    if (updateError) {
      console.error('❌ Error updating document with financial data:', updateError)
    } else {
      console.log('✅ Document updated with financial processing data.')
    }

    // --- Unified Transaction Extraction and Insertion ---
    // Fetch client_id and secondary_classification for association
    const { data: docMeta, error: docMetaError } = await supabaseClient
      .from('documents')
      .select('client_id, secondary_classification')
      .eq('id', document_id)
      .single();
    if (docMetaError || !docMeta) {
      console.error('❌ Could not fetch document meta for transaction extraction:', docMetaError);
    } else if (!docMeta.client_id) {
      console.error('❌ Document missing client_id, cannot insert transactions.');
    } else {
      // Map human secondary_classification to internal type
      const secClass = (docMeta.secondary_classification || '').toLowerCase();
      let docType: 'bank_statement' | 'invoice' | 'receipt' | null = null;
      if (secClass === 'bank statement') docType = 'bank_statement';
      else if (secClass === 'invoice') docType = 'invoice';
      else if (secClass === 'receipt') docType = 'receipt';
      // Only process if one of the three
      if (!docType) {
        console.log('ℹ️ Document secondary_classification not supported for transaction extraction:', docMeta.secondary_classification);
      } else {
        // Transaction extraction logic
        function getBankTransactionType(description: string): string {
          if (!description) return 'other';
          const desc = description.toUpperCase();
          if (desc.includes('POS PURCHASE')) return 'pos_purchase';
          if (desc.includes('CHECK')) return 'check';
          if (desc.includes('ATM WITHDRAWAL')) return 'atm_withdrawal';
          if (desc.includes('PREAUTHORIZED CREDIT')) return 'preauth_credit';
          if (desc.includes('INTEREST CREDIT')) return 'interest_credit';
          if (desc.includes('SERVICE CHARGE')) return 'service_charge';
          if (desc.includes('TRANSFER')) return 'transfer';
          if (desc.includes('DEPOSIT')) return 'deposit';
          return 'other';
        }
        function determineDebitCredit(description: string, amount: number): 'debit' | 'credit' {
          if (!description) return amount < 0 ? 'debit' : 'credit';
          const desc = description.toUpperCase();
          const creditIndicators = ['PREAUTHORIZED CREDIT', 'INTEREST CREDIT', 'DEPOSIT', 'REFUND'];
          if (creditIndicators.some(ind => desc.includes(ind))) return 'credit';
          return 'debit';
        }
        function extractReferenceNumber(description: string): string | null {
          if (!description) return null;
          if (description.toUpperCase().includes('CHECK')) {
            const parts = description.split(' ');
            for (let i = 0; i < parts.length; i++) {
              if (parts[i].toUpperCase() === 'CHECK' && i + 1 < parts.length) {
                return parts[i + 1];
              }
            }
          }
          return null;
        }
        function toDateString(val: string | undefined): string | null {
          if (!val) return null;
          const d = new Date(val);
          return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
        }
        // --- Extract transactions ---
        const transactions: any[] = [];
        const ocrResponse = financialResult;
        if (docType === 'bank_statement' && ocrResponse.microsoft?.status === 'success') {
          const extracted = ocrResponse.microsoft.extracted_data?.[0] || {};
          const itemLines = extracted.item_lines || [];
          const currency = extracted.local?.currency_code || 'USD';
          for (let i = 0; i < itemLines.length; i++) {
            const t = itemLines[i];
            transactions.push({
              transaction_id: `BS_${i + 1}_${Date.now()}`,
              document_id,
              client_id: docMeta.client_id,
              document_source: 'bank_statement',
              transaction_date: toDateString(t.date),
              description: (t.description || '').trim(),
              amount: Math.abs(t.amount_line || 0),
              currency,
              transaction_type: getBankTransactionType(t.description),
              debit_credit: determineDebitCredit(t.description, t.amount_line || 0),
              reference_number: extractReferenceNumber(t.description),
              counterparty: null,
              counterparty_address: null,
              invoice_number: null,
              due_date: null,
              payment_status: 'cleared',
              payment_method: null,
              matching_candidate: true,
              matched_transaction_ids: [],
              tags: JSON.stringify(['bank_statement']),
              line_items: JSON.stringify([]),
              raw_data: JSON.stringify(t),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        } else if (docType === 'invoice' && ocrResponse.microsoft?.status === 'success') {
          const extracted = ocrResponse.microsoft.extracted_data?.[0] || {};
          const merchantInfo = extracted.merchant_information || {};
          const paymentInfo = extracted.payment_information || {};
          const financialInfo = extracted.financial_document_information || {};
          const itemLines = extracted.item_lines || [];
          const currency = extracted.local?.currency_code || 'USD';
          const lineItems = itemLines.map((item: any) => ({
            description: item.description || '',
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            amount: item.amount_line || 0,
            tax: item.tax,
            tax_rate: item.tax_rate
          }));
          transactions.push({
            transaction_id: `INV_${financialInfo.invoice_receipt_id || Date.now()}`,
            document_id,
            client_id: docMeta.client_id,
            document_source: 'invoice',
            transaction_date: toDateString(financialInfo.invoice_date),
            description: `Invoice from ${merchantInfo.name || 'Unknown Merchant'}`,
            amount: Math.abs(paymentInfo.total || paymentInfo.amount_due || 0),
            currency,
            transaction_type: 'invoice_payable',
            debit_credit: 'debit',
            reference_number: financialInfo.invoice_receipt_id,
            counterparty: merchantInfo.name,
            counterparty_address: merchantInfo.address,
            invoice_number: financialInfo.invoice_receipt_id,
            due_date: toDateString(financialInfo.invoice_due_date),
            payment_status: 'pending',
            payment_method: null,
            matching_candidate: true,
            matched_transaction_ids: [],
            tags: JSON.stringify(['invoice', 'payable']),
            line_items: JSON.stringify(lineItems),
            raw_data: JSON.stringify({ customer_info: extracted.customer_information, merchant_info: merchantInfo, payment_info: paymentInfo, financial_info: financialInfo }),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        } else if (docType === 'receipt' && ocrResponse.microsoft?.status === 'success') {
          const extracted = ocrResponse.microsoft.extracted_data?.[0] || {};
          const merchantInfo = extracted.merchant_information || {};
          const paymentInfo = extracted.payment_information || {};
          const financialInfo = extracted.financial_document_information || {};
          const itemLines = extracted.item_lines || [];
          const currency = extracted.local?.currency_code || 'USD';
          const lineItems = itemLines.map((item: any) => ({
            description: item.description || '',
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            amount: item.amount_line || 0,
            tax: item.tax,
            tax_rate: item.tax_rate
          }));
          transactions.push({
            transaction_id: `REC_${financialInfo.invoice_receipt_id || Date.now()}`,
            document_id,
            client_id: docMeta.client_id,
            document_source: 'receipt',
            transaction_date: toDateString(financialInfo.invoice_date || financialInfo.order_date),
            description: `Purchase from ${merchantInfo.name || 'Unknown Merchant'}`,
            amount: Math.abs(paymentInfo.total || paymentInfo.amount_paid || 0),
            currency,
            transaction_type: 'purchase',
            debit_credit: 'debit',
            reference_number: financialInfo.invoice_receipt_id || financialInfo.tracking_number,
            counterparty: merchantInfo.name,
            counterparty_address: merchantInfo.address,
            invoice_number: financialInfo.invoice_receipt_id,
            due_date: null,
            payment_status: 'paid',
            payment_method: paymentInfo.payment_method,
            matching_candidate: true,
            matched_transaction_ids: [],
            tags: JSON.stringify(['receipt', 'purchase']),
            line_items: JSON.stringify(lineItems),
            raw_data: JSON.stringify({ customer_info: extracted.customer_information, merchant_info: merchantInfo, payment_info: paymentInfo, financial_info: financialInfo }),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
        // Insert transactions into unified_transactions
        if (transactions.length > 0) {
          const insertPayload = transactions.map(t => ({
            ...t,
            tags: t.tags ? JSON.parse(t.tags) : [],
            line_items: t.line_items ? JSON.parse(t.line_items) : [],
            raw_data: t.raw_data ? JSON.parse(t.raw_data) : {},
          }));
          const { error: insertError } = await supabaseClient
            .from('unified_transactions')
            .insert(insertPayload);
          if (insertError) {
            console.error('❌ Error inserting unified transactions:', insertError);
          } else {
            console.log(`✅ Inserted ${transactions.length} unified transactions for document ${document_id}`);
          }
        } else {
          console.log('ℹ️ No transactions extracted for this document.');
        }
      }
    }
    // --- End Unified Transaction Extraction ---

    return new Response(
      JSON.stringify({
        success: true,
        document_id: document_id,
        processed_data: financialResult,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error in process-financial function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})