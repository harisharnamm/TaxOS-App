// Document types and interfaces for the upload system

export interface Document {
  id: string;
  user_id: string;
  client_id?: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  document_type: DocumentType;
  storage_path: string;
  ocr_text?: string;
  ai_summary?: string;
  tags?: string[];
  is_processed: boolean;
  created_at: string;
  updated_at: string;
  ai_analysis_response?: any;
  // Additional properties from database
  eden_ai_classification?: string;
  classification_api_response?: any;
  financial_processing_response?: any;
  identity_processing_response?: any;
  tax_processing_response?: any;
  processing_status?: string;
  secondary_classification?: string;
  uploaded_via_token?: boolean;
  upload_token?: string;
}

export type DocumentType = 
  | 'w2'
  | '1099'
  | 'receipt'
  | 'bank_statement'
  | 'irs_notice'
  | 'w9'
  | 'invoice'
  | 'other';

export interface IRSNotice {
  id: string;
  user_id: string;
  client_id?: string;
  document_id?: string;
  notice_type: string;
  notice_number?: string;
  tax_year?: number;
  amount_owed?: number;
  deadline_date?: string;
  status: NoticeStatus;
  priority: NoticePriority;
  ai_summary?: string;
  ai_recommendations?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
}

export type NoticeStatus = 'pending' | 'in_progress' | 'resolved' | 'appealed';
export type NoticePriority = 'low' | 'medium' | 'high' | 'critical';

export interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  documentId?: string;
}

export interface DocumentUploadOptions {
  clientId?: string;
  documentType?: DocumentType;
  tags?: string[];
  processingOptions?: {
    enableOCR?: boolean;
    enableAI?: boolean;
    autoClassify?: boolean;
  };
}

export interface DocumentFilter {
  clientId?: string;
  documentType?: DocumentType;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
  isProcessed?: boolean;
}

export interface DocumentAnalytics {
  totalDocuments: number;
  totalSize: number;
  documentsByType: Record<DocumentType, number>;
  recentUploads: number;
  processingQueue: number;
  storageUsage: {
    used: number;
    limit: number;
    percentage: number;
  };
}

export interface StorageBucket {
  CLIENT_DOCUMENTS: 'client-documents';
  IRS_NOTICES: 'irs-notices';
}

export const STORAGE_BUCKETS: StorageBucket = {
  CLIENT_DOCUMENTS: 'client-documents',
  IRS_NOTICES: 'irs-notices',
};

export const ALLOWED_FILE_TYPES = {
  PDF: 'application/pdf',
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  WEBP: 'image/webp',
  TXT: 'text/plain',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  DOC: 'application/msword',
} as const;

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  'w2': 'W-2 Form',
  '1099': '1099 Form',
  'receipt': 'Receipt',
  'bank_statement': 'Bank Statement',
  'irs_notice': 'IRS Notice',
  'w9': 'W-9 Form',
  'invoice': 'Invoice',
  'other': 'Other Document',
};

export const NOTICE_STATUS_LABELS: Record<NoticeStatus, string> = {
  'pending': 'Pending Review',
  'in_progress': 'In Progress',
  'resolved': 'Resolved',
  'appealed': 'Appealed',
};

export const NOTICE_PRIORITY_LABELS: Record<NoticePriority, string> = {
  'low': 'Low Priority',
  'medium': 'Medium Priority',
  'high': 'High Priority',
  'critical': 'Critical',
};

// Enhanced interface for IRS Notice with joined data
export interface EnrichedIRSNotice extends IRSNotice {
  documents?: Document;
  clients?: {
    id: string;
    name: string;
  };
}
