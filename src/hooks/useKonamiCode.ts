import { useState, useEffect } from 'react';

const KONAMI_CODE = [
    'ArrowUp', 'ArrowUp',
    'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight',
    'ArrowLeft', 'ArrowRight',
    'b', 'a'
];

export const useKonamiCode = (callback: () => void) => {
    const [sequence, setSequence] = useState<string[]>([]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const { key } = event;

            setSequence((prev) => {
                const nextSequence = [...prev, key].slice(-KONAMI_CODE.length);

                if (JSON.stringify(nextSequence) === JSON.stringify(KONAMI_CODE)) {
                    callback();
                    return []; // Reset after trigger
                }

                return nextSequence;
            });
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [callback]);
};
