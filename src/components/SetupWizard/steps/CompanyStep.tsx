import React, { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';

import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Building2, Search } from 'lucide-react';
import countries from 'i18n-iso-countries';
import moment from 'moment-timezone';
import currencies from 'currency-codes';

interface CompanyStepProps {
  companyForm: any;
  timezoneSearch: string;
  timezoneOpen: boolean;
  countrySearch: string;
  countryOpen: boolean;
  currencySearch: string;
  currencyOpen: boolean;
  safeSetCompanyForm: (updates: any) => void;
  setTimezoneSearch: (search: string) => void;
  setTimezoneOpen: (open: boolean) => void;
  setCountrySearch: (search: string) => void;
  setCountryOpen: (open: boolean) => void;
  setCurrencySearch: (search: string) => void;
  setCurrencyOpen: (open: boolean) => void;
  getFilteredTimezoneOptions: () => any;
  getFilteredCountryOptions: () => any;
  getFilteredCurrencyOptions: () => any;
}

export const CompanyStep: React.FC<CompanyStepProps> = ({
  companyForm,
  timezoneSearch,
  timezoneOpen,
  countrySearch,
  countryOpen,
  currencySearch,
  currencyOpen,
  safeSetCompanyForm,
  setTimezoneSearch,
  setTimezoneOpen,
  setCountrySearch,
  setCountryOpen,
  setCurrencySearch,
  setCurrencyOpen,
  getFilteredTimezoneOptions,
  getFilteredCountryOptions,
  getFilteredCurrencyOptions
}) => {
  const timezoneSearchInputRef = useRef<HTMLInputElement>(null);
  const countrySearchInputRef = useRef<HTMLInputElement>(null);
  const currencySearchInputRef = useRef<HTMLInputElement>(null);

  // Keep focus on search input when dropdown is open
  useEffect(() => {
    if (timezoneOpen && timezoneSearchInputRef.current) {
      const timer = setTimeout(() => {
        if (timezoneSearchInputRef.current) {
          timezoneSearchInputRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [timezoneOpen]);

  useEffect(() => {
    if (countryOpen && countrySearchInputRef.current) {
      const timer = setTimeout(() => {
        if (countrySearchInputRef.current) {
          countrySearchInputRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [countryOpen]);

  useEffect(() => {
    if (currencyOpen && currencySearchInputRef.current) {
      const timer = setTimeout(() => {
        if (currencySearchInputRef.current) {
          currencySearchInputRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currencyOpen]);

  // Prevent focus loss when typing
  const handleTimezoneSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimezoneSearch(e.target.value);
    setTimeout(() => {
      if (timezoneSearchInputRef.current) {
        timezoneSearchInputRef.current.focus();
      }
    }, 0);
  };

  const handleCountrySearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCountrySearch(e.target.value);
    setTimeout(() => {
      if (countrySearchInputRef.current) {
        countrySearchInputRef.current.focus();
      }
    }, 0);
  };

  const handleCurrencySearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrencySearch(e.target.value);
    setTimeout(() => {
      if (currencySearchInputRef.current) {
        currencySearchInputRef.current.focus();
      }
    }, 0);
  };
  return (
    <div className="max-w-4xl mx-auto">
      <Card className="border-0 shadow-lg">
        {/*<CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-blue-600" />
            Edit Company Details
          </CardTitle>
          <p className="text-gray-600 dark:text-gray-400">
            Update your company information and settings
          </p>
        </CardHeader>*/}
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                value={companyForm.name}
                onChange={(e) => safeSetCompanyForm({ name: e.target.value })}
                placeholder="e.g., Acme Corporation, TechStart Inc."
              />
            </div>
            <div>
              <Label htmlFor="companyDescription">Description</Label>
              <Textarea
                id="companyDescription"
                value={companyForm.description}
                onChange={(e) => safeSetCompanyForm({ description: e.target.value })}
                placeholder="e.g., Leading manufacturer of innovative products with global reach and 20+ years of excellence in customer service."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={companyForm.website}
                  onChange={(e) => safeSetCompanyForm({ website: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={companyForm.phone}
                  onChange={(e) => safeSetCompanyForm({ phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="companySize">Company Size</Label>
                <Select value={companyForm.company_size} onValueChange={(value) => safeSetCompanyForm({ company_size: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select company size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="startup">
                      <div className="flex flex-col">
                        <span className="font-medium">Startup</span>
                        <span className="text-xs text-muted-foreground">1-10 employees</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="small">
                      <div className="flex flex-col">
                        <span className="font-medium">Small</span>
                        <span className="text-xs text-muted-foreground">11-50 employees</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="medium">
                      <div className="flex flex-col">
                        <span className="font-medium">Medium</span>
                        <span className="text-xs text-muted-foreground">51-250 employees</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="large">
                      <div className="flex flex-col">
                        <span className="font-medium">Large</span>
                        <span className="text-xs text-muted-foreground">251-1,000 employees</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="enterprise">
                      <div className="flex flex-col">
                        <span className="font-medium">Enterprise</span>
                        <span className="text-xs text-muted-foreground">1,000+ employees</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="fiscalYearStart">Fiscal Year Start</Label>
                <div className="flex gap-2">
                  <Select 
                    value={companyForm.fiscal_year_start ? companyForm.fiscal_year_start.split('-')[1] || '' : ''} 
                    onValueChange={(value) => {
                      const currentDay = companyForm.fiscal_year_start ? companyForm.fiscal_year_start.split('-')[2] || '01' : '01';
                      const fiscalYearStart = value && currentDay ? `2024-${value}-${currentDay.padStart(2, '0')}` : '';
                      safeSetCompanyForm({ fiscal_year_start: fiscalYearStart });
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="e.g., January" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="01">January</SelectItem>
                      <SelectItem value="02">February</SelectItem>
                      <SelectItem value="03">March</SelectItem>
                      <SelectItem value="04">April</SelectItem>
                      <SelectItem value="05">May</SelectItem>
                      <SelectItem value="06">June</SelectItem>
                      <SelectItem value="07">July</SelectItem>
                      <SelectItem value="08">August</SelectItem>
                      <SelectItem value="09">September</SelectItem>
                      <SelectItem value="10">October</SelectItem>
                      <SelectItem value="11">November</SelectItem>
                      <SelectItem value="12">December</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="1"
                    value={companyForm.fiscal_year_start ? companyForm.fiscal_year_start.split('-')[2] || '' : ''}
                    onChange={(e) => {
                      const currentMonth = companyForm.fiscal_year_start ? companyForm.fiscal_year_start.split('-')[1] || '01' : '01';
                      const fiscalYearStart = currentMonth && e.target.value ? `2024-${currentMonth}-${e.target.value.padStart(2, '0')}` : '';
                      safeSetCompanyForm({ fiscal_year_start: fiscalYearStart });
                    }}
                    className="w-20"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="country">Country</Label>
                <Select 
                  value={companyForm.country} 
                  onValueChange={(value) => {
                    safeSetCompanyForm({ country: value });
                    setCountryOpen(false);
                  }}
                  open={countryOpen}
                  onOpenChange={(open) => {
                    setCountryOpen(open);
                    if (!open) {
                      setCountrySearch('');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent 
                    className="max-h-96"
                    onCloseAutoFocus={(e) => e.preventDefault()}
                    onPointerDownOutside={(e) => {
                      // Allow closing when clicking outside the dropdown
                      setCountryOpen(false);
                    }}
                    position="popper"
                    sideOffset={4}
                  >
                    <div className="p-2 border-b bg-white sticky top-0 z-10">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          ref={countrySearchInputRef}
                          placeholder="Search countries..."
                          value={countrySearch}
                          onChange={handleCountrySearchChange}
                          className="pl-8"
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setCountryOpen(false);
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto bg-white">
                      {getFilteredCountryOptions().map((country: any) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </div>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select 
                  value={companyForm.timezone} 
                  onValueChange={(value) => {
                    safeSetCompanyForm({ timezone: value });
                    setTimezoneOpen(false);
                  }}
                  open={timezoneOpen}
                  onOpenChange={(open) => {
                    setTimezoneOpen(open);
                    if (!open) {
                      setTimezoneSearch('');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone">
                      {companyForm.timezone && (
                        <span>
                          {(() => {
                            try {
                              const cityName = companyForm.timezone.split('/').pop()?.replace('_', ' ') || companyForm.timezone;
                              const offset = moment.tz(companyForm.timezone).format('Z');
                              return `${cityName} (GMT${offset})`;
                            } catch (error) {
                              return companyForm.timezone;
                            }
                          })()}
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent 
                    className="max-h-96"
                    onCloseAutoFocus={(e) => e.preventDefault()}
                    onPointerDownOutside={(e) => {
                      // Allow closing when clicking outside the dropdown
                      setTimezoneOpen(false);
                    }}
                    position="popper"
                    sideOffset={4}
                  >
                    <div className="p-2 border-b bg-white sticky top-0 z-10">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          ref={timezoneSearchInputRef}
                          placeholder="Search timezones..."
                          value={timezoneSearch}
                          onChange={handleTimezoneSearchChange}
                          className="pl-8"
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setTimezoneOpen(false);
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto bg-white">
                      {Object.entries(getFilteredTimezoneOptions()).map(([region, cities]) => (
                        <div key={region}>
                          <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground bg-muted/50">
                            {region}
                          </div>
                          {(cities as any[]).map((tz) => (
                            <SelectItem 
                              key={tz.value} 
                              value={tz.value}
                              className="pl-6"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{tz.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  GMT{tz.offset}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </div>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select 
                  value={companyForm.currency} 
                  onValueChange={(value) => {
                    safeSetCompanyForm({ currency: value });
                    setCurrencyOpen(false);
                  }}
                  open={currencyOpen}
                  onOpenChange={(open) => {
                    setCurrencyOpen(open);
                    if (!open) {
                      setCurrencySearch('');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent 
                    className="max-h-96"
                    onCloseAutoFocus={(e) => e.preventDefault()}
                    onPointerDownOutside={(e) => {
                      // Allow closing when clicking outside the dropdown
                      setCurrencyOpen(false);
                    }}
                    position="popper"
                    sideOffset={4}
                  >
                    <div className="p-2 border-b bg-white sticky top-0 z-10">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          ref={currencySearchInputRef}
                          placeholder="Search currencies..."
                          value={currencySearch}
                          onChange={handleCurrencySearchChange}
                          className="pl-8"
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setCurrencyOpen(false);
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto bg-white">
                      {getFilteredCurrencyOptions().map((currency: any) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          <div className="flex flex-col">
                            <span className="font-medium">{currency.code}</span>
                            <span className="text-xs text-muted-foreground">{currency.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </div>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  value={companyForm.logo_url}
                  onChange={(e) => safeSetCompanyForm({ logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={companyForm.address}
                onChange={(e) => safeSetCompanyForm({ address: e.target.value })}
                placeholder="e.g., 123 Business Park Drive, Suite 100"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={companyForm.city}
                  onChange={(e) => safeSetCompanyForm({ city: e.target.value })}
                  placeholder="e.g., San Francisco, London, Tokyo"
                />
              </div>
              <div>
                <Label htmlFor="stateProvince">State/Province</Label>
                <Input
                  id="stateProvince"
                  value={companyForm.state_province}
                  onChange={(e) => safeSetCompanyForm({ state_province: e.target.value })}
                  placeholder="e.g., California, Ontario, Bavaria"
                />
              </div>
              <div>
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  value={companyForm.postal_code}
                  onChange={(e) => safeSetCompanyForm({ postal_code: e.target.value })}
                  placeholder="e.g., 94105, M5V 3A8, 80331"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={companyForm.notes}
                onChange={(e) => safeSetCompanyForm({ notes: e.target.value })}
                placeholder="e.g., Founded in 1995, publicly traded since 2010, ISO 9001 certified, special focus on sustainability initiatives."
                rows={3}
              />
            </div>

          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 