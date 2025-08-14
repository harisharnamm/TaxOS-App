import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useClients } from '../hooks/useClients';
import { useDocuments } from '../hooks/useDocuments';
import { Document } from '../types/documents';
import { useClientNotes } from '../hooks/useClientNotes';
import { useTransactions, Transaction } from '../hooks/useTransactions';
import { TopBar } from '../components/organisms/TopBar';
import { GlobalSearch } from '../components/molecules/GlobalSearch';
import { useSearch } from '../contexts/SearchContext';
import { DocumentList } from '../components/ui/document-list';
import { AestheticUpload } from '../components/ui/aesthetic-upload';
import { AddNoteDialog } from '../components/ui/add-note-dialog';
import { EditNoteDialog } from '../components/ui/edit-note-dialog';
import { EditClientDialog } from '../components/ui/edit-client-dialog';
import { EnhancedDocumentPreview } from '../components/ui/enhanced-document-preview';
import { AddTransactionDialog } from '../components/ui/add-transaction-dialog';
import { EmptyState } from '../components/ui/empty-state';
import { useToast } from '../contexts/ToastContext';
import { Skeleton, SkeletonText } from '../components/ui/skeleton';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import { Input } from '../components/atoms/Input';
import { OpenBankingSection } from '../components/ui/open-banking-section';
import { generateTransactionId } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft, 
  Edit, 
  FileText, 
  Plus, 
  Upload, 
  MessageSquare, 
  DollarSign,
  Calendar,
  User,
  Mail,
  Phone,
  Building,
  Tag,
  Trash2,
  Eye,
  Download,
  CheckCircle2,
  Clock,
  TrendingUp,
  Link2,
  AlertCircle,
  Search,
  Filter,
  X,
  ChevronDown,
  Zap
} from 'lucide-react';

// Legacy transaction interface for backward compatibility
interface LegacyTransaction {
  id: string;
  amount: number;
  date: string;
  description: string;
  merchant_name: string;
  source_document_type: string;
  status: 'confirmed' | 'high_confidence' | 'pending' | 'reconciled' | 'needs_review';
  confidence?: number;
  reconciled_with?: string;
  created_at: string;
  updated_at: string;
}

// Simplified interface for transaction processing
interface ProcessedTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  source: string;
}

// String similarity calculation
const calculateSimilarity = (str1: string, str2: string): number => {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  // Simple string similarity algorithm
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

// Levenshtein distance calculation
const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

// Simplified transaction processing for real database transactions
const processTransactions = (transactions: Transaction[]) => {
  return transactions.map(transaction => ({
    ...transaction,
    displayAmount: transaction.amount ? `$${transaction.amount.toFixed(2)}` : 'N/A',
    displayDate: transaction.transaction_date ? new Date(transaction.transaction_date).toLocaleDateString() : 'N/A',
    displayDescription: transaction.description || 'No description',
    displayCounterparty: transaction.counterparty || 'Unknown'
  }));
};

// Simple transaction display component
const TransactionRow: React.FC<{ transaction: Transaction }> = ({ transaction }) => {
  return (
    <div className="flex items-center space-x-4 p-4 border-b border-border-subtle last:border-b-0">
      <div className="flex-1">
        <div className="font-medium text-text-primary">
          {transaction.description || 'No description'}
        </div>
        <div className="text-sm text-text-tertiary">
          {transaction.counterparty || 'Unknown'} • {transaction.transaction_date ? new Date(transaction.transaction_date).toLocaleDateString() : 'No date'}
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold text-text-primary">
          {transaction.amount ? `$${transaction.amount.toFixed(2)}` : 'N/A'}
        </div>
        <div className="text-xs text-text-tertiary">
          {transaction.document_source.replace('_', ' ')}
        </div>
      </div>
    </div>
  );
};

// Simple transaction summary component
const TransactionSummary: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const uniqueSources = [...new Set(transactions.map(t => t.document_source))];
  
  return (
    <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 shadow-soft">
      <h4 className="font-semibold text-text-primary mb-4">Transaction Summary</h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-text-tertiary">Total Transactions</p>
          <p className="text-2xl font-semibold text-text-primary">{transactions.length}</p>
        </div>
        <div>
          <p className="text-sm text-text-tertiary">Total Amount</p>
          <p className="text-2xl font-semibold text-text-primary">${totalAmount.toFixed(2)}</p>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-sm text-text-tertiary">Sources: {uniqueSources.join(', ')}</p>
      </div>
    </div>
  );
};

// Transaction Filters Component
const TransactionFilters: React.FC<{
  filters: any;
  onFiltersChange: (filters: any) => void;
}> = ({ filters, onFiltersChange }) => {
  const filterOptions = {
    status: [
      { value: 'all', label: 'All Statuses' },
      { value: 'confirmed', label: 'Confirmed (Bank)' },
      { value: 'high_confidence', label: 'High Confidence' },
      { value: 'pending', label: 'Pending' },
      { value: 'reconciled', label: 'Reconciled' },
      { value: 'needs_review', label: 'Needs Review' }
    ],
    documentType: [
      { value: 'all', label: 'All Documents' },
      { value: 'bank_statement', label: 'Bank Statements' },
      { value: 'receipt', label: 'Receipts' },
      { value: 'invoice', label: 'Invoices' }
    ],
    confidence: [
      { value: 'all', label: 'All Confidence Levels' },
      { value: 'high', label: 'High (85%+)' },
      { value: 'medium', label: 'Medium (70-84%)' },
      { value: 'low', label: 'Low (<70%)' }
    ]
  };
  
  return (
    <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 shadow-soft mb-6">
      <h4 className="font-medium text-text-primary mb-4">Filter Transactions</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search Input */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <Input
              placeholder="Description, merchant, amount..."
              value={filters.search || ''}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>
        
        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Status
          </label>
          <select
            value={filters.status || 'all'}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
            className="w-full px-3 py-2 border border-border-subtle rounded-xl bg-surface-elevated text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {filterOptions.status.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        
        {/* Document Type Filter */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Document Type
          </label>
          <select
            value={filters.documentType || 'all'}
            onChange={(e) => onFiltersChange({ ...filters, documentType: e.target.value })}
            className="w-full px-3 py-2 border border-border-subtle rounded-xl bg-surface-elevated text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {filterOptions.documentType.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        
        {/* Confidence Filter */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Confidence Level
          </label>
          <select
            value={filters.confidence || 'all'}
            onChange={(e) => onFiltersChange({ ...filters, confidence: e.target.value })}
            className="w-full px-3 py-2 border border-border-subtle rounded-xl bg-surface-elevated text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {filterOptions.confidence.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Date Range Filter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            From Date
          </label>
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
            className="w-full px-3 py-2 border border-border-subtle rounded-xl bg-surface-elevated text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            To Date
          </label>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
            className="w-full px-3 py-2 border border-border-subtle rounded-xl bg-surface-elevated text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>
      
      {/* Clear Filters Button */}
      <div className="mt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFiltersChange({})}
          className="text-primary hover:text-primary-hover"
        >
          Clear All Filters
        </Button>
      </div>
    </div>
  );
};

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clients, loading: clientsLoading, updateClient, refreshClients } = useClients();
  const { documents, loading: documentsLoading, refreshDocuments, getDocumentPreviewURL, downloadDocument, deleteDocument } = useDocuments(id);
  const { notes, loading: notesLoading, createNote, updateNote, deleteNote } = useClientNotes(id || '');
  const { transactions, loading: transactionsLoading, refreshTransactions, createTransaction } = useTransactions(id);
  const { isSearchOpen, closeSearch } = useSearch();
  const toast = useToast();

  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddNote, setShowAddNote] = useState(false);
  const [showEditNote, setShowEditNote] = useState(false);
  const [showEditClient, setShowEditClient] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<any>({});
  const [previewDocument, setPreviewDocument] = useState<any | null>(null);
  const [expandedDocumentId, setExpandedDocumentId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: { progress: number; status: string; error?: string } }>({});
  const [isUploadMinimized, setIsUploadMinimized] = useState(false);
  const [activeUploads, setActiveUploads] = useState<string[]>([]);

  const client = clients.find(c => c.id === id);



  // Simple transaction creation helper
  const createLocalTransaction = (data: any): ProcessedTransaction => {
    return {
      id: generateTransactionId(),
      description: data.description || 'New Transaction',
      amount: data.amount || 0,
      date: data.date || new Date().toISOString().split('T')[0],
      source: data.source || 'manual'
    };
  };

  // Transaction handling using the hook
  const handleAddTransaction = async (transactionData: any) => {
    try {
      const result = await createTransaction(transactionData);
      if (result.success) {
        toast.success('Transaction Added', 'Transaction has been added successfully');
      } else {
        toast.error('Failed to add transaction', result.error);
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      toast.error('Failed to add transaction', 'An unexpected error occurred');
    }
  };

  // Filter transactions
  const getFilteredTransactions = () => {
    return transactions.filter(transaction => {
      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const matchesSearch = 
          (transaction.description?.toLowerCase().includes(searchTerm) || false) ||
          (transaction.counterparty?.toLowerCase().includes(searchTerm) || false) ||
          (transaction.amount?.toString().includes(searchTerm) || false);
        if (!matchesSearch) return false;
      }
      
      // Document type filter
      if (filters.documentType && filters.documentType !== 'all') {
        if (transaction.document_source !== filters.documentType) return false;
      }
      
      // Date range filter
      if (filters.dateFrom && transaction.transaction_date) {
        if (new Date(transaction.transaction_date) < new Date(filters.dateFrom)) return false;
      }
      if (filters.dateTo && transaction.transaction_date) {
        if (new Date(transaction.transaction_date) > new Date(filters.dateTo)) return false;
      }
      
      return true;
    });
  };

  // Event handlers
  const handleUploadComplete = (documentIds: string[]) => {
    toast.success('Processing Complete', `${documentIds.length} document(s) processed successfully`);
    refreshDocuments();
    // Don't close the modal here - let the AestheticUpload component handle it
  };

  const handleUploadError = (error: string) => {
    toast.error('Upload Failed', error);
  };

  const handleCreateNote = async (noteData: any) => {
    const result = await createNote(noteData);
    if (result.success) {
      toast.success('Note Created', 'Note has been added successfully');
    } else {
      toast.error('Failed to create note', result.error);
      throw new Error(result.error);
    }
  };

  const handleUpdateNote = async (noteData: any) => {
    if (!selectedNote) return;
    
    const result = await updateNote(selectedNote.id, noteData);
    if (result.success) {
      toast.success('Note Updated', 'Note has been updated successfully');
    } else {
      toast.error('Failed to update note', result.error);
      throw new Error(result.error);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      const result = await deleteNote(noteId);
      if (result.success) {
        toast.success('Note Deleted', 'Note has been deleted successfully');
      } else {
        toast.error('Failed to delete note', result.error);
      }
    }
  };

  const handleUpdateClient = async (clientData: any) => {
    if (!client) return;
    
    try {
      await updateClient(client.id, {
        name: clientData.name,
        email: clientData.email,
        phone: clientData.phone,
        address: clientData.address,
        tax_year: clientData.taxYear,
        entity_type: clientData.entityType as any
      });
      toast.success('Client Updated', 'Client information has been updated successfully');
    } catch (error: any) {
      toast.error('Update Failed', error.message);
      throw error;
    }
  };

  // Function to trigger financial processing for a document
  const handleProcessFinancialDocument = async (documentId: string) => {
    try {
      toast.info('Processing document...');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session');
      }

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-financial`;
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
        throw new Error(`Processing failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Financial processing result:', result);
      
      toast.success('Document processed successfully!');
      refreshTransactions();
      refreshDocuments();
    } catch (error: any) {
      console.error('Processing error:', error);
      toast.error(`Processing failed: ${error.message}`);
    }
  };

  const handlePreviewDocument = async (documentId: string) => {
    try {
      const result = await getDocumentPreviewURL(documentId);
      if (result.url) {
        const doc = documents.find(d => d.id === documentId);
        setSelectedDocument(doc);
        setPreviewUrl(result.url);
        setShowPreview(true);
      } else {
        toast.error('Preview Failed', result.error || 'Failed to generate preview URL');
      }
    } catch (error: any) {
      toast.error('Preview Failed', error.message);
    }
  };

  const handleDownloadDocument = async (documentId: string, filename: string) => {
    try {
      const result = await downloadDocument(documentId, filename);
      if (!result.success) {
        toast.error('Download Failed', result.error || 'Failed to download document');
      }
    } catch (error: any) {
      toast.error('Download Failed', error.message);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    const document = documents.find(d => d.id === documentId);
    if (!document) return;
    
    if (window.confirm(`Are you sure you want to delete "${document.original_filename}"? This action cannot be undone.`)) {
      try {
        const result = await deleteDocument(documentId);
        if (result.success) {
          toast.success('Document Deleted', 'Document has been deleted successfully');
        } else {
          toast.error('Delete Failed', result.error || 'Failed to delete document');
        }
      } catch (error) {
        console.error('Delete error:', error);
        toast.error('Delete Failed', 'An unexpected error occurred');
      }
    }
  };

  const handleViewDocument = async (document: Document) => {
    // Use the existing preview functionality for viewing
    await handlePreviewDocument(document.id);
  };



  if (clientsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated">
        <TopBar title="Loading..." />
        <div className="max-w-content mx-auto px-8 py-8">
          <Skeleton className="h-32 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-64" />
              <Skeleton className="h-96" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-48" />
              <Skeleton className="h-264" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated">
        <TopBar title="Client Not Found" />
        <div className="max-w-content mx-auto px-8 py-8">
          <EmptyState
            icon={User}
            title="Client Not Found"
            description="The client you're looking for doesn't exist or you don't have permission to view it."
            action={{
              label: "Back to Clients",
              onClick: () => navigate('/clients'),
              icon: ArrowLeft
            }}
          />
        </div>
      </div>
    );
  }

  const filteredTransactions = getFilteredTransactions();

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated">
      <TopBar 
        title={client.name}
        breadcrumbItems={[
          { label: 'Clients', href: '/clients' },
          { label: client.name }
        ]}
        action={{
          label: 'Edit Client',
          onClick: () => setShowEditClient(true),
          icon: Edit
        }}
      />

      {/* Global Search */}
      <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />
      
      <div className="max-w-content mx-auto px-8 py-8">
        {/* Client Header */}
        <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-8 shadow-soft mb-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-6">
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center shadow-soft">
                <span className="text-xl font-bold text-gray-900">
                  {client.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text-primary mb-2">{client.name}</h1>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-text-tertiary" />
                    <span className="text-text-secondary">{client.email}</span>
                  </div>
                  {client.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-text-tertiary" />
                      <span className="text-text-secondary">{client.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-text-tertiary" />
                    <span className="text-text-secondary">Tax Year {client.tax_year}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Building className="w-4 h-4 text-text-tertiary" />
                    <span className="text-text-secondary capitalize">{client.entity_type.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Badge variant="success">Active</Badge>
              <Button
                variant="secondary"
                icon={Edit}
                onClick={() => setShowEditClient(true)}
              >
                Edit Client
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-surface-elevated rounded-2xl border border-border-subtle mb-8 shadow-soft">
          <div className="flex p-2">
            {[
              { id: 'overview', label: 'Overview', icon: User },
              { id: 'documents', label: 'Documents', icon: FileText },
              { id: 'transactions', label: 'Transactions', icon: DollarSign },
              { id: 'notes', label: 'Notes', icon: MessageSquare }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex-1 ${
                  activeTab === tab.id
                    ? 'bg-primary text-gray-900 shadow-soft'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 shadow-soft">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-tertiary">Documents</p>
                      <p className="text-2xl font-semibold text-text-primary">{documents.length}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 shadow-soft">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-br from-green-100 to-green-50 rounded-xl">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-tertiary">Transactions</p>
                      <p className="text-2xl font-semibold text-text-primary">{transactions.length}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 shadow-soft">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-br from-purple-100 to-purple-50 rounded-xl">
                      <MessageSquare className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-tertiary">Notes</p>
                      <p className="text-2xl font-semibold text-text-primary">{notes.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction Summary */}
              <TransactionSummary transactions={transactions} />

              {/* Recent Activity */}
              <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 shadow-soft">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Recent Activity</h3>
                <div className="space-y-4">
                  {documents.slice(0, 3).map(doc => (
                    <div key={doc.id} className="flex items-center space-x-3 p-3 bg-surface rounded-xl">
                      <FileText className="w-5 h-5 text-text-tertiary" />
                      <div className="flex-1">
                        <p className="font-medium text-text-primary">{doc.original_filename}</p>
                        <p className="text-sm text-text-tertiary">
                          Uploaded {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Open Banking Section */}
              <OpenBankingSection 
                clientId={client.id}
                clientEmail={client.email}
                clientName={client.name}
              />

              {/* Quick Actions */}
              <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 shadow-soft">
                <h3 className="font-semibold text-text-primary mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Button 
                    className="w-full justify-start bg-primary text-gray-900 hover:bg-primary-hover" 
                    icon={Upload}
                    onClick={() => setShowUpload(true)}
                  >
                    Upload Documents
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="w-full justify-start" 
                    icon={Plus}
                    onClick={() => setShowAddTransaction(true)}
                  >
                    Add Transaction
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="w-full justify-start" 
                    icon={MessageSquare}
                    onClick={() => setShowAddNote(true)}
                  >
                    Add Note
                  </Button>
                </div>
              </div>

              {/* Client Info */}
              <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 shadow-soft">
                <h3 className="font-semibold text-text-primary mb-4">Client Information</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-text-tertiary">Entity Type:</span>
                    <span className="ml-2 font-medium text-text-primary capitalize">
                      {client.entity_type.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">Tax Year:</span>
                    <span className="ml-2 font-medium text-text-primary">{client.tax_year}</span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">Status:</span>
                    <span className="ml-2">
                      <Badge variant="success" size="sm">{client.status}</Badge>
                    </span>
                  </div>
                  {client.address && (
                    <div>
                      <span className="text-text-tertiary">Address:</span>
                      <p className="mt-1 text-text-primary">{client.address}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-text-primary">Documents</h2>
              <div className="flex space-x-3">
                {/* Process button for Sarah Johnson's invoice */}
                {client?.name === 'Sarah Johnson' && (
                  <Button
                    onClick={() => handleProcessFinancialDocument('f1f72536-5318-41c0-8920-b607ab7cb25b')}
                    variant="secondary"
                    className="flex items-center space-x-2"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Process Invoice</span>
                  </Button>
                )}
                <Button 
                  icon={Upload}
                  onClick={() => setShowUpload(true)}
                  className="bg-primary text-gray-900 hover:bg-primary-hover"
                >
                  Upload Documents
                </Button>
              </div>
            </div>

            {/* Aesthetic Upload Modal */}
            <AnimatePresence>
              {showUpload && (
                <AestheticUpload
                  clientId={id!}
                  onUploadComplete={handleUploadComplete}
                  onUploadError={handleUploadError}
                  onClose={() => setShowUpload(false)}
                  isMinimized={isUploadMinimized}
                  onToggleMinimize={() => setIsUploadMinimized(!isUploadMinimized)}
                />
              )}
            </AnimatePresence>

            <DocumentList
              documents={documents}
              loading={documentsLoading}
              onPreview={handlePreviewDocument}
              onDownload={handleDownloadDocument}
              onDelete={handleDeleteDocument}
              onEdit={handleViewDocument}
            />
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-text-primary">Transactions</h2>
              <div className="flex space-x-3">
                <Button 
                  icon={Plus}
                  onClick={() => setShowAddTransaction(true)}
                  className="bg-primary text-gray-900 hover:bg-primary-hover"
                >
                  Add Transaction
                </Button>
              </div>
            </div>

            {/* Collapsible Filters */}
            <div className="bg-surface-elevated rounded-xl border border-border-subtle shadow-soft overflow-hidden">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="w-full flex items-center justify-between p-4 hover:bg-surface-hover transition-colors duration-200"
              >
                <div className="flex items-center space-x-3">
                  <Filter className="w-5 h-5 text-text-tertiary" />
                  <span className="font-medium text-text-primary">Filter Transactions</span>
                  {Object.keys(filters).length > 0 && (
                    <Badge variant="warning" size="sm">
                      {Object.keys(filters).length} active
                    </Badge>
                  )}
                </div>
                <ChevronDown className={`w-5 h-5 text-text-tertiary transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
              </button>
              
              {showFilters && (
                <div className="border-t border-border-subtle p-4">
                  <TransactionFilters 
                    filters={filters} 
                    onFiltersChange={setFilters} 
                  />
                </div>
              )}
            </div>



            {/* Transactions List */}
            {filteredTransactions.length > 0 ? (
              <div className="bg-surface-elevated rounded-2xl border border-border-subtle shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface border-b border-border-subtle">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                          Counterparty
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                          Source
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                          Type
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {filteredTransactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-surface-hover transition-colors duration-200">
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium text-text-primary">
                                {transaction.description || 'No description'}
                              </div>
                              {transaction.reference_number && (
                                <div className="text-sm text-text-tertiary">Ref: {transaction.reference_number}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-text-secondary">
                            {transaction.counterparty || 'Unknown'}
                          </td>
                          <td className="px-6 py-4 font-semibold text-text-primary">
                            {transaction.amount ? `$${transaction.amount.toFixed(2)}` : 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-text-secondary">
                            {transaction.transaction_date ? new Date(transaction.transaction_date).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="neutral" size="sm">
                              {transaction.document_source.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="neutral" size="sm">
                              {transaction.transaction_type || 'Unknown'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={DollarSign}
                title={Object.keys(filters).length > 0 ? "No transactions match your filters" : "No transactions yet"}
                description={Object.keys(filters).length > 0 
                  ? "Try adjusting your search or filters to find what you're looking for"
                  : "Upload financial documents or add transactions manually to get started"
                }
                action={Object.keys(filters).length === 0 ? {
                  label: "Add First Transaction",
                  onClick: () => setShowAddTransaction(true),
                  icon: Plus
                } : undefined}
              />
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-text-primary">Notes</h2>
              <Button 
                icon={Plus}
                onClick={() => setShowAddNote(true)}
                className="bg-primary text-gray-900 hover:bg-primary-hover"
              >
                Add Note
              </Button>
            </div>

            {notesLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-surface-elevated rounded-xl p-6 border border-border-subtle">
                    <Skeleton className="h-6 w-1/3 mb-3" />
                    <SkeletonText lines={3} />
                  </div>
                ))}
              </div>
            ) : notes.length > 0 ? (
              <div className="space-y-4">
                {notes.map(note => (
                  <div key={note.id} className="bg-surface-elevated rounded-xl border border-border-subtle p-6 shadow-soft">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-text-primary">{note.title}</h3>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant={note.priority === 'high' ? 'error' : note.priority === 'medium' ? 'warning' : 'neutral'} 
                          size="sm"
                        >
                          {note.priority} priority
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Edit}
                          onClick={() => {
                            setSelectedNote(note);
                            setShowEditNote(true);
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-red-600 hover:text-red-700"
                        />
                      </div>
                    </div>
                    
                    <p className="text-text-secondary mb-3 whitespace-pre-line">{note.content}</p>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-4">
                        <Badge variant="neutral" size="sm">
                          {note.category.replace('_', ' ')}
                        </Badge>
                        {note.tags.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <Tag className="w-3 h-3 text-text-tertiary" />
                            <span className="text-text-tertiary">{note.tags.join(', ')}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-text-tertiary">
                        {new Date(note.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={MessageSquare}
                title="No notes yet"
                description="Add notes to keep track of important information about this client"
                action={{
                  label: "Add First Note",
                  onClick: () => setShowAddNote(true),
                  icon: Plus
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddNoteDialog
        isOpen={showAddNote}
        onClose={() => setShowAddNote(false)}
        onSubmit={handleCreateNote}
      />

      <EditNoteDialog
        isOpen={showEditNote}
        onClose={() => {
          setShowEditNote(false);
          setSelectedNote(null);
        }}
        onSubmit={handleUpdateNote}
        note={selectedNote}
      />

      <EditClientDialog
        isOpen={showEditClient}
        onClose={() => setShowEditClient(false)}
        onSubmit={handleUpdateClient}
        client={client}
      />

      <AddTransactionDialog
        isOpen={showAddTransaction}
        onClose={() => setShowAddTransaction(false)}
        onSubmit={handleAddTransaction}
      />

      {/* Document Preview */}
      {showPreview && selectedDocument && previewUrl && (
        <EnhancedDocumentPreview
          document={selectedDocument}
          previewUrl={previewUrl}
          isOpen={showPreview}
          onClose={() => {
            setShowPreview(false);
            setSelectedDocument(null);
            setPreviewUrl(null);
          }}
          onDownload={() => handleDownloadDocument(selectedDocument.id, selectedDocument.original_filename)}
        />
      )}
    </div>
  );
}