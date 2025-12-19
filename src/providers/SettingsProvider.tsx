'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface SettingsContextType {
    highContrast: boolean;
    setHighContrast: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [highContrast, setHighContrast] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Load settings from localStorage
        const stored = localStorage.getItem('printcon_settings_contrast');
        if (stored) {
            setHighContrast(JSON.parse(stored));
        }
        setIsLoaded(true);
    }, []);

    const updateHighContrast = (enabled: boolean) => {
        setHighContrast(enabled);
        localStorage.setItem('printcon_settings_contrast', JSON.stringify(enabled));
    };

    if (!isLoaded) return null; // Prevent hydration mismatch

    return (
        <SettingsContext.Provider value={{ highContrast, setHighContrast: updateHighContrast }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
