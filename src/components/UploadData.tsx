
import React from 'react';
import { SalesData } from '@/types/sales';
import { FileUpload } from './FileUpload';

interface UploadDataProps {
  onDataUpload: (data: SalesData[]) => void;
}

export const UploadData: React.FC<UploadDataProps> = ({ onDataUpload }) => {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Upload Sales Data</h2>
      <FileUpload onDataUpload={onDataUpload} />
    </div>
  );
};
