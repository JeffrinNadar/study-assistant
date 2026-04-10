import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FolderOpen, Loader2 } from 'lucide-react';
import { uploadFiles } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import { useToastStore } from '../store/useToastStore';

interface Props {
  onUploaded?: (fileCount: number, sessionId: string) => void;
}

export function UploadZone({ onUploaded }: Props) {
  const [loading, setLoading] = useState(false);
  const { currentSessionId, setCurrentSessionId } = useAppStore();
  const addToast = useToastStore((s) => s.addToast);

  const onDrop = useCallback(async (accepted: File[]) => {
    if (!accepted.length) return;
    setLoading(true);
    try {
      const resp = await uploadFiles(accepted, currentSessionId ?? undefined);
      if (!currentSessionId) setCurrentSessionId(resp.session_id);
      onUploaded?.(resp.files.length, resp.session_id);
      addToast(`${resp.files.length} file(s) uploaded successfully`, 'success');
    } catch {
      addToast('Upload failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentSessionId, setCurrentSessionId, onUploaded, addToast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 20 * 1024 * 1024,
    maxFiles: 5,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
        ${isDragActive
          ? 'border-pencil bg-pencil/5 scale-[1.02] dark:border-chalk-text'
          : 'border-ruled hover:border-pencil bg-cream/50 dark:bg-chalk-bg-light/50 dark:border-chalk-muted dark:hover:border-chalk-text'
        }`}
    >
      <input {...getInputProps()} />
      {loading ? (
        <div className="flex items-center justify-center gap-2 text-pencil dark:text-chalk-text">
          <Loader2 className="animate-spin" size={20} />
          <span className="font-hand text-lg">Processing PDF...</span>
        </div>
      ) : (
        <>
          <FolderOpen className="mx-auto mb-2 text-pencil/40 dark:text-chalk-muted" size={36} />
          <p className="text-charcoal dark:text-chalk-text font-hand text-lg">
            {isDragActive ? 'Drop your notes here!' : 'Drop your notes here, or click to select'}
          </p>
          <p className="text-xs text-charcoal-light dark:text-chalk-muted mt-1">PDF only · Max 20 MB · Up to 5 files</p>
        </>
      )}
    </div>
  );
}
