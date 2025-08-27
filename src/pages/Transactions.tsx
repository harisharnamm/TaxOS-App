import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/organisms/TopBar';
import { GlobalSearch } from '../components/molecules/GlobalSearch';
import { useSearch } from '../contexts/SearchContext';
import { useToast } from '../contexts/ToastContext';
import { useClients } from '../hooks/useClients';
import { useBookkeepingTransactions } from '../hooks/useBookkeepingTransactions';
import { useFinicityEnhancement } from '../hooks/useFinicityEnhancement';
import { useTransactionLearning } from '../hooks/useTransactionLearning';
import { useRealtimeTransactions } from '../hooks/useRealtimeTransactions';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import { Input } from '../components/atoms/Input';
import { Tooltip } from '../components/ui/tooltip';
import { 
  Search, 
  Filter, 
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Paperclip,
  Split,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Zap,
  Eye,
  Download,
  Upload,
  Settings,
  Banknote,
  CreditCard,
  Wallet,
  X,
  Brain,
  FileText,
  Plus,
  Link,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Users2
} from 'lucide-react';



export function Transactions() {
  const navigate = useNavigate();
  const { isSearchOpen, closeSearch } = useSearch();
  const toast = useToast();
  const { clients, loading: clientsLoading } = useClients();
  const { user } = useAuth();
  
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [showTransactionManagement, setShowTransactionManagement] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showTransactionDrawer, setShowTransactionDrawer] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'for_review' | 'categorized' | 'all'>('for_review');

  // Get transactions for selected client
  const { transactions: bookkeepingTransactions, loading: transactionsLoading, updateTransaction, bulkUpdateTransactions, refreshTransactions } = useBookkeepingTransactions(selectedClientId || undefined);
  
  // Finicity enhancement functionality
  const { enhanceTransaction, enhanceTransactions, isLoading: enhancementLoading, error: enhancementError, clearError } = useFinicityEnhancement();
  
  // Transaction learning system
  const { 
    acceptSuggestion, 
    rejectSuggestion, 
    modifySuggestion, 
    getLearningAnalytics,
    isLoading: learningLoading,
    error: learningError,
    clearError: clearLearningError
  } = useTransactionLearning();
  
  // State for enhancement
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [showEnhancementResults, setShowEnhancementResults] = useState(false);
  const [enhancementResults, setEnhancementResults] = useState<any>(null);
  
  // State for learning system
  const [learningAnalytics, setLearningAnalytics] = useState<any>(null);
  const [showLearningAnalytics, setShowLearningAnalytics] = useState(false);
  const [processedTransactions, setProcessedTransactions] = useState<Set<string>>(new Set());

  // 🚀 Real-time transaction updates
  const [showRealtimeStatus, setShowRealtimeStatus] = useState(false);
  
  // Initialize real-time hook
  const { 
    isConnected: isRealtimeConnected, 
    eventCount: realtimeEventCount,
    refreshNow: refreshRealtime
  } = useRealtimeTransactions(
    selectedClientId || undefined,
    (event) => {
      console.log('📡 Real-time transaction update received:', event);
      
      // Handle different event types
      switch (event.event_type) {
        case 'transaction_created':
          toast.success(`🆕 New transaction received: ${event.payload.data.raw_description}`);
          // Refresh transactions to show new data
          refreshTransactions();
          break;
          
        case 'transaction_enhanced':
          toast.success(`🤖 Transaction enhanced: ${event.payload.data.raw_description}`);
          // Refresh transactions to show enhanced data
          refreshTransactions();
          break;
          
        case 'transaction_updated':
          toast.success(`🔄 Transaction updated: ${event.payload.data.raw_description}`);
          // Refresh transactions to show updated data
          refreshTransactions();
          break;
          
        default:
          console.log('Unknown real-time event type:', event.event_type);
      }
    }
  );

  // Filter transactions based on active tab
  const filteredTransactions = bookkeepingTransactions.filter(tx => {
    if (activeTab === 'for_review') return tx.status === 'for_review';
    if (activeTab === 'categorized') return tx.status === 'categorized' || tx.status === 'posted';
    return true; // 'all' tab
  });

  // Load learning analytics when component mounts
  useEffect(() => {
    if (user && showLearningAnalytics) {
      getLearningAnalytics().then(setLearningAnalytics);
    }
  }, [user, showLearningAnalytics, getLearningAnalytics]);

  // Handle AI suggestion feedback
  const handleAcceptSuggestion = async (transactionId: string, suggestion: any) => {
    console.log('Accepting suggestion for transaction:', transactionId);
    console.log('Suggestion data:', suggestion);
    
    const feedbackData = {
      category: suggestion.category_suggested || suggestion.category_final,
      payee: suggestion.normalized_merchant || suggestion.payee_final,
      confidence: suggestion.confidence || suggestion.category_confidence || 0.8
    };
    
    console.log('Feedback data being sent:', feedbackData);
    
    const success = await acceptSuggestion(transactionId, feedbackData);
    
    if (success) {
      // Mark transaction as processed (hide feedback buttons)
      setProcessedTransactions(prev => new Set(prev).add(transactionId));
      
      // Show success message with learning confirmation
      toast.success('✅ AI suggestion accepted and learned! The system will remember this pattern.');
      
      // Refresh learning analytics to show updated patterns
      if (user) {
        getLearningAnalytics().then(setLearningAnalytics);
      }
      
      // Refresh transactions to show updated data
      refreshTransactions();
    } else {
      toast.error('Failed to accept suggestion');
    }
  };

  const handleRejectSuggestion = async (transactionId: string, suggestion: any) => {
    console.log('Rejecting suggestion for transaction:', transactionId);
    console.log('Suggestion data:', suggestion);
    
    const feedbackData = {
      category: suggestion.category_suggested || suggestion.category_final,
      payee: suggestion.normalized_merchant || suggestion.payee_final,
      confidence: suggestion.confidence || suggestion.category_confidence || 0.8
    };
    
    console.log('Feedback data being sent:', feedbackData);
    
    const success = await rejectSuggestion(transactionId, feedbackData);
    
    if (success) {
      // Mark transaction as processed (hide feedback buttons)
      setProcessedTransactions(prev => new Set(prev).add(transactionId));
      
      // Show success message with learning confirmation
      toast.success('❌ AI suggestion rejected and learned! The system will improve its suggestions.');
      
      // Refresh learning analytics to show updated patterns
      if (user) {
        getLearningAnalytics().then(setLearningAnalytics);
      }
      
      // Refresh transactions to show updated data
      refreshTransactions();
    } else {
      toast.error('Failed to reject suggestion');
    }
  };

  // Sample transaction data for Harisharnam (fallback)
  const sampleTransactions = [
    {
      id: 'tx_001',
      date: '2025-01-15',
      description: 'AMZN Mktp US*1234567890',
      merchant: 'Amazon Marketplace',
      amount: -125.50,
      category: 'office_supplies',
      categoryFinal: 'Office Supplies',
      payee: 'Amazon',
      status: 'categorized',
      confidence: 0.95,
      account: 'Chase Checking',
      notes: 'Office supplies for team'
    },
    {
      id: 'tx_002',
      date: '2025-01-14',
      description: 'NETFLIX.COM',
      merchant: 'Netflix',
      amount: -29.99,
      category: 'software_subscriptions',
      categoryFinal: 'Software',
      payee: 'Netflix',
      status: 'categorized',
      confidence: 0.98,
      account: 'Chase Checking',
      notes: 'Monthly streaming subscription'
    },
    {
      id: 'tx_003',
      date: '2025-01-12',
      description: 'UBER *TRIP',
      merchant: 'Uber',
      amount: -45.20,
      category: 'travel_entertainment',
      categoryFinal: 'Travel & Entertainment',
      payee: 'Uber',
      status: 'for_review',
      confidence: 0.85,
      account: 'Chase Checking',
      notes: 'Business trip transportation'
    },
    {
      id: 'tx_004',
      date: '2025-01-11',
      description: 'STARBUCKS',
      merchant: 'Starbucks',
      amount: -67.80,
      category: 'travel_entertainment',
      categoryFinal: 'Travel & Entertainment',
      payee: 'Starbucks',
      status: 'for_review',
      confidence: 0.90,
      account: 'Chase Checking',
      notes: 'Client meeting coffee'
    },
    {
      id: 'tx_005',
      date: '2025-01-10',
      description: 'LAW OFFICE OF SMITH & ASSOC',
      merchant: 'Law Office of Smith & Associates',
      amount: -500.00,
      category: 'professional_services',
      categoryFinal: 'Professional Services',
      payee: 'Law Office of Smith & Associates',
      status: 'categorized',
      confidence: 0.92,
      account: 'Chase Checking',
      notes: 'Legal consultation services'
    },
    {
      id: 'tx_006',
      date: '2025-01-09',
      description: 'PG&E ELECTRIC',
      merchant: 'PG&E',
      amount: -89.45,
      category: 'utilities',
      categoryFinal: 'Utilities',
      payee: 'PG&E',
      status: 'categorized',
      confidence: 0.96,
      account: 'Chase Checking',
      notes: 'Monthly electricity bill'
    },
    {
      id: 'tx_007',
      date: '2025-01-08',
      description: 'CLIENT PAYMENT - ABC CORP',
      merchant: 'ABC Corporation',
      amount: 2500.00,
      category: 'revenue',
      categoryFinal: 'Revenue',
      payee: 'ABC Corporation',
      status: 'categorized',
      confidence: 0.99,
      account: 'Chase Checking',
      notes: 'Q1 consulting services payment'
    },
    {
      id: 'tx_008',
      date: '2025-01-07',
      description: 'CLIENT PAYMENT - XYZ LLC',
      merchant: 'XYZ LLC',
      amount: 1800.00,
      category: 'revenue',
      categoryFinal: 'Revenue',
      payee: 'XYZ LLC',
      status: 'categorized',
      confidence: 0.99,
      account: 'Chase Checking',
      notes: 'Project completion payment'
    }
  ];

  // Get transaction counts for tabs
  const transactionCounts = {
    for_review: bookkeepingTransactions.filter(t => t.status === 'for_review').length,
    categorized: bookkeepingTransactions.filter(t => t.status === 'categorized' || t.status === 'posted').length,
    all: bookkeepingTransactions.length
  };

  // Filter clients based on search
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Enhancement functions
  const handleEnhanceTransaction = async (transactionId: string) => {
    const result = await enhanceTransaction(transactionId);
    if (result) {
      setEnhancementResults(result);
      setShowEnhancementResults(true);
      // Refresh transactions to show updated data
      refreshTransactions();
    }
  };

  const handleEnhanceSelected = async () => {
    if (selectedTransactionIds.size === 0) return;
    
    const result = await enhanceTransactions(Array.from(selectedTransactionIds));
    if (result) {
      setEnhancementResults(result);
      setShowEnhancementResults(true);
      setSelectedTransactionIds(new Set());
      // Refresh transactions to show updated data
      refreshTransactions();
    }
  };

  const handleSelectTransaction = (transactionId: string, checked: boolean) => {
    const newSelected = new Set(selectedTransactionIds);
    if (checked) {
      newSelected.add(transactionId);
    } else {
      newSelected.delete(transactionId);
    }
    setSelectedTransactionIds(newSelected);
  };

  const handleSelectAllTransactions = () => {
    if (selectedTransactionIds.size === filteredTransactions.length) {
      setSelectedTransactionIds(new Set());
    } else {
      setSelectedTransactionIds(new Set(filteredTransactions.map(tx => tx.id)));
    }
  };



  // Handle client card click
  const handleClientCardClick = (clientId: string) => {
    setSelectedClientId(clientId);
    setShowTransactionManagement(true);
  };

  // Handle bank integration request
  const handleBankIntegrationRequest = (clientId: string) => {
    navigate(`/clients/${clientId}`);
    toast.info('Bank Integration', 'Navigate to client page to set up bank integration');
  };

  // Handle viewing transaction details
  const handleViewTransaction = (transaction: any) => {
    setSelectedTransaction(transaction);
    setShowTransactionDrawer(true);
  };

  // Handle closing transaction drawer
  const handleCloseTransactionDrawer = () => {
    setShowTransactionDrawer(false);
    setSelectedTransaction(null);
  };

  // Keyboard navigation for drawer
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showTransactionDrawer) {
        handleCloseTransactionDrawer();
      }
    };

    if (showTransactionDrawer) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [showTransactionDrawer]);

  // Loading state
  if (clientsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated">
        <TopBar title="Client Financial Overview" />
        <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />
        <div className="max-w-content mx-auto px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 shadow-soft animate-pulse">
                <div className="h-4 bg-surface-hover rounded mb-4"></div>
                <div className="h-8 bg-surface-hover rounded mb-4"></div>
                <div className="h-4 bg-surface-hover rounded mb-4"></div>
                <div className="h-4 bg-surface-hover rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // If showing transaction management, render the transaction interface
  if (showTransactionManagement && selectedClientId) {
    const selectedClient = clients.find(c => c.id === selectedClientId);
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated">
        <TopBar title={`Transaction Management - ${selectedClient?.name || 'Client'}`} />
        <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />
        
        <div className="max-w-content mx-auto px-8 py-8">
          {/* Header with back button */}
          <div className="mb-8">
            <div className="flex items-center space-x-4 mb-4">
              <Button 
                variant="secondary" 
                onClick={() => setShowTransactionManagement(false)}
                className="flex items-center space-x-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Client Overview
              </Button>
            </div>
            <h1 className="text-2xl font-bold text-text-primary">Transaction Management</h1>
            <p className="text-text-secondary mt-1">Review, categorize, and manage financial transactions for {selectedClient?.name}</p>
            
            {/* Navigation to Transaction Matching */}
            <div className="flex items-center gap-4 mt-4">
              <Button
                variant="secondary"
                onClick={() => navigate(`/transaction-matching/${selectedClientId}`)}
                className="flex items-center gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                <Link className="h-4 w-4" />
                Go to Transaction Matching
              </Button>
              
              <div className="text-sm text-text-secondary">
                Automatically match deposits with AR items
              </div>
            </div>
            
            {/* 🚀 Real-time Status Indicator */}
            <div className="flex items-center gap-2 mt-3">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                isRealtimeConnected 
                  ? 'bg-green-100 text-green-700 border border-green-200' 
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isRealtimeConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`} />
                <span>{isRealtimeConnected ? 'Live Updates' : 'Offline'}</span>
                {isRealtimeConnected && realtimeEventCount > 0 && (
                  <Badge variant="success" className="ml-1">
                    {realtimeEventCount} updates
                  </Badge>
                )}
              </div>
              
              {isRealtimeConnected && (
                <Button
                  onClick={refreshRealtime}
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-700"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh Now
                </Button>
              )}
            </div>
          </div>

          {/* Enrichment Overview Card */}
          {bookkeepingTransactions.some(tx => tx.enrichment_source === 'mastercard_data_enrichment') && (
            <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <Zap className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-blue-900">AI Enhancement Overview</h2>
                    <p className="text-blue-700">
                      {bookkeepingTransactions.filter(tx => tx.enrichment_source === 'mastercard_data_enrichment').length} of {bookkeepingTransactions.length} transactions enhanced
                    </p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-900">
                      {Math.round((bookkeepingTransactions.filter(tx => tx.enrichment_source === 'mastercard_data_enrichment').length / bookkeepingTransactions.length) * 100)}%
                    </div>
                    <div className="text-sm text-blue-700">Enhancement Coverage</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-900">
                      {bookkeepingTransactions.filter(tx => tx.category_suggested).length}
                    </div>
                    <div className="text-sm text-blue-700">Categories Suggested</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-900">
                      {bookkeepingTransactions.filter(tx => tx.normalized_merchant && tx.normalized_merchant !== tx.raw_description).length}
                    </div>
                    <div className="text-sm text-blue-700">Merchants Normalized</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Learning Analytics Card */}
          <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-xl">
                  <Brain className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-green-900">AI Learning Progress</h2>
                  <p className="text-green-700">
                    Track how our AI improves based on your feedback
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-900">
                    {learningAnalytics?.totalPatterns || 0}
                  </div>
                  <div className="text-sm text-green-700">Learning Patterns</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-900">
                    {learningAnalytics?.highConfidencePatterns || 0}
                  </div>
                  <div className="text-sm text-green-700">High Confidence</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-900">
                    {Math.round((learningAnalytics?.averageSuccessRate || 0) * 100)}%
                  </div>
                  <div className="text-sm text-green-700">Success Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-900">
                    {learningAnalytics?.recentImprovements || 0}
                  </div>
                  <div className="text-sm text-green-700">Recent Improvements</div>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowLearningAnalytics(!showLearningAnalytics)}
                disabled={learningLoading}
              >
                <Brain className="h-4 w-4 mr-2" />
                {learningLoading ? 'Loading...' : (showLearningAnalytics ? 'Hide Details' : 'Show Details')}
              </Button>
            </div>
          </div>

          {/* Transaction Management Interface */}
          <div className="space-y-6">
            {/* Filters and Controls */}
            <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 shadow-soft">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  {/* Account Selector */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-text-secondary">Account:</span>
                    <select className="bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary">
                      <option value="all">All Accounts</option>
                      <option value="1066252378">Chase Checking</option>
                      <option value="1066252377">Savings</option>
                      <option value="1066252376">Personal Investments</option>
                    </select>
                  </div>

                  {/* Date Range */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-text-secondary">Date:</span>
                    <select className="bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary">
                      <option value="all">All Time</option>
                      <option value="this_month">This Month</option>
                      <option value="last_month">Last Month</option>
                      <option value="this_quarter">This Quarter</option>
                    </select>
                  </div>
                </div>

                {/* Bulk Actions */}
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={handleEnhanceSelected}
                    disabled={selectedTransactionIds.size === 0 || enhancementLoading}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {enhancementLoading ? 'Enhancing...' : `Enhance (${selectedTransactionIds.size})`}
                  </Button>
                  {bookkeepingTransactions.some(tx => !tx.enrichment_source) && (
                    <Button 
                      variant="primary" 
                      size="sm"
                      onClick={() => {
                        const unenhancedIds = bookkeepingTransactions
                          .filter(tx => !tx.enrichment_source)
                          .map(tx => tx.id);
                        if (unenhancedIds.length > 0) {
                          enhanceTransactions(unenhancedIds);
                        }
                      }}
                      disabled={enhancementLoading}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      {enhancementLoading ? 'Enhancing...' : `Enhance All (${bookkeepingTransactions.filter(tx => !tx.enrichment_source).length})`}
                    </Button>
                  )}
                  <Button variant="secondary" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex space-x-1 bg-surface rounded-lg p-1">
                <button 
                  onClick={() => setActiveTab('for_review')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                    activeTab === 'for_review' 
                      ? 'bg-primary text-gray-900' 
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  For Review ({transactionCounts.for_review})
                </button>
                <button 
                  onClick={() => setActiveTab('categorized')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                    activeTab === 'categorized' 
                      ? 'bg-primary text-gray-900' 
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  Categorized ({transactionCounts.categorized})
                </button>
                <button 
                  onClick={() => setActiveTab('all')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                    activeTab === 'all' 
                      ? 'bg-primary text-gray-900' 
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  All ({transactionCounts.all})
                </button>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-surface-elevated rounded-2xl border border-border-subtle shadow-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-hover border-b border-border-subtle">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        <input 
                          type="checkbox" 
                          className="rounded border-border-subtle"
                          checked={selectedTransactionIds.size === filteredTransactions.length && filteredTransactions.length > 0}
                          onChange={handleSelectAllTransactions}
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Payee
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Confidence
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-surface-elevated divide-y divide-border-subtle">
                    {filteredTransactions.map((transaction) => (
                      <tr 
                        key={transaction.id}
                        className={`hover:bg-surface-hover cursor-pointer transition-colors duration-200 ${
                          transaction.enrichment_source === 'mastercard_data_enrichment' 
                            ? 'bg-gradient-to-r from-blue-50/30 to-indigo-50/30 border-l-4 border-l-blue-300' 
                            : ''
                        }`}
                        onClick={() => handleViewTransaction(transaction)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input 
                            type="checkbox" 
                            className="rounded border-border-subtle"
                            checked={selectedTransactionIds.has(transaction.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleSelectTransaction(transaction.id, e.target.checked);
                            }}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                          {transaction.date_posted}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            {/* Original Description */}
                            <span className="text-sm text-text-primary">{transaction.raw_description}</span>
                            
                            {/* Enhanced Data Display */}
                            {transaction.enrichment_source === 'mastercard_data_enrichment' && (
                              <div className="space-y-1">
                                {/* AI Suggested Category */}
                                {transaction.category_suggested && (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="success" className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                                      🎯 {transaction.category_suggested}
                                    </Badge>
                                    {transaction.category_confidence && (
                                      <span className="text-xs text-blue-600">
                                        {Math.round(transaction.category_confidence * 100)}% confident
                                      </span>
                                    )}
                                  </div>
                                )}
                                
                                {/* Enhanced Merchant */}
                                {transaction.normalized_merchant && transaction.normalized_merchant !== transaction.raw_description && (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="neutral" className="text-xs bg-green-100 text-green-800 border-green-200">
                                      🏢 {transaction.normalized_merchant}
                                    </Badge>
                                  </div>
                                )}
                                
                                {/* Location if available */}
                                {(transaction.merchant_city || transaction.merchant_state) && (
                                  <div className="flex items-center gap-1 text-xs text-gray-600">
                                    📍 {[transaction.merchant_city, transaction.merchant_state].filter(Boolean).join(', ')}
                                  </div>
                                )}
                                
                                                            {/* Enhancement Badge with Tooltip */}
                            <Tooltip 
                              content={
                                <div className="p-3 space-y-2">
                                  <div className="font-semibold text-white">AI Enhancement Details</div>
                                  <div className="space-y-1 text-sm">
                                    {transaction.category_suggested && (
                                      <div>🎯 Category: {transaction.category_suggested}</div>
                                    )}
                                    {transaction.category_group && (
                                      <div>📊 Group: {transaction.category_group}</div>
                                    )}
                                    {transaction.category_confidence && (
                                      <div>📈 Confidence: {Math.round(transaction.category_confidence * 100)}%</div>
                                    )}
                                    {transaction.normalized_merchant && (
                                      <div>🏢 Merchant: {transaction.normalized_merchant}</div>
                                    )}
                                    {(transaction.merchant_city || transaction.merchant_state) && (
                                      <div>📍 Location: {[transaction.merchant_city, transaction.merchant_state].filter(Boolean).join(', ')}</div>
                                    )}
                                    <div className="text-xs text-gray-300">
                                      Enhanced: {transaction.enrichment_timestamp ? new Date(transaction.enrichment_timestamp).toLocaleDateString() : 'Unknown'}
                                    </div>
                                  </div>
                                </div>
                              }
                              position="top"
                            >
                              <div className="flex items-center gap-1 text-xs text-blue-600 cursor-help">
                                <Zap className="h-3 w-3" />
                                <span>AI Enhanced</span>
                              </div>
                            </Tooltip>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${transaction.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            {/* Primary Category */}
                            <Badge 
                              variant={transaction.status === 'categorized' ? 'success' : 'warning'}
                            >
                              {transaction.category_final || transaction.category_suggested || 'Uncategorized'}
                            </Badge>
                            
                            {/* Enhanced Category Group */}
                            {transaction.enrichment_source === 'mastercard_data_enrichment' && transaction.category_group && (
                              <Badge variant="neutral" className="text-xs bg-purple-100 text-purple-800 border-purple-200">
                                📊 {transaction.category_group}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                          {transaction.payee_final || transaction.payee_suggested || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge 
                            variant={transaction.status === 'categorized' ? 'success' : transaction.status === 'for_review' ? 'warning' : 'neutral'}
                          >
                            {transaction.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            {/* Single Highest Confidence Score */}
                            <div className="flex items-center space-x-2">
                              <div className="w-16 bg-surface rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${
                                    (transaction.confidence || 0) >= 0.9 ? 'bg-emerald-500' : 
                                    (transaction.confidence || 0) >= 0.7 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${(transaction.confidence || 0) * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-xs text-text-secondary">{Math.round((transaction.confidence || 0) * 100)}%</span>
                            </div>
                            
                            {/* Confidence Source Badge */}
                            {transaction.enrichment_source === 'mastercard_data_enrichment' && (
                              <Badge 
                                variant="neutral" 
                                className={`text-xs ${
                                  processedTransactions.has(transaction.id) 
                                    ? 'bg-green-100 text-green-800 border-green-200' 
                                    : 'bg-blue-100 text-blue-800 border-blue-200'
                                }`}
                              >
                                {processedTransactions.has(transaction.id) ? '🧠 Learned' : '🧠 AI Enhanced'}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                          <div className="flex items-center space-x-2">
                            <button className="p-1 hover:bg-surface rounded" onClick={(e) => e.stopPropagation()}>
                              <Eye className="h-4 w-4" />
                            </button>
                            <button 
                              className="p-1 hover:bg-surface rounded" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEnhanceTransaction(transaction.id);
                              }}
                              title="Enhance with AI"
                            >
                              <Zap className="h-4 w-4" />
                            </button>
                            <button className="p-1 hover:bg-surface rounded" onClick={(e) => e.stopPropagation()}>
                              <Paperclip className="h-4 w-4" />
                            </button>
                            
                            {/* AI Feedback Buttons - only show for enhanced transactions that haven't been processed */}
                            {transaction.enrichment_source === 'mastercard_data_enrichment' && !processedTransactions.has(transaction.id) && (
                              <>
                                <button 
                                  className="p-1 hover:bg-green-100 rounded text-green-600" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAcceptSuggestion(transaction.id, transaction);
                                  }}
                                  title="Accept AI suggestion"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                                <button 
                                  className="p-1 hover:bg-red-100 rounded text-red-600" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRejectSuggestion(transaction.id, transaction);
                                  }}
                                  title="Reject AI suggestion"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            
                            {/* Learning Status Indicator - show when feedback has been processed */}
                            {transaction.enrichment_source === 'mastercard_data_enrichment' && processedTransactions.has(transaction.id) && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
                                <Brain className="h-3 w-3" />
                                <span>Learned</span>
                              </div>
                            )}
                            
                            <button className="p-1 hover:bg-surface rounded" onClick={(e) => e.stopPropagation()}>
                              <Split className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Enhancement Results */}
            {enhancementError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Enhancement Error:</span>
                  <span>{enhancementError}</span>
                  <button 
                    onClick={() => clearError()}
                    className="ml-auto text-red-600 hover:text-red-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {showEnhancementResults && enhancementResults && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-blue-800">
                    <Zap className="h-4 w-4" />
                    <span className="font-medium">Enhancement Results</span>
                  </div>
                  <button 
                    onClick={() => setShowEnhancementResults(false)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-600">
                      {enhancementResults.updated}
                    </div>
                    <div className="text-blue-600">Successfully Enhanced</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-red-600">
                      {enhancementResults.errors}
                    </div>
                    <div className="text-blue-600">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-blue-600">
                      {enhancementResults.updated > 0 ? Math.round((enhancementResults.updated / (enhancementResults.updated + enhancementResults.errors)) * 100) : 0}%
                    </div>
                    <div className="text-blue-600">Success Rate</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-blue-600">
                  Enhanced transactions now include AI-powered categories, merchant data, and confidence scores.
                </div>
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-text-secondary">
                Showing 1-{filteredTransactions.length} of {filteredTransactions.length} transactions
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="secondary" size="sm">
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button variant="secondary" size="sm">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Right-Side Transaction Drawer */}
            {showTransactionDrawer && selectedTransaction && (
              <div className="fixed inset-0 z-50 overflow-hidden">
                {/* Backdrop */}
                <div 
                  className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                  onClick={handleCloseTransactionDrawer}
                />
                
                {/* Drawer */}
                <div className="absolute right-0 top-0 h-full w-[400px] bg-surface-elevated border-l border-border-subtle shadow-soft transform transition-transform duration-300 ease-out">
                  <div className="h-full flex flex-col">
                    {/* Header Section */}
                    <div className="p-6 border-b border-border-subtle">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          {/* Transaction Amount */}
                          <div className="mb-3">
                            <span className={`text-4xl font-bold ${selectedTransaction.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              ${Math.abs(selectedTransaction.amount).toFixed(2)}
                            </span>
                            <span className="text-sm text-text-tertiary ml-2">
                              {selectedTransaction.amount > 0 ? 'Credit' : 'Debit'}
                            </span>
                          </div>
                          
                          {/* Merchant/Payee Name */}
                          <h3 className="text-xl font-semibold text-text-primary mb-2">
                            {selectedTransaction.normalized_merchant || selectedTransaction.raw_description}
                          </h3>
                          
                          {/* Enhanced Data Badge */}
                          {selectedTransaction.enrichment_source === 'mastercard_data_enrichment' && (
                            <div className="mb-2 flex items-center gap-2">
                              <Badge variant="success" className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                                <Zap className="h-3 w-3 mr-1" />
                                AI Enhanced
                              </Badge>
                              <span className="text-xs text-blue-600">
                                {selectedTransaction.category_confidence ? `${Math.round(selectedTransaction.category_confidence * 100)}% confident` : 'Enhanced'}
                              </span>
                            </div>
                          )}
                          
                          {/* Date + Account Badge */}
                          <div className="flex items-center space-x-3">
                            <span className="text-sm text-text-secondary">
                              {selectedTransaction.date_posted}
                            </span>
                            <Badge variant="neutral" className="text-xs">
                              {selectedTransaction.account_name || 'Unknown Account'}
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          {/* Enhance Button */}
                          {!selectedTransaction.enrichment_source && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                handleEnhanceTransaction(selectedTransaction.id);
                                handleCloseTransactionDrawer();
                              }}
                              disabled={enhancementLoading}
                              className="flex items-center gap-1"
                            >
                              <Zap className="h-3 w-3" />
                              Enhance
                            </Button>
                          )}
                          
                          {/* Close Button */}
                          <button
                            onClick={handleCloseTransactionDrawer}
                            className="p-2 hover:bg-surface-hover rounded-xl transition-colors duration-200"
                          >
                            <X className="h-5 w-5 text-text-tertiary" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Core Details Section */}
                    <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                      {/* Category */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          Category
                        </label>
                        <select className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-colors">
                          <option value={selectedTransaction.category_suggested || selectedTransaction.category_final}>
                            {selectedTransaction.category_suggested || selectedTransaction.category_final || 'Uncategorized'}
                          </option>
                          <option value="office_supplies">Office Supplies</option>
                          <option value="software_subscriptions">Software & Subscriptions</option>
                          <option value="travel_entertainment">Travel & Entertainment</option>
                          <option value="professional_services">Professional Services</option>
                          <option value="utilities">Utilities</option>
                          <option value="revenue">Revenue</option>
                        </select>
                        
                        {/* Enhanced Category Group */}
                        {selectedTransaction.enrichment_source === 'mastercard_data_enrichment' && selectedTransaction.category_group && (
                          <div className="mt-2">
                            <Badge variant="neutral" className="text-xs bg-purple-100 text-purple-800 border-purple-200">
                              📊 {selectedTransaction.category_group}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Payee/Vendor */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          Payee/Vendor
                        </label>
                        <input
                          type="text"
                          defaultValue={selectedTransaction.normalized_merchant || selectedTransaction.payee_final || selectedTransaction.payee_suggested}
                          placeholder="Enter vendor name..."
                          className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-text-primary focus:border-primary focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                        />
                        
                        {/* Enhanced Merchant Info */}
                        {selectedTransaction.enrichment_source === 'mastercard_data_enrichment' && (
                          <div className="mt-2 space-y-1">
                            {selectedTransaction.normalized_merchant && selectedTransaction.normalized_merchant !== selectedTransaction.raw_description && (
                              <div className="flex items-center gap-2 text-xs text-blue-600">
                                <span>🏢 AI Normalized:</span>
                                <span className="font-medium">{selectedTransaction.normalized_merchant}</span>
                              </div>
                            )}
                            {(selectedTransaction.merchant_city || selectedTransaction.merchant_state) && (
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <span>📍 Location:</span>
                                <span>{[selectedTransaction.merchant_city, selectedTransaction.merchant_state].filter(Boolean).join(', ')}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Original Description */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          Original Description
                        </label>
                        <div className="w-full bg-surface-hover border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-secondary">
                          {selectedTransaction.raw_description}
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          Notes
                        </label>
                        <textarea
                          defaultValue={selectedTransaction.notes}
                          placeholder="Add additional context..."
                          rows={3}
                          className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
                        />
                      </div>

                      {/* AI Confidence */}
                      <div className="bg-surface-hover rounded-xl p-4 border border-border-subtle">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-text-secondary">AI Suggestion</span>
                          <span className="text-sm font-medium text-text-primary">
                            {selectedTransaction.category_suggested || selectedTransaction.category_final || 'No suggestion'}
                          </span>
                        </div>
                        
                        {/* Enhanced Data Display */}
                        {selectedTransaction.enrichment_source === 'mastercard_data_enrichment' ? (
                          <div className="space-y-3">
                            {/* Confidence Bar */}
                            {selectedTransaction.category_confidence && (
                              <div className="flex items-center space-x-3">
                                <div className="flex-1 bg-surface rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full ${
                                      selectedTransaction.category_confidence >= 0.9 ? 'bg-emerald-500' : 
                                      selectedTransaction.category_confidence >= 0.7 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${selectedTransaction.category_confidence * 100}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium text-text-primary">
                                  {Math.round(selectedTransaction.category_confidence * 100)}%
                                </span>
                              </div>
                            )}
                            
                            {/* Enhancement Details */}
                            <div className="text-xs text-gray-600 space-y-1">
                              <div>🎯 Category: {selectedTransaction.category_suggested || 'Not suggested'}</div>
                              <div>📊 Group: {selectedTransaction.category_group || 'Not categorized'}</div>
                              <div>🏢 Merchant: {selectedTransaction.normalized_merchant || 'Not normalized'}</div>
                              <div>📍 Location: {(selectedTransaction.merchant_city || selectedTransaction.merchant_state) ? [selectedTransaction.merchant_city, selectedTransaction.merchant_state].filter(Boolean).join(', ') : 'Not available'}</div>
                              <div>⚡ Enhanced: {selectedTransaction.enrichment_timestamp ? new Date(selectedTransaction.enrichment_timestamp).toLocaleDateString() : 'Unknown'}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">
                            No AI enhancement data available. Use the "Enhance with AI" button to get suggestions.
                          </div>
                        )}
                      </div>

                      {/* Attachments Section */}
                      <div>
                        <h4 className="text-sm font-medium text-text-secondary mb-3">Attachments</h4>
                        
                        {/* Receipt Preview */}
                        <div className="bg-surface-hover rounded-xl p-4 border border-border-subtle border-dashed mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-surface rounded-lg">
                              <FileText className="h-6 w-6 text-text-tertiary" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-text-secondary">No receipt attached</p>
                              <p className="text-xs text-text-tertiary">Drag & drop files here or click to upload</p>
                            </div>
                          </div>
                        </div>
                        
                        <Button variant="secondary" size="sm" className="w-full">
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Receipt
                        </Button>
                      </div>

                      {/* Audit & Status Section */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-text-secondary mb-3">Status & Audit</h4>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-text-secondary">Status:</span>
                          <Badge 
                            variant={selectedTransaction.status === 'categorized' ? 'success' : selectedTransaction.status === 'for_review' ? 'warning' : 'neutral'}
                          >
                            {selectedTransaction.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-text-secondary">Journal Entry:</span>
                          <span className="text-sm text-text-primary">Not Posted</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-text-secondary">Reconciliation:</span>
                          <span className="text-sm text-text-primary">Unmatched</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-border-subtle space-y-3">
                      <Button 
                        className="w-full bg-primary text-gray-900 hover:bg-primary-hover shadow-medium"
                        onClick={() => {
                          toast.success('Changes saved successfully');
                          handleCloseTransactionDrawer();
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Save Changes
                      </Button>
                      
                      <div className="flex space-x-2">
                        <Button 
                          variant="secondary" 
                          className="flex-1"
                          onClick={() => {
                            toast.success('Transaction marked as reviewed');
                            handleCloseTransactionDrawer();
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Mark Reviewed
                        </Button>
                        
                        <Button 
                          variant="secondary" 
                          className="flex-1"
                          onClick={() => {
                            toast.info('Client message request generated');
                            handleCloseTransactionDrawer();
                          }}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Flag for Client
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated">
      <TopBar title="Client Financial Overview" />
      <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />
      
      <div className="max-w-content mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary">Client Financial Overview</h1>
          <p className="text-text-secondary mt-1">Monitor cash balances and month-end progress across all clients</p>
        </div>

        {/* Search and Controls */}
        <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 mb-8 shadow-soft">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-tertiary" />
              <Input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Right side actions */}
            <div className="flex gap-2">
              <Button variant="secondary" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => navigate('/clients')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </Button>
            </div>
          </div>
        </div>

        {/* Client Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => {
            // Check if this client has bank integration
            const hasBankIntegration = client.name === 'Harisharnam' || client.name === 'Lakshya';
            
            return (
              <div 
                key={client.id}
                className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 shadow-soft hover:shadow-medium transition-all duration-200 cursor-pointer"
                onClick={() => handleClientCardClick(client.id)}
              >
                {/* Client Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-text-primary mb-1">{client.name}</h3>
                    <p className="text-sm text-text-tertiary">{client.email}</p>
                  </div>
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <Users2 className="h-5 w-5 text-primary" />
                  </div>
                </div>

                {/* Financial Data */}
                {hasBankIntegration ? (
                  <>
                    {/* Cash Balance */}
                    <div className="mb-4">
                      <p className="text-sm text-text-tertiary mb-1">Cash Balance</p>
                      <p className="text-3xl font-bold text-text-primary">
                        ${client.name === 'Harisharnam' ? '2,000.00' : '10.00'}
                      </p>
                    </div>

                    {/* Month Close Progress */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-text-tertiary">Month Close Progress</p>
                        <span className="text-sm font-medium px-2 py-1 rounded-full border text-emerald-600 bg-emerald-50 border-emerald-200">
                          {client.name === 'Harisharnam' ? '95%' : '85%'}
                        </span>
                      </div>
                      <div className="w-full bg-surface-hover rounded-full h-2">
                        <div 
                          className="h-2 rounded-full bg-emerald-500"
                          style={{ width: client.name === 'Harisharnam' ? '95%' : '85%' }}
                        ></div>
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Pending Transactions:</span>
                        <span className="text-text-primary font-medium">1</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Last Activity:</span>
                        <span className="text-text-primary">Today</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Bank Status:</span>
                        <span className="text-emerald-600 font-medium">Linked ✓</span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="mt-4">
                      <Button 
                        className="w-full bg-primary text-gray-900 hover:bg-primary-hover shadow-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClientCardClick(client.id);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Transactions
                      </Button>
                    </div>
                  </>
                ) : (
                  /* No Bank Integration CTA */
                  <div className="text-center py-6">
                    <div className="p-3 bg-surface-hover rounded-xl w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                      <Link className="h-6 w-6 text-text-tertiary" />
                    </div>
                    <h4 className="font-medium text-text-primary mb-2">No Bank Integration</h4>
                    <p className="text-sm text-text-secondary mb-4">
                      Connect bank accounts to start tracking transactions and cash flow
                    </p>
                    <Button 
                      variant="secondary"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBankIntegrationRequest(client.id);
                      }}
                    >
                      <Link className="h-4 w-4 mr-2" />
                      Set Up Integration
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredClients.length === 0 && !clientsLoading && (
          <div className="text-center py-12">
            <div className="p-4 bg-surface-hover rounded-xl w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Users2 className="h-8 w-8 text-text-tertiary" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">No clients found</h3>
            <p className="text-text-secondary mb-6">
              {searchQuery ? 'Try adjusting your search terms' : 'Get started by adding your first client'}
            </p>
            <Button 
              onClick={() => navigate('/clients')}
              className="bg-primary text-gray-900 hover:bg-primary-hover shadow-medium"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Client
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
