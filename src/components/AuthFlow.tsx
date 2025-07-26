import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, User, Building2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface AuthFlowProps {
  onAuthComplete: (user: any, company: any) => void;
}

const AuthFlow: React.FC<AuthFlowProps> = ({ onAuthComplete }) => {
  const [step, setStep] = useState<'register' | 'login' | 'create-company'>('login');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Registration form
  const [registrationData, setRegistrationData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: ''
  });

  // Login form
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  // Company form
  const [companyData, setCompanyData] = useState({
    name: '',
    description: '',
    country: '',
    website: '',
    phone: '',
    address: '',
    city: '',
    state_province: '',
    postal_code: '',
    company_size: '',
    timezone: 'UTC',
    currency: 'USD',
    logo_url: '',
    notes: ''
  });

  const handleRegister = async () => {
    if (registrationData.password !== registrationData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (registrationData.password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registrationData.email,
          username: registrationData.username,
          password: registrationData.password,
          first_name: registrationData.first_name,
          last_name: registrationData.last_name
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // New direct registration flow - no email verification needed
        toast.success('Registration successful! You can now log in.');
        setStep('login');
      } else {
        toast.error(result.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });

      const result = await response.json();
      
      if (result.success) {
        // Store tokens
        localStorage.setItem('sessionToken', result.sessionToken);
        localStorage.setItem('refreshToken', result.refreshToken);
        
        setUser(result.user);
        
        if (result.user.company_id) {
          // User already has a company, get company details
          const companyResponse = await fetch('/api/auth/company', {
            headers: {
              'Authorization': `Bearer ${result.sessionToken}`
            }
          });
          
          if (companyResponse.ok) {
            const companyResult = await companyResponse.json();
            onAuthComplete(result.user, companyResult.company);
          } else {
            onAuthComplete(result.user, null);
          }
        } else {
          // User needs to create a company
          setStep('create-company');
        }
        
        toast.success('Login successful!');
      } else {
        toast.error(result.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async () => {
    if (!companyData.name.trim()) {
      toast.error('Company name is required');
      return;
    }

    setLoading(true);
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      
      const response = await fetch('/api/auth/company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(companyData)
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Company created successfully!');
        onAuthComplete(user, result.company);
      } else {
        toast.error(result.error || 'Company creation failed');
      }
    } catch (error) {
      console.error('Company creation error:', error);
      toast.error('Company creation failed');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'register':
        return (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Create Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={registrationData.first_name}
                    onChange={(e) => setRegistrationData({ ...registrationData, first_name: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={registrationData.last_name}
                    onChange={(e) => setRegistrationData({ ...registrationData, last_name: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={registrationData.email}
                  onChange={(e) => setRegistrationData({ ...registrationData, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={registrationData.username}
                  onChange={(e) => setRegistrationData({ ...registrationData, username: e.target.value })}
                  placeholder="johndoe"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={registrationData.password}
                  onChange={(e) => setRegistrationData({ ...registrationData, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={registrationData.confirmPassword}
                  onChange={(e) => setRegistrationData({ ...registrationData, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <Button onClick={handleRegister} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Account'}
              </Button>
              <div className="text-center">
                <Button variant="link" onClick={() => setStep('login')}>
                  Already have an account? Log in
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'login':
        return (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Log In
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="loginEmail">Email</Label>
                <Input
                  id="loginEmail"
                  type="email"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <Label htmlFor="loginPassword">Password</Label>
                <Input
                  id="loginPassword"
                  type="password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <Button onClick={handleLogin} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log In'}
              </Button>
              <div className="text-center">
                <Button variant="link" onClick={() => setStep('register')}>
                  Don't have an account? Register
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'create-company':
        return (
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Create Your Company
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  value={companyData.name}
                  onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                  placeholder="Acme Corporation"
                />
              </div>
              <div>
                <Label htmlFor="companyDescription">Description</Label>
                <Textarea
                  id="companyDescription"
                  value={companyData.description}
                  onChange={(e) => setCompanyData({ ...companyData, description: e.target.value })}
                  placeholder="Brief description of your company"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={companyData.country}
                    onChange={(e) => setCompanyData({ ...companyData, country: e.target.value })}
                    placeholder="United States"
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={companyData.website}
                    onChange={(e) => setCompanyData({ ...companyData, website: e.target.value })}
                    placeholder="https://www.company.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="companySize">Company Size</Label>
                  <Select value={companyData.company_size} onValueChange={(value) => setCompanyData({ ...companyData, company_size: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="startup">Startup</SelectItem>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={companyData.currency} onValueChange={(value) => setCompanyData({ ...companyData, currency: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="CAD">CAD (C$)</SelectItem>
                      <SelectItem value="MXN">MXN (Mex$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreateCompany} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Company'}
              </Button>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      {renderStep()}
    </div>
  );
};

export default AuthFlow; 