import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DocumentTransactionMatch {
  id: string
  document_id: string
  transaction_id: string
  match_confidence: number
  match_reasoning: string
  match_type: 'auto' | 'manual' | 'ai_suggested'
  status: 'proposed' | 'accepted' | 'rejected' | 'modified'
  user_id: string
  client_id: string
  created_at: string
  updated_at: string
  accepted_at?: string
  rejected_at?: string
  rejection_reason?: string
  modified_fields?: any
}

interface Document {
  id: string
  client_id: string
  user_id: string
  document_type: string
  financial_processing_response?: any
  ai_analysis_response?: any
  ocr_text?: string
  created_at: string
}

interface Transaction {
  id: string
  client_id: string
  user_id: string
  account_id: string
  tx_id_ext: string
  amount: number
  raw_description?: string
  payee_final?: string
  category_final?: string
  date_posted: string
  created_at: string
}

interface UnmatchedDocument {
  id: string
  document_id: string
  client_id: string
  user_id: string
  document_type: string
  expected_amount?: number
  expected_date?: string
  vendor_name?: string
  invoice_number?: string
  status: string
  resolution_notes?: string
  created_at: string
  updated_at: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, clientId, userId } = await req.json()

    console.log('📄 Document-Transaction Matching - Action:', action, 'Client:', clientId)

    switch (action) {
      case 'generate_matches':
        return await generateDocumentTransactionMatches(supabase, clientId, userId)
      
      case 'accept_match':
        return await acceptDocumentTransactionMatch(supabase, req.json())
      
      case 'reject_match':
        return await rejectDocumentTransactionMatch(supabase, req.json())
      
      case 'get_matching_data':
        return await getDocumentTransactionMatchingData(supabase, clientId, userId)
      
      case 'get_unmatched_documents':
        return await getUnmatchedDocuments(supabase, clientId, userId)
      
      case 'update_learning_patterns':
        return await updateDocumentMatchingLearningPatterns(supabase, req.json())
      
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('💥 Document-Transaction Matching Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function generateDocumentTransactionMatches(supabase: any, clientId: string, userId: string) {
  console.log('🔍 Generating document-transaction matches for client:', clientId)

  try {
    // 1. Get all financial documents for the client
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('client_id', clientId)
      .in('document_type', ['invoice', 'receipt'])
      .not('financial_processing_response', 'is', null)
      .order('created_at', { ascending: false })

    if (docError) throw docError

    // 2. Get all transactions for the client
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('client_id', clientId)
      .order('date_posted', { ascending: false })

    if (txError) throw txError

    console.log(`📊 Found ${documents?.length || 0} financial documents and ${transactions?.length || 0} transactions`)

    if (!documents?.length || !transactions?.length) {
      return new Response(
        JSON.stringify({ 
          message: 'No financial documents or transactions found',
          matches: [],
          stats: {
            totalMatches: 0,
            autoMatches: 0,
            aiSuggested: 0,
            manualMatches: 0
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Generate AI-powered matches
    const matches = await generateAIDocumentTransactionMatches(supabase, documents, transactions, clientId, userId)
    
    // 4. Store matches in database
    const { data: storedMatches, error: storeError } = await supabase
      .from('document_transaction_matches')
      .insert(matches)
      .select()

    if (storeError) throw storeError

    console.log(`✅ Generated and stored ${storedMatches?.length || 0} document-transaction matches`)

    // 5. Calculate statistics
    const stats = {
      totalMatches: storedMatches?.length || 0,
      autoMatches: storedMatches?.filter(m => m.match_type === 'auto').length || 0,
      aiSuggested: storedMatches?.filter(m => m.match_type === 'ai_suggested').length || 0,
      manualMatches: storedMatches?.filter(m => m.match_type === 'manual').length || 0
    }

    return new Response(
      JSON.stringify({ 
        message: 'Document-transaction matches generated successfully',
        matches: storedMatches,
        stats
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error generating matches:', error)
    throw error
  }
}

async function generateAIDocumentTransactionMatches(
  supabase: any,
  documents: Document[], 
  transactions: Transaction[], 
  clientId: string, 
  userId: string
): Promise<Partial<DocumentTransactionMatch>[]> {
  const matches: Partial<DocumentTransactionMatch>[] = []

  // Get existing document matching rules for this client
  const { data: rules } = await supabase
    .from('document_matching_rules')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_active', true)

  for (const document of documents) {
    let bestMatch: Transaction | null = null
    let bestConfidence = 0
    let bestReasoning = ''

    for (const transaction of transactions) {
      const confidence = calculateDocumentTransactionMatchConfidence(document, transaction, rules || [])
      
      if (confidence > bestConfidence && confidence > 0.3) { // Minimum threshold
        bestConfidence = confidence
        bestMatch = transaction
        bestReasoning = generateDocumentTransactionMatchReasoning(document, transaction, confidence)
      }
    }

    if (bestMatch && bestConfidence > 0.7) {
      matches.push({
        document_id: document.id,
        transaction_id: bestMatch.id,
        match_confidence: bestConfidence,
        match_reasoning: bestReasoning,
        match_type: bestConfidence > 0.9 ? 'auto' : 'ai_suggested',
        status: 'proposed',
        user_id: userId,
        client_id: clientId
      })
    }
  }

  return matches
}

function calculateDocumentTransactionMatchConfidence(
  document: Document, 
  transaction: Transaction, 
  rules: any[]
): number {
  let confidence = 0

  // Extract financial data from document
  const financialData = extractFinancialDataFromDocument(document)
  
  if (!financialData) return 0

  // 1. Amount matching (highest weight: 40%)
  if (financialData.amount && Math.abs(financialData.amount - transaction.amount) < 0.01) {
    confidence += 0.4
  } else if (financialData.amount && Math.abs(financialData.amount - transaction.amount) < 1.0) {
    confidence += 0.2
  }

  // 2. Date matching (weight: 30%)
  if (financialData.date && transaction.date_posted) {
    const docDate = new Date(financialData.date)
    const txDate = new Date(transaction.date_posted)
    const daysDiff = Math.abs(docDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)
    
    if (daysDiff <= 7) {
      confidence += 0.3
    } else if (daysDiff <= 30) {
      confidence += 0.15
    }
  }

  // 3. Vendor/Payee matching (weight: 20%)
  if (financialData.vendor && transaction.payee_final) {
    const vendorLower = financialData.vendor.toLowerCase()
    const payeeLower = transaction.payee_final.toLowerCase()
    
    if (vendorLower === payeeLower) {
      confidence += 0.2
    } else if (vendorLower.includes(payeeLower) || payeeLower.includes(vendorLower)) {
      confidence += 0.15
    } else if (calculateStringSimilarity(vendorLower, payeeLower) > 0.7) {
      confidence += 0.1
    }
  }

  // 4. Description matching (weight: 10%)
  if (financialData.description && transaction.raw_description) {
    const descLower = financialData.description.toLowerCase()
    const txDescLower = transaction.raw_description.toLowerCase()
    
    if (descLower === txDescLower) {
      confidence += 0.1
    } else if (descLower.includes(txDescLower) || txDescLower.includes(descLower)) {
      confidence += 0.08
    }
  }

  // 5. Apply learning rules
  for (const rule of rules) {
    if (rule.rule_type === 'vendor_pattern' && 
        financialData.vendor && 
        financialData.vendor.toLowerCase().includes(rule.pattern.toLowerCase())) {
      confidence += rule.confidence_boost
    }
    
    if (rule.rule_type === 'amount_pattern' && 
        financialData.amount && 
        financialData.amount.toString().includes(rule.pattern)) {
      confidence += rule.confidence_boost
    }
  }

  // Cap confidence at 1.0
  return Math.min(confidence, 1.0)
}

function extractFinancialDataFromDocument(document: Document): any {
  try {
    if (!document.financial_processing_response) return null

    const extracted = document.financial_processing_response?.microsoft?.extracted_data?.[0]
    if (!extracted) return null

    return {
      amount: extracted.payment_information?.total,
      date: extracted.financial_document_information?.invoice_date,
      vendor: extracted.merchant_information?.name,
      invoice: extracted.financial_document_information?.invoice_receipt_id,
      description: extracted.item_lines?.[0]?.description
    }
  } catch (error) {
    console.error('Error extracting financial data:', error)
    return null
  }
}

function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1.0
  
  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      )
    }
  }
  
  return matrix[str2.length][str1.length]
}

function generateDocumentTransactionMatchReasoning(document: Document, transaction: Transaction, confidence: number): string {
  const reasons: string[] = []
  const financialData = extractFinancialDataFromDocument(document)
  
  if (financialData?.amount && Math.abs(financialData.amount - transaction.amount) < 0.01) {
    reasons.push('Exact amount match')
  }
  
  if (financialData?.vendor && transaction.payee_final && 
      financialData.vendor.toLowerCase() === transaction.payee_final.toLowerCase()) {
    reasons.push('Exact vendor/payee match')
  }
  
  if (confidence > 0.9) {
    reasons.push('High confidence AI match')
  } else if (confidence > 0.7) {
    reasons.push('AI suggested match')
  }
  
  return reasons.join('; ') || 'AI analysis suggests potential match'
}

async function acceptDocumentTransactionMatch(supabase: any, data: any) {
  const { matchId, userId } = data
  
  try {
    const { data: match, error: matchError } = await supabase
      .from('document_transaction_matches')
      .select('*')
      .eq('id', matchId)
      .single()

    if (matchError) throw matchError

    // Update match status
    const { error: updateError } = await supabase
      .from('document_transaction_matches')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', matchId)

    if (updateError) throw updateError

    // Update unmatched document status if it exists
    const { error: unmatchedError } = await supabase
      .from('unmatched_documents')
      .update({ 
        status: 'resolved',
        resolution_notes: `Matched to transaction ${match.transaction_id}`,
        updated_at: new Date().toISOString()
      })
      .eq('document_id', match.document_id)

    if (unmatchedError) {
      console.log('No unmatched document found to update')
    }

    // Record in history
    await supabase
      .from('document_matching_history')
      .insert({
        match_id: matchId,
        action: 'accepted',
        user_id: userId,
        previous_state: match,
        new_state: { ...match, status: 'accepted', accepted_at: new Date().toISOString() }
      })

    // Update learning patterns
    await updateDocumentMatchingLearningPatterns(supabase, {
      clientId: match.client_id,
      ruleType: 'vendor_pattern',
      pattern: match.match_reasoning,
      success: true
    })

    return new Response(
      JSON.stringify({ message: 'Document-transaction match accepted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error accepting match:', error)
    throw error
  }
}

async function rejectDocumentTransactionMatch(supabase: any, data: any) {
  const { matchId, userId, rejectionReason } = data
  
  try {
    const { data: match, error: matchError } = await supabase
      .from('document_transaction_matches')
      .select('*')
      .eq('id', matchId)
      .single()

    if (matchError) throw matchError

    // Update match status
    const { error: updateError } = await supabase
      .from('document_transaction_matches')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: rejectionReason,
        updated_at: new Date().toISOString()
      })
      .eq('id', matchId)

    if (updateError) throw updateError

    // Record in history
    await supabase
      .from('document_matching_history')
      .insert({
        match_id: matchId,
        action: 'rejected',
        user_id: userId,
        previous_state: match,
        new_state: { ...match, status: 'rejected', rejected_at: new Date().toISOString(), rejection_reason: rejectionReason }
      })

    // Update learning patterns
    await updateDocumentMatchingLearningPatterns(supabase, {
      clientId: match.client_id,
      ruleType: 'vendor_pattern',
      pattern: match.match_reasoning,
      success: false
    })

    return new Response(
      JSON.stringify({ message: 'Document-transaction match rejected successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error rejecting match:', error)
    throw error
  }
}

async function getDocumentTransactionMatchingData(supabase: any, clientId: string, userId: string) {
  try {
    // Get all document-transaction matches
    const { data: matches, error: matchesError } = await supabase
      .from('document_transaction_matches')
      .select(`
        *,
        documents:document_id(id, filename, document_type, financial_processing_response),
        transactions:transaction_id(id, amount, raw_description, payee_final, date_posted)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    if (matchesError) throw matchesError

    // Calculate statistics
    const stats = {
      totalMatches: matches?.length || 0,
      proposedMatches: matches?.filter(m => m.status === 'proposed').length || 0,
      acceptedMatches: matches?.filter(m => m.status === 'accepted').length || 0,
      rejectedMatches: matches?.filter(m => m.status === 'rejected').length || 0,
      autoMatchRate: matches?.length ? Math.round((matches.filter(m => m.match_type === 'auto').length / matches.length) * 100) : 0
    }

    return new Response(
      JSON.stringify({ 
        matches: matches || [],
        stats
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error getting matching data:', error)
    throw error
  }
}

async function getUnmatchedDocuments(supabase: any, clientId: string, userId: string) {
  try {
    // Get all unmatched documents
    const { data: unmatchedDocs, error: unmatchedError } = await supabase
      .from('unmatched_documents')
      .select(`
        *,
        documents:document_id(id, filename, document_type, financial_processing_response, ai_analysis_response)
      `)
      .eq('client_id', clientId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (unmatchedError) throw unmatchedError

    return new Response(
      JSON.stringify({ 
        unmatchedDocuments: unmatchedDocs || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error getting unmatched documents:', error)
    throw error
  }
}

async function updateDocumentMatchingLearningPatterns(supabase: any, data: any) {
  const { clientId, ruleType, pattern, success } = data
  
  try {
    // Find existing rule
    const { data: existingRule } = await supabase
      .from('document_matching_rules')
      .select('*')
      .eq('client_id', clientId)
      .eq('rule_type', ruleType)
      .eq('pattern', pattern)
      .single()

    if (existingRule) {
      // Update existing rule
      const newUsageCount = existingRule.usage_count + 1
      const newSuccessRate = ((existingRule.success_rate * existingRule.usage_count) + (success ? 1 : 0)) / newUsageCount
      
      await supabase
        .from('document_matching_rules')
        .update({
          usage_count: newUsageCount,
          success_rate: newSuccessRate,
          confidence_boost: Math.min(existingRule.confidence_boost + (success ? 0.02 : -0.01), 0.3),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRule.id)
    } else {
      // Create new rule
      await supabase
        .from('document_matching_rules')
        .insert({
          client_id: clientId,
          rule_type: ruleType,
          pattern,
          confidence_boost: 0.1,
          usage_count: 1,
          success_rate: success ? 1.0 : 0.0
        })
    }

  } catch (error) {
    console.error('❌ Error updating learning patterns:', error)
    // Don't throw error for learning pattern updates
  }
}
