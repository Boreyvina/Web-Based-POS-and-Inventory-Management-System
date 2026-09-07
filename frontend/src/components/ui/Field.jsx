import { forwardRef } from 'react';

export function Field({ label, error, hint, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-danger-600"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger-fg">{error}</span>}
    </label>
  );
}

const base =
  'w-full rounded-lg border bg-white px-3 text-ink placeholder:text-slate-400 ' +
  'focus:border-brand-500 disabled:bg-slate-50 disabled:text-slate-500';

/* forwardRef so the checkout screen can keep focus in the scan box. */
export const Input = forwardRef(function Input({ error, className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`${base} h-11 ${error ? 'border-danger-600' : 'border-slate-300'} ${className}`}
      {...props}
    />
  );
});

export function Select({ error, className = '', children, ...props }) {
  return (
    <select
      className={`${base} h-11 ${error ? 'border-danger-600' : 'border-slate-300'} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ error, className = '', ...props }) {
  return (
    <textarea
      className={`${base} py-2 ${error ? 'border-danger-600' : 'border-slate-300'} ${className}`}
      rows={3}
      {...props}
    />
  );
}
