import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

export interface ReconciliationMatch {
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

export interface ARCandidate {
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

export interface ReconciliationStats {
  totalMatches: number
  proposedMatches: number
  acceptedMatches: number
  rejectedMatches: number
  autoMatchRate: number
  totalAmount: number
}

export interface ReconciliationData {
  matches: ReconciliationMatch[]
  arCandidates: ARCandidate[]
  stats: ReconciliationStats
}

export function useDepositReconciliation(clientId?: string) {
  const { user } = useAuth()
  const [data, setData] = useState<ReconciliationData>({
    matches: [],
    arCandidates: [],
    stats: {
      totalMatches: 0,
      proposedMatches: 0,
      acceptedMatches: 0,
      rejectedMatches: 0,
      autoMatchRate: 0,
      totalAmount: 0
    }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load reconciliation data
  const loadReconciliationData = useCallback(async () => {
    if (!clientId || !user) return

    setLoading(true)
    setError(null)

    try {
      const { data: result, error: apiError } = await supabase.functions.invoke('deposit-reconciliation', {
        body: {
          action: 'get_reconciliation_data',
          clientId,
          userId: user.id
        }
      })

      if (apiError) throw apiError

      setData(result)
      console.log('✅ Reconciliation data loaded:', result)

    } catch (err) {
      console.error('❌ Error loading reconciliation data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load reconciliation data')
    } finally {
      setLoading(false)
    }
  }, [clientId, user])

  // Generate AI matches
  const generateMatches = useCallback(async () => {
    if (!clientId || !user) return

    setLoading(true)
    setError(null)

    try {
      const { data: result, error: apiError } = await supabase.functions.invoke('deposit-reconciliation', {
        body: {
          action: 'generate_matches',
          clientId,
          userId: user.id
        }
      })

      if (apiError) throw apiError

      console.log('✅ AI matches generated:', result)
      
      // Reload data to show new matches
      await loadReconciliationData()

    } catch (err) {
      console.error('❌ Error generating matches:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate matches')
    } finally {
      setLoading(false)
    }
  }, [clientId, user, loadReconciliationData])

  // Accept a match
  const acceptMatch = useCallback(async (matchId: string) => {
    if (!user) return

    try {
      const { error: apiError } = await supabase.functions.invoke('deposit-reconciliation', {
        body: {
          action: 'accept_match',
          matchId,
          userId: user.id
        }
      })

      if (apiError) throw apiError

      console.log('✅ Match accepted:', matchId)
      
      // Update local state
      setData(prev => ({
        ...prev,
        matches: prev.matches.map(match => 
          match.id === matchId 
            ? { ...match, status: 'accepted' as const, accepted_at: new Date().toISOString() }
            : match
        ),
        stats: {
          ...prev.stats,
          proposedMatches: prev.stats.proposedMatches - 1,
          acceptedMatches: prev.stats.acceptedMatches + 1
        }
      }))

    } catch (err) {
      console.error('❌ Error accepting match:', err)
      throw err
    }
  }, [user])

  // Reject a match
  const rejectMatch = useCallback(async (matchId: string, rejectionReason?: string) => {
    if (!user) return

    try {
      const { error: apiError } = await supabase.functions.invoke('deposit-reconciliation', {
        body: {
          action: 'reject_match',
          matchId,
          userId: user.id,
          rejectionReason
        }
      })

      if (apiError) throw apiError

      console.log('✅ Match rejected:', matchId)
      
      // Update local state
      setData(prev => ({
        ...prev,
        matches: prev.matches.map(match => 
          match.id === matchId 
            ? { ...match, status: 'rejected' as const, rejected_at: new Date().toISOString(), rejection_reason: rejectionReason }
            : match
        ),
        stats: {
          ...prev.stats,
          proposedMatches: prev.stats.proposedMatches - 1,
          rejectedMatches: prev.stats.rejectedMatches + 1
        }
      }))

    } catch (err) {
      console.error('❌ Error rejecting match:', err)
      throw err
    }
  }, [user])

  // Bulk accept matches
  const acceptSelectedMatches = useCallback(async (matchIds: string[]) => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const promises = matchIds.map(matchId => acceptMatch(matchId))
      await Promise.all(promises)

      console.log('✅ Bulk accepted matches:', matchIds)
      
      // Reload data to ensure consistency
      await loadReconciliationData()

    } catch (err) {
      console.error('❌ Error bulk accepting matches:', err)
      setError(err instanceof Error ? err.message : 'Failed to accept some matches')
    } finally {
      setLoading(false)
    }
  }, [user, acceptMatch, loadReconciliationData])

  // Get filtered matches by status
  const getMatchesByStatus = useCallback((status: ReconciliationMatch['status']) => {
    return data.matches.filter(match => match.status === status)
  }, [data.matches])

  // Get proposed matches
  const proposedMatches = getMatchesByStatus('proposed')
  
  // Get accepted matches
  const acceptedMatches = getMatchesByStatus('accepted')
  
  // Get rejected matches
  const rejectedMatches = getMatchesByStatus('rejected')

  // Get open AR candidates
  const openARCandidates = data.arCandidates.filter(ar => ar.status === 'open')

  // Load data on mount and when clientId changes
  useEffect(() => {
    if (clientId && user) {
      loadReconciliationData()
    }
  }, [clientId, user, loadReconciliationData])

  return {
    // Data
    data,
    matches: data.matches,
    arCandidates: data.arCandidates,
    stats: data.stats,
    
    // Filtered data
    proposedMatches,
    acceptedMatches,
    rejectedMatches,
    openARCandidates,
    
    // State
    loading,
    error,
    
    // Actions
    loadReconciliationData,
    generateMatches,
    acceptMatch,
    rejectMatch,
    acceptSelectedMatches,
    
    // Utilities
    getMatchesByStatus
  }
}
