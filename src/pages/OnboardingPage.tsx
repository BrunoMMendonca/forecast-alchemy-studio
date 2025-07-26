import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, UserPlus, LogIn, Building2, Users, Shield } from 'lucide-react';

const OnboardingPage = () => {
  const navigate = useNavigate();

  const handleNewUser = () => {
    navigate('/register');
  };

  const handleExistingUser = () => {
    navigate('/login');
  };

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Back Button */}
        <div className="mb-8">
          <Button variant="ghost" onClick={handleBack} className="text-slate-600 hover:text-slate-800">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">
            Welcome to Forecast Alchemy Studio
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Choose how you'd like to get started with enterprise forecasting and AI-powered optimization.
          </p>
        </div>

        {/* Options Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* New User Card */}
          <Card className="border-2 border-blue-200 hover:border-blue-300 transition-colors cursor-pointer" onClick={handleNewUser}>
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl text-slate-800">Create New Account</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-slate-600 mb-6">
                Start your journey with a free trial. Set up your organization and begin forecasting in minutes.
              </p>
              <div className="space-y-3 text-sm text-slate-500">
                <div className="flex items-center justify-center">
                  <Building2 className="h-4 w-4 mr-2" />
                  <span>Company setup & configuration</span>
                </div>
                <div className="flex items-center justify-center">
                  <Users className="h-4 w-4 mr-2" />
                  <span>Team member invitations</span>
                </div>
                <div className="flex items-center justify-center">
                  <Shield className="h-4 w-4 mr-2" />
                  <span>30-day free trial</span>
                </div>
              </div>
              <Button className="w-full mt-6" size="lg" onClick={(e) => { e.stopPropagation(); handleNewUser(); }}>
                Get Started
              </Button>
            </CardContent>
          </Card>

          {/* Existing User Card */}
          <Card className="border-2 border-green-200 hover:border-green-300 transition-colors cursor-pointer" onClick={handleExistingUser}>
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogIn className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-slate-800">Sign In</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-slate-600 mb-6">
                Welcome back! Access your existing account and continue with your forecasting projects.
              </p>
              <div className="space-y-3 text-sm text-slate-500">
                <div className="flex items-center justify-center">
                  <Building2 className="h-4 w-4 mr-2" />
                  <span>Access your organization</span>
                </div>
                <div className="flex items-center justify-center">
                  <Users className="h-4 w-4 mr-2" />
                  <span>Continue with your team</span>
                </div>
                <div className="flex items-center justify-center">
                  <Shield className="h-4 w-4 mr-2" />
                  <span>Secure authentication</span>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-6" size="lg" onClick={(e) => { e.stopPropagation(); handleExistingUser(); }}>
                Sign In
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Additional Info */}
        <div className="text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-4">
            <button 
              onClick={handleNewUser}
              className="text-blue-600 hover:text-blue-800 underline text-sm"
            >
              Create new account
            </button>
            <span className="text-slate-400 text-sm">•</span>
            <button 
              onClick={handleExistingUser}
              className="text-blue-600 hover:text-blue-800 underline text-sm"
            >
              Sign in to existing account
            </button>
          </div>
          <p className="text-sm text-slate-500">
            Need help? Contact our support team at{' '}
            <a href="mailto:support@forecastalchemy.com" className="text-blue-600 hover:text-blue-800 underline">
              support@forecastalchemy.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage; 