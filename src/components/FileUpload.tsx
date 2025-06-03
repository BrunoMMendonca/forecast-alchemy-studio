import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, CheckCircle, RefreshCw } from 'lucide-react';
import { SalesData } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  onDataUpload: (data: SalesData[]) => void;
  hasExistingData?: boolean;
  dataCount?: number;
  skuCount?: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onDataUpload, 
  hasExistingData = false,
  dataCount = 0,
  skuCount = 0
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const processCSV = useCallback((file: File) => {
    setIsProcessing(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
        
        // Validate headers
        const requiredHeaders = ['date', 'sku', 'sales'];
        const hasRequiredHeaders = requiredHeaders.every(header => 
          headers.some(h => h.includes(header))
        );
        
        if (!hasRequiredHeaders) {
          throw new Error('CSV must contain Date, SKU, and Sales columns');
        }
        
        const dateIndex = headers.findIndex(h => h.includes('date'));
        const skuIndex = headers.findIndex(h => h.includes('sku'));
        const salesIndex = headers.findIndex(h => h.includes('sales'));
        
        const data: SalesData[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const values = line.split(',').map(v => v.trim());
          
          if (values.length >= 3) {
            const dateStr = values[dateIndex];
            const sku = values[skuIndex];
            const sales = parseFloat(values[salesIndex]);
            
            if (!isNaN(sales) && dateStr && sku) {
              data.push({
                date: dateStr,
                sku: sku,
                sales: sales
              });
            }
          }
        }
        
        if (data.length === 0) {
          throw new Error('No valid data rows found');
        }
        
        onDataUpload(data);
        setUploadedFile(file);
        toast({
          title: "Success!",
          description: `Uploaded ${data.length} records from ${new Set(data.map(d => d.sku)).size} SKUs`,
        });
        
      } catch (error) {
        toast({
          title: "Upload Error",
          description: error instanceof Error ? error.message : "Failed to process file",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    };
    
    reader.readAsText(file);
  }, [onDataUpload, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.endsWith('.csv'));
    
    if (csvFile) {
      processCSV(csvFile);
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
    }
  }, [processCSV, toast]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processCSV(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Existing Data Indicator */}
      {hasExistingData && !uploadedFile && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <h4 className="font-semibold text-green-800">Data Already Loaded</h4>
              <p className="text-green-700 text-sm">
                {dataCount.toLocaleString()} records from {skuCount} SKUs currently loaded
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Drag and Drop Area */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300
          ${isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : uploadedFile 
              ? 'border-green-500 bg-green-50' 
              : hasExistingData
                ? 'border-orange-300 bg-orange-50 hover:border-orange-400'
                : 'border-slate-300 bg-slate-50 hover:border-slate-400'
          }
        `}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
      >
        {uploadedFile ? (
          <div className="space-y-4">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-green-800">File Uploaded Successfully</h3>
              <p className="text-green-600">{uploadedFile.name}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {hasExistingData ? (
              <RefreshCw className={`h-12 w-12 mx-auto transition-colors ${isDragging ? 'text-blue-600' : 'text-orange-500'}`} />
            ) : (
              <Upload className={`h-12 w-12 mx-auto transition-colors ${isDragging ? 'text-blue-600' : 'text-slate-400'}`} />
            )}
            <div>
              <h3 className="text-lg font-semibold text-slate-700">
                {hasExistingData ? 'Upload New CSV File' : 'Drop your CSV file here'}
              </h3>
              <p className="text-slate-500">
                {hasExistingData ? 'Replace current data or click to browse files' : 'or click to browse files'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* File Input */}
      <div className="space-y-2">
        <Label htmlFor="file-upload">
          {hasExistingData ? 'Upload New CSV File' : 'Upload CSV File'}
        </Label>
        <Input
          id="file-upload"
          type="file"
          accept=".csv"
          onChange={handleFileInput}
          disabled={isProcessing}
          className="cursor-pointer"
        />
      </div>

      {/* Processing State */}
      {isProcessing && (
        <div className="flex items-center justify-center space-x-2 text-blue-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span>Processing file...</span>
        </div>
      )}

      {/* Sample Format */}
      <div className="bg-slate-100 rounded-lg p-4">
        <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Expected CSV Format
        </h4>
        <div className="text-sm text-slate-600 font-mono bg-white p-2 rounded border">
          Date,SKU,Sales<br/>
          2024-01-01,PROD-001,150<br/>
          2024-01-02,PROD-001,180<br/>
          2024-01-01,PROD-002,220<br/>
          ...
        </div>
      </div>
    </div>
  );
};
