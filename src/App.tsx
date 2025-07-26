import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import Index from '@/pages/Index';
import OnboardingPage from '@/pages/OnboardingPage';
import RegisterPage from '@/pages/RegisterPage';
import ForecastPage from '@/pages/ForecastPage';
import NotFound from '@/pages/NotFound';
import { MainLayout } from '@/components/MainLayout';
import { OptimizationStatusProvider } from '@/contexts/OptimizationStatusContext';
import AuthFlow from '@/components/AuthFlow';
import SetupWizard from '@/components/SetupWizard/SetupWizard';
import { create } from 'zustand';

// TypeScript interface for setup state
interface SetupState {
  setupRequired: boolean;
  setupWizardAccessible: boolean;
  setSetupRequired: (val: boolean) => void;
  setSetupWizardAccessible: (val: boolean) => void;
}

// Zustand store for setup state
export const useSetupStore = create<SetupState>((set) => ({
  setupRequired: false,
  setupWizardAccessible: false,
  setSetupRequired: (val) => set({ setupRequired: val }),
  setSetupWizardAccessible: (val) => set({ setupWizardAccessible: val }),
}));

const queryClient = new QueryClient();

// AuthGuard redirects to login if not authenticated
const AuthGuard: React.FC<{ isAuthenticated: boolean; children: React.ReactNode }> = ({ isAuthenticated, children }) => {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// AdminGuard ensures only admin users can access setup
const AdminGuard: React.FC<{ user: any; children: React.ReactNode }> = ({ user, children }) => {
  console.log('🔍 [AdminGuard] Checking admin access');
  console.log('🔍 [AdminGuard] User:', user);
  console.log('🔍 [AdminGuard] User roles:', user?.roles);
  
  const isAdmin = user && user.roles && user.roles.some((role: any) => 
    role.role_type === 'company_admin' || role.role_type === 'division_admin'
  );
  
  console.log('🔍 [AdminGuard] Is admin:', isAdmin);
  
  if (!isAdmin) {
    console.log('🔍 [AdminGuard] Access denied - redirecting to /forecast');
    return <Navigate to="/forecast" replace />;
  }
  
  console.log('🔍 [AdminGuard] Access granted - rendering children');
  return <>{children}</>;
};

// ForecastGuard ensures setup is complete before allowing access
const ForecastGuard: React.FC<{ 
  refreshSetupStatus: () => Promise<any>;
  children: React.ReactNode 
}> = ({ refreshSetupStatus, children }) => {
  const [isChecking, setIsChecking] = useState(false);
  const setupRequired = useSetupStore((s) => s.setupRequired);
  const setupWizardAccessible = useSetupStore((s) => s.setupWizardAccessible);

  useEffect(() => {
    const checkSetupStatus = async () => {
      setIsChecking(true);
      await refreshSetupStatus();
      setIsChecking(false);
    };
    
    checkSetupStatus();
  }, [refreshSetupStatus]);

  if (isChecking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Checking setup status...</p>
        </div>
      </div>
    );
  }

  // Only redirect to setup if setup is required AND wizard is accessible
  if (setupRequired && setupWizardAccessible) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const setupRequired = useSetupStore((s) => s.setupRequired);
  const setupWizardAccessible = useSetupStore((s) => s.setupWizardAccessible);
  const setSetupRequired = useSetupStore((s) => s.setSetupRequired);
  const setSetupWizardAccessible = useSetupStore((s) => s.setSetupWizardAccessible);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const refreshSetupStatus = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) return;

      const response = await fetch('/api/auth/setup/status', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      if (response.ok) {
        const setupResult = await response.json();
        setSetupRequired(setupResult.setupRequired);
        setSetupWizardAccessible(setupResult.setupWizardAccessible);
        return setupResult;
      }
    } catch (error) {
      console.error('Error refreshing setup status:', error);
    }
    return { setupRequired: false, setupWizardAccessible: false };
  };

  const checkAuthStatus = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setUser(result.user);
        
        // Check if user has a company
        if (result.user.company_id) {
          const companyResponse = await fetch('/api/auth/company', {
            headers: {
              'Authorization': `Bearer ${sessionToken}`
            }
          });
          
          if (companyResponse.ok) {
            const companyResult = await companyResponse.json();
            setCompany(companyResult.company);
            
            // Check setup status
            await refreshSetupStatus();
          }
        }
        
        setIsAuthenticated(true);
      } else {
        // Token is invalid, clear it
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('refreshToken');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthComplete = async (user: any, company: any) => {
    setUser(user);
    setCompany(company);
    setIsAuthenticated(true);
    
    // Check setup status and navigate accordingly
    try {
      const setupResult = await refreshSetupStatus();
      if (setupResult.setupRequired) {
        // Setup is required, navigate to setup wizard
        window.location.href = '/setup';
      } else {
        // Setup is complete, navigate to forecast
        window.location.href = '/forecast';
      }
    } catch (error) {
      console.error('Error checking setup status:', error);
      // Fallback to forecast page
      window.location.href = '/forecast';
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <OptimizationStatusProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              
              {/* Authentication routes */}
              <Route path="/login" element={
                isAuthenticated ? <Navigate to={setupRequired ? "/setup" : "/forecast"} replace /> : <AuthFlow onAuthComplete={handleAuthComplete} />
              } />
              <Route path="/register" element={
                isAuthenticated ? <Navigate to={setupRequired ? "/setup" : "/forecast"} replace /> : <RegisterPage />
              } />
              
              {/* Setup wizard - requires authentication and admin role */}
              <Route path="/setup" element={
                <AuthGuard isAuthenticated={isAuthenticated}>
                  <AdminGuard user={user}>
                    {(() => {
                      console.log('🔍 [Setup Route] setupWizardAccessible:', setupWizardAccessible);
                      console.log('🔍 [Setup Route] setupRequired:', setupRequired);
                      if (setupWizardAccessible) {
                        console.log('🔍 [Setup Route] Rendering SetupWizard');
                        return <SetupWizard />;
                      } else {
                        console.log('🔍 [Setup Route] setupWizardAccessible is false - redirecting to /forecast');
                        return <Navigate to="/forecast" replace />;
                      }
                    })()}
                  </AdminGuard>
                </AuthGuard>
              } />
              
              {/* Protected routes - require authentication */}
              <Route element={<MainLayout />}>
                <Route path="forecast" element={
                  <AuthGuard isAuthenticated={isAuthenticated}>
                    <ForecastGuard refreshSetupStatus={refreshSetupStatus}>
                      <ForecastPage />
                    </ForecastGuard>
                  </AuthGuard>
                } />
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </OptimizationStatusProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
