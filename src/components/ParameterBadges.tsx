
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Bot, Grid3X3, User } from 'lucide-react';

interface ParameterBadgesProps {
  canOptimize: boolean;
  grokApiEnabled: boolean;
  localSelectedMethod: 'ai' | 'grid' | 'manual' | undefined;
  cacheVersion: number;
  selectedSKU: string;
  modelId: string;
  onMethodChange: (method: 'ai' | 'grid' | 'manual') => void;
}

export const ParameterBadges: React.FC<ParameterBadgesProps> = ({
  canOptimize,
  grokApiEnabled,
  localSelectedMethod,
  cacheVersion,
  selectedSKU,
  modelId,
  onMethodChange,
}) => {
  if (!canOptimize) {
    return (
      <Badge variant="outline" className="text-xs">
        No Optimization
      </Badge>
    );
  }

  const isAI = localSelectedMethod === 'ai';
  const isGrid = localSelectedMethod === 'grid';
  const isManual = localSelectedMethod === 'manual';

  // Force re-render when cache or SKU changes by using a key
  const componentKey = `${selectedSKU}-${modelId}-${cacheVersion}-${localSelectedMethod}`;

  return (
    <div key={componentKey} className="flex items-center gap-2">
      {/* AI Badge - Only show when Grok API is enabled */}
      {grokApiEnabled && (
        <Badge 
          variant={isAI ? "default" : "outline"} 
          className={`text-xs cursor-pointer ${isAI ? 'bg-green-600' : 'hover:bg-green-100'}`}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log(`🎯 AI BADGE CLICK: Current method = ${localSelectedMethod}, isAI = ${isAI}`);
            onMethodChange('ai');
          }}
        >
          <Bot className="h-3 w-3 mr-1" />
          AI
        </Badge>
      )}

      {/* Grid Badge - Always show */}
      <Badge 
        variant={isGrid ? "default" : "outline"} 
        className={`text-xs cursor-pointer ${isGrid ? 'bg-blue-600' : 'hover:bg-blue-100'}`}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          console.log(`🎯 GRID BADGE CLICK: Current method = ${localSelectedMethod}, isGrid = ${isGrid}`);
          onMethodChange('grid');
        }}
      >
        <Grid3X3 className="h-3 w-3 mr-1" />
        Grid
      </Badge>

      {/* Manual Badge - Always show */}
      <Badge 
        variant={isManual ? "default" : "outline"} 
        className={`text-xs cursor-pointer ${isManual ? 'bg-gray-700' : 'hover:bg-gray-100'}`}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          console.log(`🎯 MANUAL BADGE CLICK: Current method = ${localSelectedMethod}, isManual = ${isManual}`);
          onMethodChange('manual');
        }}
      >
        <User className="h-3 w-3 mr-1" />
        Manual
      </Badge>
    </div>
  );
};
