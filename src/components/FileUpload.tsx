
import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SalesData } from '@/types/sales';
import { parseCSVData } from '@/utils/csvUtils';
import { Upload } from 'lucide-react';

interface FileUploadProps {
  onDataUpload: (data: SalesData[]) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.warn('No file selected');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    try {
      console.log('Starting CSV parse for file:', file.name);
      const parsedData = await parseCSVData(file);
      console.log('Successfully parsed:', parsedData.length, 'records');
      onDataUpload(parsedData);
      
      // Reset the input so the same file can be uploaded again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error parsing CSV:', error);
      alert(`Failed to parse CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Sales Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
          ref={fileInputRef}
        />
        <Button onClick={handleButtonClick} className="w-full">
          <Upload className="h-4 w-4 mr-2" />
          Upload CSV File
        </Button>
        <div className="text-sm text-slate-600">
          <p>CSV file should contain columns for:</p>
          <ul className="list-disc list-inside mt-1">
            <li>SKU or Product ID</li>
            <li>Date</li>
            <li>Sales, Quantity, or Amount</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
