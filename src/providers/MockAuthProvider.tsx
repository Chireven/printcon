'use client';

import React, { createContext, useContext, useState } from 'react';
import { toast } from 'sonner';

interface User {
    name: string;
    email: string;
    role: 'admin' | 'viewer';
    permissions: string[];
}

interface AuthContextType {
    user: User;
    hasPermission: (permission: string) => boolean;
    togglePermission: (permission: string) => void;
    updateRole: (role: 'admin' | 'viewer') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initial Mock User
const INITIAL_USER: User = {
    name: 'Joe Demo',
    email: 'joe@printcon.enterprise',
    role: 'viewer', // Start as restricted
    permissions: [
        'drivers:read', 
        'read:printers', 
        'debugmode.activate', 
        'plugin.pack', 
        'plugin.delete', 
        'plugin.update', 
        'plugin.lock',
        'printservers.read',
        'printservers.create',
        'printservers.update',
        'printservers.delete'
    ]
};

export function MockAuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User>(INITIAL_USER);

    // Persistence: Load from screen storage on mount
    React.useEffect(() => {
        const stored = localStorage.getItem('printcon_debug_permissions');
        if (stored) {
            try {
                const parsedPerms = JSON.parse(stored);
                if (Array.isArray(parsedPerms)) {
                    setUser(prev => ({ ...prev, permissions: parsedPerms }));
                }
            } catch (e) {
                console.error('Failed to load permissions', e);
            }
        }
    }, []);

    const hasPermission = (permission: string) => {
        return user.permissions.includes(permission);
    };

    const togglePermission = (permission: string) => {
        setUser(prev => {
            const has = prev.permissions.includes(permission);
            const newPerms = has
                ? prev.permissions.filter(p => p !== permission)
                : [...prev.permissions, permission];

            // Notify UI of change
            toast.info(`Permission Updated`, {
                description: `${permission} is now ${!has ? 'GRANTED' : 'REVOKED'}`
            });

            // Persistence: Save to local storage
            localStorage.setItem('printcon_debug_permissions', JSON.stringify(newPerms));

            return { ...prev, permissions: newPerms };
        });
    };

    const updateRole = (role: 'admin' | 'viewer') => {
        setUser(prev => ({ ...prev, role }));
    };

    return (
        <AuthContext.Provider value={{ user, hasPermission, togglePermission, updateRole }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within a MockAuthProvider');
    }
    return context;
}
