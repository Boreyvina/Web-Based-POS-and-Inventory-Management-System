import { useRef, useState } from 'react';
import { uploadApi } from '../../api/endpoints';
import { imageSrc } from '../../utils/image';

const MAX_MB = 2;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

/**
 * Picks a product photo, uploads it straight away, and hands the stored path
 * back through onChange. Uploading on selection (rather than on save) means
 * the preview is the real file on the server, not a local illusion that might
 * fail later.
 */
export default function ImageUpload({ value, onChange, disabled }) {
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  async function handleFile(file) {
    if (!file) return;
    setError('');

    if (!ACCEPT.split(',').includes(file.type)) {
      setError('Choose a JPG, PNG, WEBP or GIF image');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Keep it under ${MAX_MB} MB.`);
      return;
    }

    setProgress(0);
    try {
      const result = await uploadApi.productImage(file, setProgress);
      onChange(result.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setProgress(null);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (!disabled) handleFile(e.dataTransfer.files?.[0]);
  }

  const uploading = progress !== null;

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">Photo</span>

      {value ? (
        <div className="flex items-center gap-4">
          <img
            src={imageSrc(value)}
            alt="Product"
            className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
          />
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || uploading}
              className="block text-sm font-medium text-brand-600 underline underline-offset-2 disabled:opacity-50"
            >
              Replace photo
            </button>
            <button
              type="button"
              onClick={() => { onChange(null); setError(''); }}
              disabled={disabled || uploading}
              className="block text-sm font-medium text-danger-fg underline underline-offset-2 disabled:opacity-50"
            >
              Remove photo
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          disabled={disabled || uploading}
          className={`flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed
            text-sm transition-colors disabled:opacity-60 ${
              dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50 hover:border-slate-400'
            }`}
        >
          {uploading ? (
            <>
              <span className="text-slate-600">Uploading… {progress}%</span>
              <span className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
                <span className="block h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
              </span>
            </>
          ) : (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
                   className="text-slate-400" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M12 3v13M7 8l5-5 5 5" />
              </svg>
              <span className="font-medium text-slate-600">Add a photo</span>
              <span className="text-xs text-slate-500">Drag one here, or tap to choose · under {MAX_MB} MB</span>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = ''; // allows re-picking the same file
        }}
      />

      {error && <span className="mt-1.5 block text-xs text-danger-fg">{error}</span>}
      {!error && !value && (
        <span className="mt-1.5 block text-xs text-slate-500">
          Shown on the customer page and the checkout screen.
        </span>
      )}
    </div>
  );
}
