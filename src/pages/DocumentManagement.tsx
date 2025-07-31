import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { TopBar } from '../components/organisms/TopBar';
import { GlobalSearch } from '../components/molecules/GlobalSearch';
import { useSearch } from '../contexts/SearchContext';
import { useDocuments } from '../hooks/useDocuments';
import { useDocumentProcessing, DocumentClassification } from '../hooks/useDocumentProcessing';
import { useChat } from '../hooks/useChat';
import { DocumentClassificationDialog } from '../components/ui/document-classification-dialog';
import { supabase } from '../lib/supabase';

import { AestheticUpload } from '../components/ui/aesthetic-upload';
import { EnhancedDocumentPreview } from '../components/ui/enhanced-document-preview';
import { EmptyState } from '../components/ui/empty-state';
import { useToast } from '../contexts/ToastContext';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import { Input } from '../components/atoms/Input';
import { 
  Search, 
  Filter, 
  FileText, 
  Upload, 
  Eye, 
  Download, 
  Zap, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  Plus,
  X,
  Trash2,
  Brain,
  ChevronDown,
  ChevronRight,
  Calculator
} from 'lucide-react';
import { Document, DOCUMENT_TYPE_LABELS } from '../types/documents';


export function DocumentManagement() {
  const { documents, loading, refreshDocuments, downloadDocument, getDocumentPreviewURL, deleteDocument } = useDocuments();
  const { getProcessingState, updateProcessingState, approveClassification, overrideClassification } = useDocumentProcessing();
  const { sendMessage } = useChat();
  const { isSearchOpen, closeSearch, openSearch } = useSearch();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showClassificationDialog, setShowClassificationDialog] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedDocumentId, setExpandedDocumentId] = useState<string | null>(null);
  const [isUploadMinimized, setIsUploadMinimized] = useState(false);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [aiAnalysisDocument, setAiAnalysisDocument] = useState<Document | null>(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);
  const [isUsingCachedAnalysis, setIsUsingCachedAnalysis] = useState(false);
  const [aiPromptDismissed, setAiPromptDismissed] = useState(false);

  // Listen for documents that need classification approval
  useEffect(() => {
    documents.forEach(doc => {
      const state = getProcessingState(doc.id);
      
      // Only mark as needing approval if classification is unknown/failed and not already processed
      if (doc.eden_ai_classification && 
          (doc.eden_ai_classification === 'unknown' || doc.eden_ai_classification === 'parsing_failed' || doc.eden_ai_classification === 'extraction_failed') &&
          !state.needsApproval && 
          doc.processing_status !== 'completed' && 
          state.processingStep === 'idle') {
        updateProcessingState(doc.id, {
          classification: doc.eden_ai_classification as DocumentClassification,
          needsApproval: true,
          processingStep: 'classification'
        });
      }
    });
  }, [documents, getProcessingState, updateProcessingState]);



  const handleUploadComplete = (documentIds: string[]) => {
    console.log('Documents processed successfully:', documentIds);
    toast.success('Processing Complete', `${documentIds.length} document(s) processed successfully`);
    // Don't close the modal here - let the AestheticUpload component handle it
    
    // Mark documents as processing
    documentIds.forEach(docId => {
      updateProcessingState(docId, {
        isProcessing: true,
        processingStep: 'ocr'
      });
    });
    
    // Refresh documents to get the latest data
    refreshDocuments();
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
    toast.error('Upload Failed', error);
  };

  const handleClassificationApproval = (document: Document) => {
    setSelectedDocument(document);
    setShowClassificationDialog(true);
  };

  const handleApproveClassification = async (classification: DocumentClassification) => {
    if (!selectedDocument) return;
    
    try {
      const result = await approveClassification(selectedDocument.id, classification);
      if (result.success) {
        toast.success('Processing Started', `Document is being processed as ${classification} document`);
        // Refresh documents to get updated data
        setTimeout(() => {
          refreshDocuments();
        }, 1000);
      } else {
        toast.error('Processing Failed', result.error || 'Failed to start document processing');
      }
    } catch (error) {
      console.error('Failed to approve classification:', error);
      toast.error('Processing Failed', 'An unexpected error occurred');
    }
  };

  const handleOverrideClassification = async (newClassification: DocumentClassification) => {
    if (!selectedDocument) return;
    
    try {
      const result = await overrideClassification(selectedDocument.id, newClassification);
      if (result.success) {
        toast.success('Classification Updated', `Document reclassified and processing started as ${newClassification} document`);
        // Refresh documents to get updated data
        setTimeout(() => {
          refreshDocuments();
        }, 1000);
      } else {
        toast.error('Override Failed', result.error || 'Failed to override classification');
      }
    } catch (error) {
      console.error('Failed to override classification:', error);
      toast.error('Override Failed', 'An unexpected error occurred');
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    const document = documents.find(d => d.id === documentId);
    if (!document) return;
    
    let confirmMessage = `Are you sure you want to delete "${document.original_filename}"? This action cannot be undone.`;
    
    // Add additional warning for client-uploaded documents
    if (document.uploaded_via_token) {
      confirmMessage += '\n\nThis document was uploaded by a client. Deleting it will remove it from their document request, and they may need to upload it again.';
    }
    
    if (window.confirm(confirmMessage)) {
      try {
        const result = await deleteDocument(documentId);
        if (result.success) {
          toast.success('Document Deleted', 'Document has been deleted successfully');
          refreshDocuments();
        } else {
          toast.error('Delete Failed', result.error || 'Failed to delete document');
        }
      } catch (error) {
        console.error('Delete error:', error);
        toast.error('Delete Failed', 'An unexpected error occurred');
      }
    }
  };

  const handleDownloadDocument = async (documentId: string, filename: string) => {
    try {
      const result = await downloadDocument(documentId, filename);
      if (!result.success) {
        toast.error('Download Failed', result.error || 'Failed to download document');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download Failed', 'An unexpected error occurred');
    }
  };

  const handlePreviewDocument = async (documentId: string) => {
    try {
      const document = documents.find(d => d.id === documentId);
      if (!document) return;
      
      setPreviewDocument(document);
      setShowPreview(true);
      
      const result = await getDocumentPreviewURL(documentId);
      if (result.url) {
        setPreviewUrl(result.url);
      } else {
        setShowPreview(false);
        toast.error('Preview Failed', result.error || 'Failed to generate preview URL');
      }
    } catch (error) {
      console.error('Preview error:', error);
      setShowPreview(false);
      toast.error('Preview Failed', 'An unexpected error occurred');
    }
  };

  const handleAIAnalysis = async (document: Document) => {
    try {
      // Reset all states
      setAiAnalysisResult(null);
      setAiAnalysisLoading(true);
      setAiAnalysisDocument(document);
      setShowAIAnalysis(true);

      // Check if we already have a saved analysis for this document
      if (document.ai_analysis_response) {
        console.log('Using cached AI analysis for document:', document.id);
        setAiAnalysisResult(document.ai_analysis_response);
        setIsUsingCachedAnalysis(true);
        setAiAnalysisLoading(false);
        return;
      }

      setIsUsingCachedAnalysis(false);

      // Build a comprehensive prompt with document content
      let documentContent = '';
      
      if (document.ocr_text && document.ocr_text.length > 0) {
        // Include OCR text (limit to avoid token overflow)
        const ocrPreview = document.ocr_text.length > 1000 
          ? document.ocr_text.substring(0, 1000) + '...' 
          : document.ocr_text;
        documentContent += `\n\nDOCUMENT CONTENT (OCR Text):\n${ocrPreview}`;
      }
      
      if (document.ai_summary && document.ai_summary.length > 0) {
        documentContent += `\n\nAI SUMMARY:\n${document.ai_summary}`;
      }

      // If no document content is available, provide a helpful message
      if (!documentContent) {
        documentContent = `\n\nNOTE: This document appears to have limited content available for analysis. The document has been processed but may not contain extractable text or may need additional processing.`;
      }

      // Call the new document analysis assistant
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-analysis-assistant`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: document.id,
          document_content: documentContent,
          document_type: document.document_type,
          filename: document.original_filename,
          classification: document.eden_ai_classification,
          secondary_classification: document.secondary_classification,
          client_id: document.client_id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const analysisResult = await response.json();
      
      if (analysisResult.success && analysisResult.data) {
        // Save the analysis result to the database
        const { error: saveError } = await supabase
          .from('documents')
          .update({ 
            ai_analysis_response: analysisResult.data,
            updated_at: new Date().toISOString()
          })
          .eq('id', document.id);

        if (saveError) {
          console.error('Error saving AI analysis:', saveError);
          // Still show the analysis even if saving fails
        } else {
          console.log('AI analysis saved to database for document:', document.id);
          // Refresh the documents to get the updated data
          refreshDocuments();
        }
        
        setAiAnalysisResult(analysisResult.data);
      } else {
        throw new Error('No response content received from AI assistant');
      }

    } catch (error) {
      console.error('AI Analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast.error('AI Analysis Failed', errorMessage);
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  // Parse the AI response into structured format
  const parseAIResponse = (content: string) => {
    const sections = {
      summary: '',
      keyInsights: [] as string[],
      taxImplications: [] as string[],
      recommendations: [] as string[],
      complianceConsiderations: [] as string[]
    };

    // Clean up the content and normalize line breaks
    const cleanContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Extract Document Summary - look for content after "Document Summary" or "📋 Document Summary"
    const summaryMatch = cleanContent.match(/(?:📋\s*)?(?:document summary|summary)[:\s]*([\s\S]*?)(?=\n\s*(?:key insights|insights|tax implications|recommendations|compliance considerations)|$)/i);
    if (summaryMatch) {
      sections.summary = summaryMatch[1].trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');
    }

    // Extract Key Insights
    const insightsMatch = cleanContent.match(/(?:key insights|insights)[:\s]*([\s\S]*?)(?=\n\s*(?:tax implications|recommendations|compliance considerations)|$)/i);
    if (insightsMatch) {
      const insightsText = insightsMatch[1].trim();
      // Split by sentences or bullet points
      const insights = insightsText.split(/(?<=\.)\s+/).filter(item => item.trim() && item.length > 10);
      sections.keyInsights = insights.map(insight => insight.trim()).filter(insight => insight.length > 0);
    }

    // Extract Tax Implications
    const taxMatch = cleanContent.match(/(?:tax implications|tax)[:\s]*([\s\S]*?)(?=\n\s*(?:recommendations|compliance considerations)|$)/i);
    if (taxMatch) {
      const taxText = taxMatch[1].trim();
      // Split by sentences or bullet points
      const implications = taxText.split(/(?<=\.)\s+/).filter(item => item.trim() && item.length > 10);
      sections.taxImplications = implications.map(implication => implication.trim()).filter(implication => implication.length > 0);
    }

    // Extract Recommendations
    const recMatch = cleanContent.match(/(?:recommendations)[:\s]*([\s\S]*?)(?=\n\s*(?:compliance considerations)|$)/i);
    if (recMatch) {
      const recText = recMatch[1].trim();
      // Split by sentences or bullet points
      const recommendations = recText.split(/(?<=\.)\s+/).filter(item => item.trim() && item.length > 10);
      sections.recommendations = recommendations.map(rec => rec.trim()).filter(rec => rec.length > 0);
    }

    // Extract Compliance Considerations
    const compMatch = cleanContent.match(/(?:compliance considerations|compliance)[:\s]*([\s\S]*?)(?=\n\s*(?:recommendations|$)|$)/i);
    if (compMatch) {
      const compText = compMatch[1].trim();
      // Split by sentences or bullet points
      const considerations = compText.split(/(?<=\.)\s+/).filter(item => item.trim() && item.length > 10);
      sections.complianceConsiderations = considerations.map(consideration => consideration.trim()).filter(consideration => consideration.length > 0);
    }

    // Fallback: if no structured content found, use the full content as summary
    if (!sections.summary && sections.keyInsights.length === 0) {
      sections.summary = content;
    }

    const result = {
      summary: sections.summary || 'Analysis completed successfully',
      keyInsights: sections.keyInsights.length > 0 ? sections.keyInsights : ['Document analysis completed'],
      taxImplications: sections.taxImplications.length > 0 ? sections.taxImplications : ['Review document for tax implications'],
      recommendations: sections.recommendations.length > 0 ? sections.recommendations : ['Consider professional review'],
      complianceConsiderations: sections.complianceConsiderations.length > 0 ? sections.complianceConsiderations : ['Verify compliance requirements'],
      confidence: 0.95,
      processingTime: 'Real-time analysis'
    };

    return result;
  };



  const getStatusBadge = (document: Document) => {
    const state = getProcessingState(document.id);
    
    if (state.needsApproval) {
      return <Badge variant="warning">Needs Approval</Badge>;
    }
    
    if (state.isProcessing) {
      return <Badge variant="neutral">Processing...</Badge>;
    }
    
    if (document.processing_status === 'completed') {
      return <Badge variant="success">Processed</Badge>;
    }
    
    if (document.processing_status === 'classified') {
      return <Badge variant="warning">Classified</Badge>;
    }
    
    if (document.processing_status === 'ocr_complete') {
      return <Badge variant="neutral">OCR Complete</Badge>;
    }
    
    return <Badge variant="neutral">Uploaded</Badge>;
  };

  const getClassificationBadge = (document: Document) => {
    const type = document.secondary_classification || document.eden_ai_classification;
    if (!type) return <Badge variant="error" size="sm">Unknown</Badge>;

    switch (type.toLowerCase()) {
      case 'invoice':
        return <Badge variant="success" size="sm">Invoice</Badge>;
      case 'bank statement':
        return <Badge variant="neutral" size="sm">Bank Statement</Badge>;
      case 'receipt':
        return <Badge variant="warning" size="sm">Receipt</Badge>;
      case 'financial document':
        return <Badge variant="success" size="sm">Financial</Badge>;
      case 'identity document':
        return <Badge variant="neutral" size="sm">Identity</Badge>;
      case 'tax document':
        return <Badge variant="warning" size="sm">Tax</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{type}</Badge>;
    }
  };

  const getProcessingIcon = (document: Document) => {
    const state = getProcessingState(document.id);
    
    if (state.needsApproval) {
      return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    }
    
    if (state.isProcessing) {
      return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
    }
    
    if (document.classification_api_response) {
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    }
    
    return <Clock className="w-4 h-4 text-gray-600" />;
  };

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchQuery || 
      doc.original_filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.ocr_text?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'processed' && doc.processing_status === 'completed') ||
      (statusFilter === 'classified' && doc.processing_status === 'classified') ||
      (statusFilter === 'pending' && (doc.processing_status === 'pending' || !doc.processing_status));
    
    const matchesClassification = classificationFilter === 'all' || 
      doc.eden_ai_classification === classificationFilter;
    
    return matchesSearch && matchesStatus && matchesClassification;
  });

  // Get stats
  const stats = {
    total: documents.length,
    processed: documents.filter(d => d.processing_status === 'completed').length,
    classified: documents.filter(d => d.processing_status === 'classified').length,
    pending: documents.filter(d => d.processing_status === 'pending' || !d.processing_status).length,
    needsApproval: documents.filter(d => {
      const state = getProcessingState(d.id);
      return state.needsApproval;
    }).length
  };

  // Progress bar logic
  const totalDocs = documents.length;
  const completedDocs = documents.filter(doc => doc.processing_status === 'completed').length;
  const inProgressDocs = documents.filter(doc => doc.processing_status !== 'completed' && doc.processing_status !== 'failed').length;
  const progressPercentage = totalDocs > 0 ? Math.round((completedDocs / totalDocs) * 100) : 0;

  // Client-uploaded documents that need processing
  const clientUploadedDocs = documents.filter(doc => 
    doc.uploaded_via_token === true && 
    (doc.processing_status === 'pending' || !doc.processing_status || doc.eden_ai_classification === 'unknown')
  );
  
  const unprocessedClientDocs = clientUploadedDocs.length;
  
  // Get a summary of document types for better UX
  const documentTypeSummary = clientUploadedDocs.reduce((acc, doc) => {
    const type = doc.document_type || 'other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const documentTypeList = Object.entries(documentTypeSummary)
    .map(([type, count]) => `${count} ${DOCUMENT_TYPE_LABELS[type as keyof typeof DOCUMENT_TYPE_LABELS] || type}`)
    .join(', ');
  
  // Check if any documents need manual approval
  const needsManualApproval = clientUploadedDocs.some(doc => 
    doc.eden_ai_classification === 'unknown' || 
    doc.eden_ai_classification === 'parsing_failed' || 
    doc.eden_ai_classification === 'extraction_failed'
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated">
      <TopBar 
        title="Document Management" 
        action={{
          label: 'Upload Documents',
          onClick: () => setShowUpload(true),
          icon: Plus
        }}
      />
      
      {/* Global Search */}
      <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />
      
      <div className="max-w-content mx-auto px-8 py-8">
        {/* Document Processing Progress Bar */}
        <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 mb-8 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" /> Document Processing Progress
            </h2>
            <span className="text-sm font-medium text-text-tertiary">{completedDocs} of {totalDocs} completed</span>
          </div>
          <div className="w-full bg-surface rounded-full h-3 overflow-hidden mb-2">
            <div 
              className="bg-primary h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-text-tertiary mt-1">
            <span><CheckCircle className="inline w-4 h-4 text-green-600 mr-1" />Completed: {completedDocs}</span>
            <span><Clock className="inline w-4 h-4 text-amber-600 mr-1" />In Progress: {inProgressDocs}</span>
            <span>Total: {totalDocs}</span>
            <span>Progress: {progressPercentage}%</span>
          </div>
        </div>
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-tertiary">Total</p>
                <p className="text-2xl font-semibold text-text-primary">{stats.total}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-xl">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-tertiary">Processed</p>
                <p className="text-2xl font-semibold text-text-primary">{stats.processed}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-amber-100 to-amber-50 rounded-xl">
                <Zap className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-tertiary">Classified</p>
                <p className="text-2xl font-semibold text-text-primary">{stats.classified}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl">
                <Clock className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-tertiary">Pending</p>
                <p className="text-2xl font-semibold text-text-primary">{stats.pending}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-red-100 to-red-50 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-tertiary">Needs Approval</p>
                <p className="text-2xl font-semibold text-text-primary">{stats.needsApproval}</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Action Prompt for Client-Uploaded Documents */}
        {unprocessedClientDocs > 0 && !aiPromptDismissed && (
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl border border-primary/20 p-6 mb-8 shadow-soft">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-primary/20 rounded-xl">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-text-primary mb-2">
                    AI Assistant Recommendation
                  </h3>
                  <p className="text-text-secondary mb-4">
                    I found <strong>{unprocessedClientDocs} document{unprocessedClientDocs !== 1 ? 's' : ''}</strong> that were uploaded by your clients and are ready for processing. 
                    These documents need to be analyzed and classified to extract valuable tax information.
                    {documentTypeList && (
                      <span className="block mt-2 text-sm">
                        <strong>Document types:</strong> {documentTypeList}
                      </span>
                    )}
                    {needsManualApproval && (
                      <span className="block mt-2 text-sm text-amber-600">
                        <AlertTriangle className="inline w-4 h-4 mr-1" />
                        Some documents may need manual classification after processing.
                      </span>
                    )}
                  </p>
                  <div className="flex items-center space-x-4">
                    <Button
                      onClick={async () => {
                        try {
                          // Process all client-uploaded documents
                          const docIds = clientUploadedDocs.map(doc => doc.id);
                          
                          // Update UI state immediately
                          docIds.forEach((docId: string) => {
                            updateProcessingState(docId, {
                              isProcessing: true,
                              processingStep: 'ocr'
                            });
                          });
                          
                          // Call the processing function for each document
                          const { data: { session } } = await supabase.auth.getSession();
                          if (!session?.access_token) {
                            throw new Error('No valid session');
                          }
                          
                          // Process documents in parallel
                          const processingPromises = docIds.map(async (docId: string) => {
                            const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-document-ai`;
                            const response = await fetch(functionUrl, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${session.access_token}`,
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                document_id: docId,
                                user_id: session.user.id,
                              }),
                            });
                            
                            if (!response.ok) {
                              throw new Error(`Failed to process document ${docId}: ${response.statusText}`);
                            }
                            
                            return response.json();
                          });
                          
                          await Promise.all(processingPromises);
                          
                          toast.success('Processing Started', `Processing ${unprocessedClientDocs} client document${unprocessedClientDocs !== 1 ? 's' : ''}`);
                          
                          // Refresh documents to show updated status
                          setTimeout(() => {
                            refreshDocuments();
                          }, 2000);
                          
                        } catch (error) {
                          console.error('Error processing documents:', error);
                          toast.error('Processing Error', 'Failed to start document processing. Please try again.');
                          
                          // Reset processing state on error
                          const docIds = clientUploadedDocs.map(doc => doc.id);
                          docIds.forEach((docId: string) => {
                            updateProcessingState(docId, {
                              isProcessing: false,
                              processingStep: 'idle'
                            });
                          });
                        }
                      }}
                      className="bg-primary text-gray-900 hover:bg-primary-hover shadow-medium"
                      icon={Zap}
                    >
                      Process {unprocessedClientDocs} Document{unprocessedClientDocs !== 1 ? 's' : ''}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        // Show the documents in a filtered view
                        setStatusFilter('pending');
                        setClassificationFilter('all');
                        setSearchQuery('');
                      }}
                      className="text-text-secondary hover:text-text-primary"
                    >
                      View Documents
                    </Button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setAiPromptDismissed(true);
                }}
                className="p-2 text-text-tertiary hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Aesthetic Upload Modal */}
        <AnimatePresence>
          {showUpload && (
            <AestheticUpload
              clientId={undefined} // This will require user to select a client
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
              onClose={() => setShowUpload(false)}
              isMinimized={isUploadMinimized}
              onToggleMinimize={() => setIsUploadMinimized(!isUploadMinimized)}
            />
          )}
        </AnimatePresence>

        {/* Search and Filters */}
        <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 mb-8 shadow-soft">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-border-subtle rounded-lg bg-surface-elevated text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="processed">Processed</option>
              <option value="classified">Classified</option>
              <option value="pending">Pending</option>
            </select>
            
            <select
              value={classificationFilter}
              onChange={(e) => setClassificationFilter(e.target.value)}
              className="px-3 py-2 border border-border-subtle rounded-lg bg-surface-elevated text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="Financial">Financial</option>
              <option value="Identity">Identity</option>
              <option value="Tax">Tax</option>
            </select>
          </div>
        </div>

        {/* Documents List */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="bg-surface-elevated rounded-2xl border border-border-subtle shadow-soft overflow-hidden">
            <div className="divide-y divide-border-subtle">
              {/* Show processing documents at the top */}
                              {/* Then show the rest of the documents */}
                {filteredDocuments.map((document) => {
                  const state = getProcessingState(document.id);
                  const isExpanded = expandedDocumentId === document.id;
                  return (
                    <React.Fragment key={document.id}>
                      <div
                        className={`p-6 transition-all duration-200 cursor-pointer flex items-center justify-between group border rounded-xl ${
                          isExpanded 
                            ? 'bg-surface-elevated border-border-subtle shadow-sm' 
                            : 'hover:bg-surface-hover border-transparent hover:border-primary/20'
                        }`}
                        onClick={() => setExpandedDocumentId(isExpanded ? null : document.id)}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 group-hover:from-primary/20 group-hover:to-primary/10 transition-all duration-200 shadow-sm group-hover:scale-105">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-primary transition-transform duration-200" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-primary transition-transform duration-200" />
                            )}
                          </div>
                          <div className="flex items-center space-x-3">
                            <div>
                              <h3 className="font-semibold text-text-primary text-lg">{document.original_filename}</h3>
                              <p className="text-xs text-text-tertiary mt-1">
                                {isExpanded ? 'Click to collapse details' : 'Click to expand details'}
                              </p>
                            </div>
                            {getStatusBadge(document)}
                            {getClassificationBadge(document)}
                          </div>
                        </div>
                      <div className="flex items-center space-x-2">
                        {getProcessingIcon(document)}
                        {state.needsApproval && (
                          <Button
                            size="sm"
                            onClick={e => { e.stopPropagation(); handleClassificationApproval(document); }}
                            className="bg-primary text-gray-900 hover:bg-primary-hover"
                          >
                            Review Classification
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={e => { e.stopPropagation(); handlePreviewDocument(document.id); }}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          Preview
                        </Button>
                        
                        {document.ocr_text && document.ocr_text.length > 50 && document.processing_status === 'completed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Brain}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAIAnalysis(document);
                            }}
                            className={`${document.ai_analysis_response ? 'text-green-600 hover:text-green-700 hover:bg-green-50' : 'text-purple-600 hover:text-purple-700 hover:bg-purple-50'}`}
                            title={`AI Analysis - ${document.ai_analysis_response ? 'Cached analysis available' : 'Generate new analysis'}`}
                          >
                            AI Analysis
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Download}
                          onClick={e => { e.stopPropagation(); handleDownloadDocument(document.id, document.original_filename); }}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          Download
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={e => { e.stopPropagation(); handleDeleteDocument(document.id); }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                                              </div>
                      </div>
                      {/* Expanded processing details */}
                      {isExpanded && (
                        <div className="bg-surface p-6 border-t border-border-subtle rounded-b-2xl mt-0">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Left: Document Info */}
                            <div className="lg:col-span-2">
                              <h4 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
                                <FileText className="w-5 h-5 mr-2 text-primary" />
                                Document Details
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-text-tertiary min-w-0">Filename:</span>
                                  <span className="text-text-primary truncate">{document.original_filename}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-text-tertiary min-w-0">Type:</span>
                                  <Badge variant="neutral" size="sm">{document.document_type}</Badge>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-text-tertiary min-w-0">Size:</span>
                                  <span className="text-text-primary">{(document.file_size / 1024 / 1024).toFixed(2)} MB</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-text-tertiary min-w-0">Status:</span>
                                  {getStatusBadge(document)}
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-text-tertiary min-w-0">Classification:</span>
                                  {getClassificationBadge(document)}
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-text-tertiary min-w-0">Secondary:</span>
                                  <span className="text-text-primary">{document.secondary_classification || '—'}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-text-tertiary min-w-0">Client ID:</span>
                                  <span className="text-text-primary font-mono text-xs">{document.client_id || '—'}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-text-tertiary min-w-0">Created:</span>
                                  <span className="text-text-primary">{new Date(document.created_at).toLocaleString()}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-text-tertiary min-w-0">Updated:</span>
                                  <span className="text-text-primary">{new Date(document.updated_at).toLocaleString()}</span>
                                </div>
                              </div>
                              
                              {/* OCR Preview */}
                              {document.ocr_text && (
                                <div className="mt-6">
                                  <h5 className="text-md font-semibold text-text-primary mb-2 flex items-center">
                                    <Eye className="w-4 h-4 mr-2 text-blue-500" />
                                    OCR Preview
                                  </h5>
                                  <div className="bg-surface-elevated rounded-lg p-4 border border-border-subtle max-h-32 overflow-y-auto">
                                    <p className="text-sm text-text-secondary leading-relaxed">
                                      {document.ocr_text.substring(0, 300)}
                                      {document.ocr_text.length > 300 && (
                                        <span className="text-text-tertiary">... (truncated)</span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Right: Processing Status & Actions */}
                            <div className="lg:col-span-1">
                              <h4 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
                                <Zap className="w-5 h-5 mr-2 text-primary" />
                                Processing Status
                              </h4>
                              
                              {/* Processing Timeline */}
                              <div className="space-y-4">
                                <div className="flex items-center space-x-3">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100">
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-text-primary">Document Uploaded</p>
                                    <p className="text-xs text-text-tertiary">File stored successfully</p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-3">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100">
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-text-primary">OCR Processing</p>
                                    <p className="text-xs text-text-tertiary">Text extraction completed</p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-3">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100">
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-text-primary">AI Classification</p>
                                    <p className="text-xs text-text-tertiary">{document.eden_ai_classification || 'Unknown'}</p>
                                  </div>
                                </div>
                                
                                {document.processing_status === 'completed' && (
                                  <div className="flex items-center space-x-3">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100">
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-text-primary">Processing Complete</p>
                                      <p className="text-xs text-text-tertiary">Ready for use</p>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Quick Actions */}
                              <div className="mt-6">
                                <h5 className="text-md font-semibold text-text-primary mb-3">Quick Actions</h5>
                                <div className="space-y-2">
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    icon={Eye}
                                    onClick={() => handlePreviewDocument(document.id)}
                                    className="w-full justify-start"
                                  >
                                    Preview Document
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    icon={Download}
                                    onClick={() => handleDownloadDocument(document.id, document.original_filename)}
                                    className="w-full justify-start"
                                  >
                                    Download
                                  </Button>
                                  {document.ocr_text && document.ocr_text.length > 50 && document.processing_status === 'completed' && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      icon={Brain}
                                      onClick={() => handleAIAnalysis(document)}
                                      className={`w-full justify-start ${document.ai_analysis_response ? 'text-green-600 hover:text-green-700 hover:bg-green-50' : ''}`}
                                      title={`AI Analysis - ${document.ai_analysis_response ? 'Cached analysis available' : 'Generate new analysis'}`}
                                    >
                                      AI Analysis
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Classification Dialog */}
      <DocumentClassificationDialog
        isOpen={showClassificationDialog}
        onClose={() => {
          setShowClassificationDialog(false);
          setSelectedDocument(null);
        }}
        document={selectedDocument}
        classification={(selectedDocument?.eden_ai_classification as DocumentClassification) || 'Unknown'}
        onApprove={handleApproveClassification}
        onOverride={handleOverrideClassification}
        loading={selectedDocument ? getProcessingState(selectedDocument.id).isProcessing : false}
      />

      {/* Document Preview */}
      {showPreview && previewDocument && (
        <EnhancedDocumentPreview
          document={previewDocument}
          previewUrl={previewUrl || undefined}
          isOpen={showPreview}
          onClose={() => {
            setShowPreview(false);
            setPreviewDocument(null);
            setPreviewUrl(null);
          }}
          onDownload={() => handleDownloadDocument(previewDocument.id, previewDocument.original_filename)}
        />
      )}

      {/* AI Analysis Modal */}
      {showAIAnalysis && aiAnalysisDocument && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-elevated rounded-2xl shadow-premium max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border-subtle">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-gradient-to-br from-purple-100 to-purple-50 rounded-xl">
                  <Brain className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-text-primary">AI Document Analysis</h2>
                  <p className="text-text-tertiary text-sm">
                    {aiAnalysisDocument.original_filename}
                    {isUsingCachedAnalysis && (
                      <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Cached
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    console.log('Refresh button clicked, aiAnalysisDocument:', aiAnalysisDocument);
                    setIsUsingCachedAnalysis(false);
                    setAiAnalysisResult(null);
                    if (aiAnalysisDocument) {
                      handleAIAnalysis(aiAnalysisDocument);
                    } else {
                      console.error('aiAnalysisDocument is null, cannot refresh');
                      toast.error('Refresh Failed', 'Document information is missing');
                    }
                  }}
                  className="text-xs"
                  disabled={aiAnalysisLoading}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Refresh
                </Button>
                <button
                  onClick={() => {
                    setShowAIAnalysis(false);
                    setAiAnalysisDocument(null);
                    setAiAnalysisResult(null);
                    setIsUsingCachedAnalysis(false);
                  }}
                  className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-xl"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {aiAnalysisLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
                    <p className="text-lg font-medium text-text-primary">Analyzing Document...</p>
                    <p className="text-sm text-text-tertiary">AI is processing your document and extracting insights</p>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center space-x-2 text-sm text-text-tertiary">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                        <span>Extracting document content...</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-text-tertiary">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                        <span>Analyzing tax implications...</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-text-tertiary">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                        <span>Generating recommendations...</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : aiAnalysisResult ? (
                <div className="space-y-6">
                  {/* Document Summary */}
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
                    <h3 className="text-lg font-semibold text-purple-900 mb-3">📋 Document Summary</h3>
                    <p className="text-purple-800 leading-relaxed">{aiAnalysisResult.document_summary}</p>
                  </div>

                  {/* Vendor and Transaction Info */}
                  {(aiAnalysisResult.vendor_name || aiAnalysisResult.transaction_date || aiAnalysisResult.total_amount) && (
                    <div className="bg-surface rounded-xl p-6 border border-border-subtle">
                      <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
                        <FileText className="w-5 h-5 mr-2 text-blue-500" />
                        Document Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {aiAnalysisResult.vendor_name && (
                          <div>
                            <p className="text-sm font-medium text-text-tertiary mb-1">Vendor</p>
                            <p className="text-text-primary font-semibold">{aiAnalysisResult.vendor_name}</p>
                          </div>
                        )}
                        {aiAnalysisResult.transaction_date && (
                          <div>
                            <p className="text-sm font-medium text-text-tertiary mb-1">Transaction Date</p>
                            <p className="text-text-primary font-semibold">{aiAnalysisResult.transaction_date}</p>
                          </div>
                        )}
                        {aiAnalysisResult.total_amount && (
                          <div>
                            <p className="text-sm font-medium text-text-tertiary mb-1">Total Amount</p>
                            <p className="text-text-primary font-semibold">${aiAnalysisResult.total_amount.toFixed(2)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Line Items */}
                  {aiAnalysisResult.line_items && aiAnalysisResult.line_items.length > 0 && (
                    <div className="bg-surface rounded-xl p-6 border border-border-subtle">
                      <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
                        <Calculator className="w-5 h-5 mr-2 text-green-500" />
                        Line Items
                      </h3>
                      <div className="space-y-3">
                        {aiAnalysisResult.line_items.map((item: any, index: number) => (
                          <div key={index} className="flex justify-between items-center p-3 bg-surface-hover rounded-lg">
                            <div className="flex-1">
                              <p className="text-text-primary font-medium">{item.description}</p>
                              <p className="text-sm text-text-tertiary">
                                Qty: {item.quantity} × ${item.unit_price?.toFixed(2) || '0.00'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-text-primary font-semibold">${item.amount?.toFixed(2) || '0.00'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tax Category */}
                  {aiAnalysisResult.suggested_tax_category && (
                    <div className="bg-surface rounded-xl p-6 border border-border-subtle">
                      <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center">
                        <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                        Suggested Tax Category
                      </h3>
                      <Badge variant="success" className="text-sm">
                        {aiAnalysisResult.suggested_tax_category}
                      </Badge>
                    </div>
                  )}

                  {/* Deduction Opportunities */}
                  {aiAnalysisResult.deduction_opportunities && aiAnalysisResult.deduction_opportunities.length > 0 && (
                    <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                      <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                        <Zap className="w-5 h-5 mr-2 text-green-600" />
                        Deduction Opportunities
                      </h3>
                      <ul className="space-y-3">
                        {aiAnalysisResult.deduction_opportunities.map((opportunity: string, index: number) => (
                          <li key={index} className="flex items-start space-x-3">
                            <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                            <span className="text-green-800 leading-relaxed">{opportunity}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Tax Implication */}
                  {aiAnalysisResult.tax_implication && (
                    <div className="bg-surface rounded-xl p-6 border border-border-subtle">
                      <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center">
                        <Calculator className="w-5 h-5 mr-2 text-blue-500" />
                        Tax Implication
                      </h3>
                      <p className="text-text-primary leading-relaxed">{aiAnalysisResult.tax_implication}</p>
                    </div>
                  )}

                  {/* Compliance Consideration */}
                  {aiAnalysisResult.compliance_consideration && (
                    <div className="bg-surface rounded-xl p-6 border border-border-subtle">
                      <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center">
                        <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" />
                        Compliance Consideration
                      </h3>
                      <p className="text-text-primary leading-relaxed">{aiAnalysisResult.compliance_consideration}</p>
                    </div>
                  )}

                  {/* Anomaly Alert */}
                  {aiAnalysisResult.anomaly_flag && (
                    <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
                      <h3 className="text-lg font-semibold text-red-900 mb-3 flex items-center">
                        <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
                        Anomaly Detected
                      </h3>
                      <p className="text-red-800 leading-relaxed">{aiAnalysisResult.anomaly_reason}</p>
                    </div>
                  )}

                  {/* Scenario Prediction */}
                  {aiAnalysisResult.scenario_prediction && (
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                      <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                        <Calculator className="w-5 h-5 mr-2 text-blue-600" />
                        Tax Scenario Prediction
                      </h3>
                      <div className="space-y-3">
                        {aiAnalysisResult.scenario_prediction.estimated_tax_saving && (
                          <div className="flex justify-between items-center">
                            <span className="text-blue-800 font-medium">Estimated Tax Savings:</span>
                            <span className="text-blue-900 font-bold text-lg">
                              ${aiAnalysisResult.scenario_prediction.estimated_tax_saving.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {aiAnalysisResult.scenario_prediction.note && (
                          <p className="text-blue-800 text-sm leading-relaxed">
                            {aiAnalysisResult.scenario_prediction.note}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Analysis Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-surface rounded-xl p-4 border border-border-subtle text-center">
                      <p className="text-2xl font-bold text-purple-600">95%</p>
                      <p className="text-sm text-text-tertiary">Confidence</p>
                    </div>
                    <div className="bg-surface rounded-xl p-4 border border-border-subtle text-center">
                      <p className="text-2xl font-bold text-blue-600">Real-time</p>
                      <p className="text-sm text-text-tertiary">Processing Time</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}