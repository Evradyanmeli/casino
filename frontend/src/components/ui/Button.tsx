import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  children: ReactNode;
  fullWidth?: boolean;
}

export default function Button({ variant = 'primary', children, fullWidth, className = '', ...props }: ButtonProps) {
  const base = 'casino-button font-semibold py-3 px-5 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2';
  const variants = {
    primary: 'casino-button-primary hover:brightness-110',
    secondary: 'casino-button-secondary hover:brightness-110',
    outline: 'casino-button-outline',
    ghost: 'casino-button-ghost text-gray-400 hover:text-white',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
