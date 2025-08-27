# TaxOS API Reference

> **Quick reference for all API endpoints, hooks, and utilities**

---

## Quick Navigation

- [Authentication](#authentication)
- [Supabase Edge Functions](#supabase-edge-functions)
- [Database Operations](#database-operations)
- [Custom Hooks](#custom-hooks)
- [Component Props](#component-props)
- [Utility Functions](#utility-functions)

---

## Authentication

### JWT Token Usage
All API calls require authentication via Bearer token:

```typescript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

// Include in headers
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

### User Context
```typescript
// Get current user
const { data: { user } } = await supabase.auth.getUser();

// User object structure
interface User {
  id: string;
  email: string;
  user_metadata: {
    first_name?: string;
    last_name?: string;
    company?: string;
  };
}
```

---

## Supabase Edge Functions

### Base URL
```
https://your-project.supabase.co/functions/v1/
```

### Common Headers
```typescript
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  'apikey': process.env.VITE_SUPABASE_ANON_KEY
};
```

### `/functions/chat`

**POST** `/functions/chat`

**Request:**
```typescript
{
  message: string;                    // Required: User question
  client_id?: string;                 // Optional: Client context
  context_documents?: string[];       // Optional: Document IDs for context
}
```

**Response:**
```typescript
{
  response: string;                   // AI-generated response
  tokens_used: number;               // Token consumption
  context_used: boolean;             // Whether documents were referenced
  sources?: string[];                // Referenced document IDs
}
```

**Example:**
```typescript
const response = await fetch('/functions/v1/chat', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    message: "What are the tax implications of home office expenses?",
    client_id: "uuid-client-id",
    context_documents: ["doc1-uuid", "doc2-uuid"]
  })
});

const data = await response.json();
console.log(data.response); // AI response text
```

**Error Responses:**
- `400`: Missing or invalid message
- `401`: Unauthorized (invalid token)
- `429`: Rate limit exceeded
- `500`: Internal server error

### `/functions/process-document-ai`

**POST** `/functions/process-document-ai`

**Request:**
```typescript
{
  document_id: string;               // Required: Document UUID
  processing_type: 'ocr' | 'analysis' | 'classification';
  options?: {
    extract_entities?: boolean;      // Extract amounts, dates, names
    generate_summary?: boolean;      // Generate AI summary
    detect_tax_forms?: boolean;      // Detect tax form types
    language?: string;              // OCR language (default: 'en')
  };
}
```

**Response:**
```typescript
{
  document_id: string;
  processing_type: string;
  results: {
    ocr_text?: string;              // Extracted text
    ai_summary?: string;            // Generated summary
    document_type?: string;         // Detected document type
    entities?: {
      amounts: Array<{
        value: number;
        currency: string;
        context: string;
      }>;
      dates: Array<{
        date: string;
        format: string;
        context: string;
      }>;
      names: string[];
      addresses: string[];
    };
    confidence_score: number;       // 0-1 confidence
    processing_time_ms: number;
  };
  status: 'completed' | 'failed';
  error?: string;
}
```

**Example:**
```typescript
const response = await fetch('/functions/v1/process-document-ai', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    document_id: "doc-uuid",
    processing_type: "analysis",
    options: {
      extract_entities: true,
      generate_summary: true,
      detect_tax_forms: true
    }
  })
});
```

### `/functions/process-tax`

**POST** `/functions/process-tax`

**Request:**
```typescript
{
  client_id: string;                 // Required: Client UUID
  tax_year: number;                  // Required: Tax year (e.g., 2024)
  form_type: '1040' | '1120' | '1120S' | '1065';
  documents: string[];               // Document UUIDs
  options?: {
    include_deductions?: boolean;
    calculate_estimated_tax?: boolean;
    generate_forms?: boolean;
  };
}
```

**Response:**
```typescript
{
  client_id: string;
  tax_year: number;
  form_type: string;
  calculations: {
    total_income: number;
    total_deductions: number;
    taxable_income: number;
    estimated_tax: number;
    estimated_refund?: number;
  };
  deductions: Array<{
    type: string;
    amount: number;
    description: string;
    supporting_documents: string[];
  }>;
  recommendations: string[];
  forms_generated?: {
    form_1040?: string;             // Base64 PDF
    schedule_a?: string;            // Itemized deductions
    schedule_c?: string;            // Business income
  };
  status: 'completed' | 'failed';
  error?: string;
}
```

### `/functions/send-document-request`

**POST** `/functions/send-document-request`

**Request:**
```typescript
{
  client_id: string;                 // Required: Client UUID
  document_types: string[];          // Required: Document types needed
  due_date: string;                  // Required: ISO date string
  message?: string;                  // Optional: Custom message
  reminder_schedule?: {
    initial_delay_days: number;
    reminder_interval_days: number;
    max_reminders: number;
  };
}
```

**Response:**
```typescript
{
  request_id: string;                // Document request UUID
  client_id: string;
  email_sent: boolean;
  upload_url: string;                // Public upload URL for client
  tracking_token: string;            // For tracking uploads
  expires_at: string;                // ISO date string
  status: 'sent' | 'failed';
  error?: string;
}
```

---

## Database Operations

### Direct Supabase Queries

#### Clients
```typescript
// Get all clients
const { data: clients } = await supabase
  .from('clients')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });

// Get client with documents
const { data: client } = await supabase
  .from('clients')
  .select(`
    *,
    documents (
      id,
      filename,
      document_type,
      created_at
    )
  `)
  .eq('id', clientId)
  .single();

// Create client
const { data: newClient } = await supabase
  .from('clients')
  .insert({
    user_id: userId,
    name: 'John Doe',
    email: 'john@example.com',
    entity_type: 'individual',
    tax_year: 2024
  })
  .select()
  .single();
```

#### Documents
```typescript
// Upload to storage and create record
const { data: file } = await supabase.storage
  .from('documents')
  .upload(`${userId}/${filename}`, fileBlob);

const { data: document } = await supabase
  .from('documents')
  .insert({
    user_id: userId,
    client_id: clientId,
    filename: file.path,
    original_filename: originalName,
    file_size: fileBlob.size,
    mime_type: fileBlob.type,
    document_type: 'receipt',
    storage_path: file.path
  })
  .select()
  .single();

// Get download URL
const { data: { publicUrl } } = supabase.storage
  .from('documents')
  .getPublicUrl(storagePath);
```

#### Tasks
```typescript
// Create task
const { data: task } = await supabase
  .from('tasks')
  .insert({
    user_id: userId,
    client_id: clientId,
    title: 'Review Q1 documents',
    description: 'Check all receipts and invoices',
    task_type: 'review',
    priority: 'high',
    due_date: '2024-04-15T00:00:00Z'
  })
  .select()
  .single();

// Update task status
const { data: updatedTask } = await supabase
  .from('tasks')
  .update({ 
    status: 'completed',
    completed_at: new Date().toISOString()
  })
  .eq('id', taskId)
  .select()
  .single();
```

---

## Custom Hooks

### useAuth()
```typescript
const {
  user,              // User | null
  profile,           // Profile | null  
  session,           // Session | null
  loading,           // boolean
  signIn,            // (email: string, password: string) => Promise<void>
  signUp,            // (email: string, password: string, metadata?: any) => Promise<void>
  signOut,           // () => Promise<void>
  resetPassword,     // (email: string) => Promise<void>
  updateProfile      // (updates: Partial<Profile>) => Promise<void>
} = useAuth();
```

### useClients()
```typescript
const {
  clients,           // Client[]
  loading,           // boolean
  error,             // string | null
  createClient,      // (client: CreateClientData) => Promise<Client>
  updateClient,      // (id: string, updates: Partial<Client>) => Promise<Client>
  deleteClient,      // (id: string) => Promise<void>
  getClient,         // (id: string) => Client | undefined
  refetch            // () => Promise<void>
} = useClients();
```

### useDocuments(options?)
```typescript
const {
  documents,         // Document[]
  loading,           // boolean
  error,             // string | null
  uploadDocument,    // (file: File, options: UploadOptions) => Promise<Document>
  deleteDocument,    // (id: string) => Promise<void>
  processDocument,   // (id: string) => Promise<void>
  searchDocuments    // (query: string) => Promise<Document[]>
} = useDocuments({
  clientId?: string,
  documentType?: DocumentType,
  limit?: number
});
```

### useChat(options?)
```typescript
const {
  messages,          // ChatMessage[]
  loading,           // boolean
  error,             // string | null
  sendMessage,       // (message: string, context?: string[]) => Promise<void>
  clearChat,         // () => void
  exportChat         // () => string
} = useChat({
  clientId?: string,
  maxMessages?: number
});
```

---

## Component Props

### Button
```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

// Usage
<Button variant="primary" size="md" icon={Plus}>
  Add Client
</Button>
```

### Modal
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

// Usage
<Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Edit Client">
  <ClientForm client={selectedClient} />
</Modal>
```

### ClientTable
```typescript
interface ClientTableProps {
  clients: Client[];
  loading?: boolean;
  onClientSelect: (client: Client) => void;
  onClientEdit: (client: Client) => void;
  onClientDelete: (clientId: string) => void;
  selectedClients?: string[];
  onSelectionChange?: (clientIds: string[]) => void;
}
```

---

## Utility Functions

### File Operations
```typescript
// Validate file
const validation = validateFile(file, {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
});

if (!validation.valid) {
  console.error(validation.error);
}

// Generate unique filename
const uniqueName = generateUniqueFilename('document.pdf');
// Returns: "document_1640995200000_abc123.pdf"

// Detect document type
const docType = await detectDocumentType(file);
// Returns: 'receipt' | 'invoice' | 'w2' | etc.
```

### Formatting
```typescript
// Format currency
const formatted = formatCurrency(1234.56);
// Returns: "$1,234.56"

// Format date
const dateStr = formatDate('2024-03-15T10:30:00Z', 'MMM dd, yyyy');
// Returns: "Mar 15, 2024"

// Format file size
const sizeStr = formatFileSize(1048576);
// Returns: "1.0 MB"
```

### Search & Filtering
```typescript
// Build document query with filters
const query = buildDocumentQuery({
  clientId: 'client-uuid',
  documentType: 'receipt',
  dateRange: {
    start: '2024-01-01',
    end: '2024-12-31'
  },
  tags: ['business', 'travel']
});

// Execute query
const { data: documents } = await query;
```

---

## Error Handling

### Common Error Types
```typescript
// Authentication errors
interface AuthError {
  message: string;
  status: 401;
  code: 'UNAUTHORIZED' | 'TOKEN_EXPIRED' | 'INVALID_CREDENTIALS';
}

// Validation errors
interface ValidationError {
  message: string;
  status: 400;
  code: 'VALIDATION_FAILED';
  details: Array<{
    field: string;
    message: string;
  }>;
}

// Server errors
interface ServerError {
  message: string;
  status: 500;
  code: 'INTERNAL_ERROR' | 'DATABASE_ERROR' | 'EXTERNAL_SERVICE_ERROR';
}
```

### Error Handling Pattern
```typescript
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  if (error.status === 401) {
    // Redirect to login
    router.push('/signin');
  } else if (error.status === 400) {
    // Show validation errors
    setFormErrors(error.details);
  } else {
    // Show generic error
    showErrorToast(error.message);
  }
  throw error;
}
```

---

## Rate Limits

### API Endpoints
- **Chat**: 60 requests per minute per user
- **Document Processing**: 20 requests per minute per user
- **File Uploads**: 100 MB per hour per user
- **Database Operations**: 1000 requests per minute per user

### Best Practices
1. Implement exponential backoff for retries
2. Cache responses when appropriate
3. Use debouncing for search inputs
4. Batch operations when possible

---

## Environment Variables

### Required Variables
```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Site URL (for auth redirects)
VITE_SITE_URL=https://your-domain.com

# Optional: Analytics
VITE_ANALYTICS_ID=your-analytics-id
```

### Development Setup
```bash
# Copy environment template
cp .env.example .env.local

# Install dependencies
npm install

# Start development server
npm run dev
```

---

*Last updated: $(date)*