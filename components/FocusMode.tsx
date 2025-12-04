
import React, { useState, useEffect, useCallback } from 'react';
import type { CognitiveCapsule } from '../types';
import { MinimizeIcon, PlayCircleIcon, PauseCircleIcon, RefreshCwIcon, CoffeeIcon, MonitorIcon, BookOpenIcon, LayersIcon, ListChecksIcon, LightbulbIcon } from '../constants';
import Quiz from './Quiz';

interface FocusModeProps {
    capsule: CognitiveCapsule;
    onExit: () => void;
    onMarkAsReviewed: (capsuleId: string, score?: number, type?: 'quiz' | 'flashcard' | 'manual') => void;
}

type TimerMode = 'focus' | 'short' | 'long';
type ViewMode = 'read' | 'flashcards' | 'quiz';

const TIMERS = {
    focus: 25 * 60,
    short: 5 * 60,
    long: 50 * 60,
};

const FocusMode: React.FC<FocusModeProps> = ({ capsule, onExit, onMarkAsReviewed }) => {
    const [timeLeft, setTimeLeft] = useState(TIMERS.focus);
    const [isActive, setIsActive] = useState(false);
    const [timerMode, setTimerMode] = useState<TimerMode>('focus');
    const [viewMode, setViewMode] = useState<ViewMode>('read');
    
    // Flashcard State (Simplified for Zen mode)
    const [fcIndex, setFcIndex] = useState(0);
    const [fcFlipped, setFcFlipped] = useState(false);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        let interval: number;
        if (isActive && timeLeft > 0) {
            interval = window.setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setIsActive(false);
            // Optional: Play sound here
        }
        return () => clearInterval(interval);
    }, [isActive, timeLeft]);

    const handleTimerSwitch = (mode: TimerMode) => {
        setIsActive(false);
        setTimerMode(mode);
        setTimeLeft(TIMERS[mode]);
    };

    const toggleTimer = () => setIsActive(!isActive);
    const resetTimer = () => {
        setIsActive(false);
        setTimeLeft(TIMERS[timerMode]);
    };

    // Flashcard Controls
    const nextCard = () => {
        if (capsule.flashcards && fcIndex < capsule.flashcards.length - 1) {
            setFcFlipped(false);
            setTimeout(() => setFcIndex(i => i + 1), 150);
        }
    };
    const prevCard = () => {
        if (fcIndex > 0) {
            setFcFlipped(false);
            setTimeout(() => setFcIndex(i => i - 1), 150);
        }
    };

    const renderContent = () => {
        switch (viewMode) {
            case 'read':
                return (
                    <div className="max-w-3xl mx-auto px-6 py-12 space-y-12 animate-fade-in">
                        <div className="text-center space-y-4">
                            <h1 className="text-4xl font-bold text-slate-900 dark:text-white leading-tight">{capsule.title}</h1>
                            <p className="text-xl text-slate-600 dark:text-zinc-300 leading-relaxed">{capsule.summary}</p>
                        </div>
                        
                        <div className="space-y-8">
                            <h2 className="text-2xl font-semibold text-center text-slate-800 dark:text-zinc-200 border-b border-slate-200 dark:border-zinc-800 pb-4">Concepts Clés</h2>
                            <div className="grid gap-8">
                                {capsule.keyConcepts.map((kc, idx) => (
                                    <div key={idx} className="bg-slate-50 dark:bg-zinc-900/50 p-6 rounded-xl border border-slate-100 dark:border-zinc-800">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-2 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                            {kc.concept}
                                        </h3>
                                        <p className="text-lg text-slate-700 dark:text-zinc-300 leading-relaxed">{kc.explanation}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {capsule.examples.length > 0 && (
                             <div className="space-y-6">
                                <h2 className="text-2xl font-semibold text-center text-slate-800 dark:text-zinc-200 border-b border-slate-200 dark:border-zinc-800 pb-4">Exemples</h2>
                                <ul className="space-y-4">
                                    {capsule.examples.map((ex, idx) => (
                                        <li key={idx} className="flex items-start gap-4 text-lg text-slate-700 dark:text-zinc-300">
                                            <span className="text-slate-400 select-none">•</span>
                                            {ex}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                );
            case 'flashcards':
                const cards = capsule.flashcards || [];
                if (cards.length === 0) return <div className="flex items-center justify-center h-full text-slate-500">Aucune flashcard disponible.</div>;
                
                const card = cards[fcIndex];
                return (
                    <div className="flex flex-col items-center justify-center h-full p-8 animate-fade-in">
                        <div 
                            className="relative w-full max-w-2xl aspect-[3/2] cursor-pointer group perspective"
                            onClick={() => setFcFlipped(!fcFlipped)}
                        >
                            <div className={`w-full h-full transition-all duration-500 preserve-3d ${fcFlipped ? 'rotate-y-180' : ''} relative`}>
                                {/* Front */}
                                <div className="absolute inset-0 backface-hidden bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center p-8 shadow-2xl">
                                    <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Question</span>
                                    <p className="text-3xl font-bold text-slate-800 dark:text-white text-center leading-snug">{card.front}</p>
                                    <p className="absolute bottom-6 text-sm text-slate-400 animate-pulse">Cliquer pour retourner</p>
                                </div>
                                {/* Back */}
                                <div className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center p-8 shadow-2xl">
                                    <span className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-4">Réponse</span>
                                    <p className="text-2xl font-medium text-slate-700 dark:text-zinc-200 text-center leading-relaxed">{card.back}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-8 mt-12">
                            <button 
                                onClick={prevCard} 
                                disabled={fcIndex === 0}
                                className="px-6 py-3 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold disabled:opacity-30 hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors"
                            >
                                Précédent
                            </button>
                            <span className="text-xl font-mono text-slate-400 dark:text-zinc-500">
                                {fcIndex + 1} / {cards.length}
                            </span>
                            <button 
                                onClick={nextCard}
                                disabled={fcIndex === cards.length - 1}
                                className="px-6 py-3 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold disabled:opacity-30 hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors"
                            >
                                Suivant
                            </button>
                        </div>
                    </div>
                );
            case 'quiz':
                 return (
                    <div className="max-w-3xl mx-auto px-6 py-12 animate-fade-in">
                        <h2 className="text-3xl font-bold text-center mb-12 text-slate-900 dark:text-white">Quiz de Validation</h2>
                        <Quiz 
                            questions={capsule.quiz} 
                            onComplete={(score) => onMarkAsReviewed(capsule.id, score, 'quiz')} 
                        />
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-zinc-950 flex flex-col overflow-hidden transition-colors duration-500">
            {/* HEADER / TOOLBAR */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-900 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-10">
                {/* Timer Controls */}
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-900 rounded-full p-1 pr-4">
                         <button 
                            onClick={toggleTimer}
                            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-md"
                        >
                            {isActive ? <PauseCircleIcon className="w-6 h-6"/> : <PlayCircleIcon className="w-6 h-6"/>}
                        </button>
                        <span className={`font-mono text-2xl font-bold w-20 text-center ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                            {formatTime(timeLeft)}
                        </span>
                        <button onClick={resetTimer} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300">
                            <RefreshCwIcon className="w-4 h-4"/>
                        </button>
                    </div>
                    
                    <div className="hidden sm:flex gap-2">
                        <button 
                            onClick={() => handleTimerSwitch('focus')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${timerMode === 'focus' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-900'}`}
                        >
                            <MonitorIcon className="w-3 h-3"/> Focus (25)
                        </button>
                        <button 
                            onClick={() => handleTimerSwitch('short')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${timerMode === 'short' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-900'}`}
                        >
                            <CoffeeIcon className="w-3 h-3"/> Pause (5)
                        </button>
                        <button 
                            onClick={() => handleTimerSwitch('long')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${timerMode === 'long' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-900'}`}
                        >
                            <CoffeeIcon className="w-3 h-3"/> Longue (50)
                        </button>
                    </div>
                </div>

                {/* View Switcher */}
                <div className="flex bg-slate-100 dark:bg-zinc-900 rounded-lg p-1 gap-1">
                    <button 
                        onClick={() => setViewMode('read')}
                        className={`p-2 rounded-md transition-all ${viewMode === 'read' ? 'bg-white dark:bg-zinc-800 shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Lecture"
                    >
                        <BookOpenIcon className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => setViewMode('flashcards')}
                        className={`p-2 rounded-md transition-all ${viewMode === 'flashcards' ? 'bg-white dark:bg-zinc-800 shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Flashcards"
                    >
                        <LayersIcon className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => setViewMode('quiz')}
                        className={`p-2 rounded-md transition-all ${viewMode === 'quiz' ? 'bg-white dark:bg-zinc-800 shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Quiz"
                    >
                        <ListChecksIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Exit Button */}
                <button 
                    onClick={onExit}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white transition-colors"
                >
                    <MinimizeIcon className="w-5 h-5" />
                    Quitter Focus
                </button>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-grow overflow-y-auto">
                {renderContent()}
            </div>
            
            {/* Styles for 3D Flip */}
            <style>{`
                .preserve-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
                .perspective { perspective: 1000px; }
            `}</style>
        </div>
    );
};

export default FocusMode;
