import { useState, useCallback } from 'react';
import { documentService } from '../lib/documentService';
import { useAuth } from './useAuth';
import { 
  Document, 
  DocumentUploadOptions, 
  UploadProgress 
} from '../types/documents';

export function useDocumentUpload() {
  const { user } = useAuth();
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const uploadSingleDocument = useCallback(async (
    file: File,
    clientId?: string,
    options: DocumentUploadOptions = {}
  ): Promise<{ data: Document | null; error: any }> => {
    if (!user) {
      return { data: null, error: new Error('User not authenticated') };
    }

    setIsUploading(true);

    // Merge clientId into options
    const finalOptions = {
      ...options,
      clientId: clientId || options.clientId
    };

    const result = await documentService.uploadDocument(
      file,
      user.id,
      finalOptions,
      (progress) => {
        setUploads(prev => {
          const existingIndex = prev.findIndex(p => p.file.name === file.name);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = progress;
            return updated;
          } else {
            return [...prev, progress];
          }
        });
      }
    );

    setIsUploading(false);
    return result;
  }, [user]);

  const uploadMultipleDocuments = useCallback(async (
    files: File[],
    clientId?: string,
    options: DocumentUploadOptions = {}
  ): Promise<{ results: Array<{ data: Document | null; error: any }> }> => {
    if (!user) {
      return { 
        results: files.map(() => ({ 
          data: null, 
          error: new Error('User not authenticated') 
        }))
      };
    }

    setIsUploading(true);

    // Merge clientId into options
    const finalOptions = {
      ...options,
      clientId: clientId || options.clientId
    };

    const result = await documentService.uploadMultipleDocuments(
      files,
      user.id,
      finalOptions,
      (progressArray) => {
        setUploads(progressArray);
      }
    );

    setIsUploading(false);
    return result;
  }, [user]);

  const clearUploads = useCallback(() => {
    setUploads([]);
  }, []);

  const removeUpload = useCallback((fileName: string) => {
    setUploads(prev => prev.filter(upload => upload.file.name !== fileName));
  }, []);

  return {
    uploads,
    isUploading,
    uploadSingleDocument,
    uploadMultipleDocuments,
    clearUploads,
    removeUpload,
  };
}
