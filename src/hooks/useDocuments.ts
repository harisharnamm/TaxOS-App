import { useState, useEffect, useCallback } from 'react';
import { 
  getUserDocuments, 
  getClientDocuments, 
  getDocument,
  deleteDocument as deleteDocumentQuery,
  getDocumentAnalytics,
  bulkUpdateDocuments,
  bulkDeleteDocuments
} from '../lib/documentQueries';
import { documentService } from '../lib/documentService';
import { useAuth } from './useAuth';
import { 
  Document, 
  DocumentFilter, 
  DocumentAnalytics 
} from '../types/documents';

export function useDocuments(clientId?: string) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async (filter?: DocumentFilter) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      let result;
      if (clientId) {
        result = await getClientDocuments(clientId, filter);
      } else {
        result = await getUserDocuments(user.id, filter);
      }

      if (result.error) {
        setError(result.error.message);
      } else {
        setDocuments(result.data || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, clientId]);

  const refreshDocuments = useCallback((filter?: DocumentFilter) => {
    fetchDocuments(filter);
  }, [fetchDocuments]);

  const deleteDocument = useCallback(async (documentId: string) => {
    try {
      const { error } = await documentService.deleteDocument(documentId);
      if (error) {
        throw error;
      }
      
      // Remove from local state
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      return { success: true, error: null };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  const downloadDocument = useCallback(async (documentId: string, filename: string) => {
    try {
      const { data, error } = await documentService.downloadDocument(documentId);
      if (error || !data) {
        throw error || new Error('Failed to download document');
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      return { success: true };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  const getDocumentPreviewURL = useCallback(async (documentId: string) => {
    try {
      console.log('🔍 Getting preview URL for document:', documentId);
      const { data, error } = await documentService.getDocumentSignedURL(documentId, 3600);
      console.log('📄 Document service response:', { data, error });
      if (error) {
        console.error('❌ Error getting signed URL:', error);
        throw error;
      }
      console.log('✅ Generated signed URL:', data);
      return { url: data, error: null };
    } catch (err: any) {
      console.error('❌ Exception in getDocumentPreviewURL:', err);
      return { url: null, error: err.message };
    }
  }, []);

  const bulkUpdate = useCallback(async (
    documentIds: string[], 
    updates: Partial<Pick<Document, 'tags' | 'document_type' | 'is_processed'>>
  ) => {
    try {
      const { data, error } = await bulkUpdateDocuments(documentIds, updates);
      if (error) {
        throw error;
      }

      // Update local state
      setDocuments(prev => prev.map(doc => {
        if (documentIds.includes(doc.id)) {
          return { ...doc, ...updates };
        }
        return doc;
      }));

      return { success: true, data };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  const bulkDelete = useCallback(async (documentIds: string[]) => {
    try {
      // Delete from storage and database
      await Promise.all(
        documentIds.map(id => documentService.deleteDocument(id))
      );

      // Update local state
      setDocuments(prev => prev.filter(doc => !documentIds.includes(doc.id)));
      return { success: true };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  // Load documents on mount
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return {
    documents,
    loading,
    error,
    refreshDocuments,
    deleteDocument,
    downloadDocument,
    getDocumentPreviewURL,
    bulkUpdate,
    bulkDelete,
    setError,
  };
}

export function useDocumentAnalytics() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<DocumentAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: analyticsError } = await getDocumentAnalytics(user.id);
      
      if (analyticsError) {
        setError(analyticsError.message);
      } else if (data) {
        // Add storage usage calculation (mock for now)
        const analyticsWithStorage: DocumentAnalytics = {
          ...data,
          storageUsage: {
            used: data.totalSize,
            limit: 1024 * 1024 * 1024, // 1GB limit
            percentage: (data.totalSize / (1024 * 1024 * 1024)) * 100,
          },
        };
        setAnalytics(analyticsWithStorage);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    analytics,
    loading,
    error,
    refreshAnalytics: fetchAnalytics,
  };
}
