import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SKUStore {
  selectedSKU: string;
  setSelectedSKU: (sku: string) => void;
}

export const useSKUStore = create(
  persist<SKUStore>(
    (set) => ({
      selectedSKU: '',
      setSelectedSKU: (sku) => set({ selectedSKU: sku }),
    }),
    {
      name: 'sku-storage', // key in localStorage
    }
  )
); 