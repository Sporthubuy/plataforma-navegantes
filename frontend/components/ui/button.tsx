import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'ghost'
  | 'warning';
export type ButtonSize = 'sm' | 'md';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-navy-800 text-white hover:bg-navy-700 active:bg-navy-900 disabled:hover:bg-navy-800',
  secondary:
    'border border-navy-200 bg-white text-navy-700 hover:bg-navy-50 active:bg-navy-100',
  danger:
    'border border-red-200 bg-white text-red-600 hover:bg-red-50 active:bg-red-100',
  warning:
    'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
  ghost: 'text-navy-700 hover:bg-navy-100 active:bg-navy-200',
};

const SIZES: Record<ButtonSize, string> = {
  // Alto mínimo ~44px para áreas de toque cómodas en móvil.
  sm: 'min-h-9 px-3 py-1.5 text-sm',
  md: 'min-h-11 px-4 py-2.5 text-sm md:text-base',
};

/**
 * Clases de botón reutilizables — sirven tanto para <button> como para
 * <Link> (por eso se exporta como helper además del componente).
 */
export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  fullWidth = false
): string {
  return [
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 focus-visible:ring-offset-1',
    'disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
    SIZES[size],
    fullWidth ? 'w-full' : '',
  ].join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${buttonClasses(variant, size, fullWidth)} ${className}`}
      {...props}
    />
  );
}
