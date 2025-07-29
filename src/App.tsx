import React from 'react';
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';
import { SearchProvider } from './contexts/SearchContext';
import { ToastProvider } from './contexts/ToastContext';
import { PreloaderProvider } from './contexts/PreloaderContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Sidebar } from './components/organisms/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Clients } from './pages/Clients';
import { ClientDetail } from './pages/ClientDetail';
import { Tasks } from './pages/Tasks';
import { Hub1099 } from './pages/Hub1099';
import { MyZone } from './pages/MyZone';
import { DocumentManagement } from './pages/DocumentManagement';
import { AITaxAssistant } from './pages/AITaxAssistant';
import { Settings } from './pages/SettingsPage';
import { ClientCommunications } from './pages/ClientCommunications';
import ClientUpload from './pages/ClientUpload';
import { SignIn } from './pages/SignIn';
import { SignUp } from './pages/SignUp';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';

function AppContent() {
  const location = useLocation();
  
  useEffect(() => {
    console.log('🔄 Route changed to:', location.pathname);
  }, [location]);

  // Main app layout component
  const AppLayout = ({ children }: { children: React.ReactNode }) => (
    <MainLayout>
      {children}
    </MainLayout>
  );

  return (
    <Routes>
      {/* Authentication routes - full width without sidebar */}
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Client upload route - public access */}
      <Route path="/upload/:token" element={<ClientUpload />} />
      
      {/* Main app routes - with sidebar */}
      <Route path="/" element={
        <ProtectedRoute>
          <AppLayout>
            <Dashboard />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/clients" element={
        <ProtectedRoute>
          <AppLayout>
            <Clients />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/clients/:id" element={
        <ProtectedRoute>
          <AppLayout>
            <ClientDetail />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/tasks" element={
        <ProtectedRoute>
          <AppLayout>
            <Tasks />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/my-zone" element={
        <ProtectedRoute>
          <AppLayout>
            <MyZone />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/irs-notices" element={
        <ProtectedRoute>
          <AppLayout>
            <DocumentManagement />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/deduction-chat" element={
        <ProtectedRoute>
          <AppLayout>
            <AITaxAssistant />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/client-communications" element={
        <ProtectedRoute>
          <AppLayout>
            <ClientCommunications />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <AppLayout>
            <Settings />
          </AppLayout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

// Separate component for the main layout with sidebar
function MainLayout({ children }: { children: React.ReactNode }) {
  const sidebar = useSidebar();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated font-inter">
      <Sidebar isOpen={sidebar.isOpen} onClose={sidebar.closeSidebar} />
      <div className="lg:ml-72 transition-all duration-300">
        {children}
      </div>
      {/* Mobile overlay */}
      {sidebar.isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={sidebar.closeSidebar}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <SearchProvider>
          <PreloaderProvider>
            <BrowserRouter>
              <SidebarProvider>
                <AppContent />
              </SidebarProvider>
            </BrowserRouter>
          </PreloaderProvider>
        </SearchProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;