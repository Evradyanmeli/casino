import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export default function Input({ label, error, id, className = '', ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-300">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : props['aria-describedby']}
        className={`input-field ${error ? 'border-error focus:border-error focus:ring-error' : ''} ${className}`}
        {...props}
      />
      {error && <p id={`${inputId}-error`} role="alert" className="text-error text-sm">{error}</p>}
    </div>
  );
}
