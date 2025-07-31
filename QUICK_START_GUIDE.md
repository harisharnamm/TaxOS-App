# TaxOS Quick Start Guide

> **Get up and running with TaxOS in minutes**

---

## Prerequisites

- **Node.js** 18+ and npm
- **Supabase** account and project
- **Git** for version control

---

## 🚀 Quick Setup

### 1. Clone and Install
```bash
git clone <repository-url>
cd taxos
npm install
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env.local

# Edit with your Supabase credentials
nano .env.local
```

Required environment variables:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SITE_URL=http://localhost:5173
```

### 3. Database Setup
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Push database migrations
supabase db push
```

### 4. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:5173` to see the application running!

---

## 📚 Essential Concepts

### Authentication Flow
```typescript
import { useAuth } from './hooks/useAuth';

function App() {
  const { user, loading, signIn, signOut } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  
  return user ? (
    <Dashboard onSignOut={signOut} />
  ) : (
    <SignInForm onSignIn={signIn} />
  );
}
```

### Client Management
```typescript
import { useClients } from './hooks/useClients';

function ClientsList() {
  const { clients, createClient, loading } = useClients();
  
  const handleAddClient = async () => {
    await createClient({
      name: 'John Doe',
      email: 'john@example.com',
      entity_type: 'individual',
      tax_year: 2024
    });
  };
  
  return (
    <div>
      <button onClick={handleAddClient}>Add Client</button>
      {clients.map(client => (
        <div key={client.id}>{client.name}</div>
      ))}
    </div>
  );
}
```

### Document Upload
```typescript
import { useDocumentUpload } from './hooks/useDocumentUpload';

function DocumentUpload({ clientId }) {
  const { uploadDocument, uploading, progress } = useDocumentUpload();
  
  const handleFileSelect = async (files) => {
    for (const file of files) {
      await uploadDocument(file, {
        clientId,
        documentType: 'receipt'
      });
    }
  };
  
  return (
    <div>
      <input 
        type="file" 
        multiple 
        onChange={(e) => handleFileSelect(e.target.files)}
      />
      {uploading && <div>Progress: {progress}%</div>}
    </div>
  );
}
```

### AI Chat Integration
```typescript
import { useChat } from './hooks/useChat';

function TaxAssistant({ clientId }) {
  const { messages, sendMessage, loading } = useChat({ clientId });
  const [input, setInput] = useState('');
  
  const handleSend = async () => {
    await sendMessage(input);
    setInput('');
  };
  
  return (
    <div>
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={msg.role}>
            {msg.content}
          </div>
        ))}
      </div>
      <input 
        value={input} 
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
      />
      <button onClick={handleSend} disabled={loading}>
        Send
      </button>
    </div>
  );
}
```

---

## 🛠️ Common Tasks

### Adding a New Page
1. Create component in `src/pages/`
2. Add route in `src/App.tsx`
3. Update navigation in `src/components/organisms/Sidebar.tsx`

```typescript
// src/pages/NewPage.tsx
export function NewPage() {
  return <div>New Page Content</div>;
}

// src/App.tsx
import { NewPage } from './pages/NewPage';

<Route path="/new-page" element={<NewPage />} />
```

### Creating a Custom Hook
```typescript
// src/hooks/useCustomHook.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useCustomHook() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('your_table')
        .select('*');
      setData(data || []);
      setLoading(false);
    }
    
    fetchData();
  }, []);
  
  return { data, loading };
}
```

### Adding a New Component
Follow atomic design principles:

```typescript
// src/components/atoms/NewAtom.tsx
interface NewAtomProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary';
}

export function NewAtom({ children, variant = 'default' }: NewAtomProps) {
  return (
    <div className={`atom-base ${variant}`}>
      {children}
    </div>
  );
}
```

### Database Queries
```typescript
// Direct Supabase query
const { data: clients } = await supabase
  .from('clients')
  .select('*, documents(count)')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });

// Using the database API
import { clientsApi } from '../lib/database';

const clients = await clientsApi.getAll();
const client = await clientsApi.getById(clientId);
```

---

## 🔧 Development Tools

### Useful Scripts
```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # TypeScript checking

# Database
supabase db reset    # Reset local database
supabase db push     # Push migrations
supabase gen types   # Generate TypeScript types
```

### VS Code Extensions
- **ES7+ React/Redux/React-Native snippets**
- **Tailwind CSS IntelliSense**
- **TypeScript Importer**
- **Supabase Snippets**

### Browser DevTools
- **React Developer Tools**
- **Supabase DevTools** (browser extension)
- **Network tab** for API debugging

---

## 🐛 Debugging

### Common Issues

#### Authentication Problems
```typescript
// Check if user is authenticated
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user);

// Check session
const { data: { session } } = await supabase.auth.getSession();
console.log('Current session:', session);
```

#### Database Connection Issues
```typescript
// Test connection
try {
  const { data, error } = await supabase
    .from('clients')
    .select('count')
    .single();
  console.log('Database connected:', !error);
} catch (error) {
  console.error('Database error:', error);
}
```

#### File Upload Problems
```typescript
// Check storage permissions
const { data: buckets } = await supabase.storage.listBuckets();
console.log('Available buckets:', buckets);

// Test upload
const { data, error } = await supabase.storage
  .from('documents')
  .upload('test.txt', new Blob(['test']));
console.log('Upload test:', { data, error });
```

### Debug Mode
```typescript
// Enable debug logging
localStorage.setItem('supabase.debug', 'true');

// Check environment
console.log('Environment:', {
  url: import.meta.env.VITE_SUPABASE_URL,
  hasKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
  mode: import.meta.env.MODE
});
```

---

## 📱 Testing

### Component Testing
```typescript
// src/components/__tests__/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from '../atoms/Button';

test('renders button with text', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

### Hook Testing
```typescript
// src/hooks/__tests__/useAuth.test.ts
import { renderHook } from '@testing-library/react';
import { useAuth } from '../useAuth';

test('useAuth returns initial state', () => {
  const { result } = renderHook(() => useAuth());
  expect(result.current.user).toBeNull();
  expect(result.current.loading).toBe(true);
});
```

### API Testing
```typescript
// Test Edge Functions locally
const response = await fetch('http://localhost:54321/functions/v1/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'Test message'
  })
});
```

---

## 🚀 Deployment

### Build and Deploy
```bash
# Build for production
npm run build

# Deploy to Vercel
npx vercel --prod

# Deploy to Netlify
npm run build && npx netlify deploy --prod --dir=dist
```

### Environment Variables (Production)
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-key
VITE_SITE_URL=https://your-domain.com
```

---

## 📖 Next Steps

1. **Read the [Comprehensive Documentation](./COMPREHENSIVE_DOCUMENTATION.md)** for detailed API reference
2. **Check the [API Reference](./API_REFERENCE.md)** for quick lookups
3. **Explore the codebase** starting with `src/App.tsx`
4. **Join the development team** and contribute!

---

## 🆘 Getting Help

- **Documentation**: Check the comprehensive docs first
- **Code Examples**: Look in the `src/` directory for patterns
- **Issues**: Create GitHub issues for bugs
- **Questions**: Ask in team chat or discussions

---

## 🎯 Key Files to Know

```
src/
├── App.tsx                 # Main app component and routing
├── main.tsx               # App entry point
├── lib/
│   ├── supabase.ts        # Supabase client configuration
│   ├── database.ts        # Database operations
│   └── documentService.ts # Document management
├── hooks/
│   ├── useAuth.ts         # Authentication hook
│   ├── useClients.ts      # Client management
│   └── useDocuments.ts    # Document operations
├── components/
│   ├── atoms/             # Basic UI components
│   ├── molecules/         # Composite components
│   ├── organisms/         # Complex components
│   └── ui/               # Shared UI components
└── pages/                # Page components
```

---

**Happy coding! 🎉**