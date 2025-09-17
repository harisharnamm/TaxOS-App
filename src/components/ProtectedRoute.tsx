import React from 'react';
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuthContext();
  const location = useLocation();
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  // Add timeout to prevent infinite loading - increased to 15s to match Supabase timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.log('⚠️ Auth loading timeout reached');
      setTimeoutReached(true);
    }, 15000); // 15 second timeout - match with Supabase timeout

    return () => clearTimeout(timeout);
  }, []);

  // Listen for Supabase connection events
  useEffect(() => {
    const handleConnectionError = () => {
      console.log('⚠️ Supabase connection error detected');
      setConnectionError(true);
    };

    const handleConnectionSuccess = () => {
      console.log('✅ Supabase connection successful');
      setConnectionError(false);
    };

    window.addEventListener('supabase:connection:error', handleConnectionError);
    window.addEventListener('supabase:connection:success', handleConnectionSuccess);

    return () => {
      window.removeEventListener('supabase:connection:error', handleConnectionError);
      window.removeEventListener('supabase:connection:success', handleConnectionSuccess);
    };
  }, []);

  // Skip loading screen - make it direct

  // Critical: If we have a user, render content even if there are connection issues
  // This prevents the redirect loop when we have a valid user but connection issues
  if (user) {
    console.log('✅ User authenticated, rendering protected content');
    return <>{children}</>;
  }

  // If we're still loading and haven't timed out, show loading
  if (loading && !timeoutReached && !connectionError) {
    console.log('🔄 Auth still loading...');
    return <div>Loading...</div>;
  }

  // If timeout reached, connection error, and still loading, redirect to sign in
  if ((timeoutReached || connectionError) && loading) {
    console.log('❌ Auth timeout reached, redirecting to sign in');
    return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  }

  // No user after loading is complete
  if (!user && !loading) {
    console.log('❌ No user found, redirecting to sign in');
    return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  }

  console.log('✅ User authenticated, rendering protected content');
  return <>{children}</>;
}