import React from 'react';
import { SunIcon, MoonIcon } from '../constants';

interface ThemeToggleProps {
    theme: 'light' | 'dark';
    onToggle: () => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onToggle }) => {
    return (
        <button
            onClick={onToggle}
            className="p-2 rounded-full text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label={theme === 'dark' ? "Passer au mode clair" : "Passer au mode sombre"}
        >
            {theme === 'dark' ? <SunIcon className="w-6 h-6 text-yellow-400" /> : <MoonIcon className="w-6 h-6" />}
        </button>
    );
};

export default ThemeToggle;