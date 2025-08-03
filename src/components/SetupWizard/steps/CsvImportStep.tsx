import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Settings, MapPin, FileText, Calendar, Trash2, Database, Upload, CheckCircle, XCircle, Info, AlertTriangle, SkipForward, X } from 'lucide-react';
import { CsvImportWizard } from '@/components/CsvImportWizard';
import { useSetupWizardStore } from '@/store/setupWizardStoreRefactored';
import { DivisionCards } from '@/components/SetupWizard/components/DivisionCards';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useToast } from '@/hooks/use-toast';

interface CsvImportStepProps {
  onNext?: () => void;
  onBack?: () => void;
  // Props passed from SetupWizard
  orgStructure?: any;
  pendingDivisions?: any[];
  pendingClusters?: any[];
  setCurrentStep?: (step: number) => void;
  getStepIndexByTitle?: (title: string) => number;
  safeSetOrgStructure?: (structure: any) => void;
  safeSetNewDivision?: (division: any) => void;
  safeSetNewCluster?: (cluster: any) => void;
  safeClearPendingItems?: () => void;
  storeData?: any;
}

const CsvImportStep: React.FC<CsvImportStepProps> = ({ 
  onNext, 
  onBack,
  orgStructure: propOrgStructure,
  pendingDivisions: propPendingDivisions,
  pendingClusters: propPendingClusters,
  setCurrentStep,
  getStepIndexByTitle,
  safeSetOrgStructure,
  safeSetNewDivision,
  safeSetNewCluster,
  safeClearPendingItems,
  storeData
}) => {
  const { toast } = useToast();
  const store = useSetupWizardStore();
  
  // Subscribe to specific parts of the store for reactivity
  const csvImportData = useSetupWizardStore((state) => state.orgStructure?.csvImportData);
  const fieldMappings = useSetupWizardStore((state) => state.fieldMappings);
  const orgStructure = useSetupWizardStore((state) => state.orgStructure);
  
  // Debug: Log when component renders
  console.log('🔍 [COMPONENT] CsvImportStep rendering with store data:', {
    csvImportData: csvImportData?.columnMappings?.filter((m: any) => m.role === 'date').map((m: any) => ({
      originalName: m.originalName,
      dateFormat: m.dateFormat
    })),
    hasCsvMappings: csvImportData?.columnMappings?.length > 0
  });
  
  // State for date format selector
  const [selectedDateFormat, setSelectedDateFormat] = useState<string>('');
  const [isDateFormatDialogOpen, setIsDateFormatDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<any>(null);
  const [forceUpdate, setForceUpdate] = useState(0);
  // State for CSV wizard visibility
  const [showCsvWizard, setShowCsvWizard] = useState(false);
  const [showImportedCsvList, setShowImportedCsvList] = useState(false);
  const [selectedDivisionForMapping, setSelectedDivisionForMapping] = useState<string | null>(null);
  
  // State for duplicate division validation
  const [showDuplicateDivisionDialog, setShowDuplicateDivisionDialog] = useState(false);
  const [duplicateDivisionData, setDuplicateDivisionData] = useState<any>(null);
  const [isProcessingDuplicateDivision, setIsProcessingDuplicateDivision] = useState(false);
  
  // Clear selected division if it becomes inactive
  useEffect(() => {
    if (selectedDivisionForMapping && store.orgStructure?.importLevel === 'division') {
      // Check if the selected division is still active
      const isSelectedDivisionActive = store.divisions?.some(
        (division: any) => division.name === selectedDivisionForMapping && division.is_active !== false
      ) || store.orgStructure?.pendingDivisions?.some(
        (division: any) => division.name === selectedDivisionForMapping && !division.isExisting && division.is_active !== false
      );
      
      if (!isSelectedDivisionActive) {
        handleClearDivisionSelection();
      }
    }
  }, [store.divisions, store.orgStructure?.pendingDivisions, selectedDivisionForMapping]);
  
  // Force re-render when store changes - using a different approach
  useEffect(() => {
    console.log('🔍 [COMPONENT] Component mounted, forceUpdate:', forceUpdate);
  }, [forceUpdate]);
  
  // Date format options organized by category
  const dateFormatOptions = {
    daily: [
      { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (European)', example: '25/12/2023' },
      { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (American)', example: '12/25/2023' },
      { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)', example: '2023-12-25' },
      { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY (European)', example: '25-12-2023' },
      { value: 'MM-DD-YYYY', label: 'MM-DD-YYYY (American)', example: '12-25-2023' },
      { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY (European)', example: '25.12.2023' },
      { value: 'MM.DD.YYYY', label: 'MM.DD.YYYY (American)', example: '12.25.2023' },
      { value: 'DD/MM/YY', label: 'DD/MM/YY (European)', example: '25/12/23' },
      { value: 'MM/DD/YY', label: 'MM/DD/YY (American)', example: '12/25/23' },
      { value: 'DD-MM-YY', label: 'DD-MM-YY (European)', example: '25-12-23' },
      { value: 'MM-DD-YY', label: 'MM-DD-YY (American)', example: '12-25-23' },
      { value: 'DD.MM.YY', label: 'DD.MM.YY (European)', example: '25.12.23' },
      { value: 'MM.DD.YY', label: 'MM.DD.YY (American)', example: '12.25.23' }
    ],
    weekly: [
      { value: 'YYYY-WW', label: 'YYYY-WW (ISO Week)', example: '2023-W01' },
      { value: 'WW-YYYY', label: 'WW-YYYY (Week-Year)', example: 'W01-2023' },
      { value: 'YYYY/WW', label: 'YYYY/WW (Week)', example: '2023/W01' },
      { value: 'WW/YYYY', label: 'WW/YYYY (Week-Year)', example: 'W01/2023' },
      { value: 'YYYY.WW', label: 'YYYY.WW (Week)', example: '2023.W01' },
      { value: 'WW.YYYY', label: 'WW.YYYY (Week-Year)', example: 'W01.2023' }
    ],
    quarterly: [
      { value: 'YYYY-QN', label: 'YYYY-QN (Quarter)', example: '2023-Q1' },
      { value: 'QN-YYYY', label: 'QN-YYYY (Quarter-Year)', example: 'Q1-2023' },
      { value: 'YYYY/QN', label: 'YYYY/QN (Quarter)', example: '2023/Q1' },
      { value: 'QN/YYYY', label: 'QN/YYYY (Quarter-Year)', example: 'Q1/2023' },
      { value: 'YYYY.QN', label: 'YYYY.QN (Quarter)', example: '2023.Q1' },
      { value: 'QN.YYYY', label: 'QN.YYYY (Quarter-Year)', example: 'Q1.2023' }
    ],
    yearly: [
      { value: 'YYYY', label: 'YYYY (Year)', example: '2023' },
      { value: 'YY', label: 'YY (Short Year)', example: '23' },
      { value: 'MM/YYYY', label: 'MM/YYYY (Month-Year)', example: '12/2023' },
      { value: 'YYYY/MM', label: 'YYYY/MM (Year-Month)', example: '2023/12' },
      { value: 'MM-YYYY', label: 'MM-YYYY (Month-Year)', example: '12-2023' },
      { value: 'YYYY-MM', label: 'YYYY-MM (Year-Month)', example: '2023-12' },
      { value: 'MM.YYYY', label: 'MM.YYYY (Month-Year)', example: '12.2023' },
      { value: 'YYYY.MM', label: 'YYYY.MM (Year-Month)', example: '2023.12' }
    ],

  };
  
  // Always use store values for reactivity
  const pendingDivisions = orgStructure?.pendingDivisions || [];
  const pendingClusters = orgStructure?.pendingClusters || [];
  
  const [csvImportComplete, setCsvImportComplete] = useState(false);

  // Check if CSV import can be skipped (only if mappings exist)
  const canSkipCsvImport = () => {
    // Check if there are existing field mappings
    const hasDatabaseMappings = store.fieldMappings && store.fieldMappings.length > 0;
    
    // Check if there are CSV mappings from previous imports
      const hasCsvMappings = store.orgStructure?.csvImportData &&
    store.orgStructure.csvImportData.columnMappings &&
    store.orgStructure.csvImportData.columnMappings.length > 0;
    
    // Check if there are any imported CSV files (single or multiple)
    const hasImportedFiles = store.orgStructure?.multipleCsvImport?.importedCsvs?.length > 0 ||
      (store.orgStructure?.csvImportData &&
       store.orgStructure.csvImportData.csvFileName &&
       store.orgStructure.csvImportData.data &&
       store.orgStructure.csvImportData.data.length > 0);
    
    // Disable skip if there are already files imported
    if (hasImportedFiles) {
      return false;
    }
    
    return hasDatabaseMappings || hasCsvMappings;
  };

  // Check if a file has been imported in company-wide context
    const hasImportedFile = () => {
      const csvImportData = store.orgStructure?.csvImportData;
      console.log('🔍 [HAS IMPORTED FILE] Checking csvImportData:', csvImportData);
      
      if (!csvImportData) {
        console.log('🔍 [HAS IMPORTED FILE] No csvImportData, returning false');
        return false;
      }
      
      // For company-level imports
      if (orgStructure.importLevel === 'company') {
        const hasFile = csvImportData.csvFileName &&
          csvImportData.data &&
          csvImportData.data.length > 0;
        console.log('🔍 [HAS IMPORTED FILE] Company level check:', { hasFile, csvFileName: csvImportData.csvFileName, dataLength: csvImportData.data?.length });
        return hasFile;
      }
      
      // For division-level imports
      if (orgStructure.importLevel === 'division') {
        // Check if there's any division-specific data
        if (csvImportData.divisionSpecific) {
          const divisionNames = Object.keys(csvImportData.divisionSpecific);
          console.log('🔍 [HAS IMPORTED FILE] Division names found:', divisionNames);
          for (const divisionName of divisionNames) {
            const divisionData = csvImportData.divisionSpecific[divisionName];
            console.log('🔍 [HAS IMPORTED FILE] Checking division data for:', divisionName, divisionData);
            if (divisionData && divisionData.data && divisionData.data.length > 0) {
              console.log('🔍 [HAS IMPORTED FILE] Found data for division:', divisionName);
              return true;
            }
          }
        }
        
        // Fallback to global data check
        const hasGlobalFile = csvImportData.csvFileName &&
          csvImportData.data &&
          csvImportData.data.length > 0;
        console.log('🔍 [HAS IMPORTED FILE] Division level global check:', { hasGlobalFile, csvFileName: csvImportData.csvFileName, dataLength: csvImportData.data?.length });
        return hasGlobalFile;
      }
      
      console.log('🔍 [HAS IMPORTED FILE] No matching import level, returning false');
      return false;
    };

  // Check if we should disable import functionality (company-wide or division-level context with file already imported)
  const shouldDisableImport = () => {
    console.log('🔍 [SHOULD DISABLE IMPORT] Checking conditions...');
    
    // Disable if company-level import and already has file
    if (orgStructure.importLevel === 'company' && hasImportedFile()) {
      console.log('🔍 [SHOULD DISABLE IMPORT] Company level with file - disabling');
      return true;
    }
    
    // For division-level imports, both scenarios allow multiple CSV uploads
    if (orgStructure.importLevel === 'division') {
      // For "withoutDivisionColumn" scenario, only disable if division selection is required
      if (orgStructure.divisionCsvType === 'withoutDivisionColumn') {
        if (shouldDisableImportForDivisionSelection()) {
          console.log('🔍 [SHOULD DISABLE IMPORT] Division selection required - disabling');
          return true;
        }
        // Don't disable for file upload - allow multiple uploads
        console.log('🔍 [SHOULD DISABLE IMPORT] withoutDivisionColumn - allowing upload');
        return false;
      }
      
      // For "withDivisionColumn" scenario, allow multiple uploads (extract divisions from each CSV)
      if (orgStructure.divisionCsvType === 'withDivisionColumn') {
        console.log('🔍 [SHOULD DISABLE IMPORT] withDivisionColumn - allowing multiple uploads');
        return false;
      }
    }
    
    console.log('🔍 [SHOULD DISABLE IMPORT] No conditions met - not disabling');
    return false;
  };

  // Function to handle next step navigation
  const getNextAvailableStep = () => {
    // Determine the next step based on the current setup flow configuration
    const { importLevel, divisionCsvType, hasMultipleDivisions, hasMultipleClusters, enableLifecycleTracking, setupFlow } = orgStructure;
    
    // Special handling for division-level import without division column
    const isDivisionLevelWithoutColumn = importLevel === 'division' && 
                                       divisionCsvType === 'withoutDivisionColumn' &&
                                       hasMultipleClusters;

    // Special handling for division-level import without division column AND no clusters
    const isDivisionLevelWithoutColumnNoClusters = importLevel === 'division' && 
                                                  divisionCsvType === 'withoutDivisionColumn' &&
                                                  !hasMultipleClusters;

    if (isDivisionLevelWithoutColumn) {
      // Flow: Manual divisions first, then CSV import for clusters, then manual cluster editing
      return 'Manage Clusters';
    } else if (isDivisionLevelWithoutColumnNoClusters) {
      // Flow: Manual divisions first, then CSV import for column mapping (before product lifecycle or S&OP)
      if (enableLifecycleTracking) {
        return 'Product Life Cycle';
      } else {
        return 'S&OP Cycles';
      }
    } else {
      // Standard flow - determine next step based on configuration
      if (!setupFlow?.skipDivisionStep && hasMultipleDivisions) {
        return 'Manage Divisions';
      } else if (!setupFlow?.skipClusterStep && hasMultipleClusters) {
        return 'Manage Clusters';
      } else if (enableLifecycleTracking) {
        return 'Product Life Cycle';
      } else {
        return 'S&OP Cycles';
      }
    }
  };

  const handleNext = () => {
    if (onNext) {
      onNext();
    } else if (setCurrentStep && getStepIndexByTitle) {
      const nextStepTitle = getNextAvailableStep();
      const nextStepIndex = getStepIndexByTitle(nextStepTitle);
      
      if (nextStepIndex !== -1) {
        setCurrentStep(nextStepIndex);
      } else {
        // Fallback: go to S&OP Cycles or Setup Complete
        const sopIndex = getStepIndexByTitle('S&OP Cycles');
        const completeIndex = getStepIndexByTitle('Setup Complete');
        
        if (sopIndex !== -1) {
          setCurrentStep(sopIndex);
        } else if (completeIndex !== -1) {
          setCurrentStep(completeIndex);
        }
      }
    }
  };

  // Function to handle back step navigation
  const handleBack = () => {
    if (onBack) {
      onBack();
    }
  };

  const handleDivisionSelect = (division: any) => {
    // Set the selected division in the store for field mapping context
    store.setOrgStructure({
      ...store.orgStructure,
      csvImportData: {
        ...store.orgStructure?.csvImportData,
        selectedDivision: division.name
      }
    });
    
    // Set the selected division for field mapping filtering
    setSelectedDivisionForMapping(division.name);
    console.log('Selected division for field mapping:', division.name);
  };

  const handleClearDivisionSelection = () => {
    // Clear the selected division from the store
    store.setOrgStructure({
      ...store.orgStructure,
      csvImportData: {
        ...store.orgStructure?.csvImportData,
        selectedDivision: null
      }
    });
    
    // Clear the selected division for field mapping filtering
    setSelectedDivisionForMapping(null);
    console.log('Cleared division selection');
    
    // Reload all field mappings (both company-wide and division-specific)
    store.loadFieldMappings();
  };

  // Helper function to get icon for column role (copied from MapStep)
  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'division':
        // For CsvImportStep, we need to check the orgStructure context
        // This is a simplified version - in most cases Division should be available
        // but we'll show sigma for consistency with the mapping steps
        return 'Σ';
      case 'cluster':
        return '📍';
      case 'material code':
      case 'material':
      case 'sku':
        return '🔢';
      case 'description':
        return '📄';
      case 'lifecycle phase':
      case 'lifecycle':
        return '❤️';
      case 'date':
        return '📅';
      case 'ignore':
        return '❌';
      default:
        // For any other role, show the standard aggregatable field icon
        return 'Σ';
    }
  };

  // Helper function to convert database field type to proper role name
  const getRoleNameFromFieldType = (fieldType: string, fieldName?: string) => {
    switch (fieldType.toLowerCase()) {
      case 'division':
        return 'Division';
      case 'cluster':
        return 'Cluster';
      case 'material':
        return 'Material Code';
      case 'description':
        return 'Description';
      case 'lifecycle':
        return 'Lifecycle Phase';
      case 'date':
        return 'Date';
      case 'aggregatable':
        // For aggregatable fields, use the field_name if available, otherwise use "Aggregatable"
        return fieldName || 'Aggregatable';
      default:
        return fieldType.charAt(0).toUpperCase() + fieldType.slice(1);
    }
  };

  // Handler for opening date format selector
  const handleDateFormatClick = (mapping: any) => {
    setEditingMapping(mapping);
    
    // Get the current date format from the CSV data
    const csvImportData = store.orgStructure?.csvImportData;
    let currentFormat = 'MM/DD/YYYY'; // default
    
    if (csvImportData && csvImportData.columnMappings) {
      // Find the first date mapping to get the current format (handle both cases)
      const firstDateMapping = csvImportData.columnMappings.find((m: any) => m.role === 'date' || m.role === 'Date');
      if (firstDateMapping && firstDateMapping.dateFormat) {
        currentFormat = firstDateMapping.dateFormat;
      }
    }
    
    setSelectedDateFormat(currentFormat);
    setIsDateFormatDialogOpen(true);
  };
  
  // Handler for updating date format
  const handleDateFormatChange = (newFormat: string) => {
    if (!editingMapping) return;
    
    // Get csvImportData from the store
    const csvImportData = store.orgStructure?.csvImportData;
    
    console.log('🔍 [DATE FORMAT] Updating date format:', {
      editingMapping,
      newFormat,
      currentCsvData: csvImportData
    });
    
    // Update the CSV import data in the store
    if (csvImportData) {
      const updatedColumnMappings = csvImportData.columnMappings.map((mapping: any) => {
        // Check if this is a date mapping that needs to be updated (handle both cases)
        if (mapping.role === 'date' || mapping.role === 'Date') {
          console.log('🔍 [DATE FORMAT] Found date mapping to update:', mapping);
          return {
            ...mapping,
            dateFormat: newFormat
          };
        }
        return mapping;
      });
      
      const updatedCsvData = {
        ...csvImportData,
        columnMappings: updatedColumnMappings
      };
      
      console.log('🔍 [DATE FORMAT] Updated CSV data:', updatedCsvData);
      
      // Store the updated CSV mapping data
      store.storeCsvMappingData(updatedCsvData);
      
      // Force a re-render by updating the store
      console.log('🔍 [DATE FORMAT] Store updated, checking for re-render...');
      
      // Force a re-render immediately
      console.log('🔍 [DATE FORMAT] Forcing re-render...');
      setForceUpdate(prev => prev + 1);
      
      toast({
        title: "Date format updated",
        description: `Changed to ${newFormat}`,
      });
    }
    
    setEditingMapping(null);
    setSelectedDateFormat('');
  };

  // Function to consolidate date fields and format them
  const consolidateDateFields = (mappings: any[], csvImportData?: any) => {
    // Detect date columns by their names or role
    const isDateColumn = (mapping: any) => {
      // Check if role is explicitly 'date' (handle both cases)
      if (mapping.role === 'date' || mapping.role === 'Date') return true;
      
      // Check if field_type is 'date'
      if (mapping.field_type === 'date') return true;
      
      // Check if the column name looks like a date (for CSV columns)
      const columnName = mapping.originalName || mapping.field_name || '';
      const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$|^\d{4}-\d{1,2}-\d{1,2}$|^\d{1,2}-\d{1,2}-\d{4}$/;
      if (datePattern.test(columnName)) return true;
      
      return false;
    };

    // Function to detect date format from a date string
    const detectDateFormat = (dateStr: string) => {
      // Helper function to validate date
      const isValidDate = (year: number, month: number, day: number) => {
        if (year < 1900 || year > 2100) return false;
        if (month < 1 || month > 12) return false;
        if (day < 1 || day > 31) return false;
        
        // Check for valid day in month
        const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (month === 2 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) {
          daysInMonth[1] = 29; // Leap year
        }
        return day <= daysInMonth[month - 1];
      };

      // Helper function to validate and return format with confidence
      const validateAndReturnFormat = (parts: string[], format: string, dayIndex: number, monthIndex: number, yearIndex: number) => {
        const day = parseInt(parts[dayIndex]);
        const month = parseInt(parts[monthIndex]);
        const year = parseInt(parts[yearIndex]);
        
        if (isValidDate(year, month, day)) {
          return { format, confidence: 'high' };
        }
        
        // Try swapping day and month
        if (isValidDate(year, day, month)) {
          return { format: format.replace('DD', 'MM').replace('MM', 'DD'), confidence: 'medium' };
        }
        
        return { format, confidence: 'low' };
      };

      // Check for DD/MM/YYYY format (e.g., "25/12/2023")
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        
        // If day > 12, it's likely DD/MM/YYYY
        if (day > 12) {
          return validateAndReturnFormat(parts, 'DD/MM/YYYY', 0, 1, 2);
        }
        // If month > 12, it's definitely DD/MM/YYYY
        if (month > 12) {
          return validateAndReturnFormat(parts, 'DD/MM/YYYY', 0, 1, 2);
        }
        // Otherwise, assume MM/DD/YYYY (American format) but validate
        return validateAndReturnFormat(parts, 'MM/DD/YYYY', 0, 1, 2);
      }
      
      // Check for DD-MM-YYYY format (e.g., "25-12-2023")
      if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        
        // If day > 12, it's likely DD-MM-YYYY
        if (day > 12) {
          return validateAndReturnFormat(parts, 'DD-MM-YYYY', 0, 1, 2);
        }
        // If month > 12, it's definitely DD-MM-YYYY
        if (month > 12) {
          return validateAndReturnFormat(parts, 'DD-MM-YYYY', 0, 1, 2);
        }
        // Otherwise, assume MM-DD-YYYY (American format) but validate
        return validateAndReturnFormat(parts, 'MM-DD-YYYY', 0, 1, 2);
      }
      
      // Check for YYYY-MM-DD format (ISO standard)
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        return validateAndReturnFormat(parts, 'YYYY-MM-DD', 2, 1, 0);
      }
      
      // Check for YYYY/MM/DD format (e.g., "2023/12/25")
      if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        return validateAndReturnFormat(parts, 'YYYY/MM/DD', 2, 1, 0);
      }
      
      // Check for MM/DD/YY format (e.g., "12/25/23")
      if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        const year = parseInt(parts[2]);
        // Assume 20xx for years 00-29, 19xx for years 30-99
        const fullYear = year < 30 ? 2000 + year : 1900 + year;
        const day = parseInt(parts[1]);
        const month = parseInt(parts[0]);
        
        if (isValidDate(fullYear, month, day)) {
          return { format: 'MM/DD/YY', confidence: 'high' };
        }
        if (isValidDate(fullYear, day, month)) {
          return { format: 'DD/MM/YY', confidence: 'medium' };
        }
        return { format: 'MM/DD/YY', confidence: 'low' };
      }
      
      // Check for DD/MM/YY format (e.g., "25/12/23")
      if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        const year = parseInt(parts[2]);
        const fullYear = year < 30 ? 2000 + year : 1900 + year;
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        
        if (isValidDate(fullYear, month, day)) {
          return { format: 'DD/MM/YY', confidence: 'high' };
        }
        if (isValidDate(fullYear, day, month)) {
          return { format: 'MM/DD/YY', confidence: 'medium' };
        }
        return { format: 'DD/MM/YY', confidence: 'low' };
      }
      
      // Check for MM-DD-YYYY format (American with dashes)
      if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        return validateAndReturnFormat(parts, 'MM-DD-YYYY', 1, 0, 2);
      }
      
      // Check for DD-MM-YYYY format (European with dashes)
      if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        if (day > 12) {
          return validateAndReturnFormat(parts, 'DD-MM-YYYY', 0, 1, 2);
        }
        if (month > 12) {
          return validateAndReturnFormat(parts, 'DD-MM-YYYY', 0, 1, 2);
        }
        return validateAndReturnFormat(parts, 'MM-DD-YYYY', 1, 0, 2);
      }
      
      // Check for DD-MM-YY format (European short year with dashes)
      if (/^\d{1,2}-\d{1,2}-\d{2}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const year = parseInt(parts[2]);
        const fullYear = year < 30 ? 2000 + year : 1900 + year;
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        
        if (isValidDate(fullYear, month, day)) {
          return { format: 'DD-MM-YY', confidence: 'high' };
        }
        if (isValidDate(fullYear, day, month)) {
          return { format: 'MM-DD-YY', confidence: 'medium' };
        }
        return { format: 'DD-MM-YY', confidence: 'low' };
      }
      
      // Check for MM-DD-YY format (American short year with dashes)
      if (/^\d{1,2}-\d{1,2}-\d{2}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const year = parseInt(parts[2]);
        const fullYear = year < 30 ? 2000 + year : 1900 + year;
        const day = parseInt(parts[1]);
        const month = parseInt(parts[0]);
        
        if (isValidDate(fullYear, month, day)) {
          return { format: 'MM-DD-YY', confidence: 'high' };
        }
        if (isValidDate(fullYear, day, month)) {
          return { format: 'DD-MM-YY', confidence: 'medium' };
        }
        return { format: 'MM-DD-YY', confidence: 'low' };
      }
      
      // Check for YYYY-MM-DD format (ISO standard)
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        return validateAndReturnFormat(parts, 'YYYY-MM-DD', 2, 1, 0);
      }
      
      // Check for YYYY/MM/DD format (ISO with slashes)
      if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        return validateAndReturnFormat(parts, 'YYYY/MM/DD', 2, 1, 0);
      }
      
      // Check for YYYY.MM.DD format (ISO with dots)
      if (/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split('.');
        return validateAndReturnFormat(parts, 'YYYY.MM.DD', 2, 1, 0);
      }
      
      // Check for DD.MM.YYYY format (European with dots)
      if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('.');
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        if (day > 12) {
          return validateAndReturnFormat(parts, 'DD.MM.YYYY', 0, 1, 2);
        }
        if (month > 12) {
          return validateAndReturnFormat(parts, 'DD.MM.YYYY', 0, 1, 2);
        }
        return validateAndReturnFormat(parts, 'MM.DD.YYYY', 1, 0, 2);
      }
      
      // Check for DD.MM.YY format (European with dots, short year)
      if (/^\d{1,2}\.\d{1,2}\.\d{2}$/.test(dateStr)) {
        const parts = dateStr.split('.');
        const year = parseInt(parts[2]);
        const fullYear = year < 30 ? 2000 + year : 1900 + year;
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        
        if (isValidDate(fullYear, month, day)) {
          return { format: 'DD.MM.YY', confidence: 'high' };
        }
        if (isValidDate(fullYear, day, month)) {
          return { format: 'MM.DD.YY', confidence: 'medium' };
        }
        return { format: 'DD.MM.YY', confidence: 'low' };
      }
      
      // Check for MM.DD.YYYY format (American with dots)
      if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('.');
        return validateAndReturnFormat(parts, 'MM.DD.YYYY', 1, 0, 2);
      }
      
      // Check for MM.DD.YY format (American with dots, short year)
      if (/^\d{1,2}\.\d{1,2}\.\d{2}$/.test(dateStr)) {
        const parts = dateStr.split('.');
        const year = parseInt(parts[2]);
        const fullYear = year < 30 ? 2000 + year : 1900 + year;
        const day = parseInt(parts[1]);
        const month = parseInt(parts[0]);
        
        if (isValidDate(fullYear, month, day)) {
          return { format: 'MM.DD.YY', confidence: 'high' };
        }
        if (isValidDate(fullYear, day, month)) {
          return { format: 'DD.MM.YY', confidence: 'medium' };
        }
        return { format: 'MM.DD.YY', confidence: 'low' };
      }
      
      // Check for YYYY format (year only)
      if (/^\d{4}$/.test(dateStr)) {
        const year = parseInt(dateStr);
        if (year >= 1900 && year <= 2100) {
          return { format: 'YYYY', confidence: 'high' };
        }
        return { format: 'YYYY', confidence: 'low' };
      }
      
      // Check for YY format (short year only)
      if (/^\d{2}$/.test(dateStr)) {
        const year = parseInt(dateStr);
        if (year >= 0 && year <= 99) {
          return { format: 'YY', confidence: 'high' };
        }
        return { format: 'YY', confidence: 'low' };
      }
      
      // Check for MM/YYYY format (month/year)
      if (/^\d{1,2}\/\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        const month = parseInt(parts[0]);
        const year = parseInt(parts[1]);
        if (month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
          return { format: 'MM/YYYY', confidence: 'high' };
        }
        return { format: 'MM/YYYY', confidence: 'low' };
      }
      
      // Check for YYYY/MM format (year/month)
      if (/^\d{4}\/\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        if (month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
          return { format: 'YYYY/MM', confidence: 'high' };
        }
        return { format: 'YYYY/MM', confidence: 'low' };
      }
      
      // Check for MM-YYYY format (month/year with dash)
      if (/^\d{1,2}-\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const month = parseInt(parts[0]);
        const year = parseInt(parts[1]);
        if (month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
          return { format: 'MM-YYYY', confidence: 'high' };
        }
        return { format: 'MM-YYYY', confidence: 'low' };
      }
      
      // Check for YYYY-MM format (year/month with dash)
      if (/^\d{4}-\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        if (month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
          return { format: 'YYYY-MM', confidence: 'high' };
        }
        return { format: 'YYYY-MM', confidence: 'low' };
      }
      
      // Check for MM.YYYY format (month/year with dot)
      if (/^\d{1,2}\.\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('.');
        const month = parseInt(parts[0]);
        const year = parseInt(parts[1]);
        if (month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
          return { format: 'MM.YYYY', confidence: 'high' };
        }
        return { format: 'MM.YYYY', confidence: 'low' };
      }
      
      // Check for YYYY.MM format (year/month with dot)
      if (/^\d{4}\.\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split('.');
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        if (month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
          return { format: 'YYYY.MM', confidence: 'high' };
        }
        return { format: 'YYYY.MM', confidence: 'low' };
      }
      
      // Weekly formats
      // Check for YYYY-WW format (ISO week format, e.g., "2023-W01")
      if (/^\d{4}-W\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split('-W');
        const year = parseInt(parts[0]);
        const week = parseInt(parts[1]);
        if (year >= 1900 && year <= 2100 && week >= 1 && week <= 53) {
          return { format: 'YYYY-WW', confidence: 'high' };
        }
        return { format: 'YYYY-WW', confidence: 'low' };
      }
      
      // Check for WW-YYYY format (week-year, e.g., "W01-2023")
      if (/^W\d{1,2}-\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const week = parseInt(parts[0].substring(1));
        const year = parseInt(parts[1]);
        if (year >= 1900 && year <= 2100 && week >= 1 && week <= 53) {
          return { format: 'WW-YYYY', confidence: 'high' };
        }
        return { format: 'WW-YYYY', confidence: 'low' };
      }
      
      // Check for YYYY/WW format (week with slash, e.g., "2023/W01")
      if (/^\d{4}\/W\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split('/W');
        const year = parseInt(parts[0]);
        const week = parseInt(parts[1]);
        if (year >= 1900 && year <= 2100 && week >= 1 && week <= 53) {
          return { format: 'YYYY/WW', confidence: 'high' };
        }
        return { format: 'YYYY/WW', confidence: 'low' };
      }
      
      // Check for WW/YYYY format (week-year with slash, e.g., "W01/2023")
      if (/^W\d{1,2}\/\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        const week = parseInt(parts[0].substring(1));
        const year = parseInt(parts[1]);
        if (year >= 1900 && year <= 2100 && week >= 1 && week <= 53) {
          return { format: 'WW/YYYY', confidence: 'high' };
        }
        return { format: 'WW/YYYY', confidence: 'low' };
      }
      
      // Check for YYYY.WW format (week with dot, e.g., "2023.W01")
      if (/^\d{4}\.W\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split('.W');
        const year = parseInt(parts[0]);
        const week = parseInt(parts[1]);
        if (year >= 1900 && year <= 2100 && week >= 1 && week <= 53) {
          return { format: 'YYYY.WW', confidence: 'high' };
        }
        return { format: 'YYYY.WW', confidence: 'low' };
      }
      
      // Check for WW.YYYY format (week-year with dot, e.g., "W01.2023")
      if (/^W\d{1,2}\.\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('.');
        const week = parseInt(parts[0].substring(1));
        const year = parseInt(parts[1]);
        if (year >= 1900 && year <= 2100 && week >= 1 && week <= 53) {
          return { format: 'WW.YYYY', confidence: 'high' };
        }
        return { format: 'WW.YYYY', confidence: 'low' };
      }
      
      // Check for YYYY-WW format (ISO week without W prefix, e.g., "2023-01")
      if (/^\d{4}-\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const year = parseInt(parts[0]);
        const week = parseInt(parts[1]);
        if (year >= 1900 && year <= 2100 && week >= 1 && week <= 53) {
          return { format: 'YYYY-WW', confidence: 'high' };
        }
        return { format: 'YYYY-WW', confidence: 'low' };
      }
      
      // Check for WW-YYYY format (week-year without W prefix, e.g., "01-2023")
      if (/^\d{1,2}-\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const week = parseInt(parts[0]);
        const year = parseInt(parts[1]);
        if (year >= 1900 && year <= 2100 && week >= 1 && week <= 53) {
          return { format: 'WW-YYYY', confidence: 'high' };
        }
        return { format: 'WW-YYYY', confidence: 'low' };
      }
      
      // Quarterly formats
      // Check for YYYY-QN format (quarter format, e.g., "2023-Q1")
      if (/^\d{4}-Q[1-4]$/.test(dateStr)) {
        const parts = dateStr.split('-Q');
        const year = parseInt(parts[0]);
        const quarter = parseInt(parts[1]);
        if (year >= 1900 && year <= 2100 && quarter >= 1 && quarter <= 4) {
          return { format: 'YYYY-QN', confidence: 'high' };
        }
        return { format: 'YYYY-QN', confidence: 'low' };
      }
      
      // Check for QN-YYYY format (quarter-year, e.g., "Q1-2023")
      if (/^Q[1-4]-\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const quarter = parseInt(parts[0].substring(1));
        const year = parseInt(parts[1]);
        if (year >= 1900 && year <= 2100 && quarter >= 1 && quarter <= 4) {
          return { format: 'QN-YYYY', confidence: 'high' };
        }
        return { format: 'QN-YYYY', confidence: 'low' };
      }
      
      // Check for YYYY/QN format (quarter with slash, e.g., "2023/Q1")
      if (/^\d{4}\/Q[1-4]$/.test(dateStr)) {
        const parts = dateStr.split('/Q');
        const year = parseInt(parts[0]);
        const quarter = parseInt(parts[1]);
        if (year >= 1900 && year <= 2100 && quarter >= 1 && quarter <= 4) {
          return { format: 'YYYY/QN', confidence: 'high' };
        }
        return { format: 'YYYY/QN', confidence: 'low' };
      }
      
      // Check for QN/YYYY format (quarter-year with slash, e.g., "Q1/2023")
      if (/^Q[1-4]\/\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        const quarter = parseInt(parts[0].substring(1));
        const year = parseInt(parts[1]);
        if (year >= 1900 && year <= 2100 && quarter >= 1 && quarter <= 4) {
          return { format: 'QN/YYYY', confidence: 'high' };
        }
        return { format: 'QN/YYYY', confidence: 'low' };
      }
      
      // Check for YYYY.QN format (quarter with dot, e.g., "2023.Q1")
      if (/^\d{4}\.Q[1-4]$/.test(dateStr)) {
        const parts = dateStr.split('.Q');
        const year = parseInt(parts[0]);
        const quarter = parseInt(parts[1]);
        if (year >= 1900 && year <= 2100 && quarter >= 1 && quarter <= 4) {
          return { format: 'YYYY.QN', confidence: 'high' };
        }
        return { format: 'YYYY.QN', confidence: 'low' };
      }
      
      // Check for QN.YYYY format (quarter-year with dot, e.g., "Q1.2023")
      if (/^Q[1-4]\.\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('.');
        const quarter = parseInt(parts[0].substring(1));
        const year = parseInt(parts[1]);
        if (year >= 1900 && year <= 2100 && quarter >= 1 && quarter <= 4) {
          return { format: 'QN.YYYY', confidence: 'high' };
        }
        return { format: 'QN.YYYY', confidence: 'low' };
      }
      
      // Check for YYYY-QN format (quarter without Q prefix, e.g., "2023-1")
      if (/^\d{4}-[1-4]$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const year = parseInt(parts[0]);
        const quarter = parseInt(parts[1]);
        if (year >= 1900 && year <= 2100 && quarter >= 1 && quarter <= 4) {
          return { format: 'YYYY-QN', confidence: 'high' };
        }
        return { format: 'YYYY-QN', confidence: 'low' };
      }
      
      // Check for QN-YYYY format (quarter-year without Q prefix, e.g., "1-2023")
      if (/^[1-4]-\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const quarter = parseInt(parts[0]);
        const year = parseInt(parts[1]);
        if (year >= 1900 && year <= 2100 && quarter >= 1 && quarter <= 4) {
          return { format: 'QN-YYYY', confidence: 'high' };
        }
        return { format: 'QN-YYYY', confidence: 'low' };
      }
      
      // Yearly/Fiscal Year formats
      // Check for FY-YYYY format (fiscal year, e.g., "FY-2023")
      if (/^FY-\d{4}$/.test(dateStr)) {
        const year = parseInt(dateStr.split('-')[1]);
        if (year >= 1900 && year <= 2100) {
          return { format: 'FY-YYYY', confidence: 'high' };
        }
        return { format: 'FY-YYYY', confidence: 'low' };
      }
      
      // Check for YYYY-FY format (year-fiscal, e.g., "2023-FY")
      if (/^\d{4}-FY$/.test(dateStr)) {
        const year = parseInt(dateStr.split('-')[0]);
        if (year >= 1900 && year <= 2100) {
          return { format: 'YYYY-FY', confidence: 'high' };
        }
        return { format: 'YYYY-FY', confidence: 'low' };
      }
      
      // Check for FY/YYYY format (fiscal year with slash, e.g., "FY/2023")
      if (/^FY\/\d{4}$/.test(dateStr)) {
        const year = parseInt(dateStr.split('/')[1]);
        if (year >= 1900 && year <= 2100) {
          return { format: 'FY/YYYY', confidence: 'high' };
        }
        return { format: 'FY/YYYY', confidence: 'low' };
      }
      
      // Check for YYYY/FY format (year-fiscal with slash, e.g., "2023/FY")
      if (/^\d{4}\/FY$/.test(dateStr)) {
        const year = parseInt(dateStr.split('/')[0]);
        if (year >= 1900 && year <= 2100) {
          return { format: 'YYYY/FY', confidence: 'high' };
        }
        return { format: 'YYYY/FY', confidence: 'low' };
      }
      
      // Check for FY.YYYY format (fiscal year with dot, e.g., "FY.2023")
      if (/^FY\.\d{4}$/.test(dateStr)) {
        const year = parseInt(dateStr.split('.')[1]);
        if (year >= 1900 && year <= 2100) {
          return { format: 'FY.YYYY', confidence: 'high' };
        }
        return { format: 'FY.YYYY', confidence: 'low' };
      }
      
      // Check for YYYY.FY format (year-fiscal with dot, e.g., "2023.FY")
      if (/^\d{4}\.FY$/.test(dateStr)) {
        const year = parseInt(dateStr.split('.')[0]);
        if (year >= 1900 && year <= 2100) {
          return { format: 'YYYY.FY', confidence: 'high' };
        }
        return { format: 'YYYY.FY', confidence: 'low' };
      }
      
      // Check for YYYY-YY format (fiscal year range, e.g., "2023-24")
      if (/^\d{4}-\d{2}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const year1 = parseInt(parts[0]);
        const year2 = parseInt(parts[1]);
        if (year2 >= 0 && year2 <= 99) {
          return { format: 'YYYY-YY', confidence: 'high' };
        }
        return { format: 'YYYY-YY', confidence: 'low' };
      }
      
      // Check for YY-YYYY format (fiscal year range reverse, e.g., "23-2024")
      if (/^\d{2}-\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const year1 = parseInt(parts[0]);
        const year2 = parseInt(parts[1]);
        if (year1 >= 0 && year1 <= 99) {
          return { format: 'YY-YYYY', confidence: 'high' };
        }
        return { format: 'YY-YYYY', confidence: 'low' };
      }
      
      // Check for YYYY/YY format (fiscal year range with slash, e.g., "2023/24")
      if (/^\d{4}\/\d{2}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        const year1 = parseInt(parts[0]);
        const year2 = parseInt(parts[1]);
        if (year2 >= 0 && year2 <= 99) {
          return { format: 'YYYY/YY', confidence: 'high' };
        }
        return { format: 'YYYY/YY', confidence: 'low' };
      }
      
      // Check for YY/YYYY format (fiscal year range reverse with slash, e.g., "23/2024")
      if (/^\d{2}\/\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        const year1 = parseInt(parts[0]);
        const year2 = parseInt(parts[1]);
        if (year1 >= 0 && year1 <= 99) {
          return { format: 'YY/YYYY', confidence: 'high' };
        }
        return { format: 'YY/YYYY', confidence: 'low' };
      }
      
      // Check for YYYY.YY format (fiscal year range with dot, e.g., "2023.24")
      if (/^\d{4}\.\d{2}$/.test(dateStr)) {
        const parts = dateStr.split('.');
        const year1 = parseInt(parts[0]);
        const year2 = parseInt(parts[1]);
        if (year2 >= 0 && year2 <= 99) {
          return { format: 'YYYY.YY', confidence: 'high' };
        }
        return { format: 'YYYY.YY', confidence: 'low' };
      }
      
      // Check for YY.YYYY format (fiscal year range reverse with dot, e.g., "23.2024")
      if (/^\d{2}\.\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('.');
        const year1 = parseInt(parts[0]);
        const year2 = parseInt(parts[1]);
        if (year1 >= 0 && year1 <= 99) {
          return { format: 'YY.YYYY', confidence: 'low' };
        }
        return { format: 'YY.YYYY', confidence: 'low' };
      }
      
      // Default fallback with low confidence
      return { format: 'MM/DD/YYYY', confidence: 'low' };
    };
    
    const dateMappings = mappings.filter(isDateColumn);
    const nonDateMappings = mappings.filter(m => !isDateColumn(m));
    
    // If we have date mappings, consolidate them
    if (dateMappings.length > 0) {
      // Detect the actual date format from the first date mapping
      let detectedFormat = 'MM/DD/YYYY'; // default

      // First, check if any date mappings have a user-selected dateFormat
      const userSelectedFormat = dateMappings.find(mapping => mapping.dateFormat && mapping.dateFormat !== undefined);

      if (userSelectedFormat) {
        // Use the user-selected format
        detectedFormat = userSelectedFormat.dateFormat;
        console.log('🔍 [CONSOLIDATE] Using user-selected format:', detectedFormat);
      }
      // If no user-selected format, check if CSV data has a dateFormat property
      else if (csvImportData && csvImportData.dateFormat) {
        detectedFormat = csvImportData.dateFormat;
        console.log('🔍 [CONSOLIDATE] Using CSV data dateFormat:', detectedFormat);
      }
      // If no user-selected format, try to detect from the originalName
      else if (dateMappings[0].originalName) {
        const detection = detectDateFormat(dateMappings[0].originalName);
        detectedFormat = detection.format;
        console.log('🔍 [CONSOLIDATE] Using auto-detected format:', detectedFormat);
      }
      
      const firstDateIndex = mappings.findIndex(isDateColumn);
      
      const consolidatedDate = {
        ...dateMappings[0],
        originalName: dateMappings.length === 1 ? dateMappings[0].originalName : 'Date Columns',
        field_name: dateMappings.length === 1 ? dateMappings[0].field_name : 'Date Fields',
        role: 'date',
        field_type: 'date',
        dateFormat: detectedFormat,
        count: dateMappings.length
      };
      
      // Insert the consolidated date at the position of the first date column
      const result = [...mappings];
      result.splice(firstDateIndex, dateMappings.length, consolidatedDate);
      
      return result;
    }
    
    return mappings;
  };

  const formatDateDisplay = (format: string) => {
    if (!format) return 'MM/DD/YYYY';
    return format.toUpperCase();
  };



  const renderTransformationFlow = () => {
    const hasDatabaseMappings = store.fieldMappings && store.fieldMappings.length > 0;
    
    // Get the correct CSV data based on the selected division
    let currentCsvData = null;
    if (store.orgStructure?.importLevel === 'division' && selectedDivisionForMapping) {
      // In division-specific mode, get the CSV data for the selected division
      currentCsvData = store.getCurrentCsvData(selectedDivisionForMapping);
    } else {
      // In company-wide mode, use the global CSV data
      currentCsvData = store.getCurrentCsvData();
    }
    
    const hasCsvMappings = currentCsvData && currentCsvData.columnMappings && currentCsvData.columnMappings.length > 0;
    
    // Filter field mappings by selected division if in division-specific mode
    const filteredFieldMappings = store.orgStructure?.importLevel === 'division' 
      ? (selectedDivisionForMapping 
          ? store.fieldMappings?.filter((mapping: any) => {
              // In division-specific mode, only show mappings that are explicitly division-specific
              // If mapping has division_id, check if it matches the selected division and is active
              if (mapping.division_id) {
                const division = store.divisions?.find((d: any) => d.id === mapping.division_id) as any;
                return division?.name === selectedDivisionForMapping && division?.is_active !== false;
              }
              // If mapping has division_name, check if it matches and division is active
              if (mapping.division_name) {
                const division = store.divisions?.find((d: any) => d.name === mapping.division_name) as any;
                return mapping.division_name === selectedDivisionForMapping && division?.is_active !== false;
              }
              // If no division info, exclude it (don't show company-wide mappings in division mode)
              return false;
            }) || []
          : []) // Show no field mappings when no division is selected in division-specific mode
      : store.fieldMappings || [];
    
    // For "withoutDivisionColumn" scenario, we should not show any database mappings
    // since they haven't been configured yet - only show CSV mappings
    const isWithoutDivisionColumn = store.orgStructure?.divisionCsvType === 'withoutDivisionColumn';
    const shouldShowDatabaseMappings = !isWithoutDivisionColumn || store.orgStructure?.importLevel !== 'division';
    
    const hasFilteredDatabaseMappings = filteredFieldMappings.length > 0;
    const effectiveDatabaseMappings = shouldShowDatabaseMappings ? hasFilteredDatabaseMappings : false;


    console.log('🔍 [RENDER DEBUG] Main condition check:', {
      effectiveDatabaseMappings,
      hasCsvMappings,
      importLevel: store.orgStructure?.importLevel,
      selectedDivisionForMapping
    });
    
    if (!effectiveDatabaseMappings && !hasCsvMappings) {
      console.log('🔍 [RENDER DEBUG] Showing main "No mappings" message');
      return (
        <div className="text-center py-8">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {store.orgStructure?.importLevel === 'division' && !selectedDivisionForMapping 
              ? 'Select a Division to View Field Mappings'
              : selectedDivisionForMapping 
                ? `No Division-Specific Field Mappings Found for ${selectedDivisionForMapping}` 
                : 'No Column Mappings Found'
            }
          </h3>
          <p className="text-gray-600 mb-4">
            {store.orgStructure?.importLevel === 'division' && !selectedDivisionForMapping
              ? 'Choose a division from the cards above to view its division-specific field mappings.'
              : selectedDivisionForMapping 
                ? `No division-specific field mappings have been configured for ${selectedDivisionForMapping} yet. Upload a CSV file to configure division-specific mappings.`
                : 'No column mappings have been configured yet. You can upload a CSV file to configure mappings.'
            }
          </p>
        </div>
      );
    }

    // If no CSV mappings, show only database fields (but not in "withoutDivisionColumn" scenario)
    if (!hasCsvMappings && shouldShowDatabaseMappings) {
    return (
      <div className="space-y-6">
          {/* Current Field Mapping Header */}
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {selectedDivisionForMapping ? `Division-Specific Field Mapping for ${selectedDivisionForMapping}` : 'Current Field Mapping'}
              </h3>
            <p className="text-gray-600">
              {selectedDivisionForMapping 
                ? `Division-specific field configuration for ${selectedDivisionForMapping}`
                : 'Your current database field configuration'
              }
            </p>
          </div>

          {/* Database Fields Only */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  {selectedDivisionForMapping ? `${selectedDivisionForMapping} Division Fields` : 'Database Fields'}
                </h4>
                <Badge variant="outline" className="text-blue-700">
                  {filteredFieldMappings?.length || 0} fields
              </Badge>
            </div>
            
              {hasFilteredDatabaseMappings ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {consolidateDateFields(filteredFieldMappings)
                    .sort((a: any, b: any) => (a.field_order || 0) - (b.field_order || 0))
                    .map((mapping: any, index: number) => (
                    <div key={`db-${index}`} className="flex items-center justify-between p-2 bg-white rounded border">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="font-medium text-sm">
                          {mapping.field_type === 'date' ? 'Date Columns' : (mapping.dataset_column || mapping.field_name)}
                        </span>
                        {mapping.count > 1 && (
                          <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">
                            {mapping.count}
                          </Badge>
                        )}
                        {mapping.field_type === 'date' && (
                          <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                            {formatDateDisplay(mapping.dataset_column || 'MM/DD/YYYY')}
                          </Badge>
                        )}
                      </div>
                          <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {getRoleIcon(mapping.field_type)} {mapping.field_type === 'aggregatable' ? (mapping.dataset_column || mapping.field_name) : getRoleNameFromFieldType(mapping.field_type, mapping.field_name)}
                        </Badge>
                          </div>
                    </div>
                    ))}
              </div>
              ) : (
                <div className="text-center py-4 text-blue-600">
                  <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {selectedDivisionForMapping 
                      ? `No division-specific field mappings configured for ${selectedDivisionForMapping}`
                      : 'No database mappings configured'
                    }
                  </p>
          </div>
        )}
            </div>
          </div>
        </div>
      );
    }
    
    // For "withoutDivisionColumn" scenario with no CSV mappings, show a specific message
    console.log('🔍 [RENDER DEBUG] Checking conditions:', {
      hasCsvMappings,
      isWithoutDivisionColumn,
      selectedDivisionForMapping,
      shouldShowDatabaseMappings,
      effectiveDatabaseMappings
    });
    
    console.log('🔍 [RENDER DEBUG] "No CSV Data" condition check:', {
      condition1: !hasCsvMappings,
      condition2: isWithoutDivisionColumn,
      condition3: selectedDivisionForMapping,
      allConditions: !hasCsvMappings && isWithoutDivisionColumn && selectedDivisionForMapping
    });
    
    if (!hasCsvMappings && isWithoutDivisionColumn && selectedDivisionForMapping) {
      console.log('🔍 [RENDER DEBUG] Showing "No CSV Data" message for:', selectedDivisionForMapping);
      return (
        <div className="text-center py-8">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No CSV Data for {selectedDivisionForMapping}
          </h3>
          <p className="text-gray-600 mb-4">
            No CSV file has been imported for {selectedDivisionForMapping} yet. Upload a CSV file to configure division-specific field mappings.
          </p>
        </div>
      );
    }

    // Full transformation flow when CSV is imported
    // But only show if not in division-specific mode OR if a division is selected
    const shouldShowTransformation = store.orgStructure?.importLevel !== 'division' || selectedDivisionForMapping;
    
    if (!shouldShowTransformation) {
      return (
        <div className="text-center py-8">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Select a Division to View Field Mapping Transformation
          </h3>
          <p className="text-gray-600 mb-4">
            Choose a division from the cards above to view how CSV columns will be mapped to division-specific fields.
          </p>
        </div>
      );
    }
    
    // Additional check: if in division-specific mode and no CSV mappings, don't show transformation
    if (store.orgStructure?.importLevel === 'division' && selectedDivisionForMapping && !hasCsvMappings) {
      return (
        <div className="text-center py-8">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No CSV Data Available for Transformation
          </h3>
          <p className="text-gray-600 mb-4">
            Upload a CSV file to see how columns will be mapped to division-specific fields for {selectedDivisionForMapping}.
          </p>
        </div>
      );
    }
    
    return (
      <div className="space-y-8">
        {/* Current Field Mapping Header */}
        <div className="text-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {selectedDivisionForMapping ? `Field Mapping Transformation for ${selectedDivisionForMapping}` : 'Field Mapping Transformation'}
              </h3>
          <p className="text-gray-600">
            {selectedDivisionForMapping 
              ? `See how ${selectedDivisionForMapping} fields will be connected to your CSV columns`
              : 'See how your database fields will be connected to your CSV columns'
            }
          </p>
        </div>

        {/* Visual Flow */}
        <div className="relative">
          {/* Flow Container */}
          <div className="flex items-center justify-between space-x-4">
            {/* Database Side */}
            <div className="flex-1">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    {selectedDivisionForMapping ? `${selectedDivisionForMapping} Division Fields` : 'Database Fields'}
                  </h4>
                  <Badge variant="outline" className="text-blue-700">
                    {filteredFieldMappings?.length || 0} fields
              </Badge>
            </div>
            
                {hasFilteredDatabaseMappings ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {consolidateDateFields(filteredFieldMappings)
                      .sort((a: any, b: any) => (a.field_order || 0) - (b.field_order || 0))
                      .map((mapping: any, index: number) => (
                      <div key={`db-${index}`} className="flex items-center justify-between p-2 bg-white rounded border">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="font-medium text-sm">
                            {mapping.field_type === 'date' ? 'Date Columns' : (mapping.dataset_column || mapping.field_name)}
                  </span>
                          {mapping.count > 1 && (
                            <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">
                              {mapping.count}
                            </Badge>
                          )}
                          {mapping.field_type === 'date' && (
                            <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                              {formatDateDisplay(mapping.dataset_column || 'MM/DD/YYYY')}
                            </Badge>
                )}
              </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {getRoleIcon(mapping.field_type)} {mapping.field_type === 'aggregatable' ? (mapping.dataset_column || mapping.field_name) : getRoleNameFromFieldType(mapping.field_type, mapping.field_name)}
                          </Badge>
                             </div>
                      </div>
                    ))}
                                 </div>
                               ) : (
                  <div className="text-center py-4 text-blue-600">
                    <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {selectedDivisionForMapping 
                        ? `No division-specific field mappings configured for ${selectedDivisionForMapping}`
                        : 'No database mappings configured'
                      }
                    </p>
                                 </div>
                               )}
                             </div>
                             </div>

            {/* Transformation Arrow */}
            <div className="flex flex-col items-center space-y-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
              <div className="text-xs text-gray-500 text-center">
                Transform
              </div>
            </div>
            
            {/* CSV Side */}
            <div className="flex-1">
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-green-900 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    CSV Columns
                  </h4>
                  <Badge variant="outline" className="text-green-700">
                    {hasCsvMappings ? consolidateDateFields(currentCsvData.columnMappings, currentCsvData).length : 0} fields
                  </Badge>
                </div>
                
                {hasCsvMappings ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto" key={`csv-mappings-${currentCsvData?.csvHash || 'no-data'}-${forceUpdate}`}>
                    {consolidateDateFields(currentCsvData.columnMappings, currentCsvData).map((mapping: any, index: number) => (
                        <div key={`csv-${index}`} className="flex items-center justify-between p-2 bg-white rounded border">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="font-medium text-sm">{mapping.originalName}</span>
                            {mapping.count > 1 && (
                              <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                                {mapping.count}
                              </Badge>
                            )}
                            {mapping.dateFormat && (
                              <Badge 
                                variant="outline" 
                                className="text-xs bg-blue-100 text-blue-700 cursor-pointer hover:bg-blue-200 transition-colors"
                                onClick={() => handleDateFormatClick(mapping)}
                              >
                                {formatDateDisplay(mapping.dateFormat)}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {getRoleIcon(mapping.role)} {mapping.role === 'date' || mapping.role === 'Date' ? 'Date' : mapping.role}
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-green-600">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No CSV mappings yet</p>
                  </div>
                )}
              </div>
            </div>
               </div>
            </div>

        {/* Transformation Summary */}
        {(hasDatabaseMappings || hasCsvMappings) && (
          <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Transformation Summary
              </h4>
              {/* Debug button to save mappings */}
              <button
                onClick={async () => {
                  try {
                    
                    if (!currentCsvData?.columnMappings?.length) {
                      alert('No CSV mappings to save');
                      return;
                    }
                    
                    // Get company ID and division ID from the store
                          const companyId = store.company?.id;
      const divisionId = store.orgStructure?.importLevel === 'division' ?
        store.orgStructure.pendingDivisions?.[0]?.id : null;
                    
                    if (!companyId) {
                      alert('No company ID available');
                      return;
                    }
                    
                    // Prepare mappings for database - use consolidated mappings
                    const consolidatedMappings = consolidateDateFields(currentCsvData.columnMappings, currentCsvData);
                    const mappingsToSave = consolidatedMappings
                      .filter((mapping: any) => mapping.role && mapping.role !== 'unmapped')
                      .map((mapping: any) => ({
                        companyId,
                        datasetColumn: mapping.role === 'date' || mapping.role === 'Date' ? mapping.dateFormat : mapping.originalName,
                        role: mapping.role
                      }));
                                        
                    // Save to database
                    const response = await fetch('/api/field-mappings/debug-save', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
                      },
                      body: JSON.stringify({
                        companyId,
                        mappings: mappingsToSave,
                        divisionId
                      })
                    });
                    
                    if (response.ok) {
                      const result = await response.json();
                      const divisionText = divisionId ? ` for division ${divisionId}` : ' (company-wide)';
                      alert(`✅ Saved ${mappingsToSave.length} mappings to database${divisionText}`);
                    } else {
                      const error = await response.text();
                      console.error('🔍 [DEBUG] Save failed:', error);
                      alert(`❌ Failed to save: ${error}`);
                    }
                  } catch (error) {
                    console.error('🔍 [DEBUG] Error saving mappings:', error);
                    alert(`❌ Error: ${error.message}`);
                  }
                }}
                className="px-3 py-1 text-xs bg-orange-100 text-orange-700 border border-orange-300 rounded hover:bg-orange-200 transition-colors"
              >
                🐛 Save to DB (Debug)
              </button>
                </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {hasDatabaseMappings ? consolidateDateFields(filteredFieldMappings).length : 0}
                </div>
                <div className="text-gray-600">Database Fields</div>
                </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {hasCsvMappings ? consolidateDateFields(currentCsvData.columnMappings, currentCsvData).length : 0}
                </div>
                <div className="text-gray-600">CSV Fields</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600 relative group">
                  {hasDatabaseMappings && hasCsvMappings ? 
                    (() => {
                      const csvMappings = consolidateDateFields(currentCsvData.columnMappings, currentCsvData);
                      const dbMappings = consolidateDateFields(filteredFieldMappings);
                      
                      // Create mapping objects for comparison
                      const csvMappingPairs = csvMappings
                        .filter((mapping: any) => mapping.role && mapping.role !== 'unmapped')
                        .map((mapping: any) => ({
                          column: mapping.originalName,
                          role: mapping.role
                        }));
                      
                      const dbMappingPairs = dbMappings.map((mapping: any) => ({
                        column: mapping.dataset_column,
                        role: getRoleNameFromFieldType(mapping.field_type, mapping.field_name)
                      }));
                      
                      // Find new mappings (in CSV but not in DB)
                      const newMappings = csvMappingPairs.filter(csvMapping => {
                        // Special handling for date fields - treat them as the same field
                        if (csvMapping.role.toLowerCase() === 'date') {
                          const dbDateMapping = dbMappingPairs.find(dbMapping => 
                            dbMapping.role.toLowerCase() === 'date'
                          );
                          return !dbDateMapping; // Only "new" if no date field exists in DB
                        }
                        
                        // First check if this column exists in DB with a different role (it's a change, not new)
                        const dbMapping = dbMappingPairs.find(dbMapping => 
                          dbMapping.column === csvMapping.column
                        );
                        
                        if (dbMapping && dbMapping.role.toLowerCase() !== csvMapping.role.toLowerCase()) {
                          return false; // This is a change, not a new mapping
                        }
                        
                        // Then check if it's completely new
                        const existsInDB = dbMappingPairs.some(dbMapping => 
                          dbMapping.column === csvMapping.column && 
                          dbMapping.role.toLowerCase() === csvMapping.role.toLowerCase()
                        );

                        return !existsInDB;
                      });
                      
                      // Count both new mappings and role changes
                      const roleChanges = csvMappingPairs.filter(csvMapping => {
                        // Special handling for date fields - don't count as role changes
                        if (csvMapping.role.toLowerCase() === 'date') {
                          return false;
                        }
                        
                        const dbMapping = dbMappingPairs.find(dbMapping => 
                          dbMapping.column === csvMapping.column
                        );
                        return dbMapping && dbMapping.role.toLowerCase() !== csvMapping.role.toLowerCase();
                      });
                      
                      const totalChanges = newMappings.length + roleChanges.length;
                      
                      return totalChanges;
                    })() : 0}
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 max-w-xs">
                    {(() => {
                      if (!hasDatabaseMappings || !hasCsvMappings) return "No changes detected";
                      
                      const csvMappings = consolidateDateFields(currentCsvData.columnMappings, currentCsvData);
                      const dbMappings = consolidateDateFields(filteredFieldMappings);
                      
                      // Create mapping objects for comparison
                      const csvMappingPairs = csvMappings
                        .filter((mapping: any) => mapping.role && mapping.role !== 'unmapped')
                        .map((mapping: any) => ({
                          column: mapping.originalName,
                          role: mapping.role
                        }));
                      
                      const dbMappingPairs = dbMappings.map((mapping: any) => ({
                        column: mapping.dataset_column,
                        role: getRoleNameFromFieldType(mapping.field_type, mapping.field_name)
                      }));
                      
                      const changes = [];
                      const processedColumns = new Set();
                      
                      // First, find changed mappings (same column, different role)
                      csvMappingPairs.forEach(csvMapping => {
                        // Special handling for date fields - don't count as changes
                        if (csvMapping.role.toLowerCase() === 'date') {
                          return;
                        }
                        
                        const dbMapping = dbMappingPairs.find(dbMapping => 
                          dbMapping.column === csvMapping.column
                        );
                        
                        if (dbMapping && dbMapping.role.toLowerCase() !== csvMapping.role.toLowerCase()) {
                          changes.push(`Changed: ${csvMapping.column} (${dbMapping.role} → ${csvMapping.role})`);
                          processedColumns.add(csvMapping.column);
                        }
                      });
                      
                      // Then, find new mappings (in CSV but not in DB) - only for columns not already processed
                      csvMappingPairs.forEach(csvMapping => {
                        if (processedColumns.has(csvMapping.column)) return; // Skip if already processed as a change
                        
                        // Special handling for date fields - only count as new if no date field exists in DB
                        if (csvMapping.role.toLowerCase() === 'date') {
                          const dbDateMapping = dbMappingPairs.find(dbMapping => 
                            dbMapping.role.toLowerCase() === 'date'
                          );
                          if (!dbDateMapping) {
                            changes.push(`New: ${csvMapping.column} → ${csvMapping.role}`);
                          }
                          return;
                        }
                        
                        const existsInDB = dbMappingPairs.some(dbMapping => 
                          dbMapping.column === csvMapping.column && 
                          dbMapping.role.toLowerCase() === csvMapping.role.toLowerCase()
                        );
                        
                        if (!existsInDB) {
                          changes.push(`New: ${csvMapping.column} → ${csvMapping.role}`);
                        }
                      });
                      
                      if (changes.length === 0) {
                        return "No changes detected";
                      }
                      
                      return changes.join('\n');
                    })()}
                  </div>
                </div>
                <div className="text-gray-600">Changes</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };



  // Handle CSV import completion
  const handleCsvImportComplete = async (result: any) => {
    console.log('CSV import completed:', result);
    setCsvImportComplete(true);
    
    // Store the mapping data for later use
    if (result.mappingData) {
      store.storeCsvMappingData(result.mappingData);
    }
    
    // Import the CSV data
    const importResult = await store.importSetupCsvData();
    if (importResult.success) {
      console.log('Setup CSV data imported successfully');
    } else {
      console.error('Failed to import setup CSV data:', importResult.error);
    }
  };

  // Handle setup data ready (for organizational structure extraction)
  const handleSetupDataReady = (divisions: string[], clusters: string[], divisionClusterMap?: Record<string, string[]>, lifecyclePhases?: string[], isSingleCsvReplacement?: boolean, csvFileName?: string) => {
    console.log('Setup data ready:', { divisions, clusters, divisionClusterMap, lifecyclePhases, isSingleCsvReplacement, csvFileName });
    
    // Check for duplicate divisions only in "withDivisionColumn" scenario
    // In "withoutDivisionColumn" scenario, users manually create divisions first, so duplicates are handled differently
    const isWithDivisionColumn = store.orgStructure?.divisionCsvType === 'withDivisionColumn';
    if (isWithDivisionColumn && checkForDuplicateDivisions(divisions, csvFileName || 'unknown.csv', divisionClusterMap, lifecyclePhases)) {
      return; // Stop here, let the dialog handle the continuation
    }
    
    // Convert lifecycle phases to the proper format for the store
    const newLifecycleMappings = lifecyclePhases ? lifecyclePhases.map((phase, index) => ({
      id: `csv-${Date.now()}-${index}`, // Use timestamp to ensure unique IDs across multiple CSV imports
      value: phase,
      phase: 'stable' as const, // Default to 'stable' phase, user can change in lifecycle step
      isCustom: false
    })) : [];
    
    console.log('🔍 [LIFECYCLE DEBUG] Converted lifecycle phases to mappings:', newLifecycleMappings);
    
    // Merge lifecycle mappings instead of overwriting them
    const existingLifecycleMappings = store.orgStructure?.lifecycleMappings || [];
    const mergedLifecycleMappings = [...existingLifecycleMappings];
    
    // Add new lifecycle mappings, avoiding duplicates
    newLifecycleMappings.forEach(newMapping => {
      const isDuplicate = mergedLifecycleMappings.some(existing => 
        existing.value.toLowerCase() === newMapping.value.toLowerCase()
      );
      
      if (!isDuplicate) {
        mergedLifecycleMappings.push(newMapping);
        console.log(`🔍 [LIFECYCLE DEBUG] Added new lifecycle mapping: "${newMapping.value}"`);
      } else {
        console.log(`🔍 [LIFECYCLE DEBUG] Skipped duplicate lifecycle mapping: "${newMapping.value}"`);
      }
    });
    
    console.log('🔍 [LIFECYCLE DEBUG] Merged lifecycle mappings:', {
      existing: existingLifecycleMappings.length,
      new: newLifecycleMappings.length,
      merged: mergedLifecycleMappings.length,
      total: mergedLifecycleMappings.length
    });
    
    // Update the org structure with extracted data
    const setOrgStructureFn = safeSetOrgStructure || store.setOrgStructure;
    
    console.log('🔍 [SET ORG STRUCTURE] Before setOrgStructure call:', {
      currentCsvImportData: store.orgStructure?.csvImportData,
      divisions,
      clusters,
      divisionClusterMap,
      existingLifecycleMappings: existingLifecycleMappings.length,
      newLifecycleMappings: newLifecycleMappings.length,
      mergedLifecycleMappings: mergedLifecycleMappings.length
    });
    
    setOrgStructureFn({
      extractedDivisions: divisions,
      extractedClusters: clusters,
      divisionClusterMap: divisionClusterMap || {},
      lifecycleMappings: mergedLifecycleMappings,
      isSingleCsvReplacement: isSingleCsvReplacement || false
    });

    console.log('🔍 [SET ORG STRUCTURE] After setOrgStructure call:', {
      updatedCsvImportData: store.orgStructure?.csvImportData
    });

    // Store CSV data in division-specific structure for "withoutDivisionColumn" scenario
    if (store.orgStructure?.importLevel === 'division' && 
        store.orgStructure?.divisionCsvType === 'withoutDivisionColumn' && 
        selectedDivisionForMapping) {
      
      // Get the current CSV data from the store
      const currentCsvData = store.orgStructure.csvImportData;
      if (currentCsvData) {
        console.log('🔍 [CSV STORAGE] Storing CSV data for division:', selectedDivisionForMapping);
        
        // The CSV data is already stored by CsvImportWizard, we don't need to store it again
        // Just ensure it's properly associated with the selected division
        console.log('🔍 [CSV STORAGE] CSV data already stored by CsvImportWizard for division:', selectedDivisionForMapping);
      }
    }

    // Load existing divisions into pending list first (for deduplication)
    store.loadDbDivisionsIntoPending();
    store.loadDbClustersIntoPending();

    // Add divisions to pending divisions (with deduplication handled by addPendingDivision)
    divisions.forEach(divisionName => {
      const pendingDivision = {
        name: divisionName,
        description: `Created from CSV import: ${csvFileName || 'unknown file'}`,
        industry: '',
        fieldMapping: divisionName,
        sourceFile: csvFileName || 'unknown.csv'
      };
      store.addPendingDivision(pendingDivision);
    });

    // Add clusters to pending clusters with detailed logging

    
    // Process clusters by division to handle duplicates across divisions
    if (divisionClusterMap) {
      let totalClustersProcessed = 0;
      const allClusters = new Set<string>();
      
      // Count total clusters across all divisions
      Object.values(divisionClusterMap).forEach(clusterList => {
        clusterList.forEach(cluster => allClusters.add(cluster));
      });
      

      
      // Process each division's clusters
      Object.entries(divisionClusterMap).forEach(([divisionName, clusterList]) => {

        
        clusterList.forEach((clusterName, index) => {
          totalClustersProcessed++;

          
          const fieldMapping = clusterName; // Use just the cluster name from CSV


          const pendingCluster = {
            name: clusterName,
            description: `Created from CSV import: ${csvFileName || 'unknown file'}`,
            divisionId: -1, // Will be resolved when divisions are created
            divisionName: divisionName,
            countryCode: '',
            region: '',
            fieldMapping: fieldMapping, // Use just the cluster name from CSV
            sourceFile: csvFileName || 'unknown.csv'
          };
          

          store.addPendingCluster(pendingCluster);

        });
      });
      

    } else {
      // Fallback to original logic if no division cluster map

      clusters.forEach((clusterName, index) => {
                
        // Find which division this cluster belongs to
        let divisionName = 'Unknown Division';
        if (divisionClusterMap) {
          for (const [div, clusterList] of Object.entries(divisionClusterMap)) {
            if (clusterList.includes(clusterName)) {
              divisionName = div;
              break;
            }
          }
        }
        

        const fieldMapping = clusterName; // Use just the cluster name from CSV


        const pendingCluster = {
          name: clusterName,
          description: `Created from CSV import: ${csvFileName || 'unknown file'}`,
          divisionId: -1, // Will be resolved when divisions are created
          divisionName: divisionName,
          countryCode: '',
          region: '',
          fieldMapping: fieldMapping, // Use just the cluster name from CSV
          sourceFile: csvFileName || 'unknown.csv'
        };
        

        store.addPendingCluster(pendingCluster);

      });

    }
  };

  // Handle proceeding to next step
  const handleProceedToNextStep = async () => {
    handleNext();
  };

  // Handle AI failure
  const handleAIFailure = (errorMessage: string) => {
    console.error('AI processing failed:', errorMessage);
    // You can show a toast or handle the error as needed
  };

  // Handle CSV data ready
  const handleDataReady = (result: any) => {
    console.log('CSV data ready:', result);
  };

  // Handle CSV confirmation
  const handleConfirm = async (result: any) => {
    console.log('CSV confirmed:', result);
    return Promise.resolve();
  };

  // Debug logging for database mappings
  console.log('🔍 [DB MAPPINGS] Current field mappings:', store.fieldMappings);
  console.log('🔍 [DB MAPPINGS] Date fields:', store.fieldMappings?.filter(m => m.field_type === 'date'));
  
  // Check for duplicate divisions in CSV import
  const checkForDuplicateDivisions = (divisions: string[], fileName: string, divisionClusterMap?: Record<string, string[]>, lifecyclePhases?: string[]) => {
    console.log('🔍 [DUPLICATE CHECK] Checking for duplicates:', { divisions, fileName });
    
    // Check if any of the divisions already exist in pending divisions
    const duplicates = divisions.filter(divisionName => 
      store.orgStructure?.pendingDivisions?.some((pendingDiv: any) => 
        pendingDiv.name === divisionName
      )
    );
    
    // Also check if any of the divisions already exist in the imported CSV files
    const existingCsvs = store.orgStructure?.multipleCsvImport?.importedCsvs || [];
    const existingCsvForDivision = existingCsvs.find(csv => 
      csv.divisionName === divisions[0] || csv.divisions?.includes(divisions[0])
    );
    
    if (duplicates.length > 0 || existingCsvForDivision) {
      console.log('🔍 [DUPLICATE CHECK] Found duplicates:', { duplicates, existingCsvForDivision });
      
      // Store the old filename to remove it later
      const oldFileName = existingCsvForDivision?.fileName || fileName;
      
      setDuplicateDivisionData({
        duplicates,
        fileName: oldFileName, // Store the old filename to remove
        divisions,
        divisionClusterMap,
        lifecyclePhases
      });
      setShowDuplicateDivisionDialog(true);
      setIsProcessingDuplicateDivision(true);
      return true;
    }
    
    return false;
  };
  
  // Handle duplicate division confirmation
  const handleDuplicateDivisionConfirm = () => {
    if (!duplicateDivisionData) return;
    
    const { fileName } = duplicateDivisionData;
    
    console.log('🔍 [DUPLICATE PROCESSING] Removing old file and accepting new import');
    
    // Simply remove the old CSV file - this will also remove associated divisions/clusters
    store.removeImportedCsv(fileName);
    
    // Close dialog
    setShowDuplicateDivisionDialog(false);
    setDuplicateDivisionData(null);
    setIsProcessingDuplicateDivision(false);
    
    // The new import is already processed and ready, so we just need to add it to tracking
    if (store.orgStructure?.importLevel === 'division' && 
        store.orgStructure?.multipleCsvImport?.isEnabled &&
        store.orgStructure?.divisionCsvType === 'withDivisionColumn') {
      
      // Get the current CSV data that was just imported
      const currentCsvData = store.orgStructure.csvImportData;
      if (currentCsvData && currentCsvData.csvFileName) {
        console.log('🔍 [DUPLICATE PROCESSING] Adding new CSV to tracking:', currentCsvData.csvFileName);
        
        // Add the new CSV to tracking
        store.addImportedCsv(
          currentCsvData.csvFileName,
          store.orgStructure.extractedDivisions || [],
          store.orgStructure.extractedClusters || [],
          store.orgStructure.extractedDivisions?.[0]
        );
        
        // Ensure the divisions and clusters are added to pending arrays
        console.log('🔍 [DUPLICATE PROCESSING] Ensuring pending arrays are updated');
        
        // Load existing divisions into pending list first (for deduplication)
        store.loadDbDivisionsIntoPending();
        store.loadDbClustersIntoPending();
        
        // Add the new divisions to pending
        const extractedDivisions = store.orgStructure.extractedDivisions || [];
        extractedDivisions.forEach(divisionName => {
          console.log('🔍 [DUPLICATE PROCESSING] Adding division to pending:', divisionName);
          const pendingDivision = {
            name: divisionName,
            description: `Created from CSV import: ${currentCsvData.csvFileName}`,
            industry: '',
            fieldMapping: divisionName,
            sourceFile: currentCsvData.csvFileName
          };
          store.addPendingDivision(pendingDivision);
        });
        
        // Add the new clusters to pending
        const extractedClusters = store.orgStructure.extractedClusters || [];
        const divisionClusterMap = store.orgStructure.divisionClusterMap || {};
        
        Object.entries(divisionClusterMap).forEach(([divisionName, clusterList]) => {
          (clusterList as string[]).forEach((clusterName) => {
            console.log('🔍 [DUPLICATE PROCESSING] Adding cluster to pending:', clusterName, 'for division:', divisionName);
            const pendingCluster = {
              name: clusterName,
              description: `Created from CSV import: ${currentCsvData.csvFileName}`,
              divisionId: -1,
              divisionName: divisionName,
              countryCode: '',
              region: '',
              fieldMapping: clusterName,
              sourceFile: currentCsvData.csvFileName
            };
            store.addPendingCluster(pendingCluster);
          });
        });
      }
    }
    
    // Force a re-render
    setForceUpdate(prev => prev + 1);
    
    // Show success message for overwrite
    toast({
      title: "Success",
      description: "Division data overwritten successfully!",
    });
  };
  
  // Handle duplicate division cancellation
  const handleDuplicateDivisionCancel = () => {
    setShowDuplicateDivisionDialog(false);
    setDuplicateDivisionData(null);
    setIsProcessingDuplicateDivision(false);
    setShowCsvWizard(false);
  };
  
  // Check if we're in the "without division column" scenario
  const isWithoutDivisionColumn = orgStructure?.importLevel === 'division' && 
                                 orgStructure?.divisionCsvType === 'withoutDivisionColumn';

  // Check if division selection is required for CSV import
  const requiresDivisionSelection = isWithoutDivisionColumn;

  // Check if import should be disabled due to missing division selection
  const shouldDisableImportForDivisionSelection = () => {
    return requiresDivisionSelection && !selectedDivisionForMapping;
  };
  
  return (
    <div className="max-w-6xl mx-auto">
      <Card className="border-0 shadow-lg relative">
        <CardContent className="pt-6">
          {/* Step Description */}
          {/*<div className="mb-6">
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Upload a CSV file to automatically detect and map your data structure for divisions, clusters, and lifecycle phases.
            </p>
          </div>*/}
          {/* Benefits Section - Explain value proposition */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Why upload a CSV?
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                Automatically detect divisions and clusters from your data
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                Identify lifecycle phases and material codes
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                Pre-map columns to save time in setup
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                Validate data structure before proceeding
              </li>
            </ul>
          </div>

          {/* Division Cards - Show ABOVE Import/Skip cards for "without division column" scenario */}
          {(() => {
            const shouldShowDivisionCards = store.orgStructure?.importLevel === 'division' && store.orgStructure?.hasMultipleDivisions;
            const isWithoutDivisionColumn = store.orgStructure?.divisionCsvType === 'withoutDivisionColumn';
            const shouldShowAbove = shouldShowDivisionCards && isWithoutDivisionColumn;
            
            console.log('🔍 [DIVISION CARDS] Debug:', {
              importLevel: store.orgStructure?.importLevel,
              hasMultipleDivisions: store.orgStructure?.hasMultipleDivisions,
              divisionCsvType: store.orgStructure?.divisionCsvType,
              shouldShowDivisionCards,
              isWithoutDivisionColumn,
              shouldShowAbove
            });
            
            return shouldShowAbove;
          })() && (
            <DivisionCards
              store={store}
              selectedDivisionForMapping={selectedDivisionForMapping}
              onDivisionSelect={handleDivisionSelect}
              onClearDivisionSelection={handleClearDivisionSelection}
              isWithoutDivisionColumn={isWithoutDivisionColumn}
            />
          )}

          {/* Information Alert - Context first */}
          <Alert className="mb-6">
            {shouldDisableImport() ? (
              <AlertTriangle className="h-4 w-4" style={{ color: '#dc2626' }} />
            ) : (
            <Info className="h-4 w-4" />
            )}
            <AlertDescription>
              {shouldDisableImport() ? (
                <>
                  {shouldDisableImportForDivisionSelection() ? (
                    <>
                      <strong>Division selection required:</strong> Please select a division from the cards above before uploading a CSV file.
                    </>
                  ) : (
                <>
                  <strong>File already uploaded:</strong> {store.orgStructure?.csvImportData?.csvFileName}.{' '}
                  <button 
                    onClick={() => setShowImportedCsvList(true)}
                    className="text-blue-600 hover:text-blue-800 underline font-medium"
                  >
                    View file details
                  </button>{' '}
                  or delete the file to upload a new one.
                    </>
                  )}
                </>
              ) : (
                <>
                  <strong>Ready to upload:</strong> The CSV upload wizard will help you map your columns and automatically detect your organizational structure.
                  {isWithoutDivisionColumn && (
                    <> You can upload one CSV file per division.</>
                  )}
                </>
              )}
            </AlertDescription>
          </Alert>

          {/* Action Options - Side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* CSV Upload Option */}
            <div 
              className="p-6 bg-white border-2 border-blue-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer"
              onClick={() => !shouldDisableImport() && setShowCsvWizard(true)}
            >
              <div className="text-center mb-4">
                <Upload className="h-12 w-12 text-blue-600 mx-auto mb-3" />
                <h4 className="font-semibold text-gray-900 mb-2">
                  {isWithoutDivisionColumn ? 'Upload CSV for Selected Division' : 'Upload CSV File'}
                </h4>
                <p className="text-sm text-gray-600">
                  {isWithoutDivisionColumn 
                    ? `Upload a CSV file for the selected division. Each division can have its own CSV file.`
                    : 'Upload your CSV to automatically detect divisions, clusters, and lifecycle phases.'
                  }
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md text-center font-medium transition-colors">
                  <Upload className="h-4 w-4 mr-2 inline" />
                  {isWithoutDivisionColumn ? 'Choose CSV for Division' : 'Choose CSV File'}
                </div>
                
                {shouldDisableImport() && hasImportedFile() && orgStructure.importLevel !== 'division' && (
                  <p className="text-xs text-gray-500 text-center">
                    File already uploaded: {store.orgStructure?.csvImportData?.csvFileName}
                  </p>
                )}
              </div>
            </div>

            {/* Skip CSV Option */}
            <div 
              className={`p-6 bg-white border-2 rounded-lg transition-all flex flex-col justify-center ${
                canSkipCsvImport() 
                  ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer' 
                  : 'border-gray-100 bg-gray-50 cursor-not-allowed'
              }`}
              onClick={() => canSkipCsvImport() && handleNext()}
            >
              <div className="text-center mb-4">
                <SkipForward className={`h-12 w-12 mx-auto mb-3 ${
                  canSkipCsvImport() ? 'text-gray-600' : 'text-gray-400'
                }`} />
                <h4 className={`font-semibold mb-2 ${
                  canSkipCsvImport() ? 'text-gray-900' : 'text-gray-500'
                }`}>Skip CSV Upload</h4>
                <p className={`text-sm ${
                  canSkipCsvImport() ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  Manually create divisions, clusters, and lifecycle phases in the following steps.
                </p>
            </div>
              
              <div className="space-y-3">
            {!canSkipCsvImport() && (
                  <p className="text-xs text-gray-500 text-center">
                    {(() => {
                      const importedCsvs = store.orgStructure?.multipleCsvImport?.importedCsvs || [];
                      const hasMultipleFiles = importedCsvs.length > 0;
                      const hasSingleFile = store.orgStructure?.csvImportData?.csvFileName;
                      
                      if (hasMultipleFiles) {
                        const fileCount = importedCsvs.length;
                        return `Cannot skip - ${fileCount} CSV file${fileCount > 1 ? 's' : ''} already imported.`;
                      } else if (hasSingleFile) {
                        return `Cannot skip - file "${store.orgStructure.csvImportData.csvFileName}" is already imported.`;
                      } else {
                        return 'You need to upload a CSV first to configure mappings.';
                      }
                    })()}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Division Cards - Show BELOW Import/Skip cards for "with division column" scenario */}
          {(() => {
            const shouldShowDivisionCards = store.orgStructure?.importLevel === 'division' && store.orgStructure?.hasMultipleDivisions;
            const isWithDivisionColumn = store.orgStructure?.divisionCsvType === 'withDivisionColumn';
            const shouldShowBelow = shouldShowDivisionCards && isWithDivisionColumn;
            
            console.log('🔍 [DIVISION CARDS BELOW] Debug:', {
              importLevel: store.orgStructure?.importLevel,
              hasMultipleDivisions: store.orgStructure?.hasMultipleDivisions,
              divisionCsvType: store.orgStructure?.divisionCsvType,
              shouldShowDivisionCards,
              isWithDivisionColumn,
              shouldShowBelow
            });
            
            return shouldShowBelow;
          })() && (
            <DivisionCards
              store={store}
              selectedDivisionForMapping={selectedDivisionForMapping}
              onDivisionSelect={handleDivisionSelect}
              onClearDivisionSelection={handleClearDivisionSelection}
              isWithoutDivisionColumn={isWithoutDivisionColumn}
            />
          )}

          {/* Current Mappings Display - Show existing state */}
          <div key={`transformation-${store.orgStructure?.csvImportData?.csvHash || 'no-data'}-${forceUpdate}`}>
            {renderTransformationFlow()}
          </div>

          {/* Floating CSV Import Wizard - Conditionally rendered */}
          {showCsvWizard && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Upload CSV File</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCsvWizard(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
            <CsvImportWizard
              onDataReady={handleDataReady}
              onConfirm={handleConfirm}
              onAIFailure={handleAIFailure}
              context="setup"
              onSetupDataReady={handleSetupDataReady}
              onProceedToNextStep={handleProceedToNextStep}
                  disableImport={shouldDisableImport()}
              onWizardClose={() => setShowCsvWizard(false)}
              selectedDivision={store.orgStructure?.csvImportData?.selectedDivision}
              isProcessingDuplicateDivision={isProcessingDuplicateDivision}
            />
          </div>
            </div>
          )}

          {csvImportComplete && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>CSV Upload Complete!</strong> Your data has been successfully mapped and organizational structure detected.
              </AlertDescription>
            </Alert>
          )}

          {/* CSV Files Popup */}
          {showImportedCsvList && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Imported CSV Files</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowImportedCsvList(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <p className="text-gray-600">
                    These CSV files have been imported and are ready for processing. You can remove any file if needed.
                  </p>
                  
                  <div className="space-y-3">
                    {store.orgStructure?.csvImportData?.csvFileName && (
                      <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-600 text-sm">✓</span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-800">{store.orgStructure.csvImportData.csvFileName}</div>
                            <div className="text-sm text-gray-600">
                              {store.orgStructure.extractedDivisions?.length > 0 && (
                                <span>Divisions: {store.orgStructure.extractedDivisions.join(', ')}</span>
                              )}
                              {store.orgStructure.extractedClusters?.length > 0 && (
                                <span className="ml-2">Clusters: {store.orgStructure.extractedClusters.join(', ')}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            // Clear CSV mapping data and arrays
                            store.clearCsvMappingData();
                            
                            // Clear organizational structure data
                            store.setOrgStructure({
                              ...store.orgStructure,
                              csvImportData: null,
                              uploadedCsvData: null,
                              csvHeaders: null,
                              csvMapping: null,
                              extractedDivisions: [],
                              extractedClusters: [],
                              divisionClusterMap: {},
                            });
                            
                            toast({
                              title: "File removed",
                              description: `"${store.orgStructure.csvImportData.csvFileName}" has been removed and all associated data has been cleared.`
                            });
                            
                            setShowImportedCsvList(false);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Date Format Selector Dialog */}
      {editingMapping && (
        <Dialog open={isDateFormatDialogOpen} onOpenChange={setIsDateFormatDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Select Date Format
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              <div className="text-sm text-gray-600">
                <p>Current detected format: <span className="font-medium">{editingMapping.dateFormat || 'MM/DD/YYYY'}</span></p>
                <p>Click on a format below to change it:</p>
              </div>
              
              {Object.entries(dateFormatOptions).map(([category, options]) => (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900 capitalize">{category} Formats</h4>
                    <Separator className="flex-1" />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {options.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleDateFormatChange(option.value)}
                        className={`p-3 text-left border rounded-lg transition-colors ${
                          selectedDateFormat === option.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium text-sm">{option.label}</div>
                        <div className="text-xs text-gray-500 mt-1">Example: {option.example}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Duplicate Division Validation Dialog */}
      {showDuplicateDivisionDialog && duplicateDivisionData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
              <h3 className="text-lg font-semibold text-gray-900">Duplicate Divisions Found</h3>
            </div>
            
            <div className="mb-6">
              {store.orgStructure?.divisionCsvType === 'withDivisionColumn' ? (
                <>
                  <p className="text-gray-600 mb-3">
                    The CSV file <strong>"{duplicateDivisionData.fileName}"</strong> contains divisions that already exist:
                  </p>
                  
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                    <div className="font-medium text-orange-800 mb-2">Duplicate Divisions:</div>
                    <div className="space-y-1">
                      {duplicateDivisionData.duplicates.map((division: string, index: number) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          <span className="text-orange-700 font-medium">{division}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600">
                    Would you like to overwrite the existing data for these divisions? This will remove any existing clusters and field mappings for these divisions.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-gray-600 mb-3">
                    The CSV file <strong>"{duplicateDivisionData.fileName}"</strong> is being imported for a division that already has data:
                  </p>
                  
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                    <div className="font-medium text-orange-800 mb-2">Existing Division:</div>
                    <div className="space-y-1">
                      {duplicateDivisionData.duplicates.map((division: string, index: number) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          <span className="text-orange-700 font-medium">{division}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600">
                    Would you like to replace the existing CSV data for this division? This will remove any existing clusters and field mappings for this division.
                  </p>
                </>
              )}
            </div>
            
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={handleDuplicateDivisionCancel}
                className="text-gray-600 hover:text-gray-800"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDuplicateDivisionConfirm}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {store.orgStructure?.divisionCsvType === 'withDivisionColumn' ? 'Overwrite Divisions' : 'Replace CSV Data'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 

export default CsvImportStep; 