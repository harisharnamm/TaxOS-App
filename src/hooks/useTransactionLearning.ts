import { useState, useCallback, useContext } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

export interface UserFeedback {
  transactionId: string;
  action: 'accepted' | 'rejected' | 'modified';
  originalSuggestion: {
    category: string;
    payee: string;
    confidence: number;
  };
  userChoice: {
    category: string;
    payee: string;
  };
  feedbackReason?: string;
}

export interface AISuggestion {
  category: string;
  payee: string;
  confidence: number;
  source: 'learning_pattern' | 'finicity' | 'fallback';
}

export interface LearningAnalytics {
  totalPatterns: number;
  highConfidencePatterns: number;
  averageSuccessRate: number;
  recentImprovements: number;
}

export function useTransactionLearning() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store user feedback for learning
  const storeFeedback = useCallback(async (feedback: UserFeedback): Promise<boolean> => {
    if (!user) {
      setError('User not authenticated');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('transaction-learning', {
        body: {
          action: 'store_feedback',
          ...feedback,
          userId: user.id,
          timestamp: new Date().toISOString()
        }
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (!data.success) {
        throw new Error('Failed to store feedback');
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error storing feedback:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Get AI suggestions based on learning patterns
  const getAISuggestions = useCallback(async (transactionDescription: string): Promise<AISuggestion | null> => {
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('transaction-learning', {
        body: {
          action: 'get_suggestions',
          userId: user.id,
          transactionDescription
        }
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (!data.success) {
        throw new Error('Failed to get AI suggestions');
      }

      return data.suggestions;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error getting AI suggestions:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Get learning analytics for the user
  const getLearningAnalytics = useCallback(async (): Promise<LearningAnalytics | null> => {
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('transaction-learning', {
        body: {
          action: 'get_analytics',
          userId: user.id
        }
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (!data.success) {
        throw new Error('Failed to get learning analytics');
      }

      return data.analytics;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error getting learning analytics:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Accept AI suggestion
  const acceptSuggestion = useCallback(async (
    transactionId: string,
    suggestion: { category: string; payee: string; confidence: number }
  ): Promise<boolean> => {
    const feedback: UserFeedback = {
      transactionId,
      action: 'accepted',
      originalSuggestion: suggestion,
      userChoice: suggestion
    };

    return await storeFeedback(feedback);
  }, [storeFeedback]);

  // Reject AI suggestion
  const rejectSuggestion = useCallback(async (
    transactionId: string,
    suggestion: { category: string; payee: string; confidence: number },
    feedbackReason?: string
  ): Promise<boolean> => {
    const feedback: UserFeedback = {
      transactionId,
      action: 'rejected',
      originalSuggestion: suggestion,
      userChoice: { category: '', payee: '' },
      feedbackReason
    };

    return await storeFeedback(feedback);
  }, [storeFeedback]);

  // Modify AI suggestion
  const modifySuggestion = useCallback(async (
    transactionId: string,
    originalSuggestion: { category: string; payee: string; confidence: number },
    userChoice: { category: string; payee: string }
  ): Promise<boolean> => {
    const feedback: UserFeedback = {
      transactionId,
      action: 'modified',
      originalSuggestion,
      userChoice
    };

    return await storeFeedback(feedback);
  }, [storeFeedback]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // Core functions
    storeFeedback,
    getAISuggestions,
    getLearningAnalytics,
    
    // Convenience functions
    acceptSuggestion,
    rejectSuggestion,
    modifySuggestion,
    
    // State
    isLoading,
    error,
    clearError
  };
}
