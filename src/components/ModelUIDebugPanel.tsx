import React, { useState } from 'react';
import { useModelUIStore } from '@/store/optimizationStore';
import { useForecastResultsStore } from '@/store/forecastResultsStore';
import { useSKUStore } from '@/store/skuStore';
import { useTrendLinesStore } from '@/store/trendLinesStore';

// Add more stores here as needed
const STORE_DEFS = [
  {
    name: 'Model UI State',
    getState: () => useModelUIStore.getState().modelUIState,
    clear: () => useModelUIStore.getState().resetModelUIState(),
  },
  {
    name: 'Forecast Results',
    getState: () => useForecastResultsStore.getState().results,
    clear: () => useForecastResultsStore.getState().clear(),
  },
  {
    name: 'SKU Store',
    getState: () => useSKUStore.getState(),
    clear: () => useSKUStore.setState({ selectedSKU: '' }), // reset to initial state
  },
  {
    name: 'Trend Lines',
    getState: () => useTrendLinesStore.getState(),
    clear: () => useTrendLinesStore.setState({ trendLines: [] }),
  },
];

export const ZustandStoreDebugger: React.FC = () => {
  const [selected, setSelected] = useState(0);
  const store = STORE_DEFS[selected];
  const state = store.getState();

  return (
    <div style={{ background: '#f8f8f8', color: '#222', fontSize: 12, padding: 12, border: '1px solid #ccc', borderRadius: 6, maxHeight: 400, overflow: 'auto', margin: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ marginRight: 8 }}>Zustand Debugger:</strong>
        <select value={selected} onChange={e => setSelected(Number(e.target.value))}>
          {STORE_DEFS.map((s, i) => (
            <option key={s.name} value={i}>{s.name}</option>
          ))}
        </select>
        <button
          style={{ marginLeft: 12, padding: '2px 8px', fontSize: 12, border: '1px solid #aaa', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
          onClick={() => store.clear && store.clear()}
        >
          Clear Store
        </button>
      </div>
      <div style={{ marginBottom: 8, color: '#888', fontSize: 11 }}>
        {selected === 0 && 'Note: modelUIState is now deeply nested (filePath → UUID → SKU → modelId → method).'}
      </div>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {JSON.stringify(state, null, 2)}
      </pre>
    </div>
  );
}; 