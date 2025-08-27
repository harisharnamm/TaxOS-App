import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReconciliationMatch {
  id: string
  transaction_id: string
  ar_item_id: string
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

interface ARCandidate {
  id: string
  client_id: string
  invoice_number: string
  customer_name: string
  amount: number
  due_date?: string
  status: string
  description?: string
  reference?: string
  created_at: string
  updated_at: string
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

    console.log('🎯 Deposit Reconciliation - Action:', action, 'Client:', clientId)

    switch (action) {
      case 'generate_matches':
        return await generateReconciliationMatches(supabase, clientId, userId)
      
      case 'accept_match':
        return await acceptReconciliationMatch(supabase, req.json())
      
      case 'reject_match':
        return await rejectReconciliationMatch(supabase, req.json())
      
      case 'get_reconciliation_data':
        return await getReconciliationData(supabase, clientId, userId)
      
      case 'update_learning_patterns':
        return await updateLearningPatterns(supabase, req.json())
      
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('💥 Deposit Reconciliation Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function generateReconciliationMatches(supabase: any, clientId: string, userId: string) {
  console.log('🔍 Generating reconciliation matches for client:', clientId)

  try {
    // 1. Get all deposit transactions for the client
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('client_id', clientId)
      .gt('amount', 0)
      .eq('category_final', 'Deposit')
      .order('date_posted', { ascending: false })

    if (txError) throw txError

    // 2. Get all open AR candidates for the client
    const { data: arCandidates, error: arError } = await supabase
      .from('ar_candidates')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })

    if (arError) throw arError

    console.log(`📊 Found ${transactions?.length || 0} transactions and ${arCandidates?.length || 0} AR candidates`)

    if (!transactions?.length || !arCandidates?.length) {
      return new Response(
        JSON.stringify({ 
          message: 'No transactions or AR candidates found',
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
    const matches = await generateAIMatches(supabase, transactions, arCandidates, clientId, userId)
    
    // 4. Store matches in database
    const { data: storedMatches, error: storeError } = await supabase
      .from('reconciliation_matches')
      .insert(matches)
      .select()

    if (storeError) throw storeError

    console.log(`✅ Generated and stored ${storedMatches?.length || 0} reconciliation matches`)

    // 5. Calculate statistics
    const stats = {
      totalMatches: storedMatches?.length || 0,
      autoMatches: storedMatches?.filter(m => m.match_type === 'auto').length || 0,
      aiSuggested: storedMatches?.filter(m => m.match_type === 'ai_suggested').length || 0,
      manualMatches: storedMatches?.filter(m => m.match_type === 'manual').length || 0
    }

    return new Response(
      JSON.stringify({ 
        message: 'Reconciliation matches generated successfully',
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

async function generateAIMatches(
  supabase: any,
  transactions: Transaction[], 
  arCandidates: ARCandidate[], 
  clientId: string, 
  userId: string
): Promise<Partial<ReconciliationMatch>[]> {
  const matches: Partial<ReconciliationMatch>[] = []

  // Get existing reconciliation rules for this client
  const { data: rules } = await supabase
    .from('reconciliation_rules')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_active', true)

  for (const transaction of transactions) {
    let bestMatch: ARCandidate | null = null
    let bestConfidence = 0
    let bestReasoning = ''

    for (const arCandidate of arCandidates) {
      const confidence = calculateMatchConfidence(transaction, arCandidate, rules || [])
      
      if (confidence > bestConfidence && confidence > 0.3) { // Minimum threshold
        bestConfidence = confidence
        bestMatch = arCandidate
        bestReasoning = generateMatchReasoning(transaction, arCandidate, confidence)
      }
    }

    if (bestMatch && bestConfidence > 0.7) {
      matches.push({
        transaction_id: transaction.id,
        ar_item_id: bestMatch.id,
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

function calculateMatchConfidence(
  transaction: Transaction, 
  arCandidate: ARCandidate, 
  rules: any[]
): number {
  let confidence = 0

  // 1. Amount matching (highest weight: 40%)
  if (Math.abs(transaction.amount - arCandidate.amount) < 0.01) {
    confidence += 0.4
  } else if (Math.abs(transaction.amount - arCandidate.amount) < 1.0) {
    confidence += 0.2
  }

  // 2. Payee/Customer name matching (weight: 30%)
  if (transaction.payee_final && arCandidate.customer_name) {
    const payeeLower = transaction.payee_final.toLowerCase()
    const customerLower = arCandidate.customer_name.toLowerCase()
    
    if (payeeLower === customerLower) {
      confidence += 0.3
    } else if (payeeLower.includes(customerLower) || customerLower.includes(payeeLower)) {
      confidence += 0.2
    } else if (calculateStringSimilarity(payeeLower, customerLower) > 0.7) {
      confidence += 0.15
    }
  }

  // 3. Description matching (weight: 20%)
  if (transaction.raw_description && arCandidate.description) {
    const descLower = transaction.raw_description.toLowerCase()
    const arDescLower = arCandidate.description.toLowerCase()
    
    if (descLower === arDescLower) {
      confidence += 0.2
    } else if (descLower.includes(arDescLower) || arDescLower.includes(descLower)) {
      confidence += 0.15
    }
  }

  // 4. Date proximity (weight: 10%)
  if (transaction.date_posted && arCandidate.due_date) {
    const txDate = new Date(transaction.date_posted)
    const dueDate = new Date(arCandidate.due_date)
    const daysDiff = Math.abs(txDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    
    if (daysDiff <= 7) {
      confidence += 0.1
    } else if (daysDiff <= 30) {
      confidence += 0.05
    }
  }

  // 5. Apply learning rules
  for (const rule of rules) {
    if (rule.rule_type === 'payee_pattern' && 
        transaction.payee_final && 
        transaction.payee_final.toLowerCase().includes(rule.pattern.toLowerCase())) {
      confidence += rule.confidence_boost
    }
    
    if (rule.rule_type === 'amount_pattern' && 
        transaction.amount.toString().includes(rule.pattern)) {
      confidence += rule.confidence_boost
    }
  }

  // Cap confidence at 1.0
  return Math.min(confidence, 1.0)
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

function generateMatchReasoning(transaction: Transaction, arCandidate: ARCandidate, confidence: number): string {
  const reasons: string[] = []
  
  if (Math.abs(transaction.amount - arCandidate.amount) < 0.01) {
    reasons.push('Exact amount match')
  }
  
  if (transaction.payee_final && arCandidate.customer_name && 
      transaction.payee_final.toLowerCase() === arCandidate.customer_name.toLowerCase()) {
    reasons.push('Exact payee/customer match')
  }
  
  if (confidence > 0.9) {
    reasons.push('High confidence AI match')
  } else if (confidence > 0.7) {
    reasons.push('AI suggested match')
  }
  
  return reasons.join('; ') || 'AI analysis suggests potential match'
}

async function acceptReconciliationMatch(supabase: any, data: any) {
  const { matchId, userId } = data
  
  try {
    const { data: match, error: matchError } = await supabase
      .from('reconciliation_matches')
      .select('*')
      .eq('id', matchId)
      .single()

    if (matchError) throw matchError

    // Update match status
    const { error: updateError } = await supabase
      .from('reconciliation_matches')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', matchId)

    if (updateError) throw updateError

    // Update AR candidate status
    const { error: arError } = await supabase
      .from('ar_candidates')
      .update({ status: 'matched' })
      .eq('id', match.ar_item_id)

    if (arError) throw arError

    // Record in history
    await supabase
      .from('reconciliation_history')
      .insert({
        match_id: matchId,
        action: 'accepted',
        user_id: userId,
        previous_state: match,
        new_state: { ...match, status: 'accepted', accepted_at: new Date().toISOString() }
      })

    // Update learning patterns
    await updateLearningPatterns(supabase, {
      clientId: match.client_id,
      ruleType: 'payee_pattern',
      pattern: match.match_reasoning,
      success: true
    })

    return new Response(
      JSON.stringify({ message: 'Match accepted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error accepting match:', error)
    throw error
  }
}

async function rejectReconciliationMatch(supabase: any, data: any) {
  const { matchId, userId, rejectionReason } = data
  
  try {
    const { data: match, error: matchError } = await supabase
      .from('reconciliation_matches')
      .select('*')
      .eq('id', matchId)
      .single()

    if (matchError) throw matchError

    // Update match status
    const { error: updateError } = await supabase
      .from('reconciliation_matches')
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
      .from('reconciliation_history')
      .insert({
        match_id: matchId,
        action: 'rejected',
        user_id: userId,
        previous_state: match,
        new_state: { ...match, status: 'rejected', rejected_at: new Date().toISOString(), rejection_reason: rejectionReason }
      })

    // Update learning patterns
    await updateLearningPatterns(supabase, {
      clientId: match.client_id,
      ruleType: 'payee_pattern',
      pattern: match.match_reasoning,
      success: false
    })

    return new Response(
      JSON.stringify({ message: 'Match rejected successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error rejecting match:', error)
    throw error
  }
}

async function getReconciliationData(supabase: any, clientId: string, userId: string) {
  try {
    // Get all reconciliation matches
    const { data: matches, error: matchesError } = await supabase
      .from('reconciliation_matches')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    if (matchesError) throw matchesError

    // Get AR candidates
    const { data: arCandidates, error: arError } = await supabase
      .from('ar_candidates')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    if (arError) throw arError

    // Calculate statistics
    const stats = {
      totalMatches: matches?.length || 0,
      proposedMatches: matches?.filter(m => m.status === 'proposed').length || 0,
      acceptedMatches: matches?.filter(m => m.status === 'accepted').length || 0,
      rejectedMatches: matches?.filter(m => m.status === 'rejected').length || 0,
      autoMatchRate: matches?.length ? Math.round((matches.filter(m => m.match_type === 'auto').length / matches.length) * 100) : 0,
      totalAmount: matches?.filter(m => m.status === 'accepted').reduce((sum, m) => sum + (m.match_confidence || 0), 0) || 0
    }

    return new Response(
      JSON.stringify({ 
        matches: matches || [],
        arCandidates: arCandidates || [],
        stats
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error getting reconciliation data:', error)
    throw error
  }
}

async function updateLearningPatterns(supabase: any, data: any) {
  const { clientId, ruleType, pattern, success } = data
  
  try {
    // Find existing rule
    const { data: existingRule } = await supabase
      .from('reconciliation_rules')
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
        .from('reconciliation_rules')
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
        .from('reconciliation_rules')
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
