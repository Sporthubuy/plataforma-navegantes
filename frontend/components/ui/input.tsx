import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

/** Clases compartidas por inputs, selects y textareas. */
export const controlClasses =
  'w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-base text-navy-900 outline-none transition placeholder:text-navy-300 focus:border-navy-500 focus:ring-2 focus:ring-navy-200 disabled:opacity-60';

/** Envuelve un control con su etiqueta y un mensaje de error opcional. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1 text-sm font-medium text-navy-800">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-navy-400">{hint}</span>}
      {error && <span className="text-xs font-normal text-red-600">{error}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props;
  return <input className={`${controlClasses} ${className}`} {...rest} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props;
  return <textarea className={`${controlClasses} ${className}`} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', ...rest } = props;
  return <select className={`${controlClasses} ${className}`} {...rest} />;
}
