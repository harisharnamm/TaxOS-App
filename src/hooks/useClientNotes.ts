import { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../contexts/AuthContext';

export interface ClientNote {
  id: string;
  client_id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  created_at: string;
  updated_at: string;
}

export function useClientNotes(clientId: string) {
  const { user } = useAuthContext();
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock data for demonstration - in a real app, this would come from the database
  const mockNotes: ClientNote[] = [
    {
      id: '1',
      client_id: clientId,
      user_id: user?.id || '',
      title: 'Initial Client Meeting',
      content: 'Met with client to discuss their tax situation for 2024. They mentioned significant business expenses and potential deductions for home office. Need to follow up on documentation for business meals and travel expenses.',
      category: 'meeting',
      priority: 'medium',
      tags: ['initial-meeting', 'deductions', 'business-expenses'],
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      client_id: clientId,
      user_id: user?.id || '',
      title: 'Tax Planning Strategy',
      content: 'Recommended maximizing retirement contributions before year-end. Client is eligible for additional $7,500 catch-up contribution. Also discussed potential Roth conversion strategy for 2025.',
      category: 'tax_planning',
      priority: 'high',
      tags: ['retirement', 'roth-conversion', 'year-end-planning'],
      created_at: '2024-02-10T14:15:00Z',
      updated_at: '2024-02-10T14:15:00Z'
    },
    {
      id: '3',
      client_id: clientId,
      user_id: user?.id || '',
      title: 'Document Review',
      content: 'Reviewed all submitted documents. Missing 1099-MISC from consulting work. Client confirmed they will provide by end of week. All other documents look complete.',
      category: 'document',
      priority: 'medium',
      tags: ['document-review', '1099-misc', 'consulting'],
      created_at: '2024-03-05T09:45:00Z',
      updated_at: '2024-03-05T09:45:00Z'
    }
  ];

  const fetchNotes = useCallback(async () => {
    if (!user || !clientId) return;

    setLoading(true);
    setError(null);

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Filter mock notes for this client
      const clientNotes = mockNotes.filter(note => note.client_id === clientId);
      setNotes(clientNotes);
    } catch (err: any) {
      console.error('Error fetching notes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, clientId]);

  const createNote = useCallback(async (noteData: {
    title: string;
    content: string;
    category: string;
    priority: 'low' | 'medium' | 'high';
    tags: string[];
  }) => {
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newNote: ClientNote = {
        id: Math.random().toString(36).substring(2, 9),
        client_id: clientId,
        user_id: user.id,
        title: noteData.title,
        content: noteData.content,
        category: noteData.category,
        priority: noteData.priority,
        tags: noteData.tags,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      setNotes(prev => [newNote, ...prev]);
      return { success: true, data: newNote };
    } catch (err: any) {
      console.error('Error creating note:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [user, clientId]);

  const updateNote = useCallback(async (
    noteId: string,
    noteData: {
      title: string;
      content: string;
      category: string;
      priority: 'low' | 'medium' | 'high';
      tags: string[];
    }
  ) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setNotes(prev => prev.map(note => 
        note.id === noteId 
          ? { 
              ...note, 
              ...noteData,
              updated_at: new Date().toISOString()
            } 
          : note
      ));
      
      return { success: true };
    } catch (err: any) {
      console.error('Error updating note:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  const deleteNote = useCallback(async (noteId: string) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setNotes(prev => prev.filter(note => note.id !== noteId));
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting note:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  // Load notes on mount
  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  return {
    notes,
    loading,
    error,
    createNote,
    updateNote,
    deleteNote,
    refreshNotes: fetchNotes,
    setError,
  };
}