
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { ImportPreview } from '@/utils/csvUtils';

interface ImportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previews: ImportPreview[];
  errors: string[];
  metadata: { threshold?: number; exportDate?: string; totalRecords?: number };
  onConfirm: () => void;
  fileName: string;
}

export const ImportPreviewDialog: React.FC<ImportPreviewDialogProps> = ({
  open,
  onOpenChange,
  previews,
  errors,
  metadata,
  onConfirm,
  fileName
}) => {
  const modifications = previews.filter(p => p.action === 'modify');
  const noteAdditions = previews.filter(p => p.action === 'add_note');
  const hasChanges = modifications.length > 0 || noteAdditions.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import Data Cleaning Preview
          </DialogTitle>
          <DialogDescription>
            Reviewing changes from: {fileName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Metadata */}
          {metadata.exportDate && (
            <div className="bg-slate-50 rounded-lg p-3">
              <h4 className="font-medium text-slate-700 mb-2">Import Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-slate-600">
                <div>Export Date: {metadata.exportDate}</div>
                {metadata.threshold && <div>Threshold: {metadata.threshold}</div>}
                {metadata.totalRecords && <div>Total Records: {metadata.totalRecords}</div>}
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <h4 className="font-medium text-red-800">Import Errors ({errors.length})</h4>
              </div>
              <ScrollArea className="max-h-24">
                <ul className="text-sm text-red-700 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-sm text-blue-600 font-medium">Total Records</div>
              <div className="text-lg font-bold text-blue-800">{previews.length}</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <div className="text-sm text-orange-600 font-medium">Value Changes</div>
              <div className="text-lg font-bold text-orange-800">{modifications.length}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-sm text-purple-600 font-medium">Note Additions</div>
              <div className="text-lg font-bold text-purple-800">{noteAdditions.length}</div>
            </div>
          </div>

          {/* Changes Preview */}
          {hasChanges ? (
            <div className="space-y-3">
              <h4 className="font-medium text-slate-700">Changes to Apply</h4>
              <ScrollArea className="max-h-64 border rounded-lg p-3">
                <div className="space-y-2">
                  {modifications.map((preview, index) => (
                    <div key={index} className="flex items-center justify-between bg-orange-50 p-2 rounded">
                      <div className="text-sm">
                        <span className="font-medium">{preview.sku}</span> - {preview.date}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">
                          {preview.currentSales.toLocaleString()} → {preview.newSales.toLocaleString()}
                        </span>
                        <Badge variant="outline" className="text-orange-800">
                          {preview.changeAmount > 0 ? '+' : ''}{preview.changeAmount.toLocaleString()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  
                  {noteAdditions.map((preview, index) => (
                    <div key={`note-${index}`} className="flex items-center justify-between bg-purple-50 p-2 rounded">
                      <div className="text-sm">
                        <span className="font-medium">{preview.sku}</span> - {preview.date}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">Add note</span>
                        <Badge variant="outline" className="text-purple-800">Note</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <h4 className="font-medium text-green-800">No Changes Detected</h4>
              <p className="text-sm text-green-700">All data matches current cleaning state</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={!hasChanges || errors.length > 0}
          >
            Apply Changes ({modifications.length + noteAdditions.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
