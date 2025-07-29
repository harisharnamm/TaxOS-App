import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClients } from '../hooks/useClients';
import { TopBar } from '../components/organisms/TopBar';
import { GlobalSearch } from '../components/molecules/GlobalSearch';
import { useSearch } from '../contexts/SearchContext';
import { ClientTable } from '../components/organisms/ClientTable';
import { ClientDialog } from '../components/ui/client-dialog';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { EmptyState } from '../components/ui/empty-state';
import { useToast } from '../contexts/ToastContext';
import { Skeleton, SkeletonText, SkeletonTable } from '../components/ui/skeleton';
import { Input } from '../components/atoms/Input';
import { Button } from '../components/atoms/Button';
import { Search, Filter, Users as UsersIcon, Plus, Mail } from 'lucide-react';
import { ClientWithDocuments } from '../hooks/useClients';

export function Clients() {
  const navigate = useNavigate();
  const { clients, loading, error, addClient, deleteClient } = useClients();
  const toast = useToast();
  const { isSearchOpen, closeSearch, openSearch } = useSearch();
  const [searchQuery, setSearchQuery] = useState('');
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    client: ClientWithDocuments | null;
  }>({
    isOpen: false,
    client: null
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // Listen for dashboard quick action events
  useEffect(() => {
    const handleDashboardAddClient = () => {
      setShowClientDialog(true);
    };

    window.addEventListener('dashboard:add-client', handleDashboardAddClient);
    
    return () => {
      window.removeEventListener('dashboard:add-client', handleDashboardAddClient);
    };
  }, []);

  const handleClientClick = (client: ClientWithDocuments) => {
    navigate(`/clients/${client.id}`);
  };

  const handleCreateClient = async (clientData: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    category: string;
    address?: string;
    taxYear: number;
    entityType: string;
    requiredDocuments: string[];
    entityType: string;
    requiredDocuments: string[];
  }) => {
    setIsCreating(true);
    try {
      await addClient({
        name: clientData.name,
        email: clientData.email,
        phone: clientData.phone,
        address: clientData.address,
        category: clientData.category,
        taxYear: clientData.taxYear,
        entityType: clientData.entityType,
        requiredDocuments: clientData.requiredDocuments
      });
    } catch (error) {
      console.error('Failed to create client:', error);
      toast.error('Failed to create client', error instanceof Error ? error.message : 'An unexpected error occurred');
      throw error; // Re-throw to let the dialog handle the error
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditClient = (client: ClientWithDocuments) => {
    // TODO: Implement edit functionality
    console.log('Edit client:', client.name);
    // For now, just navigate to client detail page
    navigate(`/clients/${client.id}`);
  };

  const handleDeleteClient = (client: ClientWithDocuments) => {
    setDeleteConfirm({
      isOpen: true,
      client
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.client) return;

    setIsDeleting(true);
    try {
      await deleteClient(deleteConfirm.client.id);
      setDeleteConfirm({ isOpen: false, client: null });
      toast.success('Client Deleted', `${deleteConfirm.client.name} has been deleted successfully`);
    } catch (error) {
      console.error('Failed to delete client:', error);
      toast.error('Delete Failed', error instanceof Error ? error.message : 'Failed to delete client');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, client: null });
  };

  const handleSendEmail = (client: ClientWithDocuments) => {
    // Create mailto link with pre-filled subject
    const subject = encodeURIComponent(`Tax Documents Request - ${new Date().getFullYear()}`);
    const body = encodeURIComponent(`Dear ${client.name},\n\nI hope this email finds you well. As we prepare for the upcoming tax season, I wanted to reach out regarding the documents we'll need to complete your ${new Date().getFullYear()} tax return.\n\nPlease let me know if you have any questions or if you'd like to schedule a meeting to discuss your tax situation.\n\nBest regards,\n[Your Name]`);
    
    toast.info('Email Client', `Opening email to ${client.name}`);
    window.open(`mailto:${client.email}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleViewDocuments = (client: ClientWithDocuments) => {
    navigate(`/clients/${client.id}`);
  };
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated">
      <TopBar title="Clients" />

      {/* Global Search */}
      <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />
      
      <div className="max-w-content mx-auto px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Client Management</h1>
            <p className="text-text-secondary mt-1">Manage your client database and tax information</p>
          </div>
          <Button 
            icon={Plus}
            onClick={() => setShowClientDialog(true)}
            className="bg-primary text-gray-900 hover:bg-primary-hover shadow-medium"
          >
            Add New Client
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-700">Error: {error}</p>
          </div>
        )}

        <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 mb-8 shadow-soft">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              variant="secondary" 
              icon={Search} 
              onClick={openSearch}
              className="flex-1"
            >
              Search clients...
            </Button>
            <Button variant="secondary" icon={Filter} className="shrink-0">
              Filter
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-xl">
                <UsersIcon className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-tertiary">Total Clients</p>
                <p className="text-2xl font-semibold text-text-primary">{loading ? '...' : clients.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl">
                <UsersIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-tertiary">Active This Year</p>
                <p className="text-2xl font-semibold text-text-primary">
                  {loading ? '...' : clients.filter(c => c.tax_year === 2025).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-amber-100 to-amber-50 rounded-xl">
                <UsersIcon className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-tertiary">Avg Documents</p>
                <p className="text-2xl font-semibold text-text-primary">
                  {loading ? '...' : Math.round(clients.reduce((acc, c) => acc + c.documentsCount, 0) / clients.length) || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-12" />
            <SkeletonTable rows={5} columns={5} />
          </div>
        ) : (
          filteredClients.length > 0 ? (
            <ClientTable 
              clients={filteredClients} 
              onClientClick={handleClientClick}
              onEditClient={handleEditClient}
              onDeleteClient={handleDeleteClient}
              onSendEmail={handleSendEmail}
              onViewDocuments={handleViewDocuments}
            />
          ) : (
            <EmptyState
              icon={Users}
              title={searchQuery ? "No clients match your search" : "No clients yet"}
              description={searchQuery 
                ? "Try adjusting your search term or clear filters to see all clients" 
                : "Add your first client to get started with managing their tax information"}
              action={{
                label: "Add New Client",
                onClick: () => setShowClientDialog(true),
                icon: Plus
              }}
            />
          )
        )}

        {/* Client Creation Dialog */}
        <ClientDialog
          isOpen={showClientDialog}
          onClose={() => setShowClientDialog(false)}
          onSubmit={handleCreateClient}
          loading={isCreating}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          onClose={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
          title="Delete Client"
          message={`Are you sure you want to delete "${deleteConfirm.client?.name}"? This action will permanently remove the client and all associated data. This cannot be undone.`}
          confirmText="Delete"
          confirmVariant="secondary"
          loading={isDeleting}
        />
      </div>
    </div>
  );
}
