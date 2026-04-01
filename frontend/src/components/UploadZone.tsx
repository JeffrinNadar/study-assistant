import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Loader2 } from 'lucide-react';
import { uploadFiles } from '../api/client';
import { useAppStore } from '../store/useAppStore';

interface Props {
  onUploaded?: () => void;
}

export function UploadZone({ onUploaded }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentSessionId, setCurrentSessionId } = useAppStore();

  const onDrop = useCallback(async (accepted: File[]) => {
    if (!accepted.length) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await uploadFiles(accepted, currentSessionId ?? undefined);
      if (!currentSessionId) setCurrentSessionId(resp.session_id);
      onUploaded?.();
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentSessionId, setCurrentSessionId, onUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 20 * 1024 * 1024,  // 20 MB
    maxFiles: 5,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
        ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}
    >
      <input {...getInputProps()} />
      {loading ? (
        <div className="flex items-center justify-center gap-2 text-blue-600">
          <Loader2 className="animate-spin" size={20} />
          <span>Processing PDF…</span>
        </div>
      ) : (
        <>
          <Upload className="mx-auto mb-2 text-gray-400" size={32} />
          <p className="text-gray-600">
            {isDragActive ? 'Drop PDFs here' : 'Drag & drop PDFs, or click to select'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Max 20 MB · Up to 5 files</p>
        </>
      )}
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
}
