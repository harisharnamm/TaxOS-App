import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface DocumentTransactionMatch {
  id: string;
  document_id: string;
  transaction_id: string;
  match_confidence: number;
  match_reasoning: string;
  match_type: 'auto' | 'manual' | 'ai_suggested';
  status: 'proposed' | 'accepted' | 'rejected' | 'modified';
  user_id: string;
  client_id: string;
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  modified_fields?: any;
  documents?: {
    id: string;
    filename: string;
    document_type: string;
    financial_processing_response?: any;
  };
  transactions?: {
    id: string;
    amount: number;
    raw_description?: string;
    payee_final?: string;
    date_posted: string;
  };
}

export interface UnmatchedDocument {
  id: string;
  document_id: string;
  client_id: string;
  user_id: string;
  document_type: string;
  expected_amount?: number;
  expected_date?: string;
  vendor_name?: string;
  invoice_number?: string;
  status: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
  documents?: {
    id: string;
    filename: string;
    document_type: string;
    financial_processing_response?: any;
    ai_analysis_response?: any;
  };
}

export interface MatchingStats {
  totalMatches: number;
  proposedMatches: number;
  acceptedMatches: number;
  rejectedMatches: number;
  autoMatchRate: number;
}

export interface MatchingData {
  matches: DocumentTransactionMatch[];
  stats: MatchingStats;
}

export function useDocumentTransactionMatching(clientId?: string) {
  const { user } = useAuth();
  const [matchingData, setMatchingData] = useState<MatchingData | null>(null);
  const [unmatchedDocuments, setUnmatchedDocuments] = useState<UnmatchedDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMatchingData = useCallback(async () => {
    if (!clientId || !user) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: responseError } = await supabase.functions.invoke('document-transaction-matching', {
        body: {
          action: 'get_matching_data',
          clientId,
          userId: user.id
        }
      });

      if (responseError) throw responseError;

      setMatchingData(data);
    } catch (err) {
      console.error('Error loading matching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load matching data');
    } finally {
      setLoading(false);
    }
  }, [clientId, user]);

  const loadUnmatchedDocuments = useCallback(async () => {
    if (!clientId || !user) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: responseError } = await supabase.functions.invoke('document-transaction-matching', {
        body: {
          action: 'get_unmatched_documents',
          clientId,
          userId: user.id
        }
      });

      if (responseError) throw responseError;

      setUnmatchedDocuments(data.unmatchedDocuments || []);
    } catch (err) {
      console.error('Error loading unmatched documents:', err);
      setError(err instanceof Error ? err.message : 'Failed to load unmatched documents');
    } finally {
      setLoading(false);
    }
  }, [clientId, user]);

  const generateMatches = useCallback(async () => {
    if (!clientId || !user) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: responseError } = await supabase.functions.invoke('document-transaction-matching', {
        body: {
          action: 'generate_matches',
          clientId,
          userId: user.id
        }
      });

      if (responseError) throw responseError;

      // Refresh the data after generating matches
      await loadMatchingData();
      await loadUnmatchedDocuments();

      return data;
    } catch (err) {
      console.error('Error generating matches:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate matches');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clientId, user, loadMatchingData, loadUnmatchedDocuments]);

  const acceptMatch = useCallback(async (matchId: string) => {
    if (!user) return;

    try {
      const { error: responseError } = await supabase.functions.invoke('document-transaction-matching', {
        body: {
          action: 'accept_match',
          matchId,
          userId: user.id
        }
      });

      if (responseError) throw responseError;

      // Refresh the data after accepting the match
      await loadMatchingData();
      await loadUnmatchedDocuments();

      return true;
    } catch (err) {
      console.error('Error accepting match:', err);
      setError(err instanceof Error ? err.message : 'Failed to accept match');
      throw err;
    }
  }, [user, loadMatchingData, loadUnmatchedDocuments]);

  const rejectMatch = useCallback(async (matchId: string, rejectionReason?: string) => {
    if (!user) return;

    try {
      const { error: responseError } = await supabase.functions.invoke('document-transaction-matching', {
        body: {
          action: 'reject_match',
          matchId,
          userId: user.id,
          rejectionReason: rejectionReason || 'User rejected match'
        }
      });

      if (responseError) throw responseError;

      // Refresh the data after rejecting the match
      await loadMatchingData();

      return true;
    } catch (err) {
      console.error('Error rejecting match:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject match');
      throw err;
    }
  }, [user, loadMatchingData]);

  const updateLearningPatterns = useCallback(async (data: {
    clientId: string;
    ruleType: string;
    pattern: string;
    success: boolean;
  }) => {
    if (!user) return;

    try {
      const { error: responseError } = await supabase.functions.invoke('document-transaction-matching', {
        body: {
          action: 'update_learning_patterns',
          ...data
        }
      });

      if (responseError) throw responseError;

      return true;
    } catch (err) {
      console.error('Error updating learning patterns:', err);
      // Don't set error for learning pattern updates
      return false;
    }
  }, [user]);

  // Load data when clientId or user changes
  useEffect(() => {
    if (clientId && user) {
      loadMatchingData();
      loadUnmatchedDocuments();
    }
  }, [clientId, user, loadMatchingData, loadUnmatchedDocuments]);

  // Helper functions for filtering and sorting
  const getMatchesByStatus = useCallback((status: DocumentTransactionMatch['status']) => {
    return matchingData?.matches.filter(match => match.status === status) || [];
  }, [matchingData]);

  const getMatchesByType = useCallback((type: DocumentTransactionMatch['match_type']) => {
    return matchingData?.matches.filter(match => match.match_type === type) || [];
  }, [matchingData]);

  const getHighConfidenceMatches = useCallback(() => {
    return matchingData?.matches.filter(match => match.match_confidence > 0.8) || [];
  }, [matchingData]);

  const getPendingMatches = useCallback(() => {
    return matchingData?.matches.filter(match => match.status === 'proposed') || [];
  }, [matchingData]);

  return {
    // State
    matchingData,
    unmatchedDocuments,
    loading,
    error,
    
    // Actions
    loadMatchingData,
    loadUnmatchedDocuments,
    generateMatches,
    acceptMatch,
    rejectMatch,
    updateLearningPatterns,
    
    // Helper functions
    getMatchesByStatus,
    getMatchesByType,
    getHighConfidenceMatches,
    getPendingMatches,
    
    // Computed values
    hasMatches: (matchingData?.matches.length || 0) > 0,
    hasUnmatchedDocuments: (unmatchedDocuments.length || 0) > 0,
    totalMatches: matchingData?.stats.totalMatches || 0,
    autoMatchRate: matchingData?.stats.autoMatchRate || 0
  };
}
