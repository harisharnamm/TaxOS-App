import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Download, 
  Eye, 
  Trash2, 
  Edit, 
  Tag,
  Calendar,
  Filter,
  Search,
  Grid,
  List
} from 'lucide-react';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { Input } from '../atoms/Input';
import { Document, DocumentFilter, DOCUMENT_TYPE_LABELS } from '../../types/documents';
import { formatFileSize } from '../../lib/uploadUtils';
import { cn } from '../../lib/utils';

interface DocumentListProps {
  documents: Document[];
  loading?: boolean;
  onDownload?: (documentId: string, filename: string) => void;
  onPreview?: (documentId: string) => void;
  onDelete?: (documentId: string) => void;
  onEdit?: (document: Document) => void;
  filter?: DocumentFilter;
  onFilterChange?: (filter: DocumentFilter) => void;
  className?: string;
}

const ViewModeToggle: React.FC<{
  viewMode: 'grid' | 'list';
  onChange: (mode: 'grid' | 'list') => void;
}> = ({ viewMode, onChange }) => (
  <div className="flex items-center space-x-1 bg-surface rounded-lg p-1">
    <button
      onClick={() => onChange('grid')}
      className={cn(
        'p-2 rounded-md transition-colors',
        viewMode === 'grid' 
          ? 'bg-primary text-white' 
          : 'hover:bg-surface-elevated text-text-tertiary'
      )}
    >
      <Grid className="w-4 h-4" />
    </button>
    <button
      onClick={() => onChange('list')}
      className={cn(
        'p-2 rounded-md transition-colors',
        viewMode === 'list' 
          ? 'bg-primary text-white' 
          : 'hover:bg-surface-elevated text-text-tertiary'
      )}
    >
      <List className="w-4 h-4" />
    </button>
  </div>
);

const DocumentCard: React.FC<{
  document: Document;
  onDownload?: (id: string, filename: string) => void;
  onPreview?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (doc: Document) => void;
}> = ({ document, onDownload, onPreview, onDelete, onEdit }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="group bg-surface-elevated rounded-2xl border border-border-subtle p-6 shadow-soft hover:shadow-medium hover:-translate-y-1 transition-all duration-200"
    >
      {/* Document Preview */}
      <div className="aspect-square bg-surface rounded-xl mb-4 flex items-center justify-center border border-border-subtle relative overflow-hidden">
        <FileText className="w-12 h-12 text-text-tertiary" />
        
        {/* Processing indicator */}
        {!document.is_processed && (
          <div className="absolute top-2 right-2 w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
        )}

        {/* Quick action overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
          <Button
            size="sm"
            variant="ghost"
            icon={Eye}
            onClick={() => onPreview?.(document.id)}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20"
          >
            Preview
          </Button>
        </div>
      </div>

      {/* Document Info */}
      <div className="space-y-3">
        <h3 
          className="font-semibold text-text-primary truncate" 
          title={document.original_filename}
        >
          {document.original_filename}
        </h3>

        <div className="flex items-center justify-between">
          <Badge variant="neutral" size="sm">
            {DOCUMENT_TYPE_LABELS[document.document_type] || document.document_type}
          </Badge>
          <span className="text-xs text-text-tertiary">
            {formatFileSize(document.file_size)}
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs text-text-tertiary">
          <Calendar className="w-3 h-3" />
          <span>{new Date(document.created_at).toLocaleDateString()}</span>
        </div>

        {/* Tags */}
        {document.tags && document.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {document.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center text-xs bg-surface px-2 py-1 rounded-md text-text-tertiary"
              >
                <Tag className="w-3 h-3 mr-1" />
                {tag}
              </span>
            ))}
            {document.tags.length > 3 && (
              <span className="text-xs text-text-tertiary">
                +{document.tags.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex space-x-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="ghost"
          icon={Download}
          onClick={() => onDownload?.(document.id, document.original_filename)}
          className="flex-1"
        >
          Download
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={Edit}
          onClick={() => onEdit?.(document)}
        >
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={Trash2}
          onClick={() => onDelete?.(document.id)}
          className="text-red-500 hover:text-red-600 hover:bg-red-50"
        >
          Delete
        </Button>
      </div>
    </motion.div>
  );
};

const DocumentListItem: React.FC<{
  document: Document;
  onDownload?: (id: string, filename: string) => void;
  onPreview?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (doc: Document) => void;
}> = ({ document, onDownload, onPreview, onDelete, onEdit }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="group bg-surface-elevated rounded-xl border border-border-subtle p-4 hover:shadow-medium transition-all duration-200"
    >
      <div className="flex items-center space-x-4">
        {/* File Icon */}
        <div className="flex-shrink-0 w-12 h-12 bg-surface rounded-lg flex items-center justify-center">
          <FileText className="w-6 h-6 text-text-tertiary" />
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-text-primary truncate" title={document.original_filename}>
            {document.original_filename}
          </h3>
          <div className="flex items-center space-x-4 mt-1">
            <Badge variant="neutral" size="sm">
              {DOCUMENT_TYPE_LABELS[document.document_type] || document.document_type}
            </Badge>
            <span className="text-sm text-text-tertiary">
              {formatFileSize(document.file_size)}
            </span>
            <span className="text-sm text-text-tertiary">
              {new Date(document.created_at).toLocaleDateString()}
            </span>
            {!document.is_processed && (
              <Badge variant="warning" size="sm">Processing</Badge>
            )}
          </div>

          {/* Tags */}
          {document.tags && document.tags.length > 0 && (
            <div className="flex items-center space-x-1 mt-2">
              <Tag className="w-3 h-3 text-text-tertiary" />
              <span className="text-xs text-text-tertiary">
                {document.tags.join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="ghost"
            icon={Eye}
            onClick={() => onPreview?.(document.id)}
          >
            Preview
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={Download}
            onClick={() => onDownload?.(document.id, document.original_filename)}
          >
            Download
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={Edit}
            onClick={() => onEdit?.(document)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={Trash2}
            onClick={() => onDelete?.(document.id)}
            className="text-red-500 hover:text-red-600"
          >
            Delete
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  loading = false,
  onDownload,
  onPreview,
  onDelete,
  onEdit,
  filter,
  onFilterChange,
  className,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState(filter?.searchQuery || '');
  const [selectedType, setSelectedType] = useState<string>(filter?.documentType || 'all');

  // Filter documents based on search and type
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchQuery || 
      doc.original_filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.ocr_text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = selectedType === 'all' || doc.document_type === selectedType;
    
    return matchesSearch && matchesType;
  });

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onFilterChange?.({ ...filter, searchQuery: value });
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    onFilterChange?.({ 
      ...filter, 
      documentType: type === 'all' ? undefined : type as any 
    });
  };

  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        {/* Loading skeleton for controls */}
        <div className="flex justify-between items-center">
          <div className="flex space-x-4">
            <div className="h-10 w-64 bg-surface-elevated rounded-lg animate-pulse" />
            <div className="h-10 w-32 bg-surface-elevated rounded-lg animate-pulse" />
          </div>
          <div className="h-10 w-20 bg-surface-elevated rounded-lg animate-pulse" />
        </div>

        {/* Loading skeleton for documents */}
        <div className={cn(
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
            : 'space-y-4'
        )}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface-elevated rounded-xl p-6 animate-pulse">
              {viewMode === 'grid' ? (
                <>
                  <div className="aspect-square bg-surface rounded-xl mb-4" />
                  <div className="h-4 bg-surface rounded mb-2" />
                  <div className="h-3 bg-surface rounded w-2/3" />
                </>
              ) : (
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-surface rounded-lg" />
                  <div className="flex-1">
                    <div className="h-4 bg-surface rounded mb-2" />
                    <div className="h-3 bg-surface rounded w-1/2" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="px-3 py-2 border border-border-subtle rounded-lg bg-surface-elevated text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="all">All Types</option>
        {documents.filter(d => d.client_id).length > 0 && (
          <span className="ml-2">
            • {documents.filter(d => d.client_id).length} associated with clients
          </span>
        )}
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* View Mode Toggle */}
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      {/* Document List/Grid */}
      <AnimatePresence mode="wait">
        {filteredDocuments.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-surface-elevated rounded-2xl border border-border-subtle p-12 text-center"
          >
            <FileText className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              {searchQuery || selectedType !== 'all' ? 'No matches found' : 'No documents yet'}
            </h3>
            <p className="text-text-tertiary">
              {searchQuery || selectedType !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Upload documents to get started'
              }
            </p>
          </motion.div>
        ) : viewMode === 'grid' ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredDocuments.map(document => (
              <DocumentCard
                key={document.id}
                document={document}
                onDownload={onDownload}
                onPreview={onPreview}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {filteredDocuments.map(document => (
              <DocumentListItem
                key={document.id}
                document={document}
                onDownload={onDownload}
                onPreview={onPreview}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results count */}
      {filteredDocuments.length > 0 && (
        <div className="text-center text-sm text-text-tertiary">
          Showing {filteredDocuments.length} of {documents.length} documents
        </div>
      )}
    </div>
  );
};
