
import React, { useState, useEffect, useCallback } from 'react';
import type { CognitiveCapsule } from '../types';
import { XIcon, LayersIcon, ChevronLeftIcon, ChevronRightIcon } from '../constants';
import { ToastType } from '../hooks/useToast';

interface FlashcardModalProps {
    capsule: CognitiveCapsule;
    onClose: () => void;
    addToast: (message: string, type: ToastType) => void;
}

const FlashcardModal: React.FC<FlashcardModalProps> = ({ capsule, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    
    const flashcards = capsule.flashcards || [];

    useEffect(() => {
        setCurrentIndex(0);
        setIsFlipped(false);
    }, [capsule.id]);

    const changeCard = useCallback((direction: 'next' | 'prev') => {
        if (flashcards.length === 0) return;
        setIsFlipped(false);
        setTimeout(() => {
            if (direction === 'next') {
                setCurrentIndex((prevIndex) => (prevIndex + 1) % flashcards.length);
            } else {
                setCurrentIndex((prevIndex) => (prevIndex - 1 + flashcards.length) % flashcards.length);
            }
        }, 200); 
    }, [flashcards.length]);

    const currentCard = flashcards[currentIndex];

    const renderContent = () => {
        if (!currentCard) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center">
                     <p className="text-slate-500 dark:text-zinc-400">Aucune flashcard n'est disponible pour cette capsule.</p>
                </div>
            );
        }
        
        return (
            <div 
                className="relative w-full max-w-2xl h-full cursor-pointer transition-transform duration-500 ease-in-out"
                style={{ perspective: '1000px', transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
                onClick={() => setIsFlipped(f => !f)}
            >
                {/* Recto */}
                <div
                    className="absolute w-full h-full p-6 md:p-8 rounded-3xl bg-white dark:bg-zinc-800 flex flex-col justify-center items-center text-center shadow-2xl border border-slate-100 dark:border-zinc-700"
                    style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                >
                    <span className="absolute top-6 left-6 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">Recto</span>
                    <p className="text-xl md:text-3xl font-bold text-slate-800 dark:text-zinc-100 leading-snug">{currentCard.front}</p>
                    <div className="absolute bottom-8 text-xs text-slate-400 dark:text-zinc-500 font-medium uppercase tracking-wide animate-pulse">
                       Cliquer pour retourner
                    </div>
                </div>
                {/* Verso */}
                <div className="absolute w-full h-full p-6 md:p-8 rounded-3xl bg-emerald-50 dark:bg-zinc-800 shadow-2xl border border-emerald-100 dark:border-zinc-700 flex flex-col justify-center items-center text-center" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                    <span className="absolute top-6 left-6 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">Verso</span>
                    <p className="text-lg md:text-2xl font-medium text-emerald-900 dark:text-emerald-100 whitespace-pre-wrap leading-relaxed">{currentCard.back}</p>
                    <div className="absolute bottom-8 text-xs text-emerald-600/50 dark:text-emerald-400/50 font-medium uppercase tracking-wide">
                       Cliquer pour revenir
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-zinc-950/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true">
             <div className="w-full max-w-4xl h-full max-h-[85vh] flex flex-col">
                <header className="flex items-center justify-between p-4 text-white mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 rounded-lg backdrop-blur-md">
                            <LayersIcon className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Flashcards</h2>
                            <p className="text-sm text-zinc-400">{capsule.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors" aria-label="Fermer">
                        <XIcon className="w-6 h-6 text-white" />
                    </button>
                </header>

                <main className="flex-grow w-full flex items-center justify-center p-4 relative" style={{ perspective: '1000px' }}>
                    {renderContent()}
                </main>

                <footer className="w-full flex items-center justify-between p-4 flex-shrink-0 mt-4 max-w-xl mx-auto">
                    <button 
                        onClick={() => changeCard('prev')} 
                        disabled={flashcards.length === 0}
                        className="p-4 rounded-full text-white bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-30 shadow-lg" 
                        aria-label="Carte précédente"
                    >
                        <ChevronLeftIcon className="w-6 h-6"/>
                    </button>
                    <div className="text-lg font-mono font-bold text-zinc-400 bg-zinc-900 px-4 py-1 rounded-lg">
                        {flashcards.length > 0 ? `${currentIndex + 1} / ${flashcards.length}` : '0 / 0'}
                    </div>
                    <button 
                        onClick={() => changeCard('next')} 
                        disabled={flashcards.length === 0}
                        className="p-4 rounded-full text-white bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-30 shadow-lg" 
                        aria-label="Carte suivante"
                    >
                        <ChevronRightIcon className="w-6 h-6"/>
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default FlashcardModal;
