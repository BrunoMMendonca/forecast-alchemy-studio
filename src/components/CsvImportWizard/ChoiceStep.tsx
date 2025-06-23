import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Bot, User, Zap } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChoiceStepProps {
  aiCsvImportEnabled: boolean;
  largeFileDetected: boolean;
  largeFileProcessingEnabled: boolean;
  aiLoading: boolean;
  configLoading: boolean;
  previewLoading: boolean;
  aiProcessingStage: 'initializing' | 'preparing_request' | 'waiting_for_ai' | 'parsing_response' | 'applying_transform' | 'finalizing';
  configProcessingStage: 'initializing' | 'generating_config' | 'applying_config' | 'parsing_result';
  onAITransform: () => Promise<void>;
  onConfigProcessing: () => Promise<void>;
  onManualChoice: () => void;
  onBackToUpload: () => void;
}

export const ChoiceStep: React.FC<ChoiceStepProps> = ({
  aiCsvImportEnabled,
  largeFileDetected,
  largeFileProcessingEnabled,
  aiLoading,
  configLoading,
  previewLoading,
  aiProcessingStage,
  configProcessingStage,
  onAITransform,
  onConfigProcessing,
  onManualChoice,
  onBackToUpload,
}) => {
  const handleAIChoice = async () => {
    if (largeFileDetected) {
      await onConfigProcessing();
    } else {
      await onAITransform();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-center min-h-[300px] py-12">
        <div className="mb-8 text-center">
          <div className="text-slate-700 text-lg font-semibold mb-2">How would you like to import your data?</div>
          <div className="text-slate-500 text-base">You've already uploaded your file. We can now process it.</div>
        </div>
        <div className="flex flex-row gap-8 justify-center mt-8">
          <button
            className={`relative flex flex-col items-center justify-center border-2 rounded-xl shadow-md px-10 py-8 transition-all duration-200 w-72 focus:outline-none bg-yellow-50 hover:bg-yellow-100 border-yellow-300 hover:border-yellow-400`}
            onClick={handleAIChoice}
            disabled={
              (largeFileDetected && !largeFileProcessingEnabled) || 
              aiLoading || 
              configLoading
            }
          >
            {(aiLoading || configLoading) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl z-10">
                <RefreshCw className="w-8 h-8 text-yellow-600 animate-spin mb-3" />
                <span className="text-sm font-medium text-slate-700 mb-2">
                   {configLoading ? 'Processing Large File...' : 'AI Processing...'}
                </span>
                 <span className="text-xs text-slate-600">
                   {configLoading ? {
                     'initializing': 'Initializing...',
                     'generating_config': 'Generating configuration...',
                     'applying_config': 'Applying configuration...',
                     'parsing_result': 'Parsing result...'
                   }[configProcessingStage] : {
                     'initializing': 'Initializing...',
                     'preparing_request': 'Preparing request...',
                     'waiting_for_ai': 'Waiting for AI...',
                     'parsing_response': 'Parsing response...',
                     'applying_transform': 'Applying transform...',
                     'finalizing': 'Finalizing...'
                    }[aiProcessingStage]}
                  </span>
              </div>
            )}
            <div className="relative">
              {largeFileDetected && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="absolute -top-2 -right-2 flex h-6 w-6">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-6 w-6 bg-yellow-500 items-center justify-center text-xs text-white">
                          <Zap size={15}/>
                    </span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          <b>Large File Processing</b><br></br>
                          Because of AI prompt size limitations, for large files, the AI first generates a transformation plan based on a sample that we then apply to the entire file. This approach is faster and more reliable.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              <Bot className="w-10 h-10 text-yellow-600 mb-3" />
            </div>
            <span className="text-xl font-bold text-yellow-600 mb-1">AI-Powered Import</span>
            <span className="text-yellow-600 text-base mb-2 text-center">Let AI automatically clean, pivot, and prepare your data.</span>
          </button>

          <button
            className="relative flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-400 rounded-xl shadow-md px-10 py-8 transition-all duration-200 w-72 focus:outline-none"
            onClick={onManualChoice}
            disabled={aiLoading || configLoading}
          >
            {previewLoading && (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl z-10">
                 <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                 <span className="text-sm font-medium text-slate-700 mb-2">
                   Preparing Preview...
                  </span>
               </div>
            )}
            <User className="w-10 h-10 text-slate-600 mb-3" />
            <span className="text-xl font-bold text-slate-800 mb-1">Manual Import</span>
            <span className="text-slate-700 text-base mb-2 text-center">Manually review, map, and import your CSV data step by step.</span>
          </button>
        </div>
      </div>
      <div className="flex justify-start mt-4">
        <Button variant="outline" onClick={onBackToUpload}>
          Back to Upload
        </Button>
      </div>
    </div>
  );
}; 