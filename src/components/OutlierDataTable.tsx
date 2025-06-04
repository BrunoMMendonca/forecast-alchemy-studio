
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SalesData } from '@/types/sales';

interface OutlierDataTableProps {
  data: SalesData[];
  onUpdateData: (updatedData: SalesData[]) => void;
}

export const OutlierDataTable: React.FC<OutlierDataTableProps> = ({ data, onUpdateData }) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [editNote, setEditNote] = useState<string>('');

  const handleEdit = (index: number, item: SalesData) => {
    setEditingIndex(index);
    setEditValue(item.sales);
    setEditNote(item.note || '');
  };

  const handleSave = (index: number) => {
    const updatedData = [...data];
    updatedData[index] = {
      ...updatedData[index],
      sales: editValue,
      note: editNote
    };
    onUpdateData(updatedData);
    setEditingIndex(null);
  };

  const handleToggleOutlier = (index: number) => {
    const updatedData = [...data];
    updatedData[index] = {
      ...updatedData[index],
      isOutlier: !updatedData[index].isOutlier
    };
    onUpdateData(updatedData);
  };

  const outlierData = data.filter(item => item.isOutlier);

  if (outlierData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Outlier Data</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500">No outliers detected</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Outlier Data ({outlierData.length} items)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Sales</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {outlierData.map((item, idx) => {
              const originalIndex = data.findIndex(d => d === item);
              return (
                <TableRow key={`${item.sku}-${item.date}`}>
                  <TableCell>{item.sku}</TableCell>
                  <TableCell>{item.date}</TableCell>
                  <TableCell>
                    {editingIndex === originalIndex ? (
                      <Input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(Number(e.target.value))}
                        className="w-24"
                      />
                    ) : (
                      item.sales
                    )}
                  </TableCell>
                  <TableCell>
                    {editingIndex === originalIndex ? (
                      <Textarea
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        className="w-40 h-20"
                        placeholder="Add note..."
                      />
                    ) : (
                      item.note || '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {editingIndex === originalIndex ? (
                      <div className="space-x-2">
                        <Button size="sm" onClick={() => handleSave(originalIndex)}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingIndex(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="space-x-2">
                        <Button size="sm" onClick={() => handleEdit(originalIndex, item)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleOutlier(originalIndex)}
                        >
                          Remove Outlier
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
