import React, { useState } from 'react';
import { TopBar } from '../components/organisms/TopBar';
import { GlobalSearch } from '../components/molecules/GlobalSearch';
import { useSearch } from '../contexts/SearchContext';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import { Input } from '../components/atoms/Input';
import { DocumentRequestDialog } from '../components/ui/document-request-dialog';
import { useClients } from '../hooks/useClients';
import { 
  Search, 
  Filter, 
  Plus, 
  FileText, 
  Mail, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Calendar, 
  Send, 
  RefreshCw, 
  Eye, 
  Download, 
  Trash2,
  MessageSquare,
  User
} from 'lucide-react';

// Mock data for document requests
interface DocumentRequest {
  id: string;
  clientId: string;
  title: string;
  description?: string;
  documentTypes: string[];
  status: 'pending' | 'partial' | 'complete' | 'overdue';
  dueDate: string;
  createdAt: string;
  lastReminder?: string;
  documents: {
    id: string;
    name: string;
    status: 'pending' | 'uploaded';
    uploadedAt?: string;
  }[];
}

export function ClientCommunications() {
  const { isSearchOpen, closeSearch, openSearch } = useSearch();
  const { clients } = useClients();
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DocumentRequest | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Mock document requests data
  const [documentRequests, setDocumentRequests] = useState<DocumentRequest[]>([
    {
      id: '1',
      clientId: clients[0]?.id || 'client-1',
      title: 'Annual Tax Return Documents',
      description: 'Please provide all necessary documents for your 2024 tax return preparation.',
      documentTypes: ['W-2', '1099-MISC', 'Bank Statements', 'Charitable Donations'],
      status: 'partial',
      dueDate: '2025-03-15',
      createdAt: '2025-01-10',
      lastReminder: '2025-02-01',
      documents: [
        { id: 'd1', name: 'W-2 Form', status: 'uploaded', uploadedAt: '2025-01-15' },
        { id: 'd2', name: '1099-MISC', status: 'pending' },
        { id: 'd3', name: 'Bank Statements', status: 'uploaded', uploadedAt: '2025-01-20' },
        { id: 'd4', name: 'Charitable Donations', status: 'pending' }
      ]
    },
    {
      id: '2',
      clientId: clients[1]?.id || 'client-2',
      title: 'Quarterly Business Expense Documentation',
      description: 'Please upload your Q1 2025 business expense receipts and statements.',
      documentTypes: ['Receipts', 'Bank Statements', 'Credit Card Statements'],
      status: 'pending',
      dueDate: '2025-04-15',
      createdAt: '2025-03-01',
      documents: [
        { id: 'd5', name: 'Receipts', status: 'pending' },
        { id: 'd6', name: 'Bank Statements', status: 'pending' },
        { id: 'd7', name: 'Credit Card Statements', status: 'pending' }
      ]
    },
    {
      id: '3',
      clientId: clients[2]?.id || 'client-3',
      title: 'IRS Audit Documentation',
      description: 'Please provide the requested documents for your IRS audit response.',
      documentTypes: ['Previous Tax Returns', 'Income Verification', 'Expense Documentation'],
      status: 'complete',
      dueDate: '2025-02-28',
      createdAt: '2025-02-01',
      lastReminder: '2025-02-15',
      documents: [
        { id: 'd8', name: 'Previous Tax Returns', status: 'uploaded', uploadedAt: '2025-02-10' },
        { id: 'd9', name: 'Income Verification', status: 'uploaded', uploadedAt: '2025-02-12' },
        { id: 'd10', name: 'Expense Documentation', status: 'uploaded', uploadedAt: '2025-02-20' }
      ]
    },
    {
      id: '4',
      clientId: clients[0]?.id || 'client-1',
      title: 'Year-End Planning Documents',
      description: 'Please provide documentation for year-end tax planning.',
      documentTypes: ['Asset Purchases', 'Retirement Contributions', 'Estimated Expenses'],
      status: 'overdue',
      dueDate: '2025-01-15',
      createdAt: '2024-12-15',
      lastReminder: '2025-01-10',
      documents: [
        { id: 'd11', name: 'Asset Purchases', status: 'pending' },
        { id: 'd12', name: 'Retirement Contributions', status: 'uploaded', uploadedAt: '2025-01-05' },
        { id: 'd13', name: 'Estimated Expenses', status: 'pending' }
      ]
    }
  ]);

  // Filter document requests based on search and filters
  const filteredRequests = documentRequests.filter(request => {
    const matchesSearch = !searchQuery || 
      request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getClientName(request.clientId).toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Get client name from client ID
  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Unknown Client';
  };

  // Get status badge based on status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return <Badge variant="success">Complete</Badge>;
      case 'partial':
        return <Badge variant="warning">Partial</Badge>;
      case 'overdue':
        return <Badge variant="error">Overdue</Badge>;
      default:
        return <Badge variant="neutral">Pending</Badge>;
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Calculate days until due date
  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `${Math.abs(diffDays)} days overdue`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else {
      return `${diffDays} days left`;
    }
  };

  // Calculate completion percentage
  const getCompletionPercentage = (request: DocumentRequest) => {
    const totalDocuments = request.documents.length;
    const uploadedDocuments = request.documents.filter(doc => doc.status === 'uploaded').length;
    return Math.round((uploadedDocuments / totalDocuments) * 100);
  };

  // Handle creating a new document request
  const handleCreateRequest = async (requestData: {
    clientId: string;
    title: string;
    description?: string;
    documentTypes: string[];
    dueDate: string;
    sendEmail: boolean;
  }) => {
    // In a real implementation, this would call an API to create the request
    // For now, we'll just add it to our mock data
    const newRequest: DocumentRequest = {
      id: `${documentRequests.length + 1}`,
      clientId: requestData.clientId,
      title: requestData.title,
      description: requestData.description,
      documentTypes: requestData.documentTypes,
      status: 'pending',
      dueDate: requestData.dueDate,
      createdAt: new Date().toISOString(),
      documents: requestData.documentTypes.map((type, index) => ({
        id: `new-${index}`,
        name: type,
        status: 'pending'
      }))
    };
    
    setDocumentRequests([newRequest, ...documentRequests]);
    
    // If sendEmail is true, we would send an email to the client
    if (requestData.sendEmail) {
      // Simulate email sending
      console.log('Sending email to client:', getClientName(requestData.clientId));
      alert(`Email sent to ${getClientName(requestData.clientId)} with document request.`);
    }
    
    return Promise.resolve();
  };

  // Handle sending a reminder
  const handleSendReminder = (requestId: string) => {
    // In a real implementation, this would call an API to send a reminder
    // For now, we'll just update the lastReminder date
    setDocumentRequests(prev => 
      prev.map(req => 
        req.id === requestId 
          ? { ...req, lastReminder: new Date().toISOString() } 
          : req
      )
    );
    
    const request = documentRequests.find(req => req.id === requestId);
    if (request) {
      alert(`Reminder sent to ${getClientName(request.clientId)} for "${request.title}".`);
    }
  };

  // Handle deleting a request
  const handleDeleteRequest = (requestId: string) => {
    if (window.confirm('Are you sure you want to delete this document request?')) {
      setDocumentRequests(prev => prev.filter(req => req.id !== requestId));
    }
  };

  // Get stats for the dashboard
  const stats = {
    total: documentRequests.length,
    pending: documentRequests.filter(req => req.status === 'pending').length,
    partial: documentRequests.filter(req => req.status === 'partial').length,
    complete: documentRequests.filter(req => req.status === 'complete').length,
    overdue: documentRequests.filter(req => req.status === 'overdue').length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated">
      <TopBar 
        title="Client Communications" 
        action={{
          label: 'New Document Request',
          onClick: () => setShowRequestDialog(true),
          icon: Plus
        }}
      />
      
      {/* Global Search */}
      <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />
      
      <div className="max-w-content mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-tertiary">Total Requests</p>
                <p className="text-2xl font-semibold text-text-primary">{stats.total}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-amber-100 to-amber-50 rounded-xl">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-tertiary">Pending</p>
                <p className="text-2xl font-semibold text-text-primary">{stats.pending}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-purple-100 to-purple-50 rounded-xl">
                <RefreshCw className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-tertiary">Partial</p>
                <p className="text-2xl font-semibold text-text-primary">{stats.partial}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-xl">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-tertiary">Complete</p>
                <p className="text-2xl font-semibold text-text-primary">{stats.complete}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-red-100 to-red-50 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-tertiary">Overdue</p>
                <p className="text-2xl font-semibold text-text-primary">{stats.overdue}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 mb-8 shadow-soft">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <Input
                  placeholder="Search by client name or request title..."
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
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="complete">Complete</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        {/* Document Requests List */}
        <div className="bg-surface-elevated rounded-2xl border border-border-subtle shadow-soft overflow-hidden mb-8">
          <div className="p-6 border-b border-border-subtle">
            <h2 className="text-xl font-semibold text-text-primary">Document Requests</h2>
          </div>
          
          {filteredRequests.length > 0 ? (
            <div className="divide-y divide-border-subtle">
              {filteredRequests.map((request) => (
                <div key={request.id} className="p-6 hover:bg-surface-hover transition-all duration-200">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-text-primary text-lg">{request.title}</h3>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-text-secondary text-sm mb-2">{request.description}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-tertiary">
                        <span className="flex items-center">
                          <User className="w-4 h-4 mr-1" />
                          {getClientName(request.clientId)}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          Due: {formatDate(request.dueDate)} ({getDaysUntilDue(request.dueDate)})
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          Created: {formatDate(request.createdAt)}
                        </span>
                        {request.lastReminder && (
                          <span className="flex items-center">
                            <Mail className="w-4 h-4 mr-1" />
                            Last Reminder: {formatDate(request.lastReminder)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Send}
                        onClick={() => handleSendReminder(request.id)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        Send Reminder
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Eye}
                        onClick={() => setSelectedRequest(request)}
                      >
                        View Details
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={() => handleDeleteRequest(request.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      />
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-text-secondary">
                        {request.documents.filter(doc => doc.status === 'uploaded').length} of {request.documents.length} documents received
                      </span>
                      <span className="text-sm font-medium text-text-secondary">
                        {getCompletionPercentage(request)}%
                      </span>
                    </div>
                    <div className="w-full bg-surface rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-2 rounded-full ${
                          request.status === 'complete' 
                            ? 'bg-emerald-500' 
                            : request.status === 'overdue' 
                              ? 'bg-red-500' 
                              : 'bg-primary'
                        }`}
                        style={{ width: `${getCompletionPercentage(request)}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Document List - Collapsed View */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {request.documents.map((doc) => (
                      <div 
                        key={doc.id} 
                        className={`px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
                          doc.status === 'uploaded' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-surface border border-border-subtle text-text-secondary'
                        }`}
                      >
                        <span className="truncate">{doc.name}</span>
                        {doc.status === 'uploaded' ? (
                          <CheckCircle className="w-4 h-4 flex-shrink-0 ml-2" />
                        ) : (
                          <Clock className="w-4 h-4 flex-shrink-0 ml-2" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">No Document Requests</h3>
              <p className="text-text-tertiary mb-6">
                {searchQuery || statusFilter !== 'all' 
                  ? 'No requests match your search criteria. Try adjusting your filters.' 
                  : 'Create your first document request to start collecting files from clients.'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Button 
                  onClick={() => setShowRequestDialog(true)} 
                  icon={Plus}
                  className="bg-primary text-gray-900 hover:bg-primary-hover"
                >
                  Create First Request
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Communication Features Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Recent Communications */}
          <div className="bg-surface-elevated rounded-2xl border border-border-subtle shadow-soft overflow-hidden">
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xl font-semibold text-text-primary">Recent Communications</h2>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-4 p-4 bg-surface rounded-xl border border-border-subtle">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Mail className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-text-primary">Document Request Sent</h4>
                      <span className="text-xs text-text-tertiary">2 hours ago</span>
                    </div>
                    <p className="text-sm text-text-secondary">Sent tax document request to John Smith</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4 p-4 bg-surface rounded-xl border border-border-subtle">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <FileText className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-text-primary">Documents Received</h4>
                      <span className="text-xs text-text-tertiary">1 day ago</span>
                    </div>
                    <p className="text-sm text-text-secondary">Sarah Johnson uploaded 3 documents</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4 p-4 bg-surface rounded-xl border border-border-subtle">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <MessageSquare className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-text-primary">Client Query</h4>
                      <span className="text-xs text-text-tertiary">2 days ago</span>
                    </div>
                    <p className="text-sm text-text-secondary">Michael Brown asked about expense documentation</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 text-center">
                <Button variant="ghost" size="sm">
                  View All Communications
                </Button>
              </div>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="bg-surface-elevated rounded-2xl border border-border-subtle shadow-soft overflow-hidden">
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xl font-semibold text-text-primary">Quick Actions</h2>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 gap-4">
                <Button 
                  className="w-full justify-start bg-primary text-gray-900 hover:bg-primary-hover shadow-medium" 
                  icon={Plus}
                  onClick={() => setShowRequestDialog(true)}
                >
                  New Document Request
                </Button>
                
                <Button 
                  variant="secondary" 
                  className="w-full justify-start hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200" 
                  icon={Mail}
                >
                  Send Bulk Reminders
                </Button>
                
                <Button 
                  variant="secondary" 
                  className="w-full justify-start hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200" 
                  icon={MessageSquare}
                >
                  Create Client Query
                </Button>
                
                <Button 
                  variant="secondary" 
                  className="w-full justify-start hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200" 
                  icon={Download}
                >
                  Download Document Report
                </Button>
              </div>
              
              <div className="mt-6 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/20">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <Mail className="w-4 h-4 text-gray-900" />
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary mb-1">Connect Your Email</h4>
                    <p className="text-sm text-text-secondary mb-3">
                      Connect your email account to automatically track client communications and send document requests.
                    </p>
                    <Button size="sm" className="bg-primary text-gray-900 hover:bg-primary-hover">
                      Connect Email
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-surface-elevated rounded-2xl border border-border-subtle shadow-soft overflow-hidden mb-8">
          <div className="p-6 border-b border-border-subtle">
            <h2 className="text-xl font-semibold text-text-primary">Upcoming Deadlines</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface border-b border-border-subtle">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                    Request
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {documentRequests
                  .filter(req => req.status !== 'complete')
                  .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                  .slice(0, 5)
                  .map((request) => (
                    <tr key={request.id} className="hover:bg-surface-hover transition-all duration-200">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-text-primary">{getClientName(request.clientId)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-text-primary">{request.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm ${
                          request.status === 'overdue' ? 'text-red-600 font-medium' : 'text-text-secondary'
                        }`}>
                          {formatDate(request.dueDate)}
                          <div className="text-xs text-text-tertiary">
                            {getDaysUntilDue(request.dueDate)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(request.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-32">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-text-tertiary">
                              {request.documents.filter(doc => doc.status === 'uploaded').length}/{request.documents.length}
                            </span>
                            <span className="text-xs font-medium text-text-secondary">
                              {getCompletionPercentage(request)}%
                            </span>
                          </div>
                          <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-1.5 rounded-full ${
                                request.status === 'overdue' ? 'bg-red-500' : 'bg-primary'
                              }`}
                              style={{ width: `${getCompletionPercentage(request)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Send}
                            onClick={() => handleSendReminder(request.id)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            Remind
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Eye}
                            onClick={() => setSelectedRequest(request)}
                          >
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Document Request Dialog */}
      <DocumentRequestDialog
        isOpen={showRequestDialog}
        onClose={() => setShowRequestDialog(false)}
        onSubmit={handleCreateRequest}
        clients={clients}
      />

      {/* Document Request Detail Dialog - Placeholder for now */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-elevated rounded-2xl shadow-premium max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border-subtle">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-text-primary">{selectedRequest.title}</h2>
                  <div className="flex items-center space-x-2 mt-1">
                    {getStatusBadge(selectedRequest.status)}
                    <span className="text-sm text-text-tertiary">
                      Client: {getClientName(selectedRequest.clientId)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-xl"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Request Details */}
              <div className="bg-surface rounded-xl border border-border-subtle p-6">
                <h3 className="font-semibold text-text-primary mb-4">Request Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-text-tertiary">Description</p>
                      <p className="text-text-primary">{selectedRequest.description || 'No description provided'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-tertiary">Created On</p>
                      <p className="text-text-primary">{formatDate(selectedRequest.createdAt)}</p>
                    </div>
                    {selectedRequest.lastReminder && (
                      <div>
                        <p className="text-sm font-medium text-text-tertiary">Last Reminder</p>
                        <p className="text-text-primary">{formatDate(selectedRequest.lastReminder)}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-text-tertiary">Due Date</p>
                      <p className={`text-text-primary ${
                        selectedRequest.status === 'overdue' ? 'text-red-600 font-medium' : ''
                      }`}>
                        {formatDate(selectedRequest.dueDate)} ({getDaysUntilDue(selectedRequest.dueDate)})
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-tertiary">Completion</p>
                      <div className="flex items-center space-x-2">
                        <div className="w-full bg-surface-elevated rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-2 rounded-full ${
                              selectedRequest.status === 'complete' 
                                ? 'bg-emerald-500' 
                                : selectedRequest.status === 'overdue' 
                                  ? 'bg-red-500' 
                                  : 'bg-primary'
                            }`}
                            style={{ width: `${getCompletionPercentage(selectedRequest)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-text-primary">
                          {getCompletionPercentage(selectedRequest)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-tertiary">Client</p>
                      <p className="text-text-primary">{getClientName(selectedRequest.clientId)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Document List */}
              <div>
                <h3 className="font-semibold text-text-primary mb-4">Requested Documents</h3>
                <div className="space-y-3">
                  {selectedRequest.documents.map((doc) => (
                    <div 
                      key={doc.id} 
                      className={`flex items-center justify-between p-4 rounded-xl border ${
                        doc.status === 'uploaded' 
                          ? 'bg-emerald-50 border-emerald-200' 
                          : 'bg-surface border-border-subtle'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${
                          doc.status === 'uploaded' ? 'bg-emerald-100' : 'bg-surface-elevated'
                        }`}>
                          <FileText className={`w-4 h-4 ${
                            doc.status === 'uploaded' ? 'text-emerald-600' : 'text-text-tertiary'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium text-text-primary">{doc.name}</p>
                          {doc.status === 'uploaded' && doc.uploadedAt && (
                            <p className="text-xs text-text-tertiary">
                              Uploaded on {formatDate(doc.uploadedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        {doc.status === 'uploaded' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Eye}
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          >
                            View
                          </Button>
                        ) : (
                          <Badge variant="neutral" size="sm">Pending</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Communication History - Placeholder */}
              <div>
                <h3 className="font-semibold text-text-primary mb-4">Communication History</h3>
                <div className="bg-surface rounded-xl border border-border-subtle p-4">
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Mail className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-text-primary">Initial Request Sent</p>
                          <span className="text-xs text-text-tertiary">{formatDate(selectedRequest.createdAt)}</span>
                        </div>
                        <p className="text-sm text-text-secondary mt-1">
                          Document request email sent to {getClientName(selectedRequest.clientId)}
                        </p>
                      </div>
                    </div>
                    
                    {selectedRequest.lastReminder && (
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <Mail className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-text-primary">Reminder Sent</p>
                            <span className="text-xs text-text-tertiary">{formatDate(selectedRequest.lastReminder)}</span>
                          </div>
                          <p className="text-sm text-text-secondary mt-1">
                            Reminder email sent to {getClientName(selectedRequest.clientId)}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {selectedRequest.documents.some(doc => doc.status === 'uploaded') && (
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                          <FileText className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-text-primary">Documents Uploaded</p>
                            <span className="text-xs text-text-tertiary">
                              {formatDate(selectedRequest.documents.find(doc => doc.status === 'uploaded')?.uploadedAt || '')}
                            </span>
                          </div>
                          <p className="text-sm text-text-secondary mt-1">
                            Client uploaded {selectedRequest.documents.filter(doc => doc.status === 'uploaded').length} document(s)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border-subtle bg-surface">
              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 sm:gap-4">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedRequest(null)}
                  className="w-full sm:w-auto"
                >
                  Close
                </Button>
                
                <div className="flex space-x-3 w-full sm:w-auto">
                  <Button
                    variant="secondary"
                    icon={Send}
                    onClick={() => handleSendReminder(selectedRequest.id)}
                    className="w-full sm:w-auto"
                  >
                    Send Reminder
                  </Button>
                  
                  <Button
                    variant="primary"
                    icon={MessageSquare}
                    className="w-full sm:w-auto bg-primary text-gray-900 hover:bg-primary-hover"
                  >
                    Message Client
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Define X component for the dialog close button
const X = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);