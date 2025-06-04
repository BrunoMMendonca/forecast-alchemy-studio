
import React from 'react';
import { SalesData } from '@/types/sales';
import { FileUpload } from './FileUpload';

interface UploadDataProps {
  onDataUpload: (data: SalesData[]) => void;
}

export const UploadData: React.FC<UploadDataProps> = ({ onDataUpload }) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Upload Sales Data</h2>
        <p className="text-slate-600">
          Start by uploading your sales data in CSV format to begin analysis and forecasting.
        </p>
      </div>
      <FileUpload onDataUpload={onDataUpload} />
    </div>
  );
};
