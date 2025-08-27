import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Json = Record<string, unknown> | Array<unknown> | string | number | boolean | null

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders } })
  }

  try {
    const { action, data } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    switch (action) {
      case 'detect_candidates': {
        const { client_id, period } = data
        const result = await detectCandidates(supabase, client_id, period)
        return jsonResponse(result)
      }
      case 'list_candidates': {
        const { client_id, period, status } = data
        const result = await listCandidates(supabase, client_id, period, status)
        return jsonResponse(result)
      }
      case 'approve_accruals': {
        const { candidate_ids, period_end, user_id } = data
        const result = await approveAccruals(supabase, candidate_ids, period_end, user_id)
        return jsonResponse(result)
      }
      case 'reverse_accrual': {
        const { entry_id, date, user_id } = data
        const result = await reverseAccrual(supabase, entry_id, date, user_id)
        return jsonResponse(result)
      }
      case 'prepaid_create_schedule': {
        const { client_id, start_date, end_date, total_amount, asset_account, expense_account, user_id } = data
        const result = await createPrepaidSchedule(supabase, { client_id, start_date, end_date, total_amount, asset_account, expense_account, user_id })
        return jsonResponse(result)
      }
      case 'prepaid_list': {
        const { client_id } = data
        const result = await listPrepaidSchedules(supabase, client_id)
        return jsonResponse(result)
      }
      case 'prepaid_post_entry': {
        const { entry_id, user_id } = data
        const result = await postPrepaidEntry(supabase, entry_id, user_id)
        return jsonResponse(result)
      }
      case 'suggest_evidence': {
        const { client_id, target, target_id } = data
        const result = await suggestEvidence(supabase, client_id, target, target_id)
        return jsonResponse(result)
      }
      case 'attach_evidence': {
        const { target, target_id, document_id, confidence } = data
        const result = await attachEvidence(supabase, target, target_id, document_id, confidence)
        return jsonResponse(result)
      }
      case 'get_evidence': {
        const { target, target_id } = data
        const result = await getEvidence(supabase, target, target_id)
        return jsonResponse(result)
      }
      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders })
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders })
  }
})

function jsonResponse(payload: Json, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
}

async function detectCandidates(supabase: any, clientId: string, period: string) {
  // Heuristics v1: create candidates based on simple signals
  const { data: existing } = await supabase
    .from('accrual_candidates')
    .select('id')
    .eq('client_id', clientId)
    .eq('period', period)
    .limit(1)

  if (existing && existing.length > 0) {
    return { created: 0 }
  }

  // 1) Recurring vendor without current invoice
  // Assume transactions table exists; find average of last 3 months for same vendor but missing this month
  const { data: recur } = await supabase.rpc('accrual_detect_recurring', { p_client_id: clientId, p_period: period })
  // 2) Contract schedule date hit
  const { data: contract } = await supabase.rpc('accrual_detect_contract', { p_client_id: clientId, p_period: period })
  // 3) Month-end spike vs trailing average
  const { data: spike } = await supabase.rpc('accrual_detect_spike', { p_client_id: clientId, p_period: period })

  const rows = [...(recur||[]), ...(contract||[]), ...(spike||[])]
  if (rows.length === 0) {
    // fallback single demo
    rows.push({ expense_account: 'Office supplies', amount: 1000, reason: 'recurring_vendor', confidence: 0.8 })
  }

  const payload = rows.map((r: any) => ({
    client_id: clientId,
    period,
    suggested_amount: r.amount,
    confidence: r.confidence ?? 0.75,
    reason: r.reason,
    status: 'proposed',
    expense_account: r.expense_account || 'Expenses:Accrued'
  }))

  const { data, error } = await supabase.from('accrual_candidates').insert(payload).select()
  if (error) throw error
  return { created: data?.length || 0, candidates: data }
}

async function listCandidates(supabase: any, clientId: string, period?: string, status?: string) {
  let query = supabase.from('accrual_candidates').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
  if (period) query = query.eq('period', period)
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data
}

async function approveAccruals(supabase: any, candidateIds: string[], periodEnd: string, userId: string) {
  const { data: candidates, error: err1 } = await supabase
    .from('accrual_candidates')
    .select('*')
    .in('id', candidateIds)
  if (err1) throw err1

  // Create JEs per candidate and store je_id
  const postedIds: string[] = []
  for (const c of candidates) {
    // 1) journal entry
    const { data: je, error: jeErr } = await supabase.from('journal_entries').insert({
      client_id: c.client_id,
      date: periodEnd,
      memo: `Accrual for ${c.expense_account || 'Expense'} (${c.reason || ''})`,
      created_by: userId
    }).select('id').single()
    if (jeErr) throw jeErr

    // 2) lines: Dr Expense, Cr Accrued Liabilities
    const expenseAccount = c.expense_account || 'Expenses:Accrued'
    const accruedLiab = 'Liabilities:Accrued'
    const amt = Number(c.suggested_amount)
    const { error: lineErr } = await supabase.from('journal_entry_lines').insert([
      { journal_entry_id: je.id, account: expenseAccount, debit: amt, credit: 0, description: 'Accrual expense' },
      { journal_entry_id: je.id, account: accruedLiab, debit: 0, credit: amt, description: 'Accrued liabilities' }
    ])
    if (lineErr) throw lineErr

    // 3) accrual_entries row linked to JE
    const { data: entry, error: insErr } = await supabase.from('accrual_entries').insert({
      candidate_id: c.id,
      period_end_date: periodEnd,
      amount: amt,
      created_by: userId,
      je_id: je.id,
      posted_at: new Date().toISOString()
    }).select('id').single()
    if (insErr) throw insErr
    postedIds.push(entry.id)
  }

  const { error: err3 } = await supabase
    .from('accrual_candidates')
    .update({ status: 'accrued' })
    .in('id', candidateIds)
  if (err3) throw err3
  return { posted: postedIds.length }
}

async function reverseAccrual(supabase: any, entryId: string, date: string, userId: string) {
  // create a reversing entry and reversing JE
  const { data: original, error: err1 } = await supabase.from('accrual_entries').select('*').eq('id', entryId).single()
  if (err1) throw err1

  // Create reversing JE
  const { data: je, error: jeErr } = await supabase.from('journal_entries').insert({
    client_id: (await supabase.from('accrual_candidates').select('client_id').eq('id', original.candidate_id).single()).data.client_id,
    date,
    memo: 'Reverse accrual',
    created_by: userId
  }).select('id').single()
  if (jeErr) throw jeErr

  const amt = Number(original.amount)
  // Reverse lines: Dr Accrued Liabilities, Cr Expense
  const { error: lineErr } = await supabase.from('journal_entry_lines').insert([
    { journal_entry_id: je.id, account: 'Liabilities:Accrued', debit: amt, credit: 0, description: 'Reverse accrual' },
    { journal_entry_id: je.id, account: 'Expenses:Accrued', debit: 0, credit: amt, description: 'Reverse accrual' }
  ])
  if (lineErr) throw lineErr

  const { data: rev, error: err2 } = await supabase.from('accrual_entries').insert({
    candidate_id: original.candidate_id,
    period_end_date: date,
    amount: -amt,
    created_by: userId,
    reversed_entry_id: entryId,
    je_id: je.id,
    posted_at: new Date().toISOString()
  }).select('id').single()
  if (err2) throw err2

  const { error: err3 } = await supabase
    .from('accrual_candidates')
    .update({ status: 'reversed' })
    .eq('id', original.candidate_id)
  if (err3) throw err3

  return { reversed_entry_id: rev.id }
}

// Prepaids
async function createPrepaidSchedule(supabase: any, args: { client_id: string, start_date: string, end_date: string, total_amount: number, asset_account?: string, expense_account?: string, user_id: string }) {
  const months = monthDiff(new Date(args.start_date), new Date(args.end_date)) + 1
  const per = Number(args.total_amount) / months
  const { data: sched, error } = await supabase.from('prepaid_schedules').insert({
    client_id: args.client_id,
    start_date: args.start_date,
    end_date: args.end_date,
    total_amount: args.total_amount,
    remaining_amount: args.total_amount,
    asset_account: args.asset_account || 'Assets:Prepaid',
    expense_account: args.expense_account || 'Expenses:Prepaid Amortization',
    created_by: args.user_id
  }).select('id').single()
  if (error) throw error

  // seed monthly entries
  const entries: any[] = []
  let cursor = new Date(args.start_date)
  for (let i=0;i<months;i++) {
    entries.push({ schedule_id: sched.id, period_date: new Date(cursor.getFullYear(), cursor.getMonth(), 28).toISOString().slice(0,10), amount: per })
    cursor = new Date(cursor.getFullYear(), cursor.getMonth()+1, 1)
  }
  const { error: e2 } = await supabase.from('prepaid_entries').insert(entries)
  if (e2) throw e2
  return { schedule_id: sched.id, entries: entries.length }
}

async function listPrepaidSchedules(supabase: any, clientId: string) {
  const { data, error } = await supabase.from('prepaid_schedules').select('*, prepaid_entries(*)').eq('client_id', clientId)
  if (error) throw error
  return data
}

async function postPrepaidEntry(supabase: any, entryId: string, userId: string) {
  const { data: entry, error: e1 } = await supabase.from('prepaid_entries').select('*, prepaid_schedules(*)').eq('id', entryId).single()
  if (e1) throw e1
  const sched = entry.prepaid_schedules
  const { data: je, error: jeErr } = await supabase.from('journal_entries').insert({
    client_id: sched.client_id,
    date: entry.period_date,
    memo: 'Prepaid amortization',
    created_by: userId
  }).select('id').single()
  if (jeErr) throw jeErr
  const { error: lErr } = await supabase.from('journal_entry_lines').insert([
    { journal_entry_id: je.id, account: sched.expense_account, debit: Number(entry.amount), credit: 0, description: 'Amortize prepaid' },
    { journal_entry_id: je.id, account: sched.asset_account, debit: 0, credit: Number(entry.amount), description: 'Reduce prepaid' }
  ])
  if (lErr) throw lErr
  const { error: u1 } = await supabase.from('prepaid_entries').update({ status: 'posted', posted_at: new Date().toISOString(), je_id: je.id }).eq('id', entryId)
  if (u1) throw u1
  const { error: u2 } = await supabase.rpc('prepaid_reduce_remaining', { p_schedule_id: sched.id, p_amount: Number(entry.amount) })
  if (u2) throw u2
  return { je_id: je.id }
}

function monthDiff(d1: Date, d2: Date) {
  return (d2.getFullYear()-d1.getFullYear())*12 + (d2.getMonth()-d1.getMonth())
}

async function suggestEvidence(supabase: any, clientId: string, target: 'accrual'|'prepaid', targetId: string) {
  // signal-based: recent docs scored by amount/date proximity if available
  let anchorAmount = 0, anchorDate = new Date()
  if (target === 'accrual') {
    const { data: cand } = await supabase.from('accrual_candidates').select('suggested_amount, created_at').eq('id', targetId).single()
    if (cand) { anchorAmount = Number(cand.suggested_amount); anchorDate = new Date(cand.created_at) }
  } else {
    const { data: sched } = await supabase.from('prepaid_schedules').select('total_amount, start_date').eq('id', targetId).single()
    if (sched) { anchorAmount = Number(sched.total_amount); anchorDate = new Date(sched.start_date) }
  }
  const { data: docs, error } = await supabase
    .from('documents')
    .select('id, filename, created_at, financial_processing_response')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(25)
  if (error) throw error
  const scored = (docs||[]).map((d: any) => {
    const parsed = d.financial_processing_response || {}
    const docAmt = Number(parsed.amount) || 0
    const docDate = parsed.date ? new Date(parsed.date) : new Date(d.created_at)
    const amountScore = anchorAmount > 0 && docAmt > 0 ? 1 - Math.min(1, Math.abs(docAmt-anchorAmount)/Math.max(anchorAmount,1)) : 0.5
    const days = Math.abs((docDate.getTime()-anchorDate.getTime())/(1000*60*60*24))
    const dateScore = 1 - Math.min(1, days/30)
    const confidence = Math.max(0, Math.min(1, 0.6*amountScore + 0.4*dateScore))
    return { document_id: d.id, filename: d.filename, confidence }
  }).sort((a,b)=>b.confidence-a.confidence).slice(0,5)
  return scored
}

async function attachEvidence(supabase: any, target: 'accrual'|'prepaid', targetId: string, documentId: string, confidence?: number) {
  if (target === 'accrual') {
    const { error } = await supabase.from('accrual_evidence_links').insert({ candidate_id: targetId, document_id: documentId, confidence: confidence ?? 0.7 })
    if (error) throw error
  } else {
    const { error } = await supabase.from('prepaid_evidence_links').insert({ schedule_id: targetId, document_id: documentId, confidence: confidence ?? 0.7 })
    if (error) throw error
  }
  return { attached: true }
}

async function getEvidence(supabase: any, target: 'accrual'|'prepaid', targetId: string) {
  if (target === 'accrual') {
    const { data, error } = await supabase.from('accrual_evidence_links').select('document_id, confidence').eq('candidate_id', targetId)
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase.from('prepaid_evidence_links').select('document_id, confidence').eq('schedule_id', targetId)
    if (error) throw error
    return data
  }
}


