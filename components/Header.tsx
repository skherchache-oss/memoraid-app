
import React from 'react';
import { MemoraidLogoIcon, UserIcon, FlameIcon, GlobeIcon } from '../constants';
import type { User } from 'firebase/auth';
import { getLevelProgress } from '../services/gamificationService';
import type { GamificationStats } from '../types';
import type { ToastType } from '../hooks/useToast';
import { useLanguage } from '../contexts/LanguageContext';

interface HeaderProps {
    onOpenProfile: () => void;
    onLogin: () => void;
    currentUser: User | null;
    isOnline?: boolean;
    gamification?: GamificationStats;
    addToast: (message: string, type: ToastType) => void;
    onLogoClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenProfile, onLogin, currentUser, isOnline = true, gamification, addToast, onLogoClick }) => {
    const { language, toggleLanguage, t } = useLanguage();
    const xpProgress = gamification ? getLevelProgress(gamification.xp) : 0;

    const handleXpClick = () => {
        addToast("Points d'Expérience (XP) : Créez des capsules et faites des quiz pour progresser !", 'info');
    };

    return (
        <header className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 dark:border-zinc-800">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* LOGO & TITRE (Cliquable pour retour accueil) */}
                    <button 
                        onClick={onLogoClick}
                        className="flex items-center space-x-2 md:space-x-3 flex-shrink-0 focus:outline-none hover:opacity-80 transition-opacity"
                        aria-label="Retour à l'accueil"
                    >
                         <MemoraidLogoIcon className="h-8 w-8 md:h-9 md:w-9 text-emerald-500" />
                        <h1 className="text-xl md:text-2xl font-bold text-emerald-700 dark:text-emerald-500 block tracking-tight">
                            Memoraid
                        </h1>
                    </button>
                    
                    <div className="flex items-center gap-2 md:gap-4">
                        {/* GAMIFICATION STATS (Compact on Mobile) */}
                        {gamification && (
                            <div 
                                className="flex items-center gap-2 bg-emerald-50 dark:bg-zinc-800/50 rounded-full px-2 md:px-3 py-1 border border-emerald-100 dark:border-zinc-700 cursor-pointer hover:bg-emerald-100 dark:hover:bg-zinc-700 transition-colors"
                                onClick={handleXpClick}
                                title="Cliquez pour voir les détails"
                            >
                                {/* Streak (Hidden on mobile) */}
                                <div className="hidden sm:flex items-center gap-1">
                                    <FlameIcon className={`w-5 h-5 ${gamification.currentStreak > 0 ? 'text-orange-500 animate-pulse' : 'text-slate-400'}`} />
                                    <span className={`font-bold text-sm ${gamification.currentStreak > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-500'}`}>
                                        {gamification.currentStreak}
                                    </span>
                                </div>
                                <div className="hidden sm:block w-px h-4 bg-slate-300 dark:bg-zinc-600"></div>
                                
                                {/* Level / XP - Compact Mode for Mobile */}
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col items-end w-full">
                                        {/* Mobile: Just "Niv. X" Badge style */}
                                        <div className="md:hidden flex items-center gap-1">
                                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-200 dark:bg-emerald-900/30 px-2 py-0.5 rounded">
                                                Niv. {gamification.level}
                                            </span>
                                        </div>

                                        {/* Desktop: Full XP Bar */}
                                        <div className="hidden md:block min-w-[100px]">
                                            <div className="flex justify-between w-full text-[10px] font-bold text-slate-600 dark:text-zinc-300 leading-none mb-1">
                                                <span>Niv. {gamification.level}</span>
                                                <span className="text-emerald-600 dark:text-emerald-400">{Math.floor(gamification.xp)} XP</span>
                                            </div>
                                            <div className="w-full bg-emerald-100 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                                                <div 
                                                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                                                    style={{ width: `${xpProgress}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* LANGUAGE SELECTOR */}
                        <button
                            onClick={toggleLanguage}
                            className="flex items-center justify-center w-8 h-8 md:w-auto md:h-auto md:px-2 md:py-1.5 rounded-full md:rounded-md bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                            title="Changer de langue / Switch language"
                        >
                            <GlobeIcon className="w-5 h-5" />
                            <span className="hidden md:inline ml-1 text-xs font-bold uppercase">{language}</span>
                        </button>

                        {/* USER SECTION */}
                        {currentUser ? (
                            <>
                                <div className="hidden md:flex flex-col items-end mr-2">
                                    <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
                                        {currentUser.displayName || currentUser.email?.split('@')[0]}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-slate-400 dark:bg-zinc-500'}`}></span>
                                        <span className={`text-xs font-medium ${isOnline ? 'text-green-600 dark:text-green-500' : 'text-slate-500 dark:text-zinc-500'}`}>
                                            {isOnline ? t('online') : t('offline')}
                                        </span>
                                    </div>
                                </div>
                                {/* Avatar / Profile Button - HIDDEN ON MOBILE (md:block) */}
                                {currentUser.photoURL ? (
                                    <img 
                                        src={currentUser.photoURL} 
                                        alt="Profil" 
                                        className="hidden md:block w-8 h-8 rounded-full cursor-pointer border border-slate-200 dark:border-zinc-700 hover:ring-2 hover:ring-emerald-300 transition-all"
                                        onClick={onOpenProfile}
                                    />
                                ) : (
                                    <button
                                        onClick={onOpenProfile}
                                        className="hidden md:block p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors"
                                        aria-label="Ouvrir le profil"
                                    >
                                        <UserIcon className="w-5 h-5" />
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={onLogin}
                                    className="px-3 py-1.5 md:px-4 md:py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 rounded-full hover:bg-emerald-700 transition-colors shadow-sm whitespace-nowrap"
                                >
                                    <span className="hidden sm:inline">{t('login_signup')}</span>
                                    <span className="sm:hidden">Login</span>
                                </button>
                                {/* BOUTON PROFIL POUR INVITÉ - HIDDEN ON MOBILE */}
                                <button
                                    onClick={onOpenProfile}
                                    className="hidden md:block p-2 rounded-full bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors border border-slate-200 dark:border-zinc-700"
                                    aria-label="Ouvrir le profil invité"
                                >
                                    <UserIcon className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
