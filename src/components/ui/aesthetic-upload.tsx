import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  X, 
  Minimize2, 
  Maximize2, 
  FileText, 
  Image, 
  CheckCircle, 
  AlertCircle, 
  RotateCw,
  Cloud,
  File,
  Trash2,
  User,
  AlertTriangle,
  Brain,
  Eye
} from 'lucide-react';
import { Button } from '../atoms/Button';
import { useDocumentUpload } from '../../hooks/useDocumentUpload';
import { useClients } from '../../hooks/useClients';
import { formatFileSize } from '../../lib/uploadUtils';
import { supabase } from '../../lib/supabase';

interface AestheticUploadProps {
  clientId?: string;
  onUploadComplete: (documentIds: string[]) => void;
  onUploadError: (error: string) => void;
  onClose: () => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
}

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  documentId?: string;
  processingStep?: 'ocr' | 'classification' | 'specific' | 'complete';
  processingDetails?: {
    ocrComplete?: boolean;
    classificationComplete?: boolean;
    specificProcessingComplete?: boolean;
  };
}

export const AestheticUpload: React.FC<AestheticUploadProps> = ({
  clientId: initialClientId,
  onUploadComplete,
  onUploadError,
  onClose,
  isMinimized,
  onToggleMinimize
}) => {
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId || '');
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const { uploadMultipleDocuments } = useDocumentUpload();
  const { clients, loading: clientsLoading } = useClients();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for processing status
  const pollProcessingStatus = useCallback(async () => {
    const itemsWithDocumentIds = uploadItems.filter(item => item.documentId && item.status === 'processing');
    
    if (itemsWithDocumentIds.length === 0) {
      return;
    }

    try {
      const documentIds = itemsWithDocumentIds.map(item => item.documentId!);
      const { data: documents, error } = await supabase
        .from('documents')
        .select('id, is_processed, processing_status, eden_ai_classification, financial_processing_response, identity_processing_response, tax_processing_response')
        .in('id', documentIds);

      if (error) {
        console.error('Error polling processing status:', error);
        return;
      }

      setUploadItems(prev => prev.map(item => {
        if (!item.documentId) return item;
        
        const document = documents?.find(d => d.id === item.documentId);
        if (!document) return item;

        // Determine processing step and completion status
        let processingStep: UploadItem['processingStep'] = 'ocr';
        let isComplete = false;

        // Check for completion - either is_processed is true OR processing_status is completed OR we have classification
        if (document.is_processed || document.processing_status === 'completed' || document.eden_ai_classification) {
          if (document.processing_status === 'completed' || document.is_processed) {
            processingStep = 'complete';
            isComplete = true;
          } else if (document.financial_processing_response || document.identity_processing_response || document.tax_processing_response) {
            processingStep = 'specific';
          } else if (document.eden_ai_classification) {
            processingStep = 'classification';
          } else {
            processingStep = 'ocr';
          }
        }

        return {
          ...item,
          status: isComplete ? 'completed' : 'processing',
          progress: isComplete ? 100 : 
                   processingStep === 'specific' ? 90 :
                   processingStep === 'classification' ? 70 :
                   processingStep === 'ocr' ? 50 : 30,
          processingStep,
          processingDetails: {
            ocrComplete: !!document.eden_ai_classification,
            classificationComplete: !!document.eden_ai_classification,
            specificProcessingComplete: !!(document.financial_processing_response || document.identity_processing_response || document.tax_processing_response)
          }
        };
      }));

      // Check if all items are complete
      const allComplete = uploadItems.every(item => 
        item.status === 'completed' || item.status === 'error'
      );

      if (allComplete) {
        // Stop polling
        if (processingIntervalRef.current) {
          clearInterval(processingIntervalRef.current);
          processingIntervalRef.current = null;
        }

        // Call completion handler with successful document IDs
        const successfulDocumentIds = uploadItems
          .filter(item => item.status === 'completed' && item.documentId)
          .map(item => item.documentId!);

        if (successfulDocumentIds.length > 0) {
          onUploadComplete(successfulDocumentIds);
        }
      }
    } catch (error) {
      console.error('Error polling processing status:', error);
    }
  }, [uploadItems, onUploadComplete]);

  // Start polling when items are in processing state
  useEffect(() => {
    const hasProcessingItems = uploadItems.some(item => item.status === 'processing');
    
    if (hasProcessingItems && !processingIntervalRef.current) {
      processingIntervalRef.current = setInterval(pollProcessingStatus, 2000); // Poll every 2 seconds
    } else if (!hasProcessingItems && processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }

    return () => {
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
        processingIntervalRef.current = null;
      }
    };
  }, [uploadItems, pollProcessingStatus]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (!selectedClientId) {
      onUploadError('Please select a client before uploading files');
      return;
    }

    const newItems: UploadItem[] = acceptedFiles.map(file => ({
      id: `${file.name}-${Date.now()}`,
      file,
      progress: 0,
      status: 'pending'
    }));

    setUploadItems(prev => [...prev, ...newItems]);
    handleUpload(acceptedFiles);
  }, [selectedClientId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'],
      'text/plain': ['.txt'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    multiple: true,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    onDropAccepted: () => setIsDragging(false)
  });

  const handleUpload = async (files: File[]) => {
    if (!selectedClientId) {
      onUploadError('Client selection is required');
      return;
    }

    try {
      // Check for duplicate documents
      setIsCheckingDuplicates(true);
      const duplicateCheckPromises = files.map(async (file) => {
        // Check for exact filename match
        const { data: exactMatches } = await supabase
          .from('documents')
          .select('id, original_filename, client_id, file_size')
          .eq('original_filename', file.name)
          .eq('client_id', selectedClientId);

        // Check for similar filenames (same base name, different extensions)
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const { data: similarMatches } = await supabase
          .from('documents')
          .select('id, original_filename, client_id, file_size')
          .eq('client_id', selectedClientId)
          .ilike('original_filename', `${baseName}%`);

        // Check for files with similar size (±5% tolerance)
        const sizeTolerance = file.size * 0.05;
        const { data: sizeMatches } = await supabase
          .from('documents')
          .select('id, original_filename, client_id, file_size')
          .eq('client_id', selectedClientId)
          .gte('file_size', file.size - sizeTolerance)
          .lte('file_size', file.size + sizeTolerance);

        return {
          file,
          exactMatches: exactMatches || [],
          similarMatches: similarMatches || [],
          sizeMatches: sizeMatches || [],
          isDuplicate: (exactMatches && exactMatches.length > 0) || 
                      (similarMatches && similarMatches.length > 0) ||
                      (sizeMatches && sizeMatches.length > 0)
        };
      });

      const duplicateResults = await Promise.all(duplicateCheckPromises);
      const duplicates = duplicateResults.filter(result => result.isDuplicate);

      if (duplicates.length > 0) {
        const duplicateDetails = duplicates.map(d => {
          let message = `${d.file.name}`;
          if (d.exactMatches.length > 0) {
            message += ` (exact match: ${d.exactMatches[0].original_filename})`;
          } else if (d.similarMatches.length > 0) {
            message += ` (similar: ${d.similarMatches[0].original_filename})`;
          } else if (d.sizeMatches.length > 0) {
            message += ` (similar size: ${d.sizeMatches[0].original_filename})`;
          }
          return message;
        }).join(', ');
        
        setIsCheckingDuplicates(false);
        onUploadError(`Duplicate documents detected: ${duplicateDetails}. These documents already exist for this client.`);
        return;
      }

      setIsCheckingDuplicates(false);

      // Update status to uploading
      setUploadItems(prev => prev.map(item => 
        files.some(f => f.name === item.file.name) 
          ? { ...item, status: 'uploading', progress: 10 }
          : item
      ));

      const result = await uploadMultipleDocuments(files, selectedClientId, {
        processingOptions: {
          enableOCR: true,
          enableAI: true,
          autoClassify: true
        }
      });

      // Update progress based on results
      result.results.forEach((fileResult, index) => {
        const fileName = files[index].name;
        setUploadItems(prev => prev.map(item => 
          item.file.name === fileName 
            ? { 
                ...item, 
                status: fileResult.error ? 'error' : 'processing',
                progress: fileResult.error ? 0 : 30,
                error: fileResult.error?.message,
                documentId: fileResult.data?.id,
                processingStep: 'ocr'
              }
            : item
        ));
      });

      // Don't call onUploadComplete here - wait for processing to complete
      const errors = result.results.filter(r => r.error);
      if (errors.length > 0) {
        onUploadError(`Failed to upload ${errors.length} file(s)`);
      }

    } catch (error: any) {
      setIsCheckingDuplicates(false);
      onUploadError(error.message);
    }
  };

  const removeUploadItem = (id: string) => {
    setUploadItems(prev => prev.filter(item => item.id !== id));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="w-5 h-5 text-blue-500" />;
    }
    if (file.type === 'application/pdf') {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const getStatusIcon = (status: string, processingStep?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'uploading':
        return <Cloud className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'processing':
        return <Brain className="w-4 h-4 text-purple-500 animate-spin" />;
      default:
        return <Cloud className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'uploading':
        return 'bg-blue-500';
      case 'processing':
        return 'bg-purple-500';
      default:
        return 'bg-gray-300';
    }
  };

  const getProcessingStepText = (processingStep?: string) => {
    switch (processingStep) {
      case 'ocr':
        return 'Extracting text...';
      case 'classification':
        return 'Classifying document...';
      case 'specific':
        return 'Processing data...';
      case 'complete':
        return 'Complete';
      default:
        return 'Processing...';
    }
  };

  const canClose = uploadItems.every(item => 
    item.status === 'completed' || item.status === 'error'
  );

  if (isMinimized) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <div className="bg-surface-elevated rounded-2xl border border-border-subtle shadow-soft p-4">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Upload className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-text-primary">
                {uploadItems.length} file(s) {uploadItems.some(item => item.status === 'processing') ? 'processing' : 'uploading'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleMinimize}
                className="p-1"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="p-1 text-text-tertiary hover:text-text-primary"
                disabled={!canClose}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Progress bar for minimized view */}
          {uploadItems.length > 0 && (
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    uploadItems.some(item => item.status === 'error') 
                      ? 'bg-red-500' 
                      : uploadItems.every(item => item.status === 'completed')
                      ? 'bg-green-500'
                      : uploadItems.some(item => item.status === 'processing')
                      ? 'bg-purple-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ 
                    width: `${uploadItems.reduce((acc, item) => acc + item.progress, 0) / uploadItems.length}%` 
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        className="bg-surface-elevated rounded-3xl border border-border-subtle shadow-soft w-full max-w-2xl mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-subtle">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Upload Documents</h3>
              <p className="text-sm text-text-tertiary">
                {uploadItems.some(item => item.status === 'processing') 
                  ? 'Processing documents...' 
                  : 'Select a client and upload files'
                }
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              onClick={onToggleMinimize}
              className="p-2"
            >
              <Minimize2 className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              onClick={onClose}
              className="p-2 text-text-tertiary hover:text-text-primary"
              disabled={!canClose}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Client Selection - only show if no items are processing */}
        {!uploadItems.some(item => item.status === 'processing') && (
          <div className="p-6 border-b border-border-subtle">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-text-primary">
                Select Client <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-border-subtle rounded-xl bg-surface-elevated text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                  disabled={uploadItems.length > 0}
                >
                  <option value="">Select a client (required)</option>
                  {clientsLoading ? (
                    <option value="" disabled>Loading clients...</option>
                  ) : (
                    clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name} ({client.email})
                      </option>
                    ))
                  )}
                </select>
              </div>
              {!selectedClientId && (
                <div className="flex items-center space-x-2 text-sm text-red-500">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Client selection is required to upload documents</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Upload Area - only show if no items are processing */}
        {!uploadItems.some(item => item.status === 'processing') && (
          <div className="p-6">
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200
                ${!selectedClientId 
                  ? 'border-gray-300 bg-gray-50 cursor-not-allowed' 
                  : isDragActive || isDragging
                  ? 'border-primary bg-primary/5 cursor-pointer'
                  : 'border-border-subtle hover:border-primary/50 hover:bg-surface-hover cursor-pointer'
                }
              `}
            >
              <input {...getInputProps()} disabled={!selectedClientId} />
              <div className="space-y-4">
                <div className={`p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center ${
                  !selectedClientId ? 'bg-gray-100' : isCheckingDuplicates ? 'bg-amber-100' : 'bg-primary/10'
                }`}>
                  {isCheckingDuplicates ? (
                    <RotateCw className="w-8 h-8 text-amber-600 animate-spin" />
                  ) : (
                    <Upload className={`w-8 h-8 ${!selectedClientId ? 'text-gray-400' : 'text-primary'}`} />
                  )}
                </div>
                <div>
                  <p className={`text-lg font-medium ${
                    !selectedClientId ? 'text-gray-500' : isCheckingDuplicates ? 'text-amber-600' : 'text-text-primary'
                  }`}>
                    {!selectedClientId 
                      ? 'Select a client first' 
                      : isCheckingDuplicates
                      ? 'Checking for duplicates...'
                      : isDragActive 
                      ? 'Drop files here' 
                      : 'Drag & drop files here'
                    }
                  </p>
                  <p className={`text-sm mt-1 ${
                    !selectedClientId ? 'text-gray-400' : isCheckingDuplicates ? 'text-amber-500' : 'text-text-tertiary'
                  }`}>
                    {!selectedClientId 
                      ? 'Client selection required' 
                      : isCheckingDuplicates
                      ? 'Verifying document uniqueness'
                      : 'or click to browse files'
                    }
                  </p>
                </div>
                <p className="text-xs text-text-tertiary">
                  {isCheckingDuplicates 
                    ? 'Checking for existing documents with similar names or sizes...'
                    : 'Supports PDF, images, and documents up to 10MB each'
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Upload Progress */}
        <AnimatePresence>
          {uploadItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 space-y-3"
            >
              <h4 className="font-medium text-text-primary">
                {uploadItems.some(item => item.status === 'processing') 
                  ? 'Processing Progress' 
                  : 'Upload Progress'
                }
              </h4>
              {uploadItems.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-surface rounded-xl p-4 border border-border-subtle"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {getFileIcon(item.file)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {item.file.name}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          {formatFileSize(item.file.size)}
                        </p>
                        {item.status === 'processing' && item.processingStep && (
                          <p className="text-xs text-purple-600 mt-1 flex items-center">
                            <Brain className="w-3 h-3 mr-1" />
                            {getProcessingStepText(item.processingStep)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(item.status, item.processingStep)}
                      {item.status !== 'processing' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeUploadItem(item.id)}
                          className="p-1 text-text-tertiary hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-text-tertiary mb-1">
                      <span>{item.status}</span>
                      <span>{item.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <motion.div
                        className={`h-2 rounded-full ${getStatusColor(item.status)}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${item.progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>

                  {/* Error Message */}
                  {item.error && (
                    <p className="text-xs text-red-500 mt-2">{item.error}</p>
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}; 