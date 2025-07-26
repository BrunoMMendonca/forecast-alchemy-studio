import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Package, Plus, X, GripVertical } from 'lucide-react';
import { useSetupWizardStore } from '../../../store/setupWizardStore';
import { toast } from 'sonner';

interface ProductLifecycleStepProps {
  orgStructure: any;
  safeSetOrgStructure: (updates: any) => void;
}

interface LifecycleMapping {
  id: string;
  value: string;
  phase: 'launch' | 'stable' | 'end-of-life';
  isCustom?: boolean;
}

export const ProductLifecycleStep: React.FC<ProductLifecycleStepProps> = ({
  orgStructure,
  safeSetOrgStructure
}) => {
  const [lifecycleMappings, setLifecycleMappings] = useState<LifecycleMapping[]>([]);
  const [newValue, setNewValue] = useState('');
  const [selectedPhase, setSelectedPhase] = useState<'launch' | 'stable' | 'end-of-life'>('launch');
  const [isDragging, setIsDragging] = useState<string | null>(null);

  // Initialize with default mappings if none exist
  useEffect(() => {
    // Only use lifecycle mappings from CSV import, no defaults
    if (orgStructure.lifecycleMappings && orgStructure.lifecycleMappings.length > 0) {
      setLifecycleMappings(orgStructure.lifecycleMappings);
    } else {
      setLifecycleMappings([]);
    }
  }, [orgStructure.lifecycleMappings, safeSetOrgStructure]);

  const addCustomMapping = () => {
    if (!newValue.trim()) {
      toast.error('Please enter a value');
      return;
    }

    if (lifecycleMappings.some(m => m.value.toLowerCase() === newValue.toLowerCase())) {
      toast.error('This value already exists');
      return;
    }

    const newMapping: LifecycleMapping = {
      id: Date.now().toString(),
      value: newValue.trim(),
      phase: selectedPhase,
      isCustom: true
    };

    const updatedMappings = [...lifecycleMappings, newMapping];
    setLifecycleMappings(updatedMappings);
    safeSetOrgStructure({ lifecycleMappings: updatedMappings });
    
    setNewValue('');
    toast.success('Lifecycle mapping added');
  };

  const removeMapping = (id: string) => {
    const updatedMappings = lifecycleMappings.filter(m => m.id !== id);
    setLifecycleMappings(updatedMappings);
    safeSetOrgStructure({ lifecycleMappings: updatedMappings });
    toast.success('Mapping removed');
  };

  const updateMappingPhase = (id: string, newPhase: 'launch' | 'stable' | 'end-of-life') => {
    const updatedMappings = lifecycleMappings.map(m => 
      m.id === id ? { ...m, phase: newPhase } : m
    );
    setLifecycleMappings(updatedMappings);
    safeSetOrgStructure({ lifecycleMappings: updatedMappings });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setIsDragging(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetPhase: 'launch' | 'stable' | 'end-of-life') => {
    e.preventDefault();
    if (isDragging) {
      updateMappingPhase(isDragging, targetPhase);
      setIsDragging(null);
    }
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'launch': return 'bg-blue-50 text-blue-700 border-blue-300';
      case 'stable': return 'bg-green-50 text-green-700 border-green-300';
      case 'end-of-life': return 'bg-red-50 text-red-700 border-red-300';
      default: return 'bg-gray-50 text-gray-700 border-gray-300';
    }
  };

  const getPhaseLabel = (phase: string) => {
    switch (phase) {
      case 'launch': return 'Launch Phase';
      case 'stable': return 'Growth & Stability Phase';
      case 'end-of-life': return 'End-of-Life Phase';
      default: return phase;
    }
  };

  const phases: Array<{ key: 'launch' | 'stable' | 'end-of-life'; label: string; description: string }> = [
    { key: 'launch', label: 'Launch Phase', description: 'New products entering the market' },
    { key: 'stable', label: 'Growth & Stability Phase', description: 'Established products with stable demand' },
    { key: 'end-of-life', label: 'End-of-Life Phase', description: 'Products being phased out' }
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Package className="h-6 w-6 text-blue-600" />
            Product Lifecycle Configuration
          </CardTitle>
          <p className="text-gray-600 dark:text-gray-400">
            Map your product lifecycle field values to the appropriate phases. Drag and drop items between phases or use the phase selector.
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          
          {/* Add New Mapping */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Add Custom Lifecycle Field Value</h3>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="new-value" className="text-sm">Lifecycle Field Value</Label>
                <Input
                  id="new-value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="e.g., Emerging, Peak, Sunset"
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="phase-select" className="text-sm">Phase</Label>
                <select
                  id="phase-select"
                  value={selectedPhase}
                  onChange={(e) => setSelectedPhase(e.target.value as 'launch' | 'stable' | 'end-of-life')}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="launch">Launch Phase</option>
                  <option value="stable">Growth & Stability Phase</option>
                  <option value="end-of-life">End-of-Life Phase</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={addCustomMapping}
                  disabled={!newValue.trim()}
                  className="px-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>
          </div>

          {/* Lifecycle Phases Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {phases.map((phase) => (
              <div
                key={phase.key}
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg min-h-64"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, phase.key)}
              >
                <div className="mb-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">{phase.label}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{phase.description}</p>
                </div>
                
                <div className="space-y-2">
                  {lifecycleMappings
                    .filter(m => m.phase === phase.key)
                    .map((mapping) => (
                      <div
                        key={mapping.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, mapping.id)}
                        className={`flex items-center justify-between p-2 bg-white border rounded-lg cursor-move hover:shadow-sm transition-shadow ${
                          isDragging === mapping.id ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">{mapping.value}</span>
                          {mapping.isCustom && (
                            <Badge variant="outline" className="text-xs">
                              Custom
                            </Badge>
                          )}
                        </div>
                        {mapping.isCustom && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMapping(mapping.id)}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  
                  {lifecycleMappings.filter(m => m.phase === phase.key).length === 0 && (
                    <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
                      <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">Drop lifecycle field values here</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Instructions */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">How to use:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Drag and drop values between phases to reorganize them</li>
              <li>• Add custom values using the form above</li>
              <li>• Remove custom values by clicking the X button</li>
              <li>• Default values cannot be removed but can be moved</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 