import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  Loader2,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { Document, DOCUMENT_TYPE_LABELS } from '../../types/documents';
import { formatFileSize } from '../../lib/uploadUtils';
import { cn } from '../../lib/utils';

interface EnhancedDocumentPreviewProps {
  document: Document;
  previewUrl?: string;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: () => void;
  className?: string;
}

const EnhancedPreviewContent: React.FC<{
  document: Document;
  previewUrl: string;
}> = ({ document, previewUrl }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [retryCount, setRetryCount] = useState(0);
  const [useDirectLink, setUseDirectLink] = useState(false);
  const [chromeBlocked, setChromeBlocked] = useState(false);
  const [loadSuccessful, setLoadSuccessful] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blockingCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasStartedCheckingRef = useRef(false);

  console.log('🖼️ EnhancedPreviewContent rendering with:', {
    filename: document.original_filename,
    type: document.mime_type,
    url: previewUrl
  });

  const isPDF = document.mime_type === 'application/pdf';
  const isImage = document.mime_type?.startsWith('image/');

  // Add timeout for loading state to handle cases where onLoad doesn't fire
  useEffect(() => {
    let loadingTimeout: NodeJS.Timeout | null = null;
    
    if (loading && isPDF) {
      console.log('⏱️ Setting timeout to clear loading state for PDF');
      loadingTimeout = setTimeout(() => {
        console.log('⏰ Timeout reached, clearing loading state');
        setLoading(false);
        
        // Check if iframe might be blocked by checking if we can access its content
        const iframe = iframeRef.current;
        if (iframe) {
          try {
            // Try to access iframe content to detect if it's blocked
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!doc) {
              console.log('🚫 Iframe content appears to be blocked');
              setChromeBlocked(true);
              setError('Browser has blocked this content due to security policies.');
            }
          } catch (e) {
            console.log('🚫 Cross-origin error suggests content might be blocked:', e);
            // This is normal for cross-origin content, don't set as blocked
          }
        }
      }, 5000); // 5 seconds timeout
    }

    return () => {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
    };
  }, [loading, isPDF]);

  const handleLoad = () => {
    console.log('✅ Preview loaded successfully');
    setLoading(false);
    setLoadSuccessful(true);
    setError(null);
    
    // Clear any existing blocking check timeout
    if (blockingCheckTimeoutRef.current) {
      clearTimeout(blockingCheckTimeoutRef.current);
      blockingCheckTimeoutRef.current = null;
    }
    
    // For PDFs, we need to check if Chrome actually allows the content
    // Use refs to avoid state updates that cause re-renders
    if (isPDF && iframeRef.current && !hasStartedCheckingRef.current) {
      hasStartedCheckingRef.current = true;
      console.log('🔍 Starting Chrome blocking detection for PDF...');
      
      // Give Chrome a moment to potentially block the content after loading
      blockingCheckTimeoutRef.current = setTimeout(() => {
        const iframe = iframeRef.current;
        if (iframe) {
          console.log('🔍 Checking iframe content accessibility...');
          try {
            // Check if we can see the iframe's content
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            
            console.log('📄 Iframe document accessible:', !!iframeDoc);
            
            // If we can access the document but it's empty or has blocking content
            if (iframeDoc) {
              const bodyText = iframeDoc.body?.innerText || '';
              const bodyHTML = iframeDoc.body?.innerHTML || '';
              const title = iframeDoc.title || '';
              
              console.log('📄 Iframe content analysis:', { 
                bodyTextLength: bodyText.length,
                bodyHTMLLength: bodyHTML.length,
                title,
                firstTextChars: bodyText.substring(0, 100),
                firstHTMLChars: bodyHTML.substring(0, 200)
              });
              
              // Enhanced detection: use normalized text and look for key blocking indicators, including cookie banner
              const lowerBodyText = bodyText.toLowerCase();
              const lowerBodyHTML = bodyHTML.toLowerCase();
              const lowerTitle = title.toLowerCase();
              const hasBlockingText = 
                lowerBodyText.includes('blocked') ||
                lowerBodyText.includes('this page') ||
                lowerBodyHTML.includes('blocked') ||
                lowerBodyText.includes('third-party cookie') ||
                lowerBodyText.includes('third party cookie') ||
                lowerTitle.includes('blocked');

              if (hasBlockingText) {
                console.log('🚫 Chrome blocking detected: Found blocking-related text or cookie banner');
                setChromeBlocked(true);
                setError('Chrome has blocked this PDF content due to security policies.');
              } else {
                console.log('✅ PDF content appears to be loading normally');
              }
            } else {
              // Cross-origin restrictions - this is normal for external URLs
              console.log('📄 Cross-origin restrictions detected (normal for Supabase URLs)');
            }
          } catch (e) {
            // Cross-origin error is normal for external content
            const error = e as Error;
            console.log('📄 Cross-origin access attempt (expected for external URLs):', error.message);
          }
        } else {
          console.log('⚠️ Iframe ref no longer available during blocking check');
        }
        
        blockingCheckTimeoutRef.current = null;
        console.log('🔍 Chrome blocking detection complete');
      }, 2000); // 2 seconds to give time for PDF rendering
    }
  };

  const handleError = (errorEvent?: any) => {
    console.error('❌ Preview failed to load', errorEvent);
    setLoading(false);
    
    // Check if it might be Chrome blocking the content
    if (errorEvent && errorEvent.target && errorEvent.target.contentDocument === null) {
      setChromeBlocked(true);
      setError('Chrome has blocked this content. Please try opening in a new tab or use the alternative view mode.');
    } else {
      setError('Failed to load preview in iframe');
    }
  };

  const handleRetry = () => {
    if (retryCount >= 2) {
      setError('Maximum retry attempts reached. Try opening in a new tab or downloading the document.');
      return;
    }
    
    console.log(`🔄 Retrying preview (attempt ${retryCount + 1})`);
    
    // Clear any existing blocking check timeout
    if (blockingCheckTimeoutRef.current) {
      clearTimeout(blockingCheckTimeoutRef.current);
      blockingCheckTimeoutRef.current = null;
    }
    
    hasStartedCheckingRef.current = false;
    setRetryCount(prev => prev + 1);
    setLoading(true);
    setError(null);
    setChromeBlocked(false);
    setLoadSuccessful(false);
    
    // Force reload
    setTimeout(() => {
      const iframe = iframeRef.current;
      if (iframe) {
        iframe.src = iframe.src + '&t=' + Date.now();
      }
    }, 100);
  };

  const openInNewTab = () => {
    console.log('🔗 Opening document in new tab');
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  const toggleDirectLink = () => {
    console.log('🔄 Toggling direct link mode:', !useDirectLink);
    
    // Clear any existing blocking check timeout
    if (blockingCheckTimeoutRef.current) {
      clearTimeout(blockingCheckTimeoutRef.current);
      blockingCheckTimeoutRef.current = null;
    }
    
    hasStartedCheckingRef.current = false;
    setUseDirectLink(!useDirectLink);
    setLoading(true);
    setError(null);
    setChromeBlocked(false);
    setLoadSuccessful(false);
    setRetryCount(0); // Reset retry count when switching modes
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleZoomReset = () => setZoom(100);

  // Reset loading state when URL or mode changes
  useEffect(() => {
    // Clear any existing blocking check timeout
    if (blockingCheckTimeoutRef.current) {
      clearTimeout(blockingCheckTimeoutRef.current);
      blockingCheckTimeoutRef.current = null;
    }
    
    hasStartedCheckingRef.current = false;
    setLoading(true);
    setError(null);
    setChromeBlocked(false);
    setLoadSuccessful(false);
  }, [previewUrl, useDirectLink]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (blockingCheckTimeoutRef.current) {
        clearTimeout(blockingCheckTimeoutRef.current);
        blockingCheckTimeoutRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 sm:h-72 md:h-96">
        <div className="text-center px-4">
          <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-xs sm:text-sm text-text-tertiary">Loading preview...</p>
          {isPDF && (
            <p className="text-xs text-text-tertiary mt-1 sm:mt-2">
              PDF documents may take a moment to load
            </p>
          )}
          {retryCount > 0 && (
            <p className="text-xs text-text-tertiary mt-1">
              Retry attempt {retryCount}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error || chromeBlocked) {
    return (
      <div className="flex items-center justify-center h-48 sm:h-72 md:h-96">
        <div className="text-center max-w-full sm:max-w-md px-4">
          <AlertCircle className="w-8 h-8 sm:w-12 sm:h-12 text-red-500 mx-auto mb-3 sm:mb-4" />
          <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-1 sm:mb-2">
            {chromeBlocked ? 'Content Blocked' : 'Preview Not Available'}
          </h3>
          <p className="text-sm text-text-tertiary mb-3 sm:mb-4">{error}</p>
          
          <div className="space-y-2">
            <div className="flex justify-center flex-wrap gap-2">
              {retryCount < 2 && !chromeBlocked && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={RefreshCw}
                  onClick={handleRetry}
                  className="text-xs sm:text-sm py-1 sm:py-2"
                >
                  Retry
                </Button>
              )}
              <Button
                size="sm"
                variant="primary"
                icon={ExternalLink}
                onClick={openInNewTab}
                className="text-xs sm:text-sm py-1 sm:py-2"
              >
                Open in New Tab
              </Button>
            </div>
            
            {isPDF && (
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleDirectLink}
                className="text-xs sm:text-sm py-1 sm:py-2"
              >
                {chromeBlocked ? 'Try Alternative View' : 'Switch View Mode'}
              </Button>
            )}
          </div>
          
          <p className="text-xs sm:text-sm text-text-tertiary mt-3 sm:mt-4">
            {chromeBlocked 
              ? 'Chrome\'s security settings are blocking this content. Opening in a new tab should work.'
              : 'You can also download the file to view it locally'
            }
          </p>
        </div>
      </div>
    );
  }

  if (isPDF) {
    console.log('📄 Rendering PDF preview with URL:', previewUrl);
    
    // For PDFs, we'll try multiple approaches
    const pdfUrl = useDirectLink ? previewUrl : `${previewUrl}#view=FitH`;
    
    console.log(`📋 PDF URL mode: ${useDirectLink ? 'Direct' : 'Standard'}, Final URL: ${pdfUrl}`);
    
    // If Chrome blocked or in direct link mode, show alternative options first
    if (chromeBlocked) {
      return (
        <div className="relative">
          <div className="flex items-center justify-between mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-red-800">PDF Content Blocked by Browser</span>
            </div>
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="primary" onClick={openInNewTab}>
                <ExternalLink className="w-4 h-4 mr-1" />
                Open PDF
              </Button>
              {!useDirectLink && (
                <Button size="sm" variant="secondary" onClick={toggleDirectLink}>
                  Try Alternative View
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-center h-96 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-center max-w-md">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Browser Security Restriction</h3>
              <p className="text-gray-600 mb-4">
                Your browser has blocked this PDF content due to security policies. 
                This is a common safety feature in modern browsers.
              </p>
              <div className="space-y-2">
                <Button variant="primary" onClick={openInNewTab} className="w-full">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open PDF in New Tab
                </Button>
                {!useDirectLink && (
                  <Button variant="secondary" onClick={toggleDirectLink} className="w-full">
                    Try Alternative Viewer
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Opening in a new tab typically bypasses these restrictions
              </p>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="relative">
        <div className="flex items-center justify-between mb-4 p-4 bg-surface-elevated rounded-lg">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-text-tertiary" />
            <span className="text-sm font-medium text-text-primary">PDF Document</span>
            {useDirectLink && (
              <Badge variant="warning" size="sm">Alternative View</Badge>
            )}
            {chromeBlocked && (
              <Badge variant="error" size="sm">Content Blocked</Badge>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button size="sm" variant="ghost" onClick={openInNewTab} title="Open in new tab">
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleZoomOut} disabled={zoom <= 50}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm text-text-tertiary min-w-[3rem] text-center">
              {zoom}%
            </span>
            <Button size="sm" variant="ghost" onClick={handleZoomIn} disabled={zoom >= 200}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleZoomReset}>
              Reset
            </Button>
          </div>
        </div>
        
        <div className="border border-border-subtle rounded-lg overflow-hidden max-h-[60vh] bg-gray-100 relative">
          {loadSuccessful && !chromeBlocked && (
            <div className="absolute top-2 right-2 z-10 bg-green-100 border border-green-300 rounded-lg px-3 py-1 text-xs text-green-700 flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-600 rounded-full"></div>
              <span>PDF loaded</span>
            </div>
          )}
        <iframe
  ref={iframeRef}
  src={pdfUrl}
  className="w-full h-full min-h-[400px] bg-white"
  style={{ 
    transform: `scale(${zoom / 100})`, 
    transformOrigin: 'top left',
    border: 'none'
  }}
  onLoad={() => {
    console.log('📄 Iframe onLoad event fired');
    handleLoad();
  }}
  onError={(e) => {
    console.error('📄 Iframe onError event fired:', e);
    handleError(e);
  }}
  title={`Preview of ${document.original_filename}`}
  {...(isPDF ? {} : { sandbox: "allow-same-origin allow-scripts allow-forms allow-downloads allow-popups" })}
  loading="eager"
  referrerPolicy="same-origin"
  allow="fullscreen"
/>  
        </div>
        
        <div className="mt-2 text-center">
          <p className="text-xs text-text-tertiary">
            Having trouble viewing? Try{' '}
            <button onClick={openInNewTab} className="text-primary hover:underline">
              opening in a new tab
            </button>
            {' '}or{' '}
            <button onClick={toggleDirectLink} className="text-primary hover:underline">
              switching view mode
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="relative">
        <div className="flex items-center justify-between mb-4 p-4 bg-surface-elevated rounded-lg">
          <div className="flex items-center space-x-2">
            <ImageIcon className="w-5 h-5 text-text-tertiary" />
            <span className="text-sm font-medium text-text-primary">Image</span>
          </div>
          <div className="flex items-center space-x-2">
            <Button size="sm" variant="ghost" onClick={handleZoomOut} disabled={zoom <= 50}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm text-text-tertiary min-w-[3rem] text-center">
              {zoom}%
            </span>
            <Button size="sm" variant="ghost" onClick={handleZoomIn} disabled={zoom >= 200}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleZoomReset}>
              Reset
            </Button>
          </div>
        </div>
        
        <div className="flex justify-center border border-border-subtle rounded-lg overflow-auto max-h-[70vh] p-4">
          <img
            src={previewUrl}
            alt={document.original_filename}
            className="max-w-full h-auto rounded-lg"
            style={{ transform: `scale(${zoom / 100})` }}
            onLoad={handleLoad}
            onError={handleError}
          />
        </div>
      </div>
    );
  }

  // Fallback for unsupported file types
  return (
    <div className="flex items-center justify-center h-48 sm:h-72 md:h-96">
      <div className="text-center px-4">
        <FileText className="w-10 h-10 sm:w-16 sm:h-16 text-text-tertiary mx-auto mb-3 sm:mb-4" />
        <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-1 sm:mb-2">Preview Not Available</h3>
        <p className="text-xs sm:text-sm text-text-tertiary mb-3 sm:mb-4">
          This file type ({document.mime_type}) cannot be previewed in the browser
        </p>
        <Button
          variant="secondary"
          icon={Download}
          onClick={openInNewTab}
          className="text-xs sm:text-sm py-1 sm:py-2"
        >
          Download to View
        </Button>
      </div>
    </div>
  );
};

export const EnhancedDocumentPreview: React.FC<EnhancedDocumentPreviewProps> = ({
  document: documentProp,
  previewUrl,
  isOpen,
  onClose,
  onDownload,
  className,
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-1 sm:p-2 md:p-4',
        className
      )}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-surface rounded-xl sm:rounded-2xl shadow-xl sm:shadow-2xl max-w-full sm:max-w-3xl md:max-w-5xl lg:max-w-6xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 border-b border-border-subtle">
          <div className="flex items-center space-x-4 flex-1 min-w-0 mb-4 sm:mb-0">
            <div className="w-full">
              <h2 className="text-base sm:text-lg font-semibold text-text-primary truncate">
                {documentProp.original_filename}
              </h2>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1">
                <Badge variant="neutral" size="sm">
                  {DOCUMENT_TYPE_LABELS[documentProp.document_type] || documentProp.document_type}
                </Badge>
                <span className="text-xs sm:text-sm text-text-tertiary">
                  {formatFileSize(documentProp.file_size)}
                </span>
                <span className="text-xs sm:text-sm text-text-tertiary">
                  {new Date(documentProp.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onDownload && (
              <Button
                variant="secondary"
                icon={Download}
                onClick={onDownload}
                className="text-xs sm:text-sm py-1 sm:py-2"
              >
                Download
              </Button>
            )}
            <Button
              variant="ghost"
              icon={X}
              onClick={onClose}
              className="text-xs sm:text-sm py-1 sm:py-2"
            >
              Close
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 md:p-6 overflow-auto" style={{ maxHeight: 'calc(85vh - 150px) sm:calc(90vh - 200px)' }}>
          {previewUrl ? (
            <EnhancedPreviewContent document={documentProp} previewUrl={previewUrl} />
          ) : (
            <div className="flex items-center justify-center h-48 sm:h-72 md:h-96">
              <div className="text-center">
                <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-xs sm:text-sm text-text-tertiary">Loading preview URL...</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer with document metadata */}
        {documentProp.ai_summary && (
          <div className="border-t border-border-subtle p-4 sm:p-6 bg-surface-elevated">
            <h3 className="text-xs sm:text-sm font-semibold text-text-primary mb-1 sm:mb-2">AI Summary</h3>
            <p className="text-xs sm:text-sm text-text-tertiary leading-relaxed">
              {documentProp.ai_summary}
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
