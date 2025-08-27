import React, { useState, useEffect, useRef } from 'react';
import { TopBar } from '../components/organisms/TopBar';
import { useToast } from '../contexts/ToastContext';
import { useVendors } from '../hooks/useVendors';
import { useClients } from '../hooks/useClients';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import { Input } from '../components/atoms/Input';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  TrendingUp,
  DollarSign,
  FileText,
  Plus,
  X,
  Check,
  Calendar,
  Users2,
  Globe
} from 'lucide-react';
import { Vendor } from '../lib/database';

export function Vendors() {
  const { showToast } = useToast();
  const { clients } = useClients();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const { vendors, vendorAnalytics, loading, error, refreshVendors } = useVendors(selectedClientId || undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // Get selected client info
  const selectedClient = selectedClientId ? clients.find(c => c.id === selectedClientId) : null;

  // Handle client selection
  const handleClientSelect = (clientId: string | null) => {
    setSelectedClientId(clientId);
    setIsClientDropdownOpen(false);
    setSearchQuery(''); // Clear search when switching clients
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

  // Filter vendors based on search query
  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vendor.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vendor.phone?.includes(searchQuery)
  );

  // Get W9 status badge
  const getW9Badge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success" className="text-xs">W9 Complete</Badge>;
      case 'pending':
        return <Badge variant="warning" className="text-xs">W9 Pending</Badge>;
      case 'expired':
        return <Badge variant="error" className="text-xs">W9 Expired</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">W9 Missing</Badge>;
    }
  };

  // Handle vendor selection for detail view
  const handleVendorClick = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsDetailModalOpen(true);
  };

  // Close detail modal
  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedVendor(null);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated">
        <TopBar title="Vendors" />
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-text-secondary">Loading vendors...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated">
        <TopBar title="Vendors" />
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-4 text-error" />
              <p className="text-error mb-4">{error}</p>
              <Button onClick={refreshVendors} variant="secondary">
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated">
      <TopBar title="Vendors" />

      {/* Header Section */}
      <div className="p-6 border-b border-border-subtle bg-surface">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Vendor Management</h1>
            <p className="text-text-secondary mt-1">
              Manage your vendor relationships, track payments, and monitor W9 compliance
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={refreshVendors}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Vendor
            </Button>
          </div>
        </div>

        {/* Client Selector */}
        <div className="mb-6">
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
                      No clients available
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>

            {/* Vendor Count Summary */}
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Building2 className="w-4 h-4" />
              <span>
                {loading ? 'Loading...' :
                 selectedClient ?
                   `${filteredVendors.length} vendor${filteredVendors.length !== 1 ? 's' : ''} for ${selectedClient.name}` :
                   `${filteredVendors.length} vendor${filteredVendors.length !== 1 ? 's' : ''} total`
                }
              </span>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <Input
                placeholder="Search vendors by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {filteredVendors.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-text-tertiary" />
            <h3 className="text-lg font-medium text-text-primary mb-2">
              {searchQuery ? 'No vendors found' :
               selectedClient ? `No vendors for ${selectedClient.name}` : 'No vendors yet'}
            </h3>
            <p className="text-text-secondary mb-6">
              {searchQuery
                ? 'Try adjusting your search terms'
                : selectedClient
                  ? `No vendors are currently associated with ${selectedClient.name}. Add vendors to start tracking payments and W9 compliance for this client.`
                  : 'Start by adding your first vendor to track payments and W9 compliance'
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {selectedClient && (
                <Button
                  onClick={() => setSelectedClientId(null)}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Globe className="w-4 h-4" />
                  View All Clients
                </Button>
              )}
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Vendor
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredVendors.map((vendor) => {
              const analytics = vendorAnalytics[vendor.id] || {
                totalPaid: 0,
                transactionCount: 0,
                averageInvoiceSize: 0,
                lastTransaction: undefined,
                lastTransactionDate: undefined,
                outstandingBalance: 0,
                pendingPayments: 0
              };
              return (
                <div
                  key={vendor.id}
                  className="bg-surface-elevated rounded-xl border border-border-subtle p-6 hover:shadow-soft transition-all duration-200 cursor-pointer group"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleVendorClick(vendor);
                  }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-text-primary group-hover:text-text-secondary transition-colors">
                          {vendor.name}
                        </h3>
                        {getW9Badge(vendor.w9_status)}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-text-tertiary group-hover:text-primary transition-colors" />
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2 mb-4">
                    {vendor.email && (
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{vendor.email}</span>
                      </div>
                    )}
                    {vendor.phone && (
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <Phone className="w-4 h-4" />
                        <span>{vendor.phone}</span>
                      </div>
                    )}
                    {vendor.address && (
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{vendor.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Analytics */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-subtle">
                    <div>
                      <p className="text-xs text-text-tertiary mb-1">Total Paid</p>
                      <p className="font-semibold text-text-primary">
                        {formatCurrency(analytics.totalPaid)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-text-tertiary mb-1">Transactions</p>
                      <p className="font-semibold text-text-primary">
                        {analytics.transactionCount}
                      </p>
                    </div>
                  </div>

                  {/* Last Transaction */}
                  {analytics.lastTransaction && (
                    <div className="mt-4 pt-4 border-t border-border-subtle">
                      <p className="text-xs text-text-tertiary mb-1">Last Transaction</p>
                      <p className="text-sm text-text-primary">
                        {formatDate(analytics.lastTransaction.date)}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Vendor Detail Modal */}
      {isDetailModalOpen && selectedVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeDetailModal} />
          <div className="relative bg-surface-elevated rounded-xl border border-border-subtle w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-border-subtle">
              <div>
                <h2 className="text-xl font-semibold text-text-primary">{selectedVendor.name}</h2>
                <p className="text-text-secondary mt-1">Vendor Details & Analytics</p>
              </div>
              <button
                onClick={closeDetailModal}
                className="p-2 text-text-tertiary hover:text-text-primary hover:bg-surface rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Vendor Info */}
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div>
                    <h3 className="font-semibold text-text-primary mb-4">Vendor Information</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-5 h-5 text-text-tertiary" />
                        <span className="font-medium">{selectedVendor.name}</span>
                      </div>
                      {selectedVendor.email && (
                        <div className="flex items-center gap-3">
                          <Mail className="w-5 h-5 text-text-tertiary" />
                          <span>{selectedVendor.email}</span>
                        </div>
                      )}
                      {selectedVendor.phone && (
                        <div className="flex items-center gap-3">
                          <Phone className="w-5 h-5 text-text-tertiary" />
                          <span>{selectedVendor.phone}</span>
                        </div>
                      )}
                      {selectedVendor.address && (
                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-text-tertiary mt-0.5" />
                          <span>{selectedVendor.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* W9 Status */}
                  <div>
                    <h3 className="font-semibold text-text-primary mb-4">W9 & Compliance</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        {getW9Badge(selectedVendor.w9_status)}
                        {selectedVendor.requires_1099 && (
                          <Badge variant="secondary" className="text-xs">Requires 1099</Badge>
                        )}
                      </div>
                      {selectedVendor.w9_document_id && (
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-text-tertiary" />
                          <span className="text-sm">W9 Document Available</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Terms */}
                  <div>
                    <h3 className="font-semibold text-text-primary mb-4">Payment Terms</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5 text-text-tertiary" />
                        <span className="text-sm">Net 30 (Default)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Analytics */}
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-text-primary mb-4">Spend Analysis</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {(() => {
                        const analytics = vendorAnalytics[selectedVendor.id] || {
                          totalPaid: 0,
                          transactionCount: 0,
                          averageInvoiceSize: 0,
                          lastTransaction: undefined,
                          lastTransactionDate: undefined,
                          outstandingBalance: 0,
                          pendingPayments: 0
                        };
                        return (
                          <>
                            <div className="bg-surface rounded-lg p-4 border border-border-subtle">
                              <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium text-text-secondary">Total Paid</span>
                              </div>
                              <p className="text-xl font-bold text-text-primary">
                                {formatCurrency(analytics.totalPaid)}
                              </p>
                            </div>
                            <div className="bg-surface rounded-lg p-4 border border-border-subtle">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium text-text-secondary">Transactions</span>
                              </div>
                              <p className="text-xl font-bold text-text-primary">
                                {analytics.transactionCount}
                              </p>
                            </div>
                            <div className="bg-surface rounded-lg p-4 border border-border-subtle">
                              <div className="flex items-center gap-2 mb-2">
                                <TrendingUp className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium text-text-secondary">Avg Invoice</span>
                              </div>
                              <p className="text-xl font-bold text-text-primary">
                                {formatCurrency(analytics.averageInvoiceSize)}
                              </p>
                            </div>
                            <div className="bg-surface rounded-lg p-4 border border-border-subtle">
                              <div className="flex items-center gap-2 mb-2">
                                <Calendar className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium text-text-secondary">Last Payment</span>
                              </div>
                              <p className="text-sm font-bold text-text-primary">
                                {analytics.lastTransactionDate ? formatDate(analytics.lastTransactionDate) : 'None'}
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Transactions Section */}
              <div className="mt-8">
                <h3 className="font-semibold text-text-primary mb-4">Recent Transactions</h3>
                <div className="border border-border-subtle rounded-lg overflow-hidden">
                  <div className="bg-surface border-b border-border-subtle px-4 py-3">
                    <div className="grid grid-cols-4 gap-4 text-sm font-medium text-text-secondary">
                      <span>Date</span>
                      <span>Description</span>
                      <span>Amount</span>
                      <span>Status</span>
                    </div>
                  </div>
                  <div className="divide-y divide-border-subtle">
                    {(() => {
                      const lastTransaction = vendorAnalytics[selectedVendor.id]?.lastTransaction;

                      if (!lastTransaction) {
                        return (
                          <div className="px-4 py-8 text-center text-text-secondary">
                            No transactions found for this vendor
                          </div>
                        );
                      }

                      return (
                        <div className="px-4 py-3 grid grid-cols-4 gap-4 text-sm hover:bg-surface transition-colors">
                          <span className="text-text-primary">{formatDate(lastTransaction.payment_date)}</span>
                          <span className="text-text-primary truncate">{lastTransaction.description || 'No description'}</span>
                          <span className={`font-medium ${lastTransaction.amount < 0 ? 'text-error' : 'text-success'}`}>
                            {formatCurrency(Math.abs(lastTransaction.amount))}
                          </span>
                          <Badge variant="success" className="text-xs w-fit">
                            Paid
                          </Badge>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
