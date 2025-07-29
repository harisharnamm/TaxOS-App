import { supabase } from './supabase';
import { Document, DocumentFilter, DocumentType, IRSNotice, EnrichedIRSNotice } from '../types/documents';

/**
 * Creates a new document record in the database
 */
export async function createDocumentRecord(documentData: {
  user_id: string;
  client_id: string; // Remove the optional '?' to make it required
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  document_type: DocumentType;
  storage_path: string;
  tags?: string[];
}): Promise<{ data: Document | null; error: any }> {
  const { data, error } = await supabase
    .from('documents')
    .insert([{
      ...documentData,
      is_processed: false,
    }])
    .select()
    .single();

  return { data, error };
}

/**
 * Updates document with processing results
 */
export async function updateDocumentProcessing(
  documentId: string,
  updates: {
    ocr_text?: string;
    ai_summary?: string;
    tags?: string[];
    is_processed?: boolean;
  }
): Promise<{ data: Document | null; error: any }> {
  const { data, error } = await supabase
    .from('documents')
    .update(updates)
    .eq('id', documentId)
    .select()
    .single();

  return { data, error };
}

/**
 * Gets documents for a specific client
 */
export async function getClientDocuments(
  clientId: string,
  filter?: DocumentFilter
): Promise<{ data: Document[] | null; error: any }> {
  let query = supabase
    .from('documents')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  // Apply filters
  if (filter?.documentType) {
    query = query.eq('document_type', filter.documentType);
  }

  if (filter?.isProcessed !== undefined) {
    query = query.eq('is_processed', filter.isProcessed);
  }

  if (filter?.tags && filter.tags.length > 0) {
    query = query.overlaps('tags', filter.tags);
  }

  if (filter?.dateRange) {
    query = query
      .gte('created_at', filter.dateRange.start.toISOString())
      .lte('created_at', filter.dateRange.end.toISOString());
  }

  if (filter?.searchQuery) {
    query = query.textSearch('search_vector', filter.searchQuery);
  }

  const { data, error } = await query;
  return { data, error };
}

/**
 * Gets all documents for a user
 */
export async function getUserDocuments(
  userId: string,
  filter?: DocumentFilter
): Promise<{ data: Document[] | null; error: any }> {
  let query = supabase
    .from('documents')
    .select(`
      *,
      clients:client_id (
        id,
        name
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  // Apply filters (similar to getClientDocuments)
  if (filter?.clientId) {
    query = query.eq('client_id', filter.clientId);
  }

  if (filter?.documentType) {
    query = query.eq('document_type', filter.documentType);
  }

  if (filter?.isProcessed !== undefined) {
    query = query.eq('is_processed', filter.isProcessed);
  }

  if (filter?.tags && filter.tags.length > 0) {
    query = query.overlaps('tags', filter.tags);
  }

  if (filter?.dateRange) {
    query = query
      .gte('created_at', filter.dateRange.start.toISOString())
      .lte('created_at', filter.dateRange.end.toISOString());
  }

  if (filter?.searchQuery) {
    query = query.textSearch('search_vector', filter.searchQuery);
  }

  const { data, error } = await query;
  return { data, error };
}

/**
 * Gets a single document by ID
 */
export async function getDocument(documentId: string): Promise<{ data: Document | null; error: any }> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single();

  return { data, error };
}

/**
 * Deletes a document record
 */
export async function deleteDocument(documentId: string): Promise<{ error: any }> {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId);

  return { error };
}

/**
 * Creates an IRS notice record with duplicate prevention
 */
export async function createIRSNoticeRecord(noticeData: {
  user_id: string;
  client_id?: string;
  document_id?: string;
  notice_type: string;
  notice_number?: string;
  tax_year?: number;
  amount_owed?: number;
  deadline_date?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}): Promise<{ data: IRSNotice | null; error: any }> {
  // Check if a notice already exists for this document
  if (noticeData.document_id) {
    const { data: existingNotice } = await supabase
      .from('irs_notices')
      .select('id')
      .eq('document_id', noticeData.document_id)
      .maybeSingle();

    if (existingNotice) {
      return { 
        data: null, 
        error: new Error(`IRS notice already exists for document ${noticeData.document_id}`) 
      };
    }
  }

  const { data, error } = await supabase
    .from('irs_notices')
    .insert([{
      ...noticeData,
      status: 'pending',
      priority: noticeData.priority || 'medium',
    }])
    .select()
    .single();

  return { data, error };
}

/**
 * Updates IRS notice
 */
export async function updateIRSNotice(
  noticeId: string,
  updates: Partial<Omit<IRSNotice, 'id' | 'created_at' | 'updated_at'>>
): Promise<{ data: IRSNotice | null; error: any }> {
  const { data, error } = await supabase
    .from('irs_notices')
    .update(updates)
    .eq('id', noticeId)
    .select()
    .single();

  return { data, error };
}

/**
 * Gets IRS notices for a user
 */
export async function getUserIRSNotices(userId: string): Promise<{ data: EnrichedIRSNotice[] | null; error: any }> {
  const { data, error } = await supabase
    .from('irs_notices')
    .select(`
      *,
      documents:document_id (*),
      clients:client_id (
        id,
        name
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Gets IRS notices for a specific client
 */
export async function getClientIRSNotices(clientId: string): Promise<{ data: EnrichedIRSNotice[] | null; error: any }> {
  const { data, error } = await supabase
    .from('irs_notices')
    .select(`
      *,
      documents:document_id (*)
    `)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Gets document analytics for a user
 */
export async function getDocumentAnalytics(userId: string): Promise<{
  data: {
    totalDocuments: number;
    totalSize: number;
    documentsByType: Record<DocumentType, number>;
    recentUploads: number;
    processingQueue: number;
  } | null;
  error: any;
}> {
  try {
    // Get total count and size
    const { data: stats, error: statsError } = await supabase
      .from('documents')
      .select('document_type, file_size, created_at, is_processed')
      .eq('user_id', userId);

    if (statsError) {
      return { data: null, error: statsError };
    }

    const totalDocuments = stats?.length || 0;
    const totalSize = stats?.reduce((sum, doc) => sum + doc.file_size, 0) || 0;

    // Calculate documents by type
    const documentsByType = stats?.reduce((acc, doc) => {
      // Ensure document_type is a valid DocumentType before using it as an index
      const docType = doc.document_type as DocumentType;
      if (docType) {
        acc[docType] = (acc[docType] || 0) + 1;
      }
      return acc;
    }, {} as Record<DocumentType, number>) || {} as Record<DocumentType, number>;

    // Recent uploads (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentUploads = stats?.filter(doc => 
      new Date(doc.created_at) > sevenDaysAgo
    ).length || 0;

    // Processing queue (unprocessed documents)
    const processingQueue = stats?.filter(doc => !doc.is_processed).length || 0;

    return {
      data: {
        totalDocuments,
        totalSize,
        documentsByType,
        recentUploads,
        processingQueue,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Bulk operations for documents
 */
export async function bulkUpdateDocuments(
  documentIds: string[],
  updates: Partial<Pick<Document, 'tags' | 'document_type' | 'is_processed'>>
): Promise<{ data: Document[] | null; error: any }> {
  const { data, error } = await supabase
    .from('documents')
    .update(updates)
    .in('id', documentIds)
    .select();

  return { data, error };
}

/**
 * Bulk delete documents
 */
export async function bulkDeleteDocuments(documentIds: string[]): Promise<{ error: any }> {
  const { error } = await supabase
    .from('documents')
    .delete()
    .in('id', documentIds);

  return { error };
}

/**
 * Deletes an IRS notice record
 */
export async function deleteIRSNotice(noticeId: string): Promise<{ error: any }> {
  const { error } = await supabase
    .from('irs_notices')
    .delete()
    .eq('id', noticeId);

  return { error };
}

/**
 * Deletes an IRS notice and its associated document
 */
export async function deleteIRSNoticeWithDocument(noticeId: string): Promise<{ error: any }> {
  try {
    // First get the notice to find the document ID
    const { data: notice, error: noticeError } = await supabase
      .from('irs_notices')
      .select('document_id')
      .eq('id', noticeId)
      .single();

    if (noticeError) {
      return { error: noticeError };
    }

    // Delete the IRS notice first (due to foreign key constraints)
    const { error: deleteNoticeError } = await deleteIRSNotice(noticeId);
    if (deleteNoticeError) {
      return { error: deleteNoticeError };
    }

    // If there's an associated document, delete it too
    if (notice.document_id) {
      const { error: deleteDocError } = await deleteDocument(notice.document_id);
      if (deleteDocError) {
        // Log error but don't fail the operation since the notice is already deleted
        console.error('Failed to delete associated document:', deleteDocError);
      }
    }

    return { error: null };
  } catch (error) {
    return { error };
  }
}
