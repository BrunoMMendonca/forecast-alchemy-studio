// Utility to generate blue-to-purple tones for chart series
export function getBlueTone(index: number, total: number) {
  // Hue: 210 (blue) to 270 (purple)
  const hue = 180 + (90 * (index / Math.max(1, total - 1)));
  const lightness = 40 + (30 * (index / Math.max(1, total - 1)));
  const saturation = 80;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
} 