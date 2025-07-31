# TaxOS - AI-Powered Tax Management Platform

> **A comprehensive tax management solution built with React, TypeScript, and Supabase**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Latest-00C896.svg)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-38B2AC.svg)](https://tailwindcss.com/)

---

## 🚀 Quick Start

```bash
# Clone and install
git clone <repository-url>
cd taxos
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start development server
npm run dev
```

**📖 [Full Quick Start Guide](./QUICK_START_GUIDE.md)**

---

## 📋 Overview

TaxOS is a modern, AI-powered tax management platform designed for CPAs and tax professionals. It provides comprehensive client management, document processing, AI-assisted tax advice, and automated workflow management.

### ✨ Key Features

- **🤖 AI Tax Assistant** - GPT-powered chat for tax questions and advice
- **📄 Smart Document Processing** - OCR and AI analysis of tax documents
- **👥 Client Management** - Comprehensive client profiles and communication
- **📊 Dashboard Analytics** - Real-time insights and statistics
- **🔄 Task Management** - Automated workflows and deadline tracking
- **📧 Email Integration** - Document requests and client communication
- **🔍 Global Search** - Find clients, documents, and tasks instantly
- **📱 Responsive Design** - Works seamlessly on all devices

---

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **AI/ML**: OpenAI GPT, Document AI processing
- **Build Tool**: Vite
- **Deployment**: Vercel/Netlify

### Project Structure
```
src/
├── components/          # UI components (Atomic Design)
│   ├── atoms/          # Basic UI elements
│   ├── molecules/      # Composite components
│   ├── organisms/      # Complex components
│   └── ui/            # Shared UI library
├── hooks/              # Custom React hooks
├── lib/               # Utilities and services
├── pages/             # Page components
├── contexts/          # React contexts
└── types/            # TypeScript definitions

supabase/
├── functions/         # Edge Functions (API)
├── migrations/       # Database migrations
└── .temp/           # Generated files
```

---

## 📚 Documentation

### 📖 Main Documentation
- **[Comprehensive Documentation](./COMPREHENSIVE_DOCUMENTATION.md)** - Complete API and component reference
- **[API Reference](./API_REFERENCE.md)** - Quick reference for all APIs and hooks
- **[Quick Start Guide](./QUICK_START_GUIDE.md)** - Get up and running in minutes

### 🔧 Additional Guides
- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** - Production deployment instructions
- **[Security Review](./security_review.md)** - Security considerations and best practices
- **[Mobile Optimization](./MOBILE_OPTIMIZATION_REPORT.md)** - Mobile-specific features and optimizations

---

## 🎯 Core Features

### Client Management
```typescript
import { useClients } from './hooks/useClients';

const { clients, createClient, updateClient } = useClients();

// Create a new client
await createClient({
  name: 'John Doe',
  email: 'john@example.com',
  entity_type: 'individual',
  tax_year: 2024
});
```

### Document Processing
```typescript
import { useDocumentUpload } from './hooks/useDocumentUpload';

const { uploadDocument } = useDocumentUpload();

// Upload and process document
await uploadDocument(file, {
  clientId: 'client-uuid',
  documentType: 'receipt',
  processImmediately: true
});
```

### AI Chat Integration
```typescript
import { useChat } from './hooks/useChat';

const { messages, sendMessage } = useChat({ clientId });

// Ask tax questions
await sendMessage("What deductions can I claim for home office expenses?");
```

---

## 🔌 API Endpoints

### Supabase Edge Functions

#### Chat Assistant
```bash
POST /functions/v1/chat
```
AI-powered tax assistant for answering questions and providing advice.

#### Document Processing  
```bash
POST /functions/v1/process-document-ai
```
OCR and AI analysis of uploaded documents.

#### Tax Processing
```bash
POST /functions/v1/process-tax
```
Tax calculations and form generation.

#### Document Requests
```bash
POST /functions/v1/send-document-request
```
Send document request emails to clients.

**📋 [Complete API Reference](./API_REFERENCE.md)**

---

## 🗄️ Database Schema

### Core Tables
- **`clients`** - Client information and profiles
- **`documents`** - Uploaded documents and metadata
- **`tasks`** - Task management and workflows
- **`chat_messages`** - AI chat conversation history
- **`vendors`** - Vendor management for 1099 tracking
- **`payment_transactions`** - Financial transaction records

**🔍 [Full Database Documentation](./COMPREHENSIVE_DOCUMENTATION.md#database-structure)**

---

## 🧩 Component Library

### Atomic Design System
- **Atoms**: Button, Input, Badge, StatCard
- **Molecules**: Modal, GlobalSearch, Breadcrumb
- **Organisms**: ClientTable, Sidebar, TopBar
- **Pages**: Dashboard, ClientDetail, DocumentManagement

### Example Usage
```tsx
import { Button } from './components/atoms/Button';
import { Modal } from './components/molecules/Modal';
import { ClientTable } from './components/organisms/ClientTable';

<Modal isOpen={showModal} onClose={() => setShowModal(false)}>
  <ClientTable 
    clients={clients}
    onClientSelect={handleClientSelect}
  />
</Modal>
```

**🎨 [Component Documentation](./COMPREHENSIVE_DOCUMENTATION.md#react-components)**

---

## 🪝 Custom Hooks

### Data Management
- **`useAuth()`** - Authentication state and methods
- **`useClients()`** - Client CRUD operations
- **`useDocuments()`** - Document management
- **`useTasks()`** - Task management
- **`useChat()`** - AI chat functionality

### Utilities
- **`useGlobalSearch()`** - Application-wide search
- **`useDocumentProcessing()`** - AI document processing
- **`useDocumentUpload()`** - File upload with progress

**🔗 [Hooks Documentation](./COMPREHENSIVE_DOCUMENTATION.md#custom-hooks)**

---

## 🛠️ Development

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account

### Setup
```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env.local

# Start development server
npm run dev
```

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # TypeScript checking
```

### Environment Variables
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SITE_URL=http://localhost:5173
```

---

## 🚀 Deployment

### Production Build
```bash
npm run build
```

### Deployment Platforms
- **Vercel** (Recommended)
- **Netlify**
- **AWS Amplify**
- **Firebase Hosting**

**📦 [Deployment Guide](./DEPLOYMENT_GUIDE.md)**

---

## 🔒 Security

### Authentication
- JWT-based authentication via Supabase Auth
- Row-level security (RLS) policies
- Secure file upload and storage

### Data Protection
- Encrypted data transmission (HTTPS)
- Input validation and sanitization
- Rate limiting on API endpoints

**🛡️ [Security Review](./security_review.md)**

---

## 📱 Mobile Support

- Responsive design for all screen sizes
- Touch-optimized interfaces
- Progressive Web App (PWA) capabilities
- Offline functionality for core features

**📱 [Mobile Optimization Report](./MOBILE_OPTIMIZATION_REPORT.md)**

---

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### Component Testing
```typescript
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

test('renders button with text', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

### API Testing
```typescript
// Test Edge Functions
const response = await fetch('/functions/v1/chat', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ message: 'Test' })
});
```

---

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Code Style
- TypeScript for type safety
- ESLint + Prettier for code formatting
- Atomic Design for component organization
- Conventional commits for git messages

### Pull Request Guidelines
- Include tests for new features
- Update documentation as needed
- Follow existing code patterns
- Ensure all checks pass

---

## 📈 Performance

### Optimization Features
- Code splitting with React.lazy()
- Image optimization and lazy loading
- Database query optimization
- Caching strategies for API responses

### Monitoring
- Real-time error tracking
- Performance metrics
- User analytics
- API usage monitoring

---

## 🔧 Troubleshooting

### Common Issues

#### Authentication Problems
```typescript
// Check authentication status
const { data: { user } } = await supabase.auth.getUser();
console.log('User:', user);
```

#### Database Connection
```typescript
// Test database connection
const { data, error } = await supabase.from('clients').select('count');
console.log('Connected:', !error);
```

#### File Upload Issues
```typescript
// Check storage permissions
const { data: buckets } = await supabase.storage.listBuckets();
console.log('Buckets:', buckets);
```

**🐛 [Debugging Guide](./QUICK_START_GUIDE.md#debugging)**

---

## 📊 Roadmap

### Current Version (v1.0)
- ✅ Core client management
- ✅ Document upload and processing
- ✅ AI chat assistant
- ✅ Task management
- ✅ Dashboard analytics

### Upcoming Features (v1.1)
- 🔄 Advanced reporting
- 🔄 Mobile app
- 🔄 API integrations (QuickBooks, etc.)
- 🔄 Multi-user collaboration
- 🔄 Advanced AI features

### Future Enhancements (v2.0)
- 📋 Tax form automation
- 📋 Client portal
- 📋 Advanced analytics
- 📋 Workflow automation
- 📋 Third-party integrations

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Supabase** for the excellent backend-as-a-service platform
- **OpenAI** for GPT API integration
- **Tailwind CSS** for the utility-first CSS framework
- **React** team for the amazing frontend library
- **TypeScript** for type safety and developer experience

---

## 📞 Support

- **Documentation**: Check the comprehensive docs first
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Email**: support@taxos.app

---

## 📈 Stats

![GitHub stars](https://img.shields.io/github/stars/your-repo/taxos)
![GitHub forks](https://img.shields.io/github/forks/your-repo/taxos)
![GitHub issues](https://img.shields.io/github/issues/your-repo/taxos)
![GitHub license](https://img.shields.io/github/license/your-repo/taxos)

---

**Built with ❤️ by the TaxOS team**