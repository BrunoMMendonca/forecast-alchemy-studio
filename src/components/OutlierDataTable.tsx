
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Edit3, Save, X } from 'lucide-react';
import { SalesData } from '@/pages/Index';

interface OutlierDataPoint extends SalesData {
  isOutlier: boolean;
  zScore: number;
  index: number;
  key: string;
  originalSales: number;
  note?: string;
}

interface OutlierDataTableProps {
  filteredData: OutlierDataPoint[];
  selectedSKU: string;
  hideCleanData: boolean;
  editingOutliers: { [key: string]: { value: number; note: string } };
  onHideCleanDataChange: (checked: boolean) => void;
  onEditOutlier: (key: string) => void;
  onSaveEdit: (key: string) => void;
  onCancelEdit: (key: string) => void;
  onEditValueChange: (key: string, value: number) => void;
  onEditNoteChange: (key: string, note: string) => void;
}

export const OutlierDataTable: React.FC<OutlierDataTableProps> = ({
  filteredData,
  selectedSKU,
  hideCleanData,
  editingOutliers,
  onHideCleanDataChange,
  onEditOutlier,
  onSaveEdit,
  onCancelEdit,
  onEditValueChange,
  onEditNoteChange
}) => {
  return (
    <div className="bg-white rounded-lg p-4 border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800">
          Edit Data Values - {selectedSKU}
        </h3>
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="hide-clean" 
            checked={hideCleanData}
            onCheckedChange={(checked) => onHideCleanDataChange(checked === true)}
          />
          <label htmlFor="hide-clean" className="text-sm text-slate-700 cursor-pointer">
            Hide clean data
          </label>
        </div>
      </div>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredData.map((dataPoint) => {
          const isEditing = editingOutliers.hasOwnProperty(dataPoint.key);
          const badgeVariant = dataPoint.isOutlier ? "destructive" : "secondary";
          const hasBeenModified = dataPoint.sales !== dataPoint.originalSales;
          
          return (
            <div key={dataPoint.key} className={`p-3 rounded-lg ${dataPoint.isOutlier ? 'bg-red-50' : 'bg-green-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-slate-600">{dataPoint.date}</div>
                  <div className="text-sm">
                    <span className="font-medium">Current: {dataPoint.sales.toLocaleString()}</span>
                    <span className="text-slate-500 ml-2">
                      (Original: {dataPoint.originalSales.toLocaleString()})
                    </span>
                  </div>
                  <Badge variant={badgeVariant} className={`text-xs ${dataPoint.isOutlier ? 'text-white' : 'text-green-800'}`}>
                    Z-Score: {dataPoint.zScore.toFixed(2)}
                  </Badge>
                  {!dataPoint.isOutlier && (
                    <Badge variant="secondary" className="text-xs text-green-800 bg-green-100">
                      Clean
                    </Badge>
                  )}
                  {hasBeenModified && (
                    <Badge variant="outline" className="text-xs text-blue-800 bg-blue-50">
                      Modified
                    </Badge>
                  )}
                  {dataPoint.note && (
                    <Badge variant="outline" className="text-xs text-purple-800 bg-purple-50">
                      Note
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  {!isEditing && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEditOutlier(dataPoint.key)}
                    >
                      <Edit3 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
              </div>

              {dataPoint.note && !isEditing && (
                <div className="text-xs text-purple-700 bg-purple-50 p-2 rounded mt-2">
                  <strong>Note:</strong> {dataPoint.note}
                </div>
              )}

              {isEditing && (
                <div className="space-y-3 bg-white p-3 rounded border">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">New Value</label>
                      <Input
                        type="number"
                        value={editingOutliers[dataPoint.key]?.value || 0}
                        onChange={(e) => onEditValueChange(dataPoint.key, parseFloat(e.target.value) || 0)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            onSaveEdit(dataPoint.key);
                          }
                        }}
                        className="w-full"
                      />
                      <div className="text-xs text-slate-500 mt-1">
                        Original: {dataPoint.originalSales.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">Note (optional)</label>
                      <Textarea
                        value={editingOutliers[dataPoint.key]?.note || ''}
                        onChange={(e) => onEditNoteChange(dataPoint.key, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            onSaveEdit(dataPoint.key);
                          }
                        }}
                        placeholder="Add a note about this change..."
                        className="w-full resize-none"
                        rows={2}
                      />
                      <div className="text-xs text-slate-500 mt-1">
                        Press Enter to save
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      onClick={() => onSaveEdit(dataPoint.key)}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onCancelEdit(dataPoint.key)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
