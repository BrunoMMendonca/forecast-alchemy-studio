import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Index = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
      <div className="text-center p-8 max-w-2xl">
        <h1 className="text-5xl font-bold text-slate-800 mb-4">
          Forecast Alchemy Studio
        </h1>
        <p className="text-xl text-slate-600 mb-8">
          Welcome! Upload your historical sales data, leverage AI for optimization, and generate enterprise-ready forecasts for your S&OP planning.
        </p>
        <Link to="/forecast">
          <Button size="lg" className="text-lg px-8 py-6">
            Get Started
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default Index;
