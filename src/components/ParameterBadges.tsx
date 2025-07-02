import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Bot, Grid3X3, User, Star } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ParameterBadgesProps {
  canOptimize: boolean;
  aiForecastModelOptimizationEnabled: boolean;
  localSelectedMethod: 'ai' | 'grid' | 'manual' | undefined;
  cacheVersion: number;
  onMethodChange: (method: 'ai' | 'grid' | 'manual') => void;
  hasGridParameters?: boolean;
  bestMethod?: string;
  winnerMethod?: string;
  isWinner?: boolean;
}

export const ParameterBadges: React.FC<ParameterBadgesProps> = ({
  canOptimize,
  aiForecastModelOptimizationEnabled,
  localSelectedMethod,
  cacheVersion,
  onMethodChange,
  hasGridParameters = false,
  bestMethod,
  winnerMethod,
  isWinner
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

  // Helper to render star icon for best method and winner
  const renderStar = (method: string) => {
    if (bestMethod === method) {
      if (isWinner && winnerMethod === method) {
        // Filled yellow star for overall winner's method
        return <Star className="h-3 w-3 ml-1 text-yellow-500 fill-yellow-500 inline" />;
      } else {
        // Outline blue star for best method of this model
        return <Star className="h-3 w-3 ml-1 text-blue-400 inline" />;
      }
    }
    return null;
  };

  return (
    <TooltipProvider>
    <div className="flex items-center gap-2">
      {/* AI Badge - Only show when Grok API is enabled */}
      {aiForecastModelOptimizationEnabled && (
        <Badge 
          key={`ai-${localSelectedMethod}-${cacheVersion}`}
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
          {renderStar('ai')}
        </Badge>
      )}

      {/* Grid Badge - Always show */}
        <Tooltip>
          <TooltipTrigger asChild>
      <Badge 
        key={`grid-${localSelectedMethod}-${cacheVersion}`}
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
        {renderStar('grid')}
      </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {hasGridParameters 
              ? "Click to apply optimized parameters from grid search" 
              : "Grid search optimization"
            }
          </TooltipContent>
        </Tooltip>

      {/* Manual Badge - Always show */}
      <Badge 
        key={`manual-${localSelectedMethod}-${cacheVersion}`}
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
        {renderStar('manual')}
      </Badge>
    </div>
    </TooltipProvider>
  );
};
