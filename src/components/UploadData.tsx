
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText } from 'lucide-react';
import { SalesData } from '@/types/sales';
import { useToast } from '@/hooks/use-toast';

interface UploadDataProps {
  onDataUpload: (data: SalesData[]) => void;
}

export const UploadData: React.FC<UploadDataProps> = ({ onDataUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const data: SalesData[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          if (values.length >= 3) {
            data.push({
              sku: values[headers.indexOf('sku')] || values[0],
              date: values[headers.indexOf('date')] || values[1],
              sales: parseFloat(values[headers.indexOf('sales')] || values[2]) || 0
            });
          }
        }
        
        onDataUpload(data);
        toast({
          title: "Data Uploaded",
          description: `Successfully uploaded ${data.length} records`,
        });
      } catch (error) {
        toast({
          title: "Upload Error",
          description: "Failed to parse CSV file",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Sales Data
        </CardTitle>
        <CardDescription>
          Upload a CSV file with columns: SKU, Date, Sales
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300'
          }`}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={() => setIsDragging(true)}
          onDragLeave={() => setIsDragging(false)}
        >
          <FileText className="h-12 w-12 mx-auto mb-4 text-slate-400" />
          <p className="text-lg font-medium mb-2">Drop your CSV file here</p>
          <p className="text-slate-500 mb-4">or</p>
          <Button onClick={() => document.getElementById('file-input')?.click()}>
            Choose File
          </Button>
          <input
            id="file-input"
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      </CardContent>
    </Card>
  );
};
