
import React from 'react';

interface OutlierStatisticsProps {
  totalRecords: number;
  outliersCount: number;
  cleanRecords: number;
  outlierRate: number;
}

export const OutlierStatistics: React.FC<OutlierStatisticsProps> = ({
  totalRecords,
  outliersCount,
  cleanRecords,
  outlierRate
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-blue-50 rounded-lg p-3 text-center">
        <div className="text-sm text-blue-600 font-medium">Total Records</div>
        <div className="text-lg font-bold text-blue-800">
          {totalRecords}
        </div>
      </div>
      <div className="bg-red-50 rounded-lg p-3 text-center">
        <div className="text-sm text-red-600 font-medium">Outliers Found</div>
        <div className="text-lg font-bold text-red-800">
          {outliersCount}
        </div>
      </div>
      <div className="bg-green-50 rounded-lg p-3 text-center">
        <div className="text-sm text-green-600 font-medium">Clean Records</div>
        <div className="text-lg font-bold text-green-800">
          {cleanRecords}
        </div>
      </div>
      <div className="bg-orange-50 rounded-lg p-3 text-center">
        <div className="text-sm text-orange-600 font-medium">Outlier Rate</div>
        <div className="text-lg font-bold text-orange-800">
          {outlierRate.toFixed(1)}%
        </div>
      </div>
    </div>
  );
};
