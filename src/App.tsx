import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import Index from '@/pages/Index';
import ForecastPage from '@/pages/ForecastPage';
import NotFound from '@/pages/NotFound';
import { MainLayout } from '@/components/MainLayout';
import { OptimizationCacheProvider } from '@/context/OptimizationCacheContext';

const queryClient = new QueryClient();

const App = () => (
  <OptimizationCacheProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route element={<MainLayout />}>
              <Route path="forecast" element={<ForecastPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </OptimizationCacheProvider>
);

export default App;
