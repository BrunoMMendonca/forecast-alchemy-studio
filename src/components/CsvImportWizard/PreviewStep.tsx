import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Bot, Brain } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import MarkdownRenderer from '../ui/MarkdownRenderer';

const PREVIEW_ROW_LIMIT = 15;

const TransposeDiagramSVG = () => {
  return (
    <div className="flex justify-center my-4">
      <svg width="1125" height="225" viewBox="0 0 1125 375" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="30" y="45" width="375" height="330" rx="27" fill="#fbe9e7" stroke="#fbbf24"/>
        <text x="225" y="90" textAnchor="middle" fontSize="33" fontWeight="bold" fill="#b45309">Dates as Rows</text>
        <text x="75" y="157.5" fontSize="22.5" fontWeight="bold" fill="#b45309">Date</text>
        <text x="180" y="157.5" fontSize="22.5" fontWeight="bold" fill="#b45309">SKU A</text>
        <text x="300" y="157.5" fontSize="22.5" fontWeight="bold" fill="#b45309">SKU B</text>
        <text x="75" y="210" fontSize="22.5" fill="#b45309">01/01</text>
        <rect x="150" y="187.5" width="75" height="39" fill="#fff" stroke="#fbbf24" rx="7.5"/>
        <text x="187.5" y="214.5" fontSize="22.5" fill="#b45309" textAnchor="middle">100</text>
        <rect x="270" y="187.5" width="75" height="39" fill="#fff" stroke="#fbbf24" rx="7.5"/>
        <text x="307.5" y="214.5" fontSize="22.5" fill="#b45309" textAnchor="middle">200</text>
        <text x="75" y="262.5" fontSize="22.5" fill="#b45309">01/02</text>
        <rect x="150" y="240" width="75" height="39" fill="#fff" stroke="#fbbf24" rx="7.5"/>
        <text x="187.5" y="267" fontSize="22.5" fill="#b45309" textAnchor="middle">120</text>
        <rect x="270" y="240" width="75" height="39" fill="#fff" stroke="#fbbf24" rx="7.5"/>
        <text x="307.5" y="267" fontSize="22.5" fill="#b45309" textAnchor="middle">210</text>
        <text x="75" y="315" fontSize="22.5" fill="#b45309">01/03</text>
        <rect x="150" y="292.5" width="75" height="39" fill="#fff" stroke="#fbbf24" rx="7.5"/>
        <text x="187.5" y="319.5" fontSize="22.5" fill="#b45309" textAnchor="middle">130</text>
        <rect x="270" y="292.5" width="75" height="39" fill="#fff" stroke="#fbbf24" rx="7.5"/>
        <text x="307.5" y="319.5" fontSize="22.5" fill="#b45309" textAnchor="middle">220</text>
        <polygon points="450,180 585,180 585,200 450,200" fill="#38bdf8"/>
        <polygon points="600,188 585,170 585,210" fill="#38bdf8"/>
        <text x="520" y="172.5" fontSize="27" fill="#38bdf8" textAnchor="middle">Transpose</text>
        <rect x="630" y="45" width="450" height="270" rx="27" fill="#e0e7ef" stroke="#b6c2d9"/>
        <text x="855" y="90" textAnchor="middle" fontSize="33" fontWeight="bold" fill="#1e293b">Dates as Columns</text>
        <text x="675" y="157.5" fontSize="22.5" fontWeight="bold" fill="#475569">SKU</text>
        <text x="780" y="157.5" fontSize="22.5" fontWeight="bold" fill="#475569">01/01</text>
        <text x="885" y="157.5" fontSize="22.5" fontWeight="bold" fill="#475569">01/02</text>
        <text x="990" y="157.5" fontSize="22.5" fontWeight="bold" fill="#475569">01/03</text>
        <text x="675" y="210" fontSize="22.5" fill="#475569">A</text>
        <rect x="765" y="187.5" width="75" height="39" fill="#fff" stroke="#b6c2d9" rx="7.5"/>
        <text x="802.5" y="214.5" fontSize="22.5" fill="#334155" textAnchor="middle">100</text>
        <rect x="870" y="187.5" width="75" height="39" fill="#fff" stroke="#b6c2d9" rx="7.5"/>
        <text x="907.5" y="214.5" fontSize="22.5" fill="#334155" textAnchor="middle">120</text>
        <rect x="975" y="187.5" width="75" height="39" fill="#fff" stroke="#b6c2d9" rx="7.5"/>
        <text x="1012.5" y="214.5" fontSize="22.5" fill="#334155" textAnchor="middle">130</text>
        <text x="675" y="262.5" fontSize="22.5" fill="#475569">B</text>
        <rect x="765" y="240" width="75" height="39" fill="#fff" stroke="#b6c2d9" rx="7.5"/>
        <text x="802.5" y="267" fontSize="22.5" fill="#334155" textAnchor="middle">200</text>
        <rect x="870" y="240" width="75" height="39" fill="#fff" stroke="#b6c2d9" rx="7.5"/>
        <text x="907.5" y="267" fontSize="22.5" fill="#334155" textAnchor="middle">210</text>
        <rect x="975" y="240" width="75" height="39" fill="#fff" stroke="#b6c2d9" rx="7.5"/>
        <text x="1012.5" y="267" fontSize="22.5" fill="#334155" textAnchor="middle">220</text>
      </svg>
    </div>
  );
};

interface PreviewStepProps {
  aiCsvImportEnabled: boolean;
  aiStep: 'upload' | 'describe' | 'ai-preview' | 'ai-mapping' | 'manual' | 'config';
  aiTransformedData: any[] | null;
  aiResultColumns: string[];
  aiReasoning: string;
  configReasoning: string;
  previewLoading: boolean;
  separator: string;
  transposed: boolean;
  data: any[];
  header: string[];
  onSeparatorChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onTransposeChange: (isChecked: boolean) => void;
  onBackToChoice: () => void;
  onBackToUpload: () => void;
  onNextToMapping: () => void;
}

export const PreviewStep: React.FC<PreviewStepProps> = ({
  aiCsvImportEnabled,
  aiStep,
  aiTransformedData,
  aiResultColumns,
  aiReasoning,
  configReasoning,
  previewLoading,
  separator,
  transposed,
  data,
  header,
  onSeparatorChange,
  onTransposeChange,
  onBackToChoice,
  onBackToUpload,
  onNextToMapping,
}) => {
  // AI Preview
  if (aiCsvImportEnabled && aiStep === 'ai-preview' && aiTransformedData) {
    const totalRows = aiTransformedData.length;
    const previewCols = aiResultColumns;
    
    return (
      <div className="space-y-4">
        <div className="font-semibold">AI-Transformed Preview</div>
        
        {/* AI Instructions Display */}
        <div className="mt-4 border border-slate-200 rounded-lg bg-slate-50/50">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <button className="flex justify-between items-center w-full p-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-slate-600" />
                  <span className="font-semibold text-slate-700">AI Instructions</span>
                </div>
                <div className="text-sm text-blue-600 hover:underline">
                  Show Details
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="p-4 pt-0">
              <div className="border-t border-slate-200 pt-3">
                <p className="text-sm text-slate-600">The AI was instructed to analyze the CSV and transform it into a standard format (one row per product, dates as columns), identifying product codes, descriptions, and sales values automatically.</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        
        {/* AI Reasoning Display */}
        {(aiReasoning || configReasoning) && (
          <div className="mt-4 border border-slate-200 rounded-lg bg-slate-50/50">
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button className="flex justify-between items-center w-full p-3">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-slate-600" />
                    <span className="font-semibold text-slate-700">AI Reasoning</span>
                  </div>
                  <div className="text-sm text-blue-600 hover:underline">
                    Show Details
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-4 pt-0">
                <div className="border-t border-slate-200 pt-3">
                  <MarkdownRenderer content={aiReasoning || configReasoning} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                {previewCols.map((col, i) => (
                  <th key={i} className="px-6 py-3 bg-slate-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(aiTransformedData || []).slice(0, PREVIEW_ROW_LIMIT).map((row, i) => (
                <tr key={i}>
                  {previewCols.map((col, j) => (
                    <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row[col]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {totalRows > PREVIEW_ROW_LIMIT && (
            <div className="text-xs text-slate-500 mt-2">Showing first {PREVIEW_ROW_LIMIT} of {totalRows} rows.</div>
          )}
        </div>
        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={onBackToChoice}>Back</Button>
          <Button onClick={onNextToMapping}>
            Next: Mapping
          </Button>
        </div>
      </div>
    );
  }

  // Manual Preview
  if (previewLoading) {
    return (
      <div className="text-blue-600 text-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
        Parsing CSV and preparing preview...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="font-medium text-slate-800 mb-1">Import CSV - Step 1: Upload & Preview</div>
      <div className="text-slate-600 text-sm mb-2 text-center">
        We expect your CSV to have <a href="#" className="text-blue-600 underline">dates as columns</a> (one row per product/SKU).<br />
        If the preview below looks wrong, click the button below to switch the orientation.
      </div>
      <TransposeDiagramSVG />
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="separator" className="text-sm">Separator:</label>
            <select
              id="separator"
              value={separator}
              onChange={onSeparatorChange}
              disabled={previewLoading}
              className="border rounded px-2 py-1 text-sm bg-white"
            >
              <option value=",">,</option>
              <option value=";">;</option>
              <option value="\t">Tab</option>
              <option value="|">|</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">Data appears transposed:</label>
            <Switch
              checked={transposed}
              onCheckedChange={onTransposeChange}
              disabled={previewLoading}
            />
          </div>
        </div>
        {data.length > 0 ? (
          <>
            <div className="overflow-x-auto border rounded">
              <table className="min-w-full text-xs">
                <thead>
                  <tr>
                    {header.map((h, i) => (
                      <th key={i} className="px-2 py-1 bg-slate-100 border-b whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i} className="bg-white border-b hover:bg-gray-50">
                      {header.map((headerName, j) => (
                        <td key={j} className="px-4 py-2 whitespace-nowrap">{row[headerName]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={onBackToChoice}>Back</Button>
              <Button onClick={onNextToMapping}>Next: Mapping</Button>
            </div>
          </>
        ) : (
          <div>
            <div className="text-center py-8 border border-dashed rounded-lg bg-slate-50">
              <div className="text-slate-500">No data to preview.</div>
              <div className="text-xs text-slate-400 mt-1">Please check your file or adjust the separator/transpose settings above.</div>
            </div>
            <div className="flex justify-start mt-4">
              <Button variant="outline" onClick={onBackToChoice}>Back</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 