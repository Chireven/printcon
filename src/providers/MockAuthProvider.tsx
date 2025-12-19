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
    permissions: ['read:drivers', 'read:printers', 'debugmode.activate']
};

export function MockAuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User>(INITIAL_USER);

    const hasPermission = (permission: string) => {
        return user.permissions.includes(permission);
    };

    const togglePermission = (permission: string) => {
        setUser(prev => {
            const has = prev.permissions.includes(permission);
            const newPerms = has
                ? prev.permissions.filter(p => p !== permission)
                : [...prev.permissions, permission];

            // Notify UI of change (Requirement: Rights Manager Refresh)
            toast.info(`Permission Updated`, {
                description: `${permission} is now ${!has ? 'GRANTED' : 'REVOKED'}`
            });

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
