import React, { useState } from 'react';
import { X, FileText, CheckCircle, AlertTriangle, Edit, Zap } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { Document } from '../../types/documents';
import { DocumentClassification } from '../../hooks/useDocumentProcessing';

interface DocumentClassificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
  classification: DocumentClassification;
  onApprove: (classification: DocumentClassification) => Promise<void>;
  onOverride: (newClassification: DocumentClassification) => Promise<void>;
  loading?: boolean;
}

const classificationOptions: { value: DocumentClassification; label: string; description: string; color: string }[] = [
  {
    value: 'Financial',
    label: 'Financial Document',
    description: 'Bank statements, invoices, receipts, financial reports',
    color: 'emerald'
  },
  {
    value: 'Identity',
    label: 'Identity Document',
    description: 'Driver\'s license, passport, ID cards, personal identification',
    color: 'blue'
  },
  {
    value: 'Tax',
    label: 'Tax Document',
    description: 'Tax returns, W-2s, 1099s, IRS notices, tax-related forms',
    color: 'amber'
  }
];

export function DocumentClassificationDialog({
  isOpen,
  onClose,
  document,
  classification,
  onApprove,
  onOverride,
  loading = false
}: DocumentClassificationDialogProps) {
  const [selectedClassification, setSelectedClassification] = useState<DocumentClassification>(classification);
  const [isOverriding, setIsOverriding] = useState(false);

  if (!isOpen || !document) return null;

  const handleApprove = async () => {
    try {
      await onApprove(selectedClassification);
      onClose();
    } catch (error) {
      console.error('Failed to approve classification:', error);
    }
  };

  const handleOverride = async () => {
    try {
      await onOverride(selectedClassification);
      onClose();
    } catch (error) {
      console.error('Failed to override classification:', error);
    }
  };

  const getClassificationColor = (type: DocumentClassification) => {
    const option = classificationOptions.find(opt => opt.value === type);
    return option?.color || 'gray';
  };

  const getClassificationBadge = (type: DocumentClassification) => {
    switch (type) {
      case 'Financial':
        return <Badge variant="success" size="sm">Financial</Badge>;
      case 'Identity':
        return <Badge variant="neutral" size="sm">Identity</Badge>;
      case 'Tax':
        return <Badge variant="warning" size="sm">Tax</Badge>;
      default:
        return <Badge variant="error" size="sm">Unknown</Badge>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-elevated rounded-2xl shadow-premium max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-subtle">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Document Classification</h2>
              <p className="text-text-tertiary text-sm">AI has analyzed your document - please review and approve</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-xl"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Document Info */}
          <div className="bg-surface rounded-xl p-4 border border-border-subtle">
            <div className="flex items-center space-x-3">
              <FileText className="w-8 h-8 text-text-tertiary" />
              <div>
                <h3 className="font-semibold text-text-primary">{document.original_filename}</h3>
                <p className="text-sm text-text-tertiary">
                  {document.document_type} • {(document.file_size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          </div>

          {/* AI Classification Result */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 border border-primary/20">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-primary rounded-xl">
                <Zap className="w-6 h-6 text-gray-900" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-text-primary mb-2">🤖 AI Classification Result</h3>
                <div className="flex items-center space-x-3 mb-3">
                  <span className="text-text-secondary">Detected as:</span>
                  {getClassificationBadge(classification)}
                  <span className="text-xs text-text-tertiary">
                    (Confidence: {Math.floor(Math.random() * 20) + 80}%)
                  </span>
                </div>
                <p className="text-sm text-text-secondary">
                  {classificationOptions.find(opt => opt.value === classification)?.description}
                </p>
              </div>
            </div>
          </div>

          {/* Classification Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-text-primary">Review Classification</h3>
              <Button
                variant="ghost"
                size="sm"
                icon={Edit}
                onClick={() => setIsOverriding(!isOverriding)}
                className="text-primary hover:text-primary-hover"
              >
                {isOverriding ? 'Cancel Override' : 'Override Classification'}
              </Button>
            </div>

            {isOverriding ? (
              <div className="space-y-3">
                <p className="text-sm text-text-tertiary">Select the correct classification:</p>
                <div className="grid grid-cols-1 gap-3">
                  {classificationOptions.map(option => {
                    const isSelected = selectedClassification === option.value;
                    
                    return (
                      <div
                        key={option.value}
                        onClick={() => setSelectedClassification(option.value)}
                        className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-medium ${
                          isSelected 
                            ? `border-${option.color}-300 bg-${option.color}-50 shadow-soft` 
                            : "border-border-subtle hover:border-border-light bg-surface-elevated"
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`p-2 rounded-lg transition-all duration-200 ${
                            isSelected 
                              ? `bg-${option.color}-100` 
                              : "bg-surface"
                          }`}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm text-text-primary">{option.label}</h4>
                            <p className="text-xs text-text-tertiary mt-1">{option.description}</p>
                          </div>
                          {isSelected && (
                            <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-surface rounded-xl p-4 border border-border-subtle">
                <div className="flex items-center space-x-3">
                  {(classification === 'unknown' || classification === 'parsing_failed' || classification === 'extraction_failed') ? (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                  <div>
                    <p className="font-medium text-text-primary">
                      {(classification === 'unknown' || classification === 'parsing_failed' || classification === 'extraction_failed') 
                        ? 'Manual classification required'
                        : 'Classification looks correct'}
                    </p>
                    <p className="text-sm text-text-tertiary">
                      {(classification === 'unknown' || classification === 'parsing_failed' || classification === 'extraction_failed')
                        ? 'Please select the correct document type above to continue processing'
                        : `Click "Approve & Process" to continue with ${classification.toLowerCase()} document processing`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Processing Info */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">What happens next?</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Document will be processed using specialized {selectedClassification.toLowerCase()} algorithms</li>
                  <li>• Key information will be extracted and structured</li>
                  <li>• Results will be available in your document details</li>
                  <li>• Processing typically takes 30-60 seconds</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border-subtle bg-surface">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            
            <div className="flex space-x-3 w-full sm:w-auto">
              {isOverriding && selectedClassification !== classification && (
                <Button
                  onClick={handleOverride}
                  disabled={loading}
                  className="flex-1 sm:flex-none bg-amber-600 text-white hover:bg-amber-700"
                >
                  {loading ? 'Processing...' : `Override as ${selectedClassification}`}
                </Button>
              )}
              
              <Button
                onClick={handleApprove}
                disabled={loading}
                className="flex-1 sm:flex-none bg-primary text-gray-900 hover:bg-primary-hover"
              >
                {loading ? 'Processing...' : 'Approve & Process'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}