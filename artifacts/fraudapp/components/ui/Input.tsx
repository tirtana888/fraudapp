import React, { InputHTMLAttributes, useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    icon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    onRightIconClick?: () => void;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, icon, rightIcon, onRightIconClick, className, value, placeholder, ...props }, ref) => {
        const [isFilled, setIsFilled] = useState(false);
        const [isFocused, setIsFocused] = useState(false);

        useEffect(() => {
            setIsFilled(!!value && value.toString().length > 0);
        }, [value]);

        const isLabelFloating = isFilled || isFocused;

        return (
            <div className="w-full">
                <div className="relative">
                    <input
                        ref={ref}
                        value={value}
                        onFocus={(e) => {
                            setIsFocused(true);
                            props.onFocus?.(e);
                        }}
                        onBlur={(e) => {
                            setIsFocused(false);
                            props.onBlur?.(e);
                        }}
                        className={twMerge(
                            clsx(
                                "peer w-full px-4 py-3 rounded-xl border bg-white/50 backdrop-blur-sm",
                                "text-slate-900 outline-none transition-all duration-300",
                                "focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange",
                                "disabled:opacity-50 disabled:cursor-not-allowed",
                                icon ? "pl-11" : "",
                                rightIcon ? "pr-11" : "",
                                error
                                    ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                    : "border-slate-200 hover:border-brand-orange/50",
                                className
                            )
                        )}
                        placeholder={placeholder}
                        {...props}
                    />

                    <label className={clsx(
                        "absolute transition-all duration-200 pointer-events-none bg-white px-1",
                        // Floating state (when filled or focused)
                        isLabelFloating
                            ? "top-[-8px] left-3 text-[11px] font-semibold text-brand-orange"
                            : clsx(
                                "top-3.5 text-sm font-normal text-slate-500",
                                icon ? "left-11" : "left-4"
                            )
                    )}>
                        {label}
                    </label>

                    {icon && (
                        <div className={clsx(
                            "absolute left-4 top-3.5 transition-colors duration-300",
                            isFocused ? "text-brand-orange" : "text-slate-400"
                        )}>
                            {icon}
                        </div>
                    )}

                    {rightIcon && (
                        <button
                            type="button"
                            onClick={onRightIconClick}
                            className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer outline-none"
                        >
                            {rightIcon}
                        </button>
                    )}
                </div>
                {error && <p className="mt-1.5 text-xs text-red-500 font-medium ml-1 animate-fade-in">{error}</p>}
            </div>
        );
    }
);

Input.displayName = 'Input';
export default Input;
