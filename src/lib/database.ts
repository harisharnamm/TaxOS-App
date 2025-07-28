import { supabase } from './supabase';

// Database types based on the schema
export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  category?: string;
  tax_year: number;
  tax_id?: string;
  entity_type: 'individual' | 'llc' | 'corporation' | 's_corp' | 'partnership';
  status: 'active' | 'inactive' | 'archived';
  required_documents?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  client_id?: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  document_type: 'w2' | '1099' | 'receipt' | 'bank_statement' | 'irs_notice' | 'w9' | 'invoice' | 'other';
  storage_path: string;
  ocr_text?: string;
  ai_summary?: string;
  tags?: string[];
  is_processed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vendor {
  id: string;
  user_id: string;
  client_id?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  w9_status: 'missing' | 'pending' | 'completed' | 'expired';
  w9_document_id?: string;
  total_paid: number;
  requires_1099: boolean;
  last_contact_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  client_id?: string;
  role: 'user' | 'assistant';
  content: string;
  context_documents?: string[];
  ai_model?: string;
  tokens_used?: number;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  client_id?: string;
  title: string;
  description?: string;
  task_type: 'general' | 'deadline' | 'follow_up' | 'review' | 'filing';
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date?: string;
  completed_at?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

export interface AIInsight {
  id: string;
  user_id: string;
  client_id?: string;
  insight_type: 'deduction' | 'compliance' | 'optimization' | 'risk' | 'opportunity';
  title: string;
  description: string;
  confidence_score?: number;
  potential_savings?: number;
  status: 'new' | 'reviewed' | 'applied' | 'dismissed';
  source_documents?: string[];
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransaction {
  id: string;
  user_id: string;
  client_id: string;
  vendor_id: string;
  amount: number;
  payment_date: string;
  description?: string;
  category?: string;
  is_deductible: boolean;
  document_id?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentRequest {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  description?: string;
  document_types: string[];
  status: 'pending' | 'partial' | 'complete' | 'overdue';
  due_date: string;
  upload_token: string;
  email_sent: boolean;
  last_reminder_sent?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentRequestItem {
  id: string;
  request_id: string;
  document_name: string;
  status: 'pending' | 'uploaded';
  uploaded_document_id?: string;
  uploaded_at?: string;
  created_at: string;
}

export interface EmailCommunication {
  id: string;
  user_id: string;
  client_id: string;
  request_id?: string;
  resend_message_id: string;
  email_type: 'initial_request' | 'reminder' | 'follow_up';
  recipient_email: string;
  subject: string;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained';
  opened_at?: string;
  clicked_at?: string;
  bounced_at?: string;
  created_at: string;
}

// Client operations
export const clientsApi = {
  async getAll(): Promise<Client[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<Client | null> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async create(client: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Client> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const clientWithUser = {
      ...client,
      user_id: user.id,
      // Ensure all fields are explicitly set to avoid null values
      address: client.address || null,
      entity_type: client.entity_type || 'individual',
      required_documents: client.required_documents || [],
      tax_id: client.tax_id || null,
      notes: client.notes || null
    };
    
    console.log('🔄 Creating client with data:', clientWithUser);
    
    const { data, error } = await supabase
      .from('clients')
      .insert([clientWithUser])
      .select()
      .single();
    
    console.log('✅ Client creation result:', { data, error });
    
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Client>): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async getDocumentCount(clientId: string): Promise<number> {
    const { count, error } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId);
    
    if (error) throw error;
    return count || 0;
  }
};

// Document operations
export const documentsApi = {
  async getAll(): Promise<Document[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getByClientId(clientId: string): Promise<Document[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async create(document: Omit<Document, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Document> {
    const { data, error } = await supabase
      .from('documents')
      .insert([document])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// Vendor operations
export const vendorsApi = {
  async getAll(): Promise<Vendor[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getByClientId(clientId: string): Promise<Vendor[]> {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async create(vendor: Omit<Vendor, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Vendor> {
    const { data, error } = await supabase
      .from('vendors')
      .insert([vendor])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Vendor>): Promise<Vendor> {
    const { data, error } = await supabase
      .from('vendors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// Chat Message operations
export const chatApi = {
  async getMessages(clientId?: string): Promise<ChatMessage[]> {
    let query = supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (clientId) {
      query = query.eq('client_id', clientId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  },

  async createMessage(message: Omit<ChatMessage, 'id' | 'user_id' | 'created_at'>): Promise<ChatMessage> {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([message])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// Task operations
export const tasksApi = {
  async getAll(): Promise<Task[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('due_date', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  async getUpcoming(limit: number = 10): Promise<Task[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'in_progress'])
      .order('due_date', { ascending: true })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  },

  async create(task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .insert([task])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// AI Insights operations
export const aiInsightsApi = {
  async getAll(): Promise<AIInsight[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const { data, error } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getRecent(limit: number = 5): Promise<AIInsight[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const { data, error } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  }
};

// Dashboard statistics
export const dashboardApi = {
  async getStats() {
    const [clients, vendors, tasks] = await Promise.all([
      clientsApi.getAll(),
      vendorsApi.getAll(),
      tasksApi.getAll()
    ]);

    const activeClients = clients.filter(c => c.status === 'active').length;
    const pendingW9s = vendors.filter(v => v.w9_status === 'pending' || v.w9_status === 'missing').length;
    const unresolvedNotices = 0; // No longer tracking IRS notices separately
    const upcomingDeadlines = tasks.filter(t => 
      t.due_date && 
      new Date(t.due_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
      t.status !== 'completed'
    ).length;

    return {
      activeClients,
      pendingW9s,
      unresolvedNotices,
      upcomingDeadlines,
      totalClients: clients.length,
      totalVendors: vendors.length,
      totalNotices: 0, // No longer tracking IRS notices separately
      totalTasks: tasks.length
    };
  }
};

// Document Request operations
export const documentRequests = {
  async getAll(): Promise<DocumentRequest[]> {
    const { data, error } = await supabase
      .from('document_requests')
      .select(`
        *,
        clients!inner(name, email)
      `)
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<DocumentRequest | null> {
    const { data, error } = await supabase
      .from('document_requests')
      .select(`
        *,
        clients!inner(name, email),
        document_request_items(*)
      `)
      .eq('id', id)
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (error) throw error;
    return data;
  },

  async create(request: Omit<DocumentRequest, 'id' | 'user_id' | 'upload_token' | 'email_sent' | 'created_at' | 'updated_at'>): Promise<DocumentRequest> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not authenticated');

    // Generate upload token
    const { data: tokenData } = await supabase.rpc('generate_upload_token');
    const uploadToken = tokenData || crypto.randomUUID();

    const { data, error } = await supabase
      .from('document_requests')
      .insert({
        ...request,
        user_id: user.id,
        upload_token: uploadToken,
        email_sent: false
      })
      .select()
      .single();

    if (error) throw error;

    // Create document request items
    const items = request.document_types.map(docType => ({
      request_id: data.id,
      document_name: docType
    }));

    await supabase
      .from('document_request_items')
      .insert(items);

    return data;
  },

  async update(id: string, updates: Partial<DocumentRequest>): Promise<DocumentRequest> {
    const { data, error } = await supabase
      .from('document_requests')
      .update(updates)
      .eq('id', id)
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('document_requests')
      .delete()
      .eq('id', id)
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

    if (error) throw error;
  }
};

// Email Communication operations
export const emailCommunications = {
  async getAll(): Promise<EmailCommunication[]> {
    const { data, error } = await supabase
      .from('email_communications')
      .select('*')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(communication: Omit<EmailCommunication, 'id' | 'user_id' | 'created_at'>): Promise<EmailCommunication> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('email_communications')
      .insert({
        ...communication,
        user_id: user.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateStatus(messageId: string, status: EmailCommunication['status'], additionalData?: Partial<EmailCommunication>): Promise<void> {
    const updateData: any = { status };
    
    if (status === 'opened' && !additionalData?.opened_at) {
      updateData.opened_at = new Date().toISOString();
    }
    if (status === 'clicked' && !additionalData?.clicked_at) {
      updateData.clicked_at = new Date().toISOString();
    }
    if (status === 'bounced' && !additionalData?.bounced_at) {
      updateData.bounced_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('email_communications')
      .update({ ...updateData, ...additionalData })
      .eq('resend_message_id', messageId);

    if (error) throw error;
  }
};