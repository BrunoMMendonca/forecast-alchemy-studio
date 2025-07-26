import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Hash, FileText, AlertCircle, RefreshCw } from 'lucide-react';

export interface ErrorHandlerProps {
  errorType: 'no-data' | 'format-issues' | 'parsing-error' | 'loading' | 'ai-error';
  details?: string;
  onRetry?: () => void;
  onBack?: () => void;
  onFormatHelp?: (type: 'date' | 'number') => void;
}

export const ErrorHandler: React.FC<ErrorHandlerProps> = ({
  errorType,
  details,
  onRetry,
  onBack,
  onFormatHelp
}) => {
  const errorMessages = {
    'no-data': {
      title: 'Unable to preview data',
      message: 'The CSV file could not be parsed with the current settings.',
      icon: AlertCircle,
      suggestions: [
        'Check if your file contains valid CSV data',
        'Try adjusting the separator setting',
        'Toggle the transpose option if your data appears sideways',
        'Ensure your file is not empty or corrupted'
      ]
    },
    'format-issues': {
      title: 'Format validation issues detected',
      message: 'Some dates or numbers don\'t match the selected formats.',
      icon: AlertCircle,
      suggestions: [
        'Review the format settings above',
        'Check for mixed date/number formats in your data',
        'Ensure consistent formatting throughout your file'
      ]
    },
    'parsing-error': {
      title: 'Error processing CSV file',
      message: details || 'An unexpected error occurred while parsing your file.',
      icon: AlertCircle,
      suggestions: [
        'Verify your file is a valid CSV format',
        'Check for special characters or encoding issues',
        'Try opening the file in a text editor to inspect its structure'
      ]
    },
    'loading': {
      title: 'Processing your file',
      message: 'Please wait while we parse and validate your CSV data...',
      icon: RefreshCw,
      suggestions: []
    },
    'ai-error': {
      title: 'AI processing failed',
      message: details || 'The AI assistant encountered an error while processing your file.',
      icon: AlertCircle,
      suggestions: [
        'Try the manual import option instead',
        'Check if your file format is supported',
        'Ensure your file is not too large or complex'
      ]
    }
  };

  const currentError = errorMessages[errorType];
  const IconComponent = currentError.icon;

  if (errorType === 'loading') {
    return (
      <div className="text-blue-600 text-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
        {currentError.message}
      </div>
    );
  }

  return (
    <div className="text-center py-8 border border-dashed rounded-lg bg-slate-50">
      <IconComponent className="w-8 h-8 text-slate-400 mx-auto mb-3" />
      <div className="text-slate-700 font-medium mb-2">{currentError.title}</div>
      <div className="text-slate-500 text-sm mb-4">{currentError.message}</div>
      
      {currentError.suggestions.length > 0 && (
        <div className="text-left max-w-md mx-auto">
          <div className="text-xs text-slate-600 font-medium mb-2">Suggestions:</div>
          <ul className="text-xs text-slate-500 space-y-1 mb-4">
            {currentError.suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start">
                <span className="text-slate-400 mr-2">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Helpful links for format validation */}
      {(errorType === 'format-issues' || errorType === 'parsing-error') && (
        <div className="border-t pt-4 mt-4">
          <div className="text-xs text-slate-600 font-medium mb-2">Need help with formats?</div>
          <div className="flex flex-wrap gap-2 justify-center text-xs">
            <button
              onClick={() => onFormatHelp?.('date')}
              className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
            >
              <Calendar className="w-3 h-3" />
              Date Format Help
            </button>
            <button
              onClick={() => onFormatHelp?.('number')}
              className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
            >
              <Hash className="w-3 h-3" />
              Number Format Help
            </button>
            <button
              onClick={() => {
                // Open CSV structure help
                window.open('https://help.example.com/csv-structure', '_blank');
              }}
              className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
            >
              <FileText className="w-3 h-3" />
              CSV Structure Guide
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 justify-center mt-6">
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
        {onRetry && (
          <Button onClick={onRetry}>
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}; 