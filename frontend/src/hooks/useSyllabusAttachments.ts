import { useState, useCallback } from 'react';
import type { NormalizedFile } from '../utils/fileTypes';
import { mapUploadResponse } from '../utils/fileTypes';

export function useSyllabusAttachments(courseId?: string) {
  const [files, setFiles] = useState<NormalizedFile[]>([]);

  const loadFromCatalog = useCallback((syllabusFiles: Array<{ name?: string; url?: string; size?: number }>) => {
    setFiles(
      (syllabusFiles || []).map((f, i) =>
        mapUploadResponse({
          path: f.url,
          originalname: f.name || `file-${i + 1}`,
          size: f.size,
        })
      )
    );
  }, []);

  const toCatalogPayload = useCallback(
    () =>
      files.map((f) => ({
        name: f.name,
        url: f.url,
        size: f.size,
      })),
    [files]
  );

  return {
    files,
    setFiles,
    loadFromCatalog,
    toCatalogPayload,
    courseId,
  };
}
