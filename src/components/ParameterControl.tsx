import React, { useMemo } from 'react';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bot, Grid3x3, User } from 'lucide-react';
import { Parameter } from '@/types/forecast';
import { useCacheOperations } from '@/hooks/useCacheOperations';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';

interface ParameterControlProps {
  name: string;
  parameter: Parameter;
  value: number;
  onChange: (value: number) => void;
  selectedSKU: string;
  modelId: string;
  cacheEntry?: {
    ai?: any;
    grid?: any;
    selected?: 'ai' | 'grid' | 'manual';
  } | null;
  grokApiEnabled?: boolean;
}

export const ParameterControl: React.FC<ParameterControlProps> = ({
  name,
  parameter,
  value,
  onChange,
  selectedSKU,
  modelId,
  cacheEntry,
  grokApiEnabled = true,
}) => {
  const { setSelectedMethod } = useCacheOperations(
    {}, // cache - not used in this component
    () => {}, // setCache - not used in this component  
    () => {}, // setCacheStats - not used in this component
    () => {}  // setCacheVersion - not used in this component
  );

  // Determine the current method based on cache entry
  const currentMethod = useMemo(() => {
    if (!cacheEntry) return 'manual';
    
    // Check if user has made an explicit selection
    if (cacheEntry.selected) {
      return cacheEntry.selected;
    }
    
    // Fallback to manual if no selection
    return 'manual';
  }, [cacheEntry]);

  // Check what methods are available
  const hasAI = cacheEntry?.ai != null;
  const hasGrid = cacheEntry?.grid != null;

  const handleMethodSelect = (method: 'ai' | 'grid' | 'manual') => {
    console.log(`🎯 PARAMETER_CONTROL: User selecting ${method} for ${selectedSKU}:${modelId}`);
    
    // Set the user's explicit choice in cache
    setSelectedMethod(selectedSKU, modelId, method);
    
    // Update the parameter value if we have cached data
    if (method === 'ai' && cacheEntry?.ai?.parameters?.[name] !== undefined) {
      onChange(cacheEntry.ai.parameters[name]);
    } else if (method === 'grid' && cacheEntry?.grid?.parameters?.[name] !== undefined) {
      onChange(cacheEntry.grid.parameters[name]);
    }
    // For manual, we keep the current value
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'ai':
        return <Bot className="h-3 w-3" />;
      case 'grid':
        return <Grid3x3 className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'ai':
        return 'AI';
      case 'grid':
        return 'Grid';
      default:
        return 'Manual';
    }
  };

  const getBadgeVariant = (method: string) => {
    if (method === currentMethod) {
      return 'default';
    }
    return 'outline';
  };

  const getBadgeStyle = (method: string) => {
    if (method === currentMethod) {
      switch (method) {
        case 'ai':
          return 'bg-blue-600 text-white border-blue-600';
        case 'grid':
          return 'bg-green-600 text-white border-green-600';
        case 'manual':
          return 'bg-slate-600 text-white border-slate-600';
      }
    }
    return '';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">
          {parameter.label}
        </label>
        <div className="flex items-center gap-1">
          {/* Manual Badge - Always Available */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 py-0"
            onClick={() => handleMethodSelect('manual')}
          >
            <Badge
              variant={getBadgeVariant('manual')}
              className={`text-xs cursor-pointer ${getBadgeStyle('manual')}`}
            >
              <div className="flex items-center gap-1">
                {getMethodIcon('manual')}
                {getMethodLabel('manual')}
              </div>
            </Badge>
          </Button>

          {/* AI Badge - Only if grokApiEnabled and results available */}
          {grokApiEnabled && hasAI && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 py-0"
              onClick={() => handleMethodSelect('ai')}
            >
              <Badge
                variant={getBadgeVariant('ai')}
                className={`text-xs cursor-pointer ${getBadgeStyle('ai')}`}
              >
                <div className="flex items-center gap-1">
                  {getMethodIcon('ai')}
                  {getMethodLabel('ai')}
                </div>
              </Badge>
            </Button>
          )}

          {/* Grid Badge - Only if results available */}
          {hasGrid && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 py-0"
              onClick={() => handleMethodSelect('grid')}
            >
              <Badge
                variant={getBadgeVariant('grid')}
                className={`text-xs cursor-pointer ${getBadgeStyle('grid')}`}
              >
                <div className="flex items-center gap-1">
                  {getMethodIcon('grid')}
                  {getMethodLabel('grid')}
                </div>
              </Badge>
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Slider
          value={[value]}
          onValueChange={([newValue]) => onChange(newValue)}
          min={parameter.min}
          max={parameter.max}
          step={parameter.step}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>{parameter.min}</span>
          <span className="font-medium">{value}</span>
          <span>{parameter.max}</span>
        </div>
      </div>

      {parameter.description && (
        <p className="text-xs text-slate-500">{parameter.description}</p>
      )}
    </div>
  );
};
