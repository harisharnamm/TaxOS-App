import { useState, useCallback } from 'react'

export function useEvidence() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const call = useCallback(async (action: string, data: any) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accruals-automation`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, data }) })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }, [])

  const suggest = useCallback(async (clientId: string, target: 'accrual'|'prepaid', targetId: string) => {
    setLoading(true); setError(null)
    try { return await call('suggest_evidence', { client_id: clientId, target, target_id: targetId }) }
    catch (e:any){ setError(e.message); return [] }
    finally { setLoading(false) }
  }, [call])

  const attach = useCallback(async (target: 'accrual'|'prepaid', targetId: string, documentId: string, confidence?: number) => {
    setLoading(true); setError(null)
    try { return await call('attach_evidence', { target, target_id: targetId, document_id: documentId, confidence }) }
    catch (e:any){ setError(e.message); return null }
    finally { setLoading(false) }
  }, [call])

  const get = useCallback(async (target: 'accrual'|'prepaid', targetId: string) => {
    setLoading(true); setError(null)
    try { return await call('get_evidence', { target, target_id: targetId }) }
    catch (e:any){ setError(e.message); return [] }
    finally { setLoading(false) }
  }, [call])

  return { loading, error, suggest, attach, get }
}


