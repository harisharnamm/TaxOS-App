import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '../components/organisms/TopBar';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../hooks/useAuth';
import { useClients } from '../hooks/useClients';
import { useBookkeepingTransactions } from '../hooks/useBookkeepingTransactions';
import { useDocumentTransactionMatching } from '../hooks/useDocumentTransactionMatching';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import { Input } from '../components/atoms/Input';
import { Tooltip } from '../components/ui/tooltip';
import {
  ArrowLeft,
  Search,
  Filter,
  Calendar,
  CheckCircle,
  X,
  AlertTriangle,
  RefreshCw,
  Eye,
  Link,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Users2,
  DollarSign,
  Clock,
  FileText,
  MessageSquare,
  Settings,
  Zap,
  Brain,
  Building2,
  Globe,
  ChevronDown
} from 'lucide-react';

interface ReconciliationMatch {
  id: string;
  transaction_id: string;
  ar_candidate_id: string;
  confidence: number;
  match_reason: string;
  transaction_amount: number;
  ar_amount: number;
  transaction_date: string;
  ar_due_date: string;
  payer_name: string;
  ar_description: string;
  status: 'proposed' | 'accepted' | 'rejected';
  created_at: string;
}

interface ARCandidate {
  id: string;
  client_id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  description: string;
  customer_name: string;
  status: 'open' | 'paid' | 'overdue';
  created_at: string;
}

interface DocumentTransactionMatch {
  id: string;
  document_id: string;
  transaction_id: string;
  match_confidence: number;
  match_reasoning: string;
  match_type: 'auto' | 'manual' | 'ai_suggested';
  status: 'proposed' | 'accepted' | 'rejected' | 'modified';
  user_id: string;
  client_id: string;
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  modified_fields?: any;
  documents?: {
    id: string;
    filename: string;
    document_type: string;
    financial_processing_response?: any;
  };
  transactions?: {
    id: string;
    amount: number;
    raw_description?: string;
    payee_final?: string;
    date_posted: string;
  };
}

interface UnmatchedDocument {
  id: string;
  document_id: string;
  client_id: string;
  user_id: string;
  document_type: string;
  expected_amount?: number;
  expected_date?: string;
  vendor_name?: string;
  invoice_number?: string;
  status: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
  documents?: {
    id: string;
    filename: string;
    document_type: string;
    financial_processing_response?: any;
    ai_analysis_response?: any;
  };
}

// Unified interfaces for the new system
interface UnifiedMatchItem {
  id: string;
  type: 'deposit_reconciliation' | 'document_transaction' | 'expense_matching';
  source_item: any; // Bank transaction
  target_item: any; // AR invoice, document, vendor bill, etc.
  confidence: number;
  match_reasoning: string;
  match_type: 'auto' | 'ai_suggested' | 'manual';
  status: 'proposed' | 'accepted' | 'rejected';
  created_at: string;
  updated_at?: string;
  accepted_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
}

interface UnifiedUnmatchedItem {
  id: string;
  type: 'ar_invoice' | 'document' | 'vendor_bill' | 'bank_transaction';
  item_data: any;
  expected_match_type: string;
  priority: 'high' | 'medium' | 'low';
  days_unmatched: number;
  potential_matches_count: number;
  created_at: string;
}

export function TransactionMatching() {
  const navigate = useNavigate();
  const { clientId } = useParams<{ clientId: string }>();
  const toast = useToast();
  const { user } = useAuth();
  const { clients } = useClients();

  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'unmatched' | 'ar-candidates' | 'money-flow'>('overview');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  const [selectedItem, setSelectedItem] = useState<UnifiedMatchItem | UnifiedUnmatchedItem | null>(null);

  // Client selection state
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clientId || null);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // Get selected client info
  const selectedClient = selectedClientId ? clients.find(c => c.id === selectedClientId) : null;

  // Handle client selection
  const handleClientSelect = (clientId: string | null) => {
    setSelectedClientId(clientId);
    setIsClientDropdownOpen(false);
    setSearchQuery(''); // Clear search when switching clients

    // Update URL to reflect the selected client
    if (clientId) {
      navigate(`/transaction-matching/${clientId}`, { replace: true });
    } else {
      navigate('/transaction-matching', { replace: true });
    }
  };

  // Click outside handler for client dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Unified data state
  const [unifiedMatches, setUnifiedMatches] = useState<UnifiedMatchItem[]>([]);
  const [unifiedUnmatchedItems, setUnifiedUnmatchedItems] = useState<UnifiedUnmatchedItem[]>([]);
  const [arCandidates, setArCandidates] = useState<ARCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Get transactions for the selected client
  const { transactions: bookkeepingTransactions, loading: transactionsLoading } = useBookkeepingTransactions(selectedClientId || undefined);

  // Document transaction matching
  const {
    matchingData: documentMatchingData,
    unmatchedDocuments,
    loading: documentMatchingLoading,
    generateMatches: generateDocumentMatches,
    acceptMatch: acceptDocumentMatch,
    rejectMatch: rejectDocumentMatch,
    hasMatches: hasDocumentMatches,
    hasUnmatchedDocuments,
    totalMatches: totalDocumentMatches,
    autoMatchRate: documentAutoMatchRate
  } = useDocumentTransactionMatching(selectedClientId || undefined);

  // Load reconciliation data
  useEffect(() => {
    if (selectedClientId) {
      loadReconciliationData();
    }
  }, [selectedClientId]);

  const loadReconciliationData = async () => {
    setLoading(true);
    try {
      // TODO: Replace with real API calls
      // For now, generate mock data based on transactions
      const mockMatches = generateMockMatches();
      const mockARCandidates = generateMockARCandidates();
      
      setUnifiedMatches(mockMatches);
      setUnifiedUnmatchedItems(generateMockUnmatchedItems());
      setArCandidates(mockARCandidates);
    } catch (error) {
      console.error('Error loading reconciliation data:', error);
      toast.error('Failed to load reconciliation data');
    } finally {
      setLoading(false);
    }
  };

  // Generate mock reconciliation matches
  const generateMockMatches = (): UnifiedMatchItem[] => {
    if (!bookkeepingTransactions.length) return [];
    
    const matches: UnifiedMatchItem[] = [];
    const deposits = bookkeepingTransactions.filter(tx => 
      tx.amount > 0 && tx.status === 'for_review'
    );
    
    deposits.forEach((tx, index) => {
      if (index < 5) { // Limit to 5 matches for demo
        matches.push({
          id: `match-${index}`,
          type: 'deposit_reconciliation',
          source_item: tx,
          target_item: {
            id: `ar-${index}`,
            client_id: selectedClientId || '',
            invoice_number: `INV-${1000 + index}`,
            amount: tx.amount + (Math.random() * 2 - 1), // Slight variation
            due_date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            description: `Professional services - Q${Math.floor(Math.random() * 4) + 1} 2025`,
            customer_name: ['Acme Corp', 'TechStart Inc', 'Global Solutions', 'Innovation Labs', 'Future Systems'][index],
            status: 'open',
            created_at: new Date().toISOString()
          },
          confidence: 0.85 + (index * 0.03), // Varying confidence
          match_reasoning: `Amount match: $${tx.amount.toFixed(2)}`,
          match_type: 'auto',
          status: 'proposed',
          created_at: new Date().toISOString()
        });
      }
    });
    
    return matches;
  };

  // Generate mock AR candidates
  const generateMockARCandidates = (): ARCandidate[] => {
    if (!bookkeepingTransactions.length) return [];
    
    const candidates: ARCandidate[] = [];
    const amounts = [1500, 2300, 1800, 950, 3200];
    
    amounts.forEach((amount, index) => {
      candidates.push({
        id: `ar-${index}`,
        client_id: clientId || '',
        invoice_number: `INV-${1000 + index}`,
        amount,
        due_date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        description: `Professional services - Q${Math.floor(Math.random() * 4) + 1} 2025`,
        customer_name: ['Acme Corp', 'TechStart Inc', 'Global Solutions', 'Innovation Labs', 'Future Systems'][index],
        status: 'open',
        created_at: new Date().toISOString()
      });
    });
    
    return candidates;
  };

  // Generate mock unmatched items
  const generateMockUnmatchedItems = (): UnifiedUnmatchedItem[] => {
    const unmatched: UnifiedUnmatchedItem[] = [];
    const arCandidatesCount = arCandidates.filter(ar => ar.status === 'open').length;
    const unmatchedDocumentsCount = unmatchedDocuments.length;

    if (arCandidatesCount > 0) {
      unmatched.push({
        id: `unmatched-ar-${arCandidatesCount}`,
        type: 'ar_invoice',
        item_data: {
          id: `unmatched-ar-${arCandidatesCount}`,
          client_id: clientId || '',
          user_id: user?.id || '',
          document_type: 'invoice',
          expected_amount: 1000 + Math.random() * 500,
          expected_date: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          vendor_name: 'Acme Corp',
          invoice_number: `INV-${1000 + arCandidatesCount}`,
          status: 'open',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        expected_match_type: 'document_transaction',
        priority: 'high',
        days_unmatched: 0,
        potential_matches_count: 0,
        created_at: new Date().toISOString()
      });
    }

    if (unmatchedDocumentsCount > 0) {
      unmatched.push({
        id: `unmatched-doc-${unmatchedDocumentsCount}`,
        type: 'document',
        item_data: {
          id: `unmatched-doc-${unmatchedDocumentsCount}`,
          document_id: `unmatched-doc-${unmatchedDocumentsCount}`,
          client_id: clientId || '',
          user_id: user?.id || '',
          document_type: 'invoice',
          expected_amount: 1500 + Math.random() * 1000,
          expected_date: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          vendor_name: 'TechStart Inc',
          invoice_number: `DOC-${1000 + unmatchedDocumentsCount}`,
          status: 'open',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        expected_match_type: 'document_transaction',
        priority: 'medium',
        days_unmatched: 0,
        potential_matches_count: 0,
        created_at: new Date().toISOString()
      });
    }

    return unmatched;
  };

  // Handle match acceptance
  const acceptMatch = async (matchId: string) => {
    try {
      // TODO: Replace with real API call
      setUnifiedMatches(prev => 
        prev.map(match => 
          match.id === matchId 
            ? { ...match, status: 'accepted' as const }
            : match
        )
      );
      
      toast.success('Match accepted successfully');
    } catch (error) {
      console.error('Error accepting match:', error);
      toast.error('Failed to accept match');
    }
  };

  // Handle match rejection
  const rejectMatch = async (matchId: string) => {
    try {
      // TODO: Replace with real API call
      setUnifiedMatches(prev => 
        prev.map(match => 
          match.id === matchId 
            ? { ...match, status: 'rejected' as const }
            : match
        )
      );
      
      toast.success('Match rejected');
    } catch (error) {
      console.error('Error rejecting match:', error);
      toast.error('Failed to reject match');
    }
  };

  // Bulk accept matches
  const acceptSelectedMatches = async () => {
    try {
      // TODO: Replace with real API call
      setUnifiedMatches(prev => 
        prev.map(match => 
          selectedItems.has(match.id) 
            ? { ...match, status: 'accepted' as const }
            : match
        )
      );
      
      setSelectedItems(new Set());
      toast.success(`${selectedItems.size} matches accepted successfully`);
    } catch (error) {
      console.error('Error accepting matches:', error);
      toast.error('Failed to accept matches');
    }
  };

  // Filter matches based on active tab
  const filteredMatches = unifiedMatches.filter(match => {
    if (activeTab === 'overview') return match.status === 'proposed';
    if (activeTab === 'unmatched') return match.status === 'rejected'; // Assuming rejected items are unmatched
    if (activeTab === 'ar-candidates') return match.type === 'deposit_reconciliation';
    if (activeTab === 'money-flow') return match.type === 'deposit_reconciliation';
    return true;
  });

  // Calculate reconciliation statistics
  const stats = {
    totalMatches: unifiedMatches.length,
    proposedMatches: unifiedMatches.filter(m => m.status === 'proposed').length,
    acceptedMatches: unifiedMatches.filter(m => m.status === 'accepted').length,
    rejectedMatches: unifiedMatches.filter(m => m.status === 'rejected').length,
    totalAmount: unifiedMatches
      .filter(m => m.status === 'accepted')
      .reduce((sum, m) => sum + m.source_item.amount, 0),
    autoMatchRate: unifiedMatches.length > 0 
      ? Math.round((unifiedMatches.filter(m => m.status === 'accepted').length / unifiedMatches.length) * 100)
      : 0
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated">
      <TopBar title={`Transaction Matching${selectedClient ? ` - ${selectedClient.name}` : ' - All Clients'}`} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-text-primary mb-2">Transaction Matching</h1>
            <p className="text-text-secondary text-lg">
              Match bank transactions with documents, invoices, and AR items using AI-powered reconciliation
            </p>
          </div>

          {/* Client Selector */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                  <Users2 className="w-4 h-4" />
                  Filter by Client:
                </div>
                <div className="relative" ref={clientDropdownRef}>
                  <button
                    onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                    className="flex items-center gap-2 px-4 py-2 bg-surface-elevated border border-border-subtle rounded-lg hover:bg-surface transition-colors min-w-[200px] justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {selectedClient ? (
                        <>
                          <Building2 className="w-4 h-4 text-primary" />
                          <span className="text-text-primary">{selectedClient.name}</span>
                        </>
                      ) : (
                        <>
                          <Globe className="w-4 h-4 text-text-tertiary" />
                          <span className="text-text-secondary">All Clients</span>
                        </>
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform ${isClientDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isClientDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-surface-elevated border border-border-subtle rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                      <button
                        onClick={() => handleClientSelect(null)}
                        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface transition-colors first:rounded-t-lg"
                      >
                        <Globe className="w-4 h-4 text-text-tertiary" />
                        <span className="text-text-secondary">All Clients</span>
                      </button>
                      {clients.map((client) => (
                        <button
                          key={client.id}
                          onClick={() => handleClientSelect(client.id)}
                          className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface transition-colors"
                        >
                          <Building2 className="w-4 h-4 text-primary" />
                          <span className="text-text-primary">{client.name}</span>
                        </button>
                      ))}
                      {clients.length === 0 && (
                        <div className="px-4 py-3 text-text-tertiary text-sm">
                          No clients available. Add clients first to filter transactions.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Transaction Count Summary */}
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <DollarSign className="w-4 h-4" />
                <span>
                  {loading ? 'Loading...' :
                   selectedClient ?
                     `${bookkeepingTransactions.length} transaction${bookkeepingTransactions.length !== 1 ? 's' : ''} for ${selectedClient.name}` :
                     `${bookkeepingTransactions.length} transaction${bookkeepingTransactions.length !== 1 ? 's' : ''} total`
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={loadReconciliationData}
                className="flex items-center gap-2 shadow-soft"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Data
              </Button>
              
              <Button
                variant="primary"
                onClick={() => {
                  // TODO: Implement unified matching generation
                  toast.success('Generating unified matches...');
                }}
                className="flex items-center gap-2 shadow-soft"
              >
                <Brain className="h-4 w-4" />
                Generate AI Matches
              </Button>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-surface-elevated rounded-2xl p-6 border border-border-subtle shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-secondary">Total Matches</p>
                  <p className="text-2xl font-bold text-text-primary">{stats.totalMatches}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Link className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>
            
            <div className="bg-surface-elevated rounded-2xl p-6 border border-border-subtle shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-secondary">Proposed Matches</p>
                  <p className="text-2xl font-bold text-text-primary">{stats.proposedMatches}</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </div>
            
            <div className="bg-surface-elevated rounded-2xl p-6 border border-border-subtle shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-secondary">Unmatched Items</p>
                  <p className="text-2xl font-bold text-text-primary">{arCandidates.filter(ar => ar.status === 'open').length + unmatchedDocuments.length}</p>
                </div>
                <div className="p-3 bg-orange-500/10 rounded-xl">
                  <FileText className="h-6 w-6 text-orange-500" />
                </div>
              </div>
            </div>
            
            <div className="bg-surface-elevated rounded-2xl p-6 border border-border-subtle shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-secondary">Auto-Match Rate</p>
                  <p className="text-2xl font-bold text-text-primary">{stats.autoMatchRate}%</p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </div>
          </div>

        {/* Tabs */}
        <div className="bg-surface-elevated rounded-2xl border border-border-subtle shadow-soft mb-6">
          <div className="grid grid-cols-4 border-b border-border-subtle">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-all duration-200 w-full ${
                activeTab === 'overview'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              Proposed Matches
              {stats.proposedMatches > 0 && (
                <Badge variant="neutral" className="ml-2">
                  {stats.proposedMatches}
                </Badge>
              )}
            </button>
            
            <button
              onClick={() => setActiveTab('unmatched')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-all duration-200 w-full ${
                activeTab === 'unmatched'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              Unmatched Items
              <Badge variant="neutral" className="ml-2">
                {arCandidates.filter(ar => ar.status === 'open').length + unmatchedDocuments.length}
              </Badge>
            </button>
            
            <button
              onClick={() => setActiveTab('ar-candidates')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-all duration-200 w-full ${
                activeTab === 'ar-candidates'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              AR Candidates
              <Badge variant="neutral" className="ml-2">
                {arCandidates.filter(ar => ar.status === 'open').length}
              </Badge>
            </button>
            
            <button
              onClick={() => setActiveTab('money-flow')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-all duration-200 w-full ${
                activeTab === 'money-flow'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              Money Flow
              <Badge variant="neutral" className="ml-2">
                {bookkeepingTransactions.length}
              </Badge>
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-text-primary">
                    Proposed Matches ({stats.proposedMatches})
                  </h3>
                  
                  {selectedItems.size > 0 && (
                                          <Button
                        onClick={acceptSelectedMatches}
                        variant="primary"
                        size="sm"
                        className="flex items-center gap-2 shadow-soft"
                      >
                      <CheckCircle className="h-4 w-4" />
                      Accept Selected ({selectedItems.size})
                    </Button>
                  )}
                </div>

                {filteredMatches.length === 0 ? (
                                   <div className="text-center py-16">
                   <div className="p-4 bg-surface-hover rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                     <Link className="h-8 w-8 text-text-tertiary" />
                   </div>
                   <h3 className="text-lg font-medium text-text-primary mb-2">No Proposed Matches</h3>
                   <p className="text-text-secondary max-w-md mx-auto">
                     All deposits have been matched or there are no new deposits to reconcile.
                   </p>
                 </div>
                ) : (
                  <div className="space-y-4">
                    {filteredMatches.map((match) => (
                                             <div
                         key={match.id}
                         className="bg-surface-elevated border border-border-subtle rounded-2xl p-6 hover:shadow-medium transition-all duration-200 hover:border-border"
                       >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                                                          <input
                                type="checkbox"
                                checked={selectedItems.has(match.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedItems(prev => new Set([...prev, match.id]));
                                  } else {
                                    setSelectedItems(prev => {
                                      const newSet = new Set(prev);
                                      newSet.delete(match.id);
                                      return newSet;
                                    });
                                  }
                                }}
                                className="rounded border-border-subtle text-primary focus:ring-primary/20 focus:ring-2 transition-colors duration-200"
                              />
                            
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <p className="text-sm text-text-secondary">Transaction</p>
                                <p className="font-semibold text-text-primary">
                                  ${match.source_item.amount.toFixed(2)}
                                </p>
                                <p className="text-xs text-text-secondary">{match.source_item.date_posted}</p>
                              </div>
                              
                              <div className="text-center">
                                <div className="w-8 h-0.5 bg-border-subtle mx-auto mb-2"></div>
                                <div className="w-8 h-0.5 bg-border-subtle mx-auto mb-2"></div>
                                <div className="w-8 h-0.5 bg-border-subtle mx-auto mb-2"></div>
                              </div>
                              
                              <div className="text-center">
                                <p className="text-sm text-text-secondary">AR Item</p>
                                <p className="font-semibold text-text-primary">
                                  ${match.target_item.amount.toFixed(2)}
                                </p>
                                <p className="text-xs text-text-secondary">{match.target_item.due_date}</p>
                              </div>
                            </div>
                            
                            <div className="ml-6">
                              <p className="font-medium text-text-primary">{match.source_item.normalized_merchant || match.source_item.raw_description?.split(' ')[0] || 'Unknown'}</p>
                              <p className="text-sm text-text-secondary">{match.target_item.description}</p>
                              <p className="text-xs text-text-secondary">{match.match_reasoning}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <Badge 
                                variant={match.confidence >= 0.9 ? 'success' : match.confidence >= 0.7 ? 'neutral' : 'error'}
                                className="mb-2"
                              >
                                {Math.round(match.confidence * 100)}% confident
                              </Badge>
                              <p className="text-xs text-text-secondary">
                                AI Suggested Match
                              </p>
                            </div>
                            
                                                         <div className="flex gap-2">
                               <Button
                                 onClick={() => acceptMatch(match.id)}
                                 variant="primary"
                                 size="sm"
                                 className="flex items-center gap-1 shadow-soft"
                               >
                                 <CheckCircle className="h-3 w-3" />
                                 Accept
                               </Button>
                               
                               <Button
                                 onClick={() => rejectMatch(match.id)}
                                 variant="ghost"
                                 size="sm"
                                 className="flex items-center gap-1 shadow-soft"
                               >
                                 <X className="h-3 w-3" />
                                 Reject
                               </Button>
                               
                               <Button
                                 onClick={() => {
                                   setSelectedItem(match);
                                   setShowMatchDetails(true);
                                 }}
                                 variant="secondary"
                                 size="sm"
                                 className="flex items-center gap-1"
                               >
                                 <Eye className="h-3 w-3" />
                                 Details
                               </Button>
                             </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'unmatched' && (
              <div>
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  Unmatched Items ({arCandidates.filter(ar => ar.status === 'open').length + unmatchedDocuments.length})
                </h3>
                
                {arCandidates.filter(ar => ar.status === 'open').length === 0 && unmatchedDocuments.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="p-4 bg-surface-hover rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <FileText className="h-8 w-8 text-text-tertiary" />
                    </div>
                    <h3 className="text-lg font-medium text-text-primary mb-2">No Unmatched Items</h3>
                    <p className="text-text-secondary max-w-md mx-auto">
                      All accounts receivable items and documents have been matched.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Unmatched AR Items */}
                    {arCandidates.filter(ar => ar.status === 'open').length > 0 && (
                      <div>
                        <h4 className="text-md font-medium text-text-primary mb-3">Unmatched AR Items</h4>
                        <div className="space-y-4">
                          {arCandidates
                            .filter(ar => ar.status === 'open')
                            .map((ar) => (
                              <div
                                key={ar.id}
                                className="bg-surface-elevated border border-border-subtle rounded-2xl p-6 hover:shadow-medium transition-all duration-200 hover:border-border"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    <div className="text-center">
                                      <p className="text-sm text-text-secondary">Amount</p>
                                      <p className="font-semibold text-text-primary">
                                        ${ar.amount.toFixed(2)}
                                      </p>
                                    </div>
                                    
                                    <div className="ml-6">
                                      <p className="font-medium text-text-primary">{ar.customer_name}</p>
                                      <p className="text-sm text-text-secondary">{ar.description}</p>
                                      <p className="text-xs text-text-secondary">Invoice: {ar.invoice_number}</p>
                                      <p className="text-xs text-text-secondary">Due: {ar.due_date}</p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex gap-2">
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="flex items-center gap-1"
                                    >
                                      <MessageSquare className="h-3 w-3" />
                                      Contact Client
                                    </Button>
                                    
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="flex items-center gap-1"
                                      onClick={() => {
                                        setSelectedItem({
                                          id: ar.id,
                                          type: 'ar_invoice',
                                          item_data: ar,
                                          expected_match_type: 'deposit_reconciliation',
                                          priority: 'medium',
                                          days_unmatched: Math.floor((Date.now() - new Date(ar.created_at).getTime()) / (1000 * 60 * 60 * 24)),
                                          potential_matches_count: 0,
                                          created_at: ar.created_at
                                        });
                                        setShowMatchDetails(true);
                                      }}
                                    >
                                      <Eye className="h-3 w-3" />
                                      View Details
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Unmatched Documents */}
                    {hasUnmatchedDocuments && (
                      <div>
                        <h4 className="text-md font-medium text-text-primary mb-3">Unmatched Documents</h4>
                        <div className="space-y-4">
                          {unmatchedDocuments.map((doc) => (
                            <div
                              key={doc.id}
                              className="bg-surface-elevated border border-border-subtle rounded-2xl p-6 hover:shadow-medium transition-all duration-200 hover:border-border"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className="text-center">
                                    <p className="text-sm text-text-secondary">Document</p>
                                    <p className="font-semibold text-text-primary">
                                      {doc.documents?.filename || 'Unknown'}
                                    </p>
                                    <p className="text-xs text-text-secondary">
                                      {doc.documents?.document_type || 'Unknown'}
                                    </p>
                                  </div>
                                  
                                  <div className="ml-6">
                                    <p className="font-medium text-text-primary">
                                      {doc.vendor_name || 'Unknown Vendor'}
                                    </p>
                                    <p className="text-sm text-text-secondary">
                                      Expected: ${doc.expected_amount?.toFixed(2) || '0.00'}
                                    </p>
                                    <p className="text-xs text-text-secondary">
                                      Date: {doc.expected_date || 'Unknown'}
                                    </p>
                                    <Badge variant="error" className="mt-1">
                                      No Transaction Found
                                    </Badge>
                                  </div>
                                </div>
                                
                                <div className="flex gap-2">
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="flex items-center gap-1"
                                  >
                                    <MessageSquare className="h-3 w-3" />
                                    Flag for Review
                                  </Button>
                                  
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="flex items-center gap-1"
                                    onClick={() => {
                                      setSelectedItem({
                                        id: doc.id,
                                        type: 'document',
                                        item_data: doc,
                                        expected_match_type: 'deposit_reconciliation',
                                        priority: 'medium',
                                        days_unmatched: Math.floor((Date.now() - new Date(doc.created_at).getTime()) / (1000 * 60 * 60 * 24)),
                                        potential_matches_count: 0,
                                        created_at: doc.created_at
                                      });
                                      setShowMatchDetails(true);
                                    }}
                                  >
                                    <Eye className="h-3 w-3" />
                                    View Details
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ar-candidates' && (
              <div>
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  AR Candidates ({arCandidates.filter(ar => ar.status === 'open').length})
                </h3>
                
                {arCandidates.filter(ar => ar.status === 'open').length === 0 ? (
                  <div className="text-center py-16">
                    <div className="p-4 bg-surface-hover rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <Users2 className="h-8 w-8 text-text-tertiary" />
                    </div>
                    <h3 className="text-lg font-medium text-text-primary mb-2">No AR Candidates</h3>
                    <p className="text-text-secondary max-w-md mx-auto">
                      No new accounts receivable items to reconcile.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {arCandidates
                      .filter(ar => ar.status === 'open')
                      .map((ar) => (
                        <div
                          key={ar.id}
                          className="bg-surface-elevated border border-border-subtle rounded-2xl p-6 hover:shadow-medium transition-all duration-200 hover:border-border"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <p className="text-sm text-text-secondary">Amount</p>
                                <p className="font-semibold text-text-primary">
                                  ${ar.amount.toFixed(2)}
                                </p>
                              </div>
                              
                              <div className="ml-6">
                                <p className="font-medium text-text-primary">{ar.customer_name}</p>
                                <p className="text-sm text-text-secondary">{ar.description}</p>
                                <p className="text-xs text-text-secondary">Invoice: {ar.invoice_number}</p>
                                <p className="text-xs text-text-secondary">Due: {ar.due_date}</p>
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="flex items-center gap-1"
                              >
                                <MessageSquare className="h-3 w-3" />
                                Contact Client
                              </Button>
                              
                              <Button
                                variant="secondary"
                                size="sm"
                                className="flex items-center gap-1"
                                onClick={() => {
                                  setSelectedItem({
                                    id: ar.id,
                                    type: 'ar_invoice',
                                    item_data: ar,
                                    expected_match_type: 'deposit_reconciliation',
                                    priority: 'medium',
                                    days_unmatched: Math.floor((Date.now() - new Date(ar.created_at).getTime()) / (1000 * 60 * 60 * 24)),
                                    potential_matches_count: 0,
                                    created_at: ar.created_at
                                  });
                                  setShowMatchDetails(true);
                                }}
                              >
                                <Eye className="h-3 w-3" />
                                View Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'money-flow' && (
              <div>
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  Money Flow ({bookkeepingTransactions.length})
                </h3>
                
                {bookkeepingTransactions.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="p-4 bg-surface-hover rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <DollarSign className="h-8 w-8 text-text-tertiary" />
                    </div>
                    <h3 className="text-lg font-medium text-text-primary mb-2">No Money Flow Data</h3>
                    <p className="text-text-secondary max-w-md mx-auto mb-6">
                      {selectedClient
                        ? `No bank transactions found for ${selectedClient.name}.`
                        : 'No bank transactions found. Select a client to view transaction data.'
                      }
                    </p>
                    {selectedClient && (
                      <Button
                        onClick={() => handleClientSelect(null)}
                        variant="outline"
                        className="flex items-center gap-2 mx-auto"
                      >
                        <Globe className="w-4 h-4" />
                        View All Clients
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bookkeepingTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="bg-surface-elevated border border-border-subtle rounded-2xl p-6 hover:shadow-medium transition-all duration-200 hover:border-border"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <p className="text-sm text-text-secondary">Transaction</p>
                              <p className="font-semibold text-text-primary">
                                ${tx.amount.toFixed(2)}
                              </p>
                              <p className="text-xs text-text-secondary">{tx.date_posted}</p>
                            </div>
                            
                            <div className="ml-6">
                              <p className="font-medium text-text-primary">{tx.normalized_merchant || tx.raw_description?.split(' ')[0] || 'Unknown'}</p>
                              <p className="text-sm text-text-secondary">{tx.raw_description}</p>
                              <p className="text-xs text-text-secondary">Status: {tx.status}</p>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="flex items-center gap-1"
                            >
                              <MessageSquare className="h-3 w-3" />
                              Flag for Review
                            </Button>
                            
                            <Button
                              variant="secondary"
                              size="sm"
                              className="flex items-center gap-1"
                              onClick={() => {
                                setSelectedItem({
                                  id: tx.id,
                                  type: 'bank_transaction',
                                  item_data: tx,
                                  expected_match_type: 'document_transaction',
                                  priority: 'medium',
                                  days_unmatched: Math.floor((Date.now() - new Date(tx.date_posted).getTime()) / (1000 * 60 * 60 * 24)),
                                  potential_matches_count: 0,
                                  created_at: tx.date_posted
                                });
                                setShowMatchDetails(true);
                              }}
                            >
                              <Eye className="h-3 w-3" />
                              View Transaction
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Match Details Modal */}
      {showMatchDetails && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-elevated rounded-2xl p-8 max-w-4xl w-full border border-border-subtle shadow-soft max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-text-primary">
                {selectedItem.type === 'deposit_reconciliation' ? 'Transaction Match Details' : 
                 selectedItem.type === 'ar_invoice' ? 'AR Invoice Details' : 
                 selectedItem.type === 'document' ? 'Document Details' : 
                 selectedItem.type === 'vendor_bill' ? 'Vendor Bill Details' : 'Item Details'}
              </h3>
              <Button
                onClick={() => setShowMatchDetails(false)}
                variant="ghost"
                size="sm"
                className="p-2 hover:bg-surface-hover"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {selectedItem.type === 'deposit_reconciliation' ? (
              // Transaction Match Details
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-surface-hover rounded-xl p-6 border border-border-subtle">
                    <h4 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      Bank Transaction
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Amount:</span>
                        <span className="font-semibold text-text-primary">${selectedItem.source_item.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Date:</span>
                        <span className="text-text-primary">{selectedItem.source_item.date_posted}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Payee:</span>
                        <span className="text-text-primary">{selectedItem.source_item.normalized_merchant || selectedItem.source_item.raw_description?.split(' ')[0] || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Description:</span>
                        <span className="text-text-primary">{selectedItem.source_item.raw_description}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Status:</span>
                        <Badge variant="neutral" className="text-xs">
                          {selectedItem.source_item.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-surface-hover rounded-xl p-6 border border-border-subtle">
                    <h4 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      AR Invoice
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Invoice #:</span>
                        <span className="font-semibold text-text-primary">{selectedItem.target_item.invoice_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Amount:</span>
                        <span className="font-semibold text-text-primary">${selectedItem.target_item.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Due Date:</span>
                        <span className="text-text-primary">{selectedItem.target_item.due_date}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="relative bg-surface-elevated rounded-xl p-6 border border-border-subtle overflow-hidden">
                    {/* Subtle gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 via-blue-50/70 to-indigo-50/60 pointer-events-none" />
                    
                    <div className="relative">
                      <h4 className="font-semibold text-text-primary mb-4">AI Match Analysis</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-text-primary">{Math.round(selectedItem.confidence * 100)}%</div>
                          <div className="text-sm text-text-secondary">Confidence</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-text-primary">{selectedItem.match_type}</div>
                          <div className="text-sm text-text-secondary">Match Type</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-text-primary">{selectedItem.status}</div>
                          <div className="text-sm text-text-secondary">Status</div>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-surface rounded-lg border border-border-subtle">
                        <p className="text-sm text-text-secondary"><strong>AI Reasoning:</strong> {selectedItem.match_reasoning}</p>
                      </div>
                    </div>
                  </div>
                
                <div className="flex gap-3 pt-4 border-t border-border-subtle">
                  <Button
                    onClick={() => {
                      acceptMatch(selectedItem.id);
                      setShowMatchDetails(false);
                    }}
                    variant="primary"
                    className="flex-1 shadow-soft"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Accept Match
                  </Button>
                  
                  <Button
                    onClick={() => {
                      rejectMatch(selectedItem.id);
                      setShowMatchDetails(false);
                    }}
                    variant="ghost"
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject Match
                  </Button>
                </div>
              </div>
            ) : selectedItem.type === 'ar_invoice' && 'item_data' in selectedItem ? (
              // AR Invoice Details
              <div className="space-y-6">
                <div className="bg-surface-hover rounded-xl p-6 border border-border-subtle">
                  <h4 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    AR Invoice Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Invoice #:</span>
                        <span className="font-semibold text-text-primary">{selectedItem.item_data.invoice_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Amount:</span>
                        <span className="font-semibold text-text-primary">${selectedItem.item_data.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Due Date:</span>
                        <span className="text-text-primary">{selectedItem.item_data.due_date}</span>
                      </div>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Customer:</span>
                        <span className="text-text-primary">{selectedItem.item_data.customer_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Description:</span>
                        <span className="text-text-primary">{selectedItem.item_data.description}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Status:</span>
                        <Badge variant="neutral" className="text-xs">
                          {selectedItem.item_data.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="relative bg-surface-elevated rounded-xl p-6 border border-border-subtle overflow-hidden">
                    {/* Subtle gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-50/80 to-red-50/70 pointer-events-none" />
                    
                    <div className="relative">
                      <h4 className="font-semibold text-text-primary mb-4">Unmatched Item Analysis</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-lg font-semibold text-text-primary">{selectedItem.priority}</div>
                          <div className="text-sm text-text-secondary">Priority</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-text-primary">{selectedItem.days_unmatched}</div>
                          <div className="text-sm text-text-secondary">Days Unmatched</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-text-primary">{selectedItem.potential_matches_count}</div>
                          <div className="text-sm text-text-secondary">Potential Matches</div>
                        </div>
                      </div>
                    </div>
                  </div>
                
                <div className="flex gap-3 pt-4 border-t border-border-subtle">
                  <Button
                    onClick={() => {
                      toast.success('AR Invoice flagged for review');
                      setShowMatchDetails(false);
                    }}
                    variant="primary"
                    className="flex-1 shadow-soft"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Flag for Review
                  </Button>
                  
                  <Button
                    onClick={() => {
                      toast.success('Contacting client...');
                      setShowMatchDetails(false);
                    }}
                    variant="ghost"
                    className="flex-1"
                  >
                    <Users2 className="h-4 w-4 mr-2" />
                    Contact Client
                  </Button>
                </div>
              </div>
            ) : selectedItem.type === 'document' && 'item_data' in selectedItem ? (
              // Document Details
              <div className="space-y-6">
                <div className="bg-surface-hover rounded-xl p-6 border border-border-subtle">
                  <h4 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    Document Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Filename:</span>
                        <span className="font-semibold text-text-primary">{selectedItem.item_data.filename || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Type:</span>
                        <span className="text-text-primary">{selectedItem.item_data.document_type || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Vendor:</span>
                        <span className="text-text-primary">{selectedItem.item_data.vendor_name || 'Unknown'}</span>
                      </div>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Expected Amount:</span>
                        <span className="font-semibold text-text-primary">${selectedItem.item_data.expected_amount?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Expected Date:</span>
                        <span className="text-text-primary">{selectedItem.item_data.expected_date || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Status:</span>
                        <Badge variant="neutral" className="text-xs">
                          {selectedItem.item_data.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="relative bg-surface-elevated rounded-xl p-6 border border-border-subtle overflow-hidden">
                    {/* Subtle gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-50/80 to-blue-50/70 pointer-events-none" />
                    
                    <div className="relative">
                      <h4 className="font-semibold text-text-primary mb-4">Document Analysis</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-lg font-semibold text-text-primary">{selectedItem.priority}</div>
                          <div className="text-sm text-text-secondary">Priority</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-text-primary">{selectedItem.days_unmatched}</div>
                          <div className="text-sm text-text-secondary">Days Unmatched</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-text-primary">{selectedItem.potential_matches_count}</div>
                          <div className="text-sm text-text-secondary">Potential Matches</div>
                        </div>
                      </div>
                    </div>
                  </div>
                
                <div className="flex gap-3 pt-4 border-t border-border-subtle">
                  <Button
                    onClick={() => {
                      toast.success('Document flagged for review');
                      setShowMatchDetails(false);
                    }}
                    variant="primary"
                    className="flex-1 shadow-soft"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Flag for Review
                  </Button>
                  
                  <Button
                    onClick={() => {
                      toast.success('Opening document...');
                      setShowMatchDetails(false);
                    }}
                    variant="ghost"
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Document
                  </Button>
                </div>
              </div>
            ) : selectedItem.type === 'bank_transaction' && 'item_data' in selectedItem ? (
              // Bank Transaction Details
              <div className="space-y-6">
                <div className="bg-surface-hover rounded-xl p-6 border border-border-subtle">
                  <h4 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    Bank Transaction Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Amount:</span>
                        <span className="font-semibold text-text-primary">${selectedItem.item_data.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Date:</span>
                        <span className="text-text-primary">{selectedItem.item_data.date_posted}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Status:</span>
                        <Badge variant="neutral" className="text-xs">
                          {selectedItem.item_data.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Payee:</span>
                        <span className="text-text-primary">{selectedItem.item_data.normalized_merchant || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Description:</span>
                        <span className="text-text-primary">{selectedItem.item_data.raw_description}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Category:</span>
                        <span className="text-text-primary">{selectedItem.item_data.category_final || 'Uncategorized'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="relative bg-surface-elevated rounded-xl p-6 border border-border-subtle overflow-hidden">
                  <div className="relative">
                    <h4 className="font-semibold text-text-primary mb-4">Transaction Analysis</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-text-primary">{selectedItem.priority}</div>
                        <div className="text-sm text-text-secondary">Priority</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-text-primary">{selectedItem.days_unmatched}</div>
                        <div className="text-sm text-text-secondary">Days Since Posted</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-text-primary">{selectedItem.potential_matches_count}</div>
                        <div className="text-sm text-text-secondary">Potential Matches</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4 border-t border-border-subtle">
                  <Button
                    onClick={() => {
                      toast.success('Transaction flagged for review');
                      setShowMatchDetails(false);
                    }}
                    variant="primary"
                    className="flex-1 shadow-soft"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Flag for Review
                  </Button>
                  
                  <Button
                    onClick={() => {
                      toast.success('Searching for matches...');
                      setShowMatchDetails(false);
                    }}
                    variant="ghost"
                    className="flex-1"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Find Matches
                  </Button>
                </div>
              </div>
            ) : (
              // Generic Item Details
              <div className="space-y-6">
                <div className="bg-surface-hover rounded-xl p-6 border border-border-subtle">
                  <h4 className="font-semibold text-text-primary mb-4">Item Details</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Type:</span>
                      <span className="text-text-primary">{selectedItem.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Created:</span>
                      <span className="text-text-primary">{new Date(selectedItem.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
