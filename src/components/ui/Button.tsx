import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'gold';
    size?: 'sm' | 'md' | 'lg';
    icon?: LucideIcon;
    iconPosition?: 'left' | 'right';
    loading?: boolean;
}

/**
 * Outlined button component with consistent styling across the application.
 * Follows the "Test Schema" button aesthetic: colored border/text with subtle hover.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            variant = 'primary',
            size = 'md',
            icon: Icon,
            iconPosition = 'left',
            loading = false,
            className = '',
            children,
            disabled,
            ...props
        },
        ref
    ) => {
        // Base styles (always applied)
        const baseStyles = 'inline-flex items-center justify-center gap-2 font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed';

        // Size variants
        const sizeStyles = {
            sm: 'px-3 py-1.5 text-xs',
            md: 'px-4 py-2 text-sm',
            lg: 'px-6 py-3 text-base'
        };

        // Variant styles (outlined with colored border/text)
        const variantStyles = {
            primary: 'bg-transparent border border-sky-500 text-sky-500 hover:bg-sky-500/10',
            secondary: 'bg-transparent border border-slate-600 text-slate-400 hover:bg-slate-800 hover:text-white hover:border-slate-500',
            danger: 'bg-transparent border border-red-500 text-red-500 hover:bg-red-500/10',
            success: 'bg-transparent border border-emerald-500 text-emerald-500 hover:bg-emerald-500/10',
            warning: 'bg-transparent border border-amber-500 text-amber-500 hover:bg-amber-500/10',
            gold: 'bg-transparent border border-yellow-500 text-yellow-500 hover:bg-yellow-500/10'
        };

        // Icon size based on button size
        const iconSizes = {
            sm: 'w-3 h-3',
            md: 'w-4 h-4',
            lg: 'w-5 h-5'
        };

        const combinedClassName = `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`;

        return (
            <button
                ref={ref}
                className={combinedClassName}
                disabled={disabled || loading}
                {...props}
            >
                {loading && (
                    <div className={`border-2 border-current border-t-transparent rounded-full animate-spin ${iconSizes[size]}`} />
                )}

                {!loading && Icon && iconPosition === 'left' && (
                    <Icon className={iconSizes[size]} />
                )}

                {children}

                {!loading && Icon && iconPosition === 'right' && (
                    <Icon className={iconSizes[size]} />
                )}
            </button>
        );
    }
);

Button.displayName = 'Button';
