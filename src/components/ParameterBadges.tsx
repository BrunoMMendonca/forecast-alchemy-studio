import React, { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Bot, Grid3X3, User } from 'lucide-react';

interface ParameterBadgesProps {
  canOptimize: boolean;
  grokApiEnabled: boolean;
  localSelectedMethod: 'ai' | 'grid' | 'manual' | undefined;
  cacheVersion: number;
  onMethodChange: (method: 'ai' | 'grid' | 'manual') => void;
}

export const ParameterBadges: React.FC<ParameterBadgesProps> = ({
  canOptimize,
  grokApiEnabled,
  localSelectedMethod,
  cacheVersion,
  onMethodChange,
}) => {
  // Log when the component renders or updates
  useEffect(() => {
    console.log(`🎯 Badges: Rendering with method = ${localSelectedMethod}, cacheVersion = ${cacheVersion}`);
  }, [localSelectedMethod, cacheVersion]);

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

  const handleMethodClick = (method: 'ai' | 'grid' | 'manual', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log(`🎯 Badge Click: Changing method from ${localSelectedMethod} to ${method}`);
    onMethodChange(method);
  };

  return (
    <div className="flex items-center gap-2">
      {/* AI Badge - Only show when Grok API is enabled */}
      {grokApiEnabled && (
        <Badge 
          key={`ai-${localSelectedMethod}-${cacheVersion}`}
          variant={isAI ? "default" : "outline"} 
          className={`text-xs cursor-pointer ${isAI ? 'bg-green-600' : 'hover:bg-green-100'}`}
          onClick={(e) => handleMethodClick('ai', e)}
        >
          <Bot className="h-3 w-3 mr-1" />
          AI
        </Badge>
      )}

      {/* Grid Badge - Always show */}
      <Badge 
        key={`grid-${localSelectedMethod}-${cacheVersion}`}
        variant={isGrid ? "default" : "outline"} 
        className={`text-xs cursor-pointer ${isGrid ? 'bg-blue-600' : 'hover:bg-blue-100'}`}
        onClick={(e) => handleMethodClick('grid', e)}
      >
        <Grid3X3 className="h-3 w-3 mr-1" />
        Grid
      </Badge>

      {/* Manual Badge - Always show */}
      <Badge 
        key={`manual-${localSelectedMethod}-${cacheVersion}`}
        variant={isManual ? "default" : "outline"} 
        className={`text-xs cursor-pointer ${isManual ? 'bg-gray-700' : 'hover:bg-gray-100'}`}
        onClick={(e) => handleMethodClick('manual', e)}
      >
        <User className="h-3 w-3 mr-1" />
        Manual
      </Badge>
    </div>
  );
};
