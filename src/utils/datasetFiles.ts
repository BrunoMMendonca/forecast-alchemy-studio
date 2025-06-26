// Utility functions for dataset file naming

/**
 * Remove extension from filename
 */
export function getBaseName(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, '');
}

/**
 * Shorten hash for filenames (match backend)
 */
export function getShortHash(hash: string): string {
  return hash.slice(0, 8);
}

/**
 * Generate dataset filename using the new naming convention
 */
export function getDatasetFileName(baseName: string, hash: string, type: string, ext: string, discarded: boolean = false): string {
  const shortHash = getShortHash(hash);
  const suffix = discarded ? '-discarded' : '';
  return `${baseName}-${shortHash}-${type}${suffix}.${ext}`;
}

/**
 * Parse dataset filename to extract components
 */
export function parseDatasetFileName(fileName: string): {
  baseName: string;
  shortHash: string;
  type: string;
  ext: string;
  discarded: boolean;
} | null {
  // Match pattern: <BaseName>-<ShortHash>-<Type>[-discarded].<ext>
  const match = fileName.match(/^(.+)-([a-f0-9]{8})-(.+?)(-discarded)?\.(.+)$/);
  if (!match) return null;
  
  const [, baseName, shortHash, type, discardedSuffix, ext] = match;
  return {
    baseName,
    shortHash,
    type,
    ext,
    discarded: !!discardedSuffix
  };
}

/**
 * Check if a filename follows the new dataset naming convention
 */
export function isDatasetFileName(fileName: string): boolean {
  return parseDatasetFileName(fileName) !== null;
}

/**
 * Check if a filename is a discarded dataset file
 */
export function isDiscardedDatasetFile(fileName: string): boolean {
  const parsed = parseDatasetFileName(fileName);
  return parsed?.discarded || false;
} 