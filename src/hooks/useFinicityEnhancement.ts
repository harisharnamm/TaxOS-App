import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

export interface EnhancementResult {
  success: boolean;
  message: string;
  updated: number;
  errors: number;
}

export function useFinicityEnhancement() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enhance a single transaction
  const enhanceTransaction = useCallback(async (transactionId: string): Promise<EnhancementResult | null> => {
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('data-enrichment', {
        body: {
          action: 'enrich_transactions',
          transactionIds: [transactionId]
        }
      });

      if (invokeError) {
        throw new Error(`Function error: ${invokeError.message}`);
      }

      if (data?.success) {
        return data;
      } else {
        throw new Error(data?.error || 'Enrichment failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Enhance multiple transactions
  const enhanceTransactions = useCallback(async (transactionIds: string[]): Promise<EnhancementResult | null> => {
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    if (transactionIds.length === 0) {
      setError('No transactions selected');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('data-enrichment', {
        body: {
          action: 'enrich_transactions',
          transactionIds
        }
      });

      if (invokeError) {
        throw new Error(`Function error: ${invokeError.message}`);
      }

      if (data?.success) {
        return data;
      } else {
        throw new Error(data?.error || 'Enrichment failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    enhanceTransaction,
    enhanceTransactions,
    isLoading,
    error,
    clearError: () => setError(null)
  };
}
