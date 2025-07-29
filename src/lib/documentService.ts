import { supabase } from './supabase';
import { 
  validateFile, 
  generateUniqueFilename, 
  detectDocumentType, 
  getBucketName,
  compressImageFile 
} from './uploadUtils';
import { 
  createDocumentRecord, 
  updateDocumentProcessing,
  createIRSNoticeRecord 
} from './documentQueries';
import { 
  Document, 
  DocumentUploadOptions, 
  UploadProgress,
  DocumentType 
} from '../types/documents';

export class DocumentService {
  /**
   * Uploads a single file to Supabase Storage and creates database record
   */
  async uploadDocument(
    file: File,
    userId: string,
    options: DocumentUploadOptions = {},
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{ data: Document | null; error: any }> {
    try {
      console.log('📤 DocumentService.uploadDocument called with:', {
        fileName: file.name,
        userId,
        clientId: options.clientId,
        documentType: options.documentType
      });
      
      // Validate that clientId is provided
      if (!options.clientId) {
        const error = new Error('Client ID is required for document upload');
        onProgress?.({
          file,
          progress: 0,
          status: 'error',
          error: error.message,
        });
        return { data: null, error };
      }

      // Validate file
      const validation = validateFile(file);
      if (!validation.isValid) {
        const error = new Error(validation.error);
        onProgress?.({
          file,
          progress: 0,
          status: 'error',
          error: validation.error,
        });
        return { data: null, error };
      }

      console.log('✅ File validation passed');
      console.log('📤 Starting upload with options:', {
        clientId: options.clientId,
        documentType: options.documentType,
        tags: options.tags
      });

      // Update progress - starting
      onProgress?.({
        file,
        progress: 10,
        status: 'uploading',
      });

      // Compress image if needed
      let processedFile = file;
      if (file.type.startsWith('image/') && file.size > 2 * 1024 * 1024) {
        processedFile = await compressImageFile(file);
      }

      // Detect document type if not provided
      const documentType = options.documentType || detectDocumentType(file.name);
      
      // Generate unique filename and storage path
      const uniqueFilename = generateUniqueFilename(file.name, userId);
      const bucketName = getBucketName(documentType);
      const storagePath = `${userId}/${uniqueFilename}`;

      onProgress?.({
        file,
        progress: 30,
        status: 'uploading',
      });

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, processedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        onProgress?.({
          file,
          progress: 0,
          status: 'error',
          error: uploadError.message,
        });
        return { data: null, error: uploadError };
      }

      onProgress?.({
        file,
        progress: 60,
        status: 'uploading',
      });

      // Create database record
      const { data: documentData, error: dbError } = await createDocumentRecord({
        user_id: userId,
        client_id: options.clientId,
        filename: uniqueFilename,
        original_filename: file.name,
        file_size: processedFile.size,
        mime_type: file.type,
        document_type: documentType,
        storage_path: uploadData.path,
        tags: options.tags,
      });

      if (dbError) {
        // Cleanup uploaded file if database insert fails
        await this.deleteFileFromStorage(bucketName, storagePath);
        console.error('❌ Database insert failed:', dbError);
        onProgress?.({
          file,
          progress: 0,
          status: 'error',
          error: dbError.message,
        });
        return { data: null, error: dbError };
      }

      console.log('✅ Document record created:', {
        id: documentData?.id,
        clientId: documentData?.client_id,
        filename: documentData?.original_filename
      });

      onProgress?.({
        file,
        progress: 80,
        status: 'processing',
        documentId: documentData?.id,
      });

      // Start background processing if enabled
      if (options.processingOptions?.enableOCR || options.processingOptions?.enableAI) {
        console.log('🤖 Starting background processing for document:', documentData!.id);
        this.initiateDocumentProcessing(documentData!.id, userId, options.processingOptions);
      } else {
        console.log('⏭️ Skipping background processing (not enabled)');
      }

      // Note: Document classification and specific processing is now handled
      // through the new 3-step workflow with user approval

      onProgress?.({
        file,
        progress: 100,
        status: 'completed',
        documentId: documentData?.id,
      });

      return { data: documentData, error: null };

    } catch (error: any) {
      onProgress?.({
        file,
        progress: 0,
        status: 'error',
        error: error.message,
      });
      return { data: null, error };
    }
  }

  /**
   * Uploads multiple files
   */
  async uploadMultipleDocuments(
    files: File[],
    userId: string,
    options: DocumentUploadOptions = {},
    onProgress?: (progress: UploadProgress[]) => void
  ): Promise<{ results: Array<{ data: Document | null; error: any }> }> {
    const results: Array<{ data: Document | null; error: any }> = [];
    const progressTracking: UploadProgress[] = files.map(file => ({
      file,
      progress: 0,
      status: 'pending',
    }));

    console.log('📤 Uploading multiple documents:', {
      fileCount: files.length,
      clientId: options.clientId,
      documentType: options.documentType
    });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      const result = await this.uploadDocument(
        file,
        userId,
        options,
        (progress) => {
          progressTracking[i] = progress;
          onProgress?.(progressTracking);
        }
      );

      results.push(result);
    }

    const successCount = results.filter(r => r.data && !r.error).length;
    console.log(`✅ Upload batch complete: ${successCount}/${files.length} successful`);

    return { results };
  }

  /**
   * Downloads a document from storage
   */
  async downloadDocument(documentId: string): Promise<{ data: Blob | null; error: any }> {
    try {
      // Get document info from database
      const { data: document, error: dbError } = await supabase
        .from('documents')
        .select('storage_path, document_type, filename')
        .eq('id', documentId)
        .single();

      if (dbError || !document) {
        return { data: null, error: dbError || new Error('Document not found') };
      }

      // Get the appropriate bucket
      const bucketName = getBucketName(document.document_type as DocumentType);

      // Download from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(document.storage_path);

      if (downloadError) {
        return { data: null, error: downloadError };
      }

      return { data: fileData, error: null };

    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Gets a signed URL for document download/preview
   */
  async getDocumentSignedURL(
    documentId: string, 
    expiresIn: number = 3600
  ): Promise<{ data: string | null; error: any }> {
    try {
      console.log('🔗 Getting signed URL for document ID:', documentId);
      
      // Get document info
      const { data: document, error: dbError } = await supabase
        .from('documents')
        .select('storage_path, document_type')
        .eq('id', documentId)
        .single();

      console.log('📊 Database query result:', { document, dbError });

      if (dbError || !document) {
        console.error('❌ Document not found or DB error:', dbError);
        return { data: null, error: dbError || new Error('Document not found') };
      }

      const bucketName = getBucketName(document.document_type as DocumentType);
      console.log('🪣 Using bucket:', bucketName, 'for document type:', document.document_type);
      console.log('📁 Storage path:', document.storage_path);

      // Create signed URL
      const { data: signedUrl, error: urlError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(document.storage_path, expiresIn);

      console.log('🔐 Signed URL creation result:', { signedUrl, urlError });

      if (urlError) {
        console.error('❌ Error creating signed URL:', urlError);
        // Try to provide more specific error information
        if (urlError.message?.includes('Object not found')) {
          return { data: null, error: new Error(`Document file not found in storage: ${document.storage_path}`) };
        } else if (urlError.message?.includes('Invalid bucket')) {
          return { data: null, error: new Error(`Storage bucket '${bucketName}' not found or not accessible`) };
        }
        return { data: null, error: urlError };
      }

      if (!signedUrl.signedUrl) {
        console.error('❌ No signed URL returned');
        return { data: null, error: new Error('Failed to generate signed URL') };
      }

      console.log('✅ Successfully created signed URL:', signedUrl.signedUrl);
      
      // Test the URL accessibility
      try {
        const testResponse = await fetch(signedUrl.signedUrl, { method: 'HEAD' });
        console.log('🔍 URL accessibility test:', {
          status: testResponse.status,
          ok: testResponse.ok,
          headers: Object.fromEntries(testResponse.headers.entries())
        });
      } catch (testError) {
        console.warn('⚠️ URL accessibility test failed:', testError);
      }
      
      return { data: signedUrl.signedUrl, error: null };

    } catch (error) {
      console.error('❌ Exception in getDocumentSignedURL:', error);
      return { data: null, error };
    }
  }

  /**
   * Deletes a document from both storage and database
   */
  async deleteDocument(documentId: string): Promise<{ error: any }> {
    try {
      // Get document info
      const { data: document, error: dbError } = await supabase
        .from('documents')
        .select('storage_path, document_type')
        .eq('id', documentId)
        .single();

      if (dbError) {
        return { error: dbError };
      }

      if (document) {
        const bucketName = getBucketName(document.document_type as DocumentType);
        
        // Delete from storage
        await supabase.storage
          .from(bucketName)
          .remove([document.storage_path]);
      }

      // Delete from database (this will cascade to related records)
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      return { error: deleteError };

    } catch (error) {
      return { error };
    }
  }

  /**
   * Processes document in background (OCR, AI analysis)
   */
  private async initiateDocumentProcessing(
    documentId: string,
    userId: string,
    options: {
      enableOCR?: boolean;
      enableAI?: boolean;
      autoClassify?: boolean;
    }
  ): Promise<void> {
    try {
      console.log('🤖 Starting initial document processing (OCR + Classification) for document:', documentId);
      console.log('🤖 User ID:', userId);
      
      // Get current user session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session for document processing');
      }

      // Call the edge function for initial processing (OCR + Classification)
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-document-ai`;
      console.log('🤖 Calling edge function:', functionUrl);
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: documentId,
          user_id: userId,
        }),
      });

      console.log('🤖 Initial processing response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Initial processing error response:', errorText);
        throw new Error(`Document processing failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('🤖 Initial processing result:', result);
      
      if (result.success) {
        console.log('✅ Initial processing (OCR + Classification) completed successfully');
        console.log('📋 Document classification:', result.classification);
        
        // The document now has OCR text and classification
        // Frontend will handle user approval and trigger Step 3 processing
      } else {
        console.error('❌ Initial processing returned no results:', result);
        throw new Error('Document processing returned no results');
      }

    } catch (error) {
      console.error('❌ Document processing failed:', error);
      
      // Mark as processed even if processing fails, so it doesn't get stuck
      await updateDocumentProcessing(documentId, {
        is_processed: true,
        ai_summary: 'Document processing failed. Please review document manually.',
      });
    }
  }

  /**
   * Triggers Step 3 processing based on classification
   */
  async processDocumentByType(
    documentId: string,
    classificationType: 'Financial' | 'Identity' | 'Tax'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session for document processing');
      }

      let functionName = '';
      switch (classificationType.toLowerCase()) {
        case 'financial':
          functionName = 'process-financial';
          break;
        case 'identity':
          functionName = 'process-identity';
          break;
        case 'tax':
          functionName = 'process-tax';
          break;
        default:
          throw new Error(`Unknown classification type: ${classificationType}`);
      }

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;
      console.log(`🤖 Calling ${classificationType} processing function:`, functionUrl);
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: documentId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ ${classificationType} processing error:`, errorText);
        throw new Error(`${classificationType} processing failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ ${classificationType} processing completed:`, result);
      
      return { success: true };

    } catch (error: any) {
      console.error(`❌ ${classificationType} processing failed:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper method to delete file from storage
   */
  private async deleteFileFromStorage(bucketName: string, path: string): Promise<void> {
    try {
      await supabase.storage.from(bucketName).remove([path]);
    } catch (error) {
      console.error('Failed to cleanup file:', error);
    }
  }
}

// Export singleton instance
export const documentService = new DocumentService();
