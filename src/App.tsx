import React from 'react';
import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';
import { SearchProvider } from './contexts/SearchContext';
import { ToastProvider } from './contexts/ToastContext';
import { PreloaderProvider } from './contexts/PreloaderContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Sidebar } from './components/organisms/Sidebar';
import { supabase } from './lib/supabase';

// Lazy-loaded pages (wrap named exports)
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Clients = lazy(() => import('./pages/Clients').then(m => ({ default: m.Clients })));
const ClientDetail = lazy(() => import('./pages/ClientDetail').then(m => ({ default: m.ClientDetail })));
const Tasks = lazy(() => import('./pages/Tasks').then(m => ({ default: m.Tasks })));
const Transactions = lazy(() => import('./pages/Transactions').then(m => ({ default: m.Transactions })));
const TransactionMatching = lazy(() => import('./pages/Reconciliation').then(m => ({ default: m.TransactionMatching })));
const Workpapers = lazy(() => import('./pages/Workpapers').then(m => ({ default: m.Workpapers })));
const Vendors = lazy(() => import('./pages/Vendors').then(m => ({ default: m.Vendors })));
const MyZone = lazy(() => import('./pages/MyZone').then(m => ({ default: m.MyZone })));
const DocumentManagement = lazy(() => import('./pages/DocumentManagement').then(m => ({ default: m.DocumentManagement })));
const AIAssistant = lazy(() => import('./pages/AIAssistant').then(m => ({ default: m.AIAssistant })));
const Settings = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.Settings })));
const ClientCommunications = lazy(() => import('./pages/ClientCommunications').then(m => ({ default: m.ClientCommunications })));
const FluxAnalysis = lazy(() => import('./pages/Analytics').then(m => ({ default: m.FluxAnalysis })));
const ClientUpload = lazy(() => import('./pages/ClientUpload'));
// const OpenBankingCallback = lazy(() => import('./pages/OpenBankingCallback').then(m => ({ default: m.OpenBankingCallback })));
const SignIn = lazy(() => import('./pages/SignIn').then(m => ({ default: m.SignIn })));
const SignUp = lazy(() => import('./pages/SignUp').then(m => ({ default: m.SignUp })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })));


function AppContent() {
  const location = useLocation();
  
  // Handle OAuth callback at app level
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      
      if (urlParams.get('code') || hashParams.get('access_token') || hashParams.get('code')) {
        console.log('🔄 App-level OAuth callback detected');
        
        // Wait for Supabase to process the callback
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ App-level OAuth error:', error);
          return;
        }
        
        if (data.session?.user) {
          console.log('✅ App-level OAuth success, user:', data.session.user.email);
          // Clear URL parameters and redirect to dashboard
          window.history.replaceState({}, document.title, '/');
          window.location.href = '/';
        }
      }
    };

    handleOAuthCallback();
  }, []);
  
  useEffect(() => {
    // Route change tracking for analytics
  }, [location]);

  // Main app layout component
  const AppLayout = ({ children }: { children: React.ReactNode }) => (
    <MainLayout>
      {children}
    </MainLayout>
  );

  const Fallback = <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <Routes>
      {/* Authentication routes - full width without sidebar */}
      <Route path="/signin" element={
        <Suspense fallback={Fallback}>
          <SignIn />
        </Suspense>
      } />
      <Route path="/signup" element={
        <Suspense fallback={Fallback}>
          <SignUp />
        </Suspense>
      } />
      <Route path="/forgot-password" element={
        <Suspense fallback={Fallback}>
          <ForgotPassword />
        </Suspense>
      } />
      <Route path="/reset-password" element={
        <Suspense fallback={Fallback}>
          <ResetPassword />
        </Suspense>
      } />
      
      {/* Client upload route - public access */}
      <Route path="/upload/:token" element={
        <Suspense fallback={Fallback}>
          <ClientUpload />
        </Suspense>
      } />
      
      {/* Main app routes - with sidebar */}
      <Route path="/" element={
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={Fallback}>
              <Dashboard />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/clients" element={
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={Fallback}>
              <Clients />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/clients/:id" element={
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={Fallback}>
              <ClientDetail />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/tasks" element={
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={Fallback}>
              <Tasks />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/transactions" element={
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={Fallback}>
              <Transactions />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/vendors" element={
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={Fallback}>
              <Vendors />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/transaction-matching" element={
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={Fallback}>
              <TransactionMatching />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/transaction-matching/:clientId" element={
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={Fallback}>
              <TransactionMatching />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/my-zone" element={
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={Fallback}>
              <MyZone />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/irs-notices" element={
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={Fallback}>
              <DocumentManagement />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/ai-assistant" element={
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={Fallback}>
              <AIAssistant />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/transactions/analytics" element={
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={Fallback}>
              <FluxAnalysis />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/transactions/analytics/:clientId" element={
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={Fallback}>
              <FluxAnalysis />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/workpapers" element={
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={Fallback}>
              <Workpapers />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/workpapers/:clientId" element={
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={Fallback}>
              <Workpapers />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/client-communications" element={
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={Fallback}>
              <ClientCommunications />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={Fallback}>
              <Settings />
            </Suspense>
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