# TaxOS Comprehensive API Documentation

> **Complete documentation for all public APIs, functions, database components, and UI elements**

---

## Table of Contents
- [Database Structure](#database-structure)
- [API Endpoints](#api-endpoints)
- [React Components](#react-components)
- [Custom Hooks](#custom-hooks)
- [Contexts](#contexts)
- [Utility Functions](#utility-functions)
- [TypeScript Types](#typescript-types)
- [Usage Examples](#usage-examples)

---

## Database Structure

### Core Tables

#### clients
**Purpose**: Stores client information for tax management
| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | uuid | Primary key | NOT NULL, DEFAULT gen_random_uuid() |
| user_id | uuid | References auth.users(id) | NOT NULL, FK |
| name | text | Client full name | NOT NULL |
| email | text | Client email address | NOT NULL |
| phone | text | Client phone number | NULLABLE |
| address | text | Client mailing address | NULLABLE |
| category | text | Client category/type | NULLABLE |
| tax_year | integer | Current tax year | NOT NULL, DEFAULT EXTRACT(year FROM NOW()) |
| tax_id | text | Tax identification number | NULLABLE |
| entity_type | text | Business entity type | NOT NULL, DEFAULT 'individual' |
| status | text | Client status | NOT NULL, DEFAULT 'active' |
| required_documents | text[] | List of required document types | DEFAULT '{}' |
| notes | text | Additional notes | NULLABLE |
| created_at | timestamptz | Creation timestamp | NOT NULL, DEFAULT NOW() |
| updated_at | timestamptz | Last update timestamp | NOT NULL, DEFAULT NOW() |

**Enums**:
- `entity_type`: 'individual', 'llc', 'corporation', 's_corp', 'partnership'
- `status`: 'active', 'inactive', 'archived'

#### documents
**Purpose**: Stores uploaded documents and their metadata
| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | uuid | Primary key | NOT NULL, DEFAULT gen_random_uuid() |
| user_id | uuid | References auth.users(id) | NOT NULL, FK |
| client_id | uuid | References clients(id) | NULLABLE, FK |
| filename | text | Storage filename | NOT NULL |
| original_filename | text | Original filename | NOT NULL |
| file_size | bigint | File size in bytes | NOT NULL |
| mime_type | text | MIME type | NOT NULL |
| document_type | text | Document category | NOT NULL |
| storage_path | text | Storage bucket path | NOT NULL |
| ocr_text | text | Extracted text content | NULLABLE |
| ai_summary | text | AI-generated summary | NULLABLE |
| tags | text[] | Document tags | DEFAULT '{}' |
| is_processed | boolean | Processing status | NOT NULL, DEFAULT false |
| created_at | timestamptz | Creation timestamp | NOT NULL, DEFAULT NOW() |
| updated_at | timestamptz | Last update timestamp | NOT NULL, DEFAULT NOW() |

**Enums**:
- `document_type`: 'w2', '1099', 'receipt', 'bank_statement', 'irs_notice', 'w9', 'invoice', 'other'

#### vendors
**Purpose**: Manages vendor information and 1099 tracking
| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | uuid | Primary key | NOT NULL, DEFAULT gen_random_uuid() |
| user_id | uuid | References auth.users(id) | NOT NULL, FK |
| client_id | uuid | References clients(id) | NULLABLE, FK |
| name | text | Vendor name | NOT NULL |
| email | text | Vendor email | NULLABLE |
| phone | text | Vendor phone | NULLABLE |
| address | text | Vendor address | NULLABLE |
| tax_id | text | Vendor tax ID/EIN | NULLABLE |
| w9_status | text | W-9 form status | NOT NULL, DEFAULT 'missing' |
| w9_document_id | uuid | References documents(id) | NULLABLE, FK |
| total_paid | numeric(10,2) | Total amount paid | NOT NULL, DEFAULT 0 |
| requires_1099 | boolean | Needs 1099 form | NOT NULL, DEFAULT false |
| last_contact_date | timestamptz | Last contact date | NULLABLE |
| notes | text | Additional notes | NULLABLE |
| created_at | timestamptz | Creation timestamp | NOT NULL, DEFAULT NOW() |
| updated_at | timestamptz | Last update timestamp | NOT NULL, DEFAULT NOW() |

**Enums**:
- `w9_status`: 'missing', 'pending', 'completed', 'expired'

#### tasks
**Purpose**: Task management and workflow tracking
| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | uuid | Primary key | NOT NULL, DEFAULT gen_random_uuid() |
| user_id | uuid | References auth.users(id) | NOT NULL, FK |
| client_id | uuid | References clients(id) | NULLABLE, FK |
| title | text | Task title | NOT NULL |
| description | text | Task description | NULLABLE |
| task_type | text | Task category | NOT NULL, DEFAULT 'general' |
| priority | text | Task priority | NOT NULL, DEFAULT 'medium' |
| status | text | Task status | NOT NULL, DEFAULT 'pending' |
| due_date | timestamptz | Due date | NULLABLE |
| completed_at | timestamptz | Completion timestamp | NULLABLE |
| assigned_to | uuid | References auth.users(id) | NULLABLE, FK |
| created_at | timestamptz | Creation timestamp | NOT NULL, DEFAULT NOW() |
| updated_at | timestamptz | Last update timestamp | NOT NULL, DEFAULT NOW() |

**Enums**:
- `task_type`: 'general', 'deadline', 'follow_up', 'review', 'filing'
- `priority`: 'low', 'medium', 'high'
- `status`: 'pending', 'in_progress', 'completed', 'cancelled'

#### chat_messages
**Purpose**: AI chat conversation history
| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | uuid | Primary key | NOT NULL, DEFAULT gen_random_uuid() |
| user_id | uuid | References auth.users(id) | NOT NULL, FK |
| client_id | uuid | References clients(id) | NULLABLE, FK |
| role | text | Message role | NOT NULL |
| content | text | Message content | NOT NULL |
| context_documents | uuid[] | Related document IDs | DEFAULT '{}' |
| ai_model | text | AI model used | NULLABLE |
| tokens_used | integer | Token count | NULLABLE |
| created_at | timestamptz | Creation timestamp | NOT NULL, DEFAULT NOW() |

**Enums**:
- `role`: 'user', 'assistant'

### Database Operations API

#### clientsApi
**Purpose**: CRUD operations for client management

```typescript
// Get all clients for authenticated user
async getAll(): Promise<Client[]>

// Get client by ID
async getById(id: string): Promise<Client | null>

// Create new client
async create(client: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Client>

// Update existing client
async update(id: string, updates: Partial<Client>): Promise<Client>

// Delete client (soft delete)
async delete(id: string): Promise<void>

// Get client statistics
async getStats(): Promise<{
  total: number;
  active: number;
  inactive: number;
  byEntityType: Record<string, number>;
}>
```

#### documentsApi
**Purpose**: Document management operations

```typescript
// Get all documents
async getAll(filters?: DocumentFilters): Promise<Document[]>

// Get document by ID
async getById(id: string): Promise<Document | null>

// Get documents by client
async getByClient(clientId: string): Promise<Document[]>

// Create document record
async create(document: CreateDocumentData): Promise<Document>

// Update document
async update(id: string, updates: Partial<Document>): Promise<Document>

// Delete document
async delete(id: string): Promise<void>

// Search documents
async search(query: string): Promise<Document[]>
```

---

## API Endpoints

### Supabase Edge Functions

#### `/functions/chat`
**Purpose**: AI-powered chat assistant for tax questions

**Method**: POST  
**Authentication**: Required (Bearer token)

**Request Body**:
```typescript
interface ChatRequest {
  message: string;           // User message
  client_id?: string;        // Optional client context
  context_documents?: string[]; // Optional document context
}
```

**Response**:
```typescript
interface ChatResponse {
  response: string;          // AI response
  tokens_used: number;       // Token consumption
  context_used: boolean;     // Whether documents were used
}
```

**Usage Example**:
```typescript
const response = await supabase.functions.invoke('chat', {
  body: {
    message: "What deductions can I claim for my home office?",
    client_id: "client-uuid",
    context_documents: ["doc1-uuid", "doc2-uuid"]
  }
});
```

#### `/functions/process-document-ai`
**Purpose**: AI-powered document processing and analysis

**Method**: POST  
**Authentication**: Required (Bearer token)

**Request Body**:
```typescript
interface ProcessDocumentRequest {
  document_id: string;       // Document to process
  processing_type: 'ocr' | 'analysis' | 'classification';
  options?: {
    extract_entities?: boolean;
    generate_summary?: boolean;
    detect_tax_forms?: boolean;
  };
}
```

**Response**:
```typescript
interface ProcessDocumentResponse {
  document_id: string;
  ocr_text?: string;
  ai_summary?: string;
  document_type?: string;
  entities?: {
    amounts: number[];
    dates: string[];
    names: string[];
  };
  confidence_score: number;
}
```

#### `/functions/process-tax`
**Purpose**: Tax calculation and form processing

**Method**: POST  
**Authentication**: Required (Bearer token)

**Request Body**:
```typescript
interface ProcessTaxRequest {
  client_id: string;
  tax_year: number;
  form_type: '1040' | '1120' | '1120S' | '1065';
  documents: string[];       // Document IDs
}
```

#### `/functions/send-document-request`
**Purpose**: Send document requests to clients via email

**Method**: POST  
**Authentication**: Required (Bearer token)

**Request Body**:
```typescript
interface DocumentRequestPayload {
  client_id: string;
  document_types: string[];
  due_date: string;
  message?: string;
}
```

---

## React Components

### Atomic Design Structure

#### Atoms (Basic UI Elements)

##### Button
**Purpose**: Reusable button component with variants

**Props**:
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  children?: React.ReactNode;
}
```

**Usage**:
```tsx
<Button variant="primary" size="md" icon={Plus} onClick={handleClick}>
  Add Client
</Button>
```

##### Input
**Purpose**: Styled input field with validation support

**Props**:
```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}
```

##### Badge
**Purpose**: Status indicators and labels

**Props**:
```typescript
interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md';
  children: React.ReactNode;
}
```

##### StatCard
**Purpose**: Dashboard statistics display

**Props**:
```typescript
interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: LucideIcon;
}
```

#### Molecules (Component Combinations)

##### GlobalSearch
**Purpose**: Application-wide search functionality

**Props**:
```typescript
interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**Features**:
- Debounced search
- Keyboard navigation
- Recent searches
- Multi-type results (clients, documents, tasks)

##### Modal
**Purpose**: Generic modal wrapper

**Props**:
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}
```

##### Breadcrumb
**Purpose**: Navigation breadcrumb trail

**Props**:
```typescript
interface BreadcrumbProps {
  items: Array<{
    label: string;
    href?: string;
    current?: boolean;
  }>;
}
```

#### Organisms (Complex Components)

##### ClientTable
**Purpose**: Comprehensive client management table

**Props**:
```typescript
interface ClientTableProps {
  clients: Client[];
  loading?: boolean;
  onClientSelect: (client: Client) => void;
  onClientEdit: (client: Client) => void;
  onClientDelete: (clientId: string) => void;
}
```

**Features**:
- Sorting and filtering
- Bulk actions
- Status indicators
- Export functionality

##### Sidebar
**Purpose**: Main application navigation

**Props**:
```typescript
interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}
```

##### TopBar
**Purpose**: Application header with user controls

**Props**:
```typescript
interface TopBarProps {
  user: User;
  onProfileClick: () => void;
  onSettingsClick: () => void;
  onSignOut: () => void;
}
```

### Page Components

#### Dashboard
**Purpose**: Main dashboard with overview statistics

**Features**:
- Real-time statistics
- Recent activity
- Quick actions
- AI insights

#### ClientDetail
**Purpose**: Comprehensive client management interface

**Features**:
- Client information editing
- Document management
- Task tracking
- Communication history
- Tax year management

#### DocumentManagement
**Purpose**: Document upload, organization, and processing

**Features**:
- Drag-and-drop upload
- Document preview
- AI processing
- Bulk operations
- Search and filtering

---

## Custom Hooks

### Authentication Hooks

#### useAuth
**Purpose**: Authentication state and operations

**Returns**:
```typescript
interface UseAuthReturn {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, metadata?: any) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}
```

**Usage**:
```tsx
const { user, loading, signIn, signOut } = useAuth();

if (loading) return <LoadingSpinner />;
if (!user) return <SignInForm onSignIn={signIn} />;
```

### Data Management Hooks

#### useClients
**Purpose**: Client data management

**Returns**:
```typescript
interface UseClientsReturn {
  clients: Client[];
  loading: boolean;
  error: string | null;
  createClient: (client: CreateClientData) => Promise<Client>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<Client>;
  deleteClient: (id: string) => Promise<void>;
  getClient: (id: string) => Client | undefined;
  refetch: () => Promise<void>;
}
```

#### useDocuments
**Purpose**: Document management operations

**Parameters**:
```typescript
interface UseDocumentsOptions {
  clientId?: string;
  documentType?: DocumentType;
  limit?: number;
}
```

**Returns**:
```typescript
interface UseDocumentsReturn {
  documents: Document[];
  loading: boolean;
  error: string | null;
  uploadDocument: (file: File, options: UploadOptions) => Promise<Document>;
  deleteDocument: (id: string) => Promise<void>;
  processDocument: (id: string) => Promise<void>;
  searchDocuments: (query: string) => Promise<Document[]>;
}
```

#### useTasks
**Purpose**: Task management functionality

**Returns**:
```typescript
interface UseTasksReturn {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  createTask: (task: CreateTaskData) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  completeTask: (id: string) => Promise<Task>;
  getTasksByClient: (clientId: string) => Task[];
  getOverdueTasks: () => Task[];
}
```

### Utility Hooks

#### useGlobalSearch
**Purpose**: Application-wide search functionality

**Returns**:
```typescript
interface UseGlobalSearchReturn {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  search: (query: string) => Promise<SearchResult[]>;
  recentSearches: string[];
  clearRecentSearches: () => void;
}
```

#### useDocumentProcessing
**Purpose**: Document AI processing

**Returns**:
```typescript
interface UseDocumentProcessingReturn {
  processDocument: (documentId: string, options?: ProcessingOptions) => Promise<ProcessingResult>;
  processing: boolean;
  progress: number;
  error: string | null;
}
```

#### useChat
**Purpose**: AI chat functionality

**Parameters**:
```typescript
interface UseChatOptions {
  clientId?: string;
  maxMessages?: number;
}
```

**Returns**:
```typescript
interface UseChatReturn {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  sendMessage: (message: string, context?: string[]) => Promise<void>;
  clearChat: () => void;
  exportChat: () => string;
}
```

---

## Contexts

### AuthContext
**Purpose**: Global authentication state management

**Provider Props**:
```typescript
interface AuthContextProviderProps {
  children: React.ReactNode;
}
```

**Context Value**:
```typescript
interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, metadata?: any) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}
```

**Usage**:
```tsx
// Provider setup
<AuthContextProvider>
  <App />
</AuthContextProvider>

// Consumer usage
const { user, signOut } = useAuthContext();
```

---

## Utility Functions

### Document Services

#### DocumentService
**Purpose**: Comprehensive document management

**Methods**:
```typescript
class DocumentService {
  // Upload document with progress tracking
  async uploadDocument(
    file: File,
    userId: string,
    options: DocumentUploadOptions,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{ data: Document | null; error: any }>;

  // Process document with AI
  async processDocument(
    documentId: string,
    processingType: ProcessingType
  ): Promise<ProcessingResult>;

  // Generate download URL
  async getDownloadUrl(storagePath: string): Promise<string>;

  // Delete document and storage
  async deleteDocument(documentId: string): Promise<void>;
}
```

### Upload Utilities

#### File Validation
```typescript
// Validate file type and size
function validateFile(file: File, options?: ValidationOptions): {
  valid: boolean;
  error?: string;
}

// Generate unique filename
function generateUniqueFilename(originalFilename: string): string;

// Detect document type from content
function detectDocumentType(file: File): Promise<DocumentType>;

// Compress image files
function compressImageFile(file: File, options?: CompressionOptions): Promise<File>;
```

### Database Utilities

#### Query Builders
```typescript
// Build filtered query for documents
function buildDocumentQuery(filters: DocumentFilters): PostgrestFilterBuilder;

// Build client search query
function buildClientSearchQuery(searchTerm: string): PostgrestFilterBuilder;

// Build task query with sorting
function buildTaskQuery(options: TaskQueryOptions): PostgrestFilterBuilder;
```

#### Data Transformers
```typescript
// Transform database row to typed object
function transformClient(row: any): Client;
function transformDocument(row: any): Document;
function transformTask(row: any): Task;

// Format currency values
function formatCurrency(amount: number): string;

// Format dates for display
function formatDate(date: string | Date, format?: string): string;
```

---

## TypeScript Types

### Core Data Types

```typescript
// Client entity
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

// Document entity
export interface Document {
  id: string;
  user_id: string;
  client_id?: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  document_type: DocumentType;
  storage_path: string;
  ocr_text?: string;
  ai_summary?: string;
  tags?: string[];
  is_processed: boolean;
  created_at: string;
  updated_at: string;
}

// Task entity
export interface Task {
  id: string;
  user_id: string;
  client_id?: string;
  title: string;
  description?: string;
  task_type: TaskType;
  priority: Priority;
  status: TaskStatus;
  due_date?: string;
  completed_at?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}
```

### Enum Types

```typescript
export type DocumentType = 
  | 'w2' 
  | '1099' 
  | 'receipt' 
  | 'bank_statement' 
  | 'irs_notice' 
  | 'w9' 
  | 'invoice' 
  | 'other';

export type TaskType = 
  | 'general' 
  | 'deadline' 
  | 'follow_up' 
  | 'review' 
  | 'filing';

export type Priority = 'low' | 'medium' | 'high';

export type TaskStatus = 
  | 'pending' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled';

export type EntityType = 
  | 'individual' 
  | 'llc' 
  | 'corporation' 
  | 's_corp' 
  | 'partnership';
```

### API Types

```typescript
// Upload options
export interface DocumentUploadOptions {
  clientId?: string;
  documentType?: DocumentType;
  tags?: string[];
  processImmediately?: boolean;
}

// Upload progress
export interface UploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

// Search result
export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  description?: string;
  date?: string;
  url: string;
  metadata?: Record<string, any>;
}

export type SearchResultType = 
  | 'client' 
  | 'document' 
  | 'task' 
  | 'vendor' 
  | 'irs_notice';
```

---

## Usage Examples

### Client Management

#### Creating a New Client
```tsx
import { useClients } from '../hooks/useClients';

function CreateClientForm() {
  const { createClient, loading } = useClients();

  const handleSubmit = async (formData: CreateClientData) => {
    try {
      const newClient = await createClient({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        entity_type: formData.entityType,
        tax_year: 2024,
        status: 'active'
      });
      
      console.log('Client created:', newClient);
      // Redirect or show success message
    } catch (error) {
      console.error('Failed to create client:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

#### Fetching and Displaying Clients
```tsx
import { useClients } from '../hooks/useClients';
import { ClientTable } from '../components/organisms/ClientTable';

function ClientsPage() {
  const { clients, loading, error, deleteClient } = useClients();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      <h1>Clients</h1>
      <ClientTable 
        clients={clients}
        onClientDelete={deleteClient}
        onClientSelect={(client) => navigate(`/clients/${client.id}`)}
      />
    </div>
  );
}
```

### Document Management

#### Document Upload with Progress
```tsx
import { useDocumentUpload } from '../hooks/useDocumentUpload';

function DocumentUpload({ clientId }: { clientId: string }) {
  const { uploadDocument, progress, uploading } = useDocumentUpload();

  const handleFileUpload = async (files: File[]) => {
    for (const file of files) {
      try {
        const document = await uploadDocument(file, {
          clientId,
          documentType: 'receipt',
          processImmediately: true
        });
        
        console.log('Document uploaded:', document);
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }
  };

  return (
    <div>
      <FileDropzone onFilesSelected={handleFileUpload} />
      {uploading && (
        <ProgressBar value={progress} />
      )}
    </div>
  );
}
```

### AI Chat Integration

#### Chat Interface
```tsx
import { useChat } from '../hooks/useChat';

function AITaxAssistant({ clientId }: { clientId?: string }) {
  const { messages, sendMessage, loading } = useChat({ clientId });
  const [input, setInput] = useState('');

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    try {
      await sendMessage(input);
      setInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            {message.content}
          </div>
        ))}
      </div>
      
      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Ask a tax question..."
        />
        <Button onClick={handleSendMessage} disabled={loading}>
          Send
        </Button>
      </div>
    </div>
  );
}
```

### Global Search

#### Search Implementation
```tsx
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import { GlobalSearch } from '../components/molecules/GlobalSearch';

function App() {
  const [searchOpen, setSearchOpen] = useState(false);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, []);

  return (
    <div>
      {/* Main app content */}
      
      <GlobalSearch 
        isOpen={searchOpen} 
        onClose={() => setSearchOpen(false)} 
      />
    </div>
  );
}
```

### Task Management

#### Creating and Managing Tasks
```tsx
import { useTasks } from '../hooks/useTasks';

function TaskManager({ clientId }: { clientId?: string }) {
  const { tasks, createTask, updateTask, completeTask } = useTasks();

  const handleCreateTask = async (taskData: CreateTaskData) => {
    try {
      const task = await createTask({
        ...taskData,
        client_id: clientId,
        priority: 'medium',
        status: 'pending'
      });
      
      console.log('Task created:', task);
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await completeTask(taskId);
      console.log('Task completed');
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  return (
    <div>
      <TaskForm onSubmit={handleCreateTask} />
      <TaskList 
        tasks={tasks}
        onComplete={handleCompleteTask}
        onUpdate={updateTask}
      />
    </div>
  );
}
```

### Error Handling

#### Global Error Boundary
```tsx
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="error-container">
      <h2>Something went wrong:</h2>
      <pre>{error.message}</pre>
      <Button onClick={resetErrorBoundary}>Try again</Button>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AuthContextProvider>
        <Router>
          <Routes>
            {/* Your routes */}
          </Routes>
        </Router>
      </AuthContextProvider>
    </ErrorBoundary>
  );
}
```

---

## Best Practices

### Performance Optimization

1. **React Query/SWR**: Use for server state management
2. **Memoization**: Use `useMemo` and `useCallback` for expensive operations
3. **Lazy Loading**: Implement code splitting for large components
4. **Virtual Scrolling**: For large lists and tables

### Security

1. **Authentication**: Always verify user authentication
2. **Authorization**: Implement row-level security (RLS) in Supabase
3. **Input Validation**: Validate all inputs on both client and server
4. **File Upload**: Validate file types and sizes

### Code Organization

1. **Atomic Design**: Follow the established component hierarchy
2. **Custom Hooks**: Extract reusable logic into custom hooks
3. **Type Safety**: Use TypeScript strictly with proper typing
4. **Error Handling**: Implement comprehensive error boundaries

---

*This documentation is automatically generated and should be kept up-to-date with code changes.*
