import React, { ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    isLoading,
    className,
    disabled,
    ...props
}) => {
    const variants = {
        primary: "bg-gradient-to-r from-brand-orange to-orange-600 text-white shadow-lg shadow-brand-orange/20 hover:shadow-brand-orange/30 hover:-translate-y-0.5",
        secondary: "bg-slate-900 text-white hover:bg-slate-800 shadow-md hover:shadow-lg",
        outline: "border-2 border-slate-200 text-slate-700 hover:border-brand-orange hover:text-brand-orange bg-transparent",
        ghost: "text-slate-600 hover:text-brand-orange hover:bg-orange-50 bg-transparent"
    };

    return (
        <button
            className={twMerge(
                clsx(
                    "relative w-full py-3 px-6 rounded-xl font-bold text-sm tracking-wide transition-all duration-300",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none disabled:shadow-none",
                    "active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-orange",
                    "flex justify-center items-center gap-2",
                    variants[variant],
                    className
                )
            )}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <Loader2 size={18} className="animate-spin absolute left-4" />}
            <span className={clsx(isLoading && "opacity-0")}>{children}</span>
            {isLoading && <span className="absolute inset-0 flex items-center justify-center">Loading...</span>}
        </button>
    );
};

export default Button;
