import { useState, useCallback } from 'react';
import { documentService } from '../lib/documentService';
import { useAuth } from './useAuth';

export type DocumentClassification = 'Financial' | 'Identity' | 'Tax' | 'Unknown';

export interface DocumentProcessingState {
  isProcessing: boolean;
  classification?: DocumentClassification;
  needsApproval: boolean;
  processingStep: 'idle' | 'ocr' | 'classification' | 'specific_processing' | 'completed' | 'error';
  error?: string;
}

export function useDocumentProcessing() {
  const { user } = useAuth();
  const [processingStates, setProcessingStates] = useState<Record<string, DocumentProcessingState>>({});

  const updateProcessingState = useCallback((documentId: string, updates: Partial<DocumentProcessingState>) => {
    setProcessingStates(prev => ({
      ...prev,
      [documentId]: { ...prev[documentId], ...updates }
    }));
  }, []);

  const getProcessingState = useCallback((documentId: string): DocumentProcessingState => {
    return processingStates[documentId] || {
      isProcessing: false,
      needsApproval: false,
      processingStep: 'idle'
    };
  }, [processingStates]);

  const approveClassification = useCallback(async (
    documentId: string, 
    classification: DocumentClassification
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    updateProcessingState(documentId, {
      isProcessing: true,
      processingStep: 'specific_processing',
      needsApproval: false
    });

    try {
      const result = await documentService.processDocumentByType(documentId, classification);
      
      if (result.success) {
        updateProcessingState(documentId, {
          isProcessing: false,
          processingStep: 'completed'
        });
      } else {
        updateProcessingState(documentId, {
          isProcessing: false,
          processingStep: 'error',
          error: result.error
        });
      }

      return result;
    } catch (error: any) {
      updateProcessingState(documentId, {
        isProcessing: false,
        processingStep: 'error',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }, [user, updateProcessingState]);

  const overrideClassification = useCallback(async (
    documentId: string, 
    newClassification: DocumentClassification
  ): Promise<{ success: boolean; error?: string }> => {
    // Update the classification and then approve it
    updateProcessingState(documentId, {
      classification: newClassification
    });

    return approveClassification(documentId, newClassification);
  }, [approveClassification]);

  const resetProcessingState = useCallback((documentId: string) => {
    setProcessingStates(prev => {
      const newState = { ...prev };
      delete newState[documentId];
      return newState;
    });
  }, []);

  return {
    getProcessingState,
    updateProcessingState,
    approveClassification,
    overrideClassification,
    resetProcessingState
  };
}