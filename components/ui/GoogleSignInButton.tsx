import React, { ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

interface GoogleSignInButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    isLoading?: boolean;
    text?: string;
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
    isLoading,
    text = 'Lanjutkan dengan Google',
    className,
    disabled,
    ...props
}) => {
    return (
        <button
            className={twMerge(
                clsx(
                    "relative w-full py-3 px-6 rounded-xl font-semibold text-sm tracking-wide transition-all duration-300",
                    "bg-white border-2 border-slate-200 text-slate-700",
                    "hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none disabled:shadow-none",
                    "active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300",
                    "flex justify-center items-center gap-3",
                    className
                )
            )}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Memproses...</span>
                </>
            ) : (
                <>
                    {/* Google Logo SVG */}
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z" fill="#4285F4" />
                        <path d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.59A9.996 9.996 0 0010 20z" fill="#34A853" />
                        <path d="M4.405 11.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 000 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59z" fill="#FBBC05" />
                        <path d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0 6.09 0 2.71 2.24 1.064 5.51l3.34 2.59C5.19 5.736 7.395 3.977 10 3.977z" fill="#EA4335" />
                    </svg>
                    <span>{text}</span>
                </>
            )}
        </button>
    );
};

export default GoogleSignInButton;
