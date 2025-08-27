import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface AccrualCandidate {
  id: string
  client_id: string
  period: string
  suggested_amount: number
  confidence: number | null
  reason: string | null
  expense_account?: string | null
  status: 'proposed' | 'approved' | 'accrued' | 'reversed'
  created_at: string
}

export function useAccruals() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const call = useCallback(async (action: string, data: any) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accruals-automation`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ action, data })
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }, [])

  const listCandidates = useCallback(async (clientId: string, period?: string, status?: string): Promise<AccrualCandidate[]> => {
    setLoading(true); setError(null)
    try {
      return await call('list_candidates', { client_id: clientId, period, status })
    } catch (e: any) {
      setError(e.message); return []
    } finally { setLoading(false) }
  }, [call])

  const detectCandidates = useCallback(async (clientId: string, period: string) => {
    setLoading(true); setError(null)
    try { return await call('detect_candidates', { client_id: clientId, period }) }
    catch (e: any) { setError(e.message); return null }
    finally { setLoading(false) }
  }, [call])

  const approveAccruals = useCallback(async (candidateIds: string[], periodEnd: string, userId: string) => {
    setLoading(true); setError(null)
    try { return await call('approve_accruals', { candidate_ids: candidateIds, period_end: periodEnd, user_id: userId }) }
    catch (e: any) { setError(e.message); return null }
    finally { setLoading(false) }
  }, [call])

  const reverseAccrual = useCallback(async (entryId: string, date: string, userId: string) => {
    setLoading(true); setError(null)
    try { return await call('reverse_accrual', { entry_id: entryId, date, user_id: userId }) }
    catch (e: any) { setError(e.message); return null }
    finally { setLoading(false) }
  }, [call])

  const reverseByCandidate = useCallback(async (candidateId: string, date: string, userId: string) => {
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase
        .from('accrual_entries')
        .select('id')
        .eq('candidate_id', candidateId)
        .order('posted_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('No accrual entry found for candidate')
      return await call('reverse_accrual', { entry_id: data.id, date, user_id: userId })
    } catch (e: any) {
      setError(e.message); return null
    } finally { setLoading(false) }
  }, [call])

  const clearError = useCallback(() => setError(null), [])

  return { loading, error, listCandidates, detectCandidates, approveAccruals, reverseAccrual, reverseByCandidate, clearError }
}


