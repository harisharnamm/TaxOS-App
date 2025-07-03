import { useState, useEffect } from 'react';
import { clientsApi, Client } from '../lib/database';
import { useAuthContext } from '../contexts/AuthContext';
import { testSupabaseConnection } from '../lib/supabase';

export interface ClientWithDocuments extends Client {
  documentsCount: number;
}

export function useClients() {
  const { user, loading: authLoading } = useAuthContext();
  const [clients, setClients] = useState<ClientWithDocuments[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Clients: Starting data fetch...');
      console.log('🔄 Clients: User authenticated:', user?.email);
      
      // Test connection first
      const connectionTest = await testSupabaseConnection();
      if (!connectionTest.success) {
        throw new Error(connectionTest.error || 'Connection test failed');
      }
      
      const clientsData = await clientsApi.getAll();
      
      console.log('✅ Clients: Found', clientsData?.length, 'clients', clientsData);
      
      // Get document counts for each client
      const clientsWithCounts = await Promise.all(
        clientsData.map(async (client) => {
          try {
            const documentsCount = await clientsApi.getDocumentCount(client.id);
            return {
              ...client,
              documentsCount
            };
          } catch (err) {
            console.warn('Failed to get document count for client', client.id, err);
            return {
              ...client,
              documentsCount: 0
            };
          }
        })
      );
      
      console.log('✅ Clients: Data processed successfully', clientsWithCounts);
      setClients(clientsWithCounts);
    } catch (err) {
      console.error('❌ Clients: Error fetching data:', err);
      
      let errorMessage = 'Failed to fetch clients';
      if (err instanceof Error) {
        if (err.message.includes('Network error')) {
          errorMessage = 'Cannot connect to the server. Please check your internet connection and try again.';
        } else if (err.message.includes('User not authenticated')) {
          errorMessage = 'Please sign in to view your clients.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch data when authentication is complete and user exists
    if (!authLoading && user) {
      console.log('🔄 Clients: Auth complete, starting data fetch');
      fetchClients();
    } else if (!authLoading && !user) {
      console.log('❌ Clients: No authenticated user');
      setError('Please sign in to view clients data');
      setLoading(false);
    } else {
      console.log('⏳ Clients: Waiting for authentication...', { authLoading, hasUser: !!user });
    }
  }, [authLoading, user]);

  const addClient = async (clientData: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    taxYear: number;
    entityType: string;
    requiredDocuments: string[];
  }) => {
    try {
      console.log('🔄 Adding client with data:', clientData);
      
      // Ensure all fields are properly mapped
      const newClient = await clientsApi.create({
        name: clientData.name,
        email: clientData.email,
        phone: clientData.phone,
        address: clientData.address,
        entity_type: clientData.entityType as Client['entity_type'],
        required_documents: clientData.requiredDocuments,
        tax_year: clientData.taxYear,
        status: 'active',
        tax_id: null,
        notes: null
      });
      
      console.log('✅ Client created successfully:', newClient);
      
      // Add to local state with 0 documents
      setClients(prev => [{
        ...newClient,
        documentsCount: 0
      }, ...prev]);
      
      return newClient;
    } catch (err) {
      console.error('Error adding client:', err);
      throw err;
    }
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    try {
      const updatedClient = await clientsApi.update(id, updates);
      
      setClients(prev => prev.map(client => 
        client.id === id 
          ? { ...updatedClient, documentsCount: client.documentsCount }
          : client
      ));
      
      return updatedClient;
    } catch (err) {
      console.error('Error updating client:', err);
      throw err;
    }
  };

  const deleteClient = async (id: string) => {
    try {
      await clientsApi.delete(id);
      setClients(prev => prev.filter(client => client.id !== id));
    } catch (err) {
      console.error('Error deleting client:', err);
      throw err;
    }
  };

  const refreshClients = () => {
    fetchClients();
  };

  return {
    clients,
    loading,
    error,
    addClient,
    updateClient,
    deleteClient,
    refreshClients
  };
}