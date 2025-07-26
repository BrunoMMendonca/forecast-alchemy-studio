

import React from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Zap } from 'lucide-react';

export interface ChartControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  autoZoom: boolean;
  onToggleAutoZoom: () => void;
  className?: string;
}

export const ChartControls: React.FC<ChartControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onResetZoom,
  autoZoom,
  onToggleAutoZoom,
  className,
}) => (
  <div className={className + ' flex items-center gap-2 flex-wrap'}>
    <Button size="sm" variant="outline" onClick={onZoomIn} title="Zoom In">
      <ZoomIn className="h-4 w-4" />
    </Button>
    <Button size="sm" variant="outline" onClick={onZoomOut} title="Zoom Out">
      <ZoomOut className="h-4 w-4" />
    </Button>
    <Button size="sm" variant="outline" onClick={onResetZoom} title="Reset Zoom">
      <RotateCcw className="h-4 w-4" />
    </Button>
    <Button 
      size="sm" 
      variant={autoZoom ? "default" : "outline"} 
      onClick={onToggleAutoZoom} 
      title={autoZoom ? 'Autozoom: ON' : 'Autozoom: OFF'}
    >
      <Zap className="h-4 w-4" />
    </Button>
  </div>
); 