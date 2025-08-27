import { useState, useCallback } from 'react'

export function usePrepaids() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const call = useCallback(async (action: string, data: any) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accruals-automation`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, data })
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }, [])

  const createSchedule = useCallback(async (args: any) => { setLoading(true); setError(null); try { return await call('prepaid_create_schedule', args) } catch (e:any){ setError(e.message); return null } finally { setLoading(false) } }, [call])
  const listSchedules = useCallback(async (clientId: string) => { setLoading(true); setError(null); try { return await call('prepaid_list', { client_id: clientId }) } catch (e:any){ setError(e.message); return [] } finally { setLoading(false) } }, [call])
  const postEntry = useCallback(async (entryId: string, userId: string) => { setLoading(true); setError(null); try { return await call('prepaid_post_entry', { entry_id: entryId, user_id: userId }) } catch (e:any){ setError(e.message); return null } finally { setLoading(false) } }, [call])

  return { loading, error, createSchedule, listSchedules, postEntry }
}


