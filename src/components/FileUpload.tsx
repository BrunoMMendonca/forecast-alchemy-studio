import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { SalesData } from '@/types/sales';
import { parseCSVData } from '@/utils/csvUtils';

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

    try {
      const parsedData = await parseCSVData(file);
      onDataUpload(parsedData);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      alert('Failed to parse CSV file. Please ensure it is properly formatted.');
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card>
      <Card className="w-full">
        <Input
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
          ref={fileInputRef}
        />
        <Button onClick={handleButtonClick}>Upload CSV</Button>
      </Card>
    </Card>
  );
};
