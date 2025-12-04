
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Language } from '../i18n/translations';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    toggleLanguage: () => void;
    t: (key: keyof typeof translations['fr']) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>('fr');

    useEffect(() => {
        // 1. Check localStorage
        const savedLang = localStorage.getItem('memoraid_language') as Language;
        if (savedLang === 'fr' || savedLang === 'en') {
            setLanguageState(savedLang);
        } else {
            // 2. Check Browser Language
            const browserLang = navigator.language.split('-')[0];
            if (browserLang === 'fr') {
                setLanguageState('fr');
            } else {
                setLanguageState('en'); // Default fallback to English for international users
            }
        }
    }, []);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('memoraid_language', lang);
    };

    const toggleLanguage = () => {
        const newLang = language === 'fr' ? 'en' : 'fr';
        setLanguage(newLang);
    };

    const t = (key: keyof typeof translations['fr']): string => {
        return translations[language][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = (): LanguageContextType => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
