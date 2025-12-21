import React from 'react';
import { Lock } from 'lucide-react';
import { useMockAuth } from '../../hooks/useMockAuth';

interface GuardedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    requiredPermission: string;
    variant?: 'primary' | 'destructive' | 'default' | 'ghost-blue';
}

export const GuardedButton: React.FC<GuardedButtonProps> = ({
    requiredPermission,
    children,
    variant = 'default',
    className = '',
    ...props
}) => {
    const { hasPermission } = useMockAuth();
    const allowed = hasPermission(requiredPermission);

    // Initial basic styles
    let baseStyles = "px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2";
    let variantStyles = "";

    if (variant === 'primary') {
        variantStyles = "bg-sky-500 text-white hover:bg-sky-400 shadow-lg shadow-sky-500/20";
    } else if (variant === 'destructive') {
        variantStyles = "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20";
    } else if (variant === 'ghost-blue') {
        variantStyles = "bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/20";
    } else {
        variantStyles = "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700";
    }

    if (!allowed) {
        // Disabled state override
        return (
            <button
                {...props}
                disabled
                onClick={undefined}
                className={`${baseStyles} bg-slate-800/50 text-slate-500 border border-slate-800 cursor-not-allowed ${className}`}
                title={`Missing permission: ${requiredPermission}`}
                style={{ pointerEvents: 'auto' }} // Ensure tooltip works but button is seemingly disabled
            >
                <Lock className="w-3.5 h-3.5" />
                {children}
            </button>
        );
    }

    return (
        <button
            className={`${baseStyles} ${variantStyles} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};
