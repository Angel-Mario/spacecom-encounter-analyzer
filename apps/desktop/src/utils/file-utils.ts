export const formatFileSize = (size: number): string => {
  if (size < 1024) {
    return `${size} B`;
  }

  return `${(size / 1024).toFixed(1)} KB`;
};

export const getFileKey = (file: File): string => `${file.name}-${file.size}-${file.lastModified}`;
