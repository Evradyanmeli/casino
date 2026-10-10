import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  children: ReactNode;
  fullWidth?: boolean;
}

export default function Button({ variant = 'primary', children, fullWidth, className = '', ...props }: ButtonProps) {
  const base = 'font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2';
  const variants = {
    primary: 'bg-gold text-[#0D0D1A] hover:brightness-110',
    secondary: 'bg-secondary text-white hover:brightness-110',
    outline: 'border border-gold text-gold hover:bg-gold hover:text-[#0D0D1A]',
    ghost: 'text-gray-400 hover:text-white hover:bg-[#1A1A2E]',
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
