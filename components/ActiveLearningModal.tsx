
import React, { useState, useMemo, useEffect } from 'react';
import type { CognitiveCapsule, KeyConcept, QuizQuestion } from '../types';
import { XIcon, LightbulbIcon, ListChecksIcon, PlayIcon, RefreshCwIcon } from '../constants';

interface ActiveLearningModalProps {
    capsule: CognitiveCapsule;
    onClose: () => void;
}

interface LearningStep {
    type: 'concept' | 'quiz';
    data: KeyConcept | QuizQuestion;
}

const ActiveLearningModal: React.FC<ActiveLearningModalProps> = ({ capsule, onClose }) => {
    const [sessionState, setSessionState] = useState<'intro' | 'learning' | 'complete'>('intro');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [showResult, setShowResult] = useState(false);

    const steps = useMemo((): LearningStep[] => {
        const conceptSteps: LearningStep[] = capsule.keyConcepts.map(kc => ({
            type: 'concept',
            data: kc,
        }));
        const quizSteps: LearningStep[] = capsule.quiz.map(q => ({
            type: 'quiz',
            data: q,
        }));
        return [...conceptSteps, ...quizSteps];
    }, [capsule]);
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'ArrowRight') {
            const nextButton = document.getElementById('next-step-button');
            if(nextButton && !nextButton.hasAttribute('disabled')) {
                nextButton.click();
            }
          }
        };
    
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
      }, []);

    const handleNext = () => {
        if (currentIndex < steps.length - 1) {
            setCurrentIndex(i => i + 1);
            setSelectedAnswer(null);
            setShowResult(false);
        } else {
            setSessionState('complete');
        }
    };

    const handleRestart = () => {
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setShowResult(false);
        setSessionState('learning');
    };

    const handleCheckAnswer = () => {
        if (selectedAnswer) {
            setShowResult(true);
        }
    };
    
    const getOptionClass = (option: string, correctAnswer: string) => {
        if (!showResult) {
            return selectedAnswer === option
                ? "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-500 ring-1 ring-emerald-500 text-emerald-800 dark:text-emerald-200"
                : "bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700";
        }

        const isCorrect = option === correctAnswer;
        const isSelected = option === selectedAnswer;

        if (isCorrect) {
            return "bg-emerald-100 dark:bg-emerald-900 border-emerald-500 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-500";
        }
        if (isSelected) {
            return "bg-red-100 dark:bg-red-900 border-red-500 text-red-800 dark:text-red-200";
        }
        return "bg-slate-50 dark:bg-zinc-700 border-slate-300 dark:border-zinc-600 text-slate-600 dark:text-zinc-300 opacity-70";
    };

    const renderContent = () => {
        if (sessionState === 'intro') {
            return (
                <div className="text-center p-8">
                    <div className="w-20 h-20 mx-auto bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-6">
                        <PlayIcon className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Session d'Apprentissage Actif</h2>
                    <p className="text-slate-600 dark:text-zinc-300 mb-8 leading-relaxed">
                        Préparez-vous à renforcer votre connaissance sur "{capsule.title}".<br/>
                        La session contient <strong className="text-emerald-600 dark:text-emerald-400">{capsule.keyConcepts.length} concept(s)</strong> et <strong className="text-emerald-600 dark:text-emerald-400">{capsule.quiz.length} question(s)</strong>.
                    </p>
                    <button
                        onClick={() => setSessionState('learning')}
                        className="px-8 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-bold text-lg shadow-lg shadow-emerald-200/50 dark:shadow-none"
                    >
                        Commencer
                    </button>
                </div>
            );
        }

        if (sessionState === 'complete') {
            return (
                <div className="text-center p-8">
                    <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-10 h-10 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Session terminée !</h2>
                    <p className="text-slate-600 dark:text-zinc-300 mb-6">
                       Excellent travail ! Vous avez terminé la session d'apprentissage pour "{capsule.title}".
                       Cette capsule a été marquée comme révisée.
                    </p>
                    <div className="flex justify-center gap-4">
                        <button
                            onClick={handleRestart}
                            className="flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors font-semibold"
                        >
                            <RefreshCwIcon className="w-5 h-5"/>
                            Recommencer
                        </button>
                        <button
                            onClick={onClose}
                            className="px-8 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold"
                        >
                            Terminer
                        </button>
                    </div>
                </div>
            );
        }
        
        if (sessionState === 'learning' && steps.length > 0) {
            const currentStep = steps[currentIndex];
            const isQuiz = currentStep.type === 'quiz';
            const quizData = isQuiz ? (currentStep.data as QuizQuestion) : null;
            const conceptData = !isQuiz ? (currentStep.data as KeyConcept) : null;
            
            const canProceed = isQuiz ? showResult : true;

            return (
                <div className="p-6 md:p-8 flex-grow flex flex-col">
                    <div className="flex-grow">
                        {isQuiz ? (
                            // QUIZ LAYOUT
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center flex-shrink-0">
                                        <ListChecksIcon className="w-5 h-5 text-sky-600 dark:text-sky-400"/>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Question de quiz</h3>
                                </div>
                                <p className="text-slate-700 dark:text-zinc-200 mb-6 font-medium text-xl leading-relaxed">{quizData?.question}</p>
                                <div className="space-y-3 mb-6">
                                    {quizData?.options.map((option) => (
                                        <button 
                                            key={option} 
                                            onClick={() => !showResult && setSelectedAnswer(option)}
                                            disabled={showResult}
                                            className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${getOptionClass(option, quizData.correctAnswer)}`}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                                {showResult && (
                                    <div className={`p-4 rounded-xl mb-4 animate-fade-in-fast ${selectedAnswer === quizData?.correctAnswer ? 'bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-100 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/50 border border-red-100 dark:border-red-800'}`}>
                                        <h4 className={`font-bold ${selectedAnswer === quizData?.correctAnswer ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                                            {selectedAnswer === quizData?.correctAnswer ? 'Bonne réponse !' : 'Réponse incorrecte'}
                                        </h4>
                                        <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed">{quizData?.explanation}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            // CONCEPT LAYOUT
                             <div>
                                <div className="flex items-center gap-3 mb-6">
                                     <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                                        <LightbulbIcon className="w-5 h-5 text-amber-600 dark:text-amber-400"/>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Concept Clé</h3>
                                </div>
                                <div className="p-6 bg-slate-50 dark:bg-zinc-900/50 rounded-2xl border border-slate-200 dark:border-zinc-800">
                                    <p className="font-bold text-slate-800 dark:text-zinc-100 text-2xl mb-3">{conceptData?.concept}</p>
                                    <p className="text-slate-600 dark:text-zinc-300 text-lg leading-relaxed">{conceptData?.explanation}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-8 flex-shrink-0">
                        {isQuiz && !showResult && (
                            <button
                                onClick={handleCheckAnswer}
                                disabled={!selectedAnswer}
                                className="w-full px-6 py-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed transition-colors font-bold shadow-md shadow-emerald-200/50 dark:shadow-none"
                            >
                                Vérifier la réponse
                            </button>
                        )}
                        {canProceed && (
                            <button
                                id="next-step-button"
                                onClick={handleNext}
                                className="w-full px-6 py-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-bold shadow-md shadow-emerald-200/50 dark:shadow-none"
                            >
                               {currentIndex === steps.length - 1 ? 'Terminer la session' : 'Étape suivante'}
                            </button>
                        )}
                    </div>
                </div>
            );
        }

        return null;
    };

    const progress = steps.length > 0 ? ((currentIndex + (sessionState === 'complete' ? 1 : 0)) / steps.length) * 100 : 0;

    return (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-2xl h-full max-h-[90vh] flex flex-col overflow-hidden">
                <header className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                         <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                            <PlayIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400"/>
                         </div>
                         <h2 className="text-lg font-bold text-slate-800 dark:text-white">Apprentissage Actif</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Fermer">
                        <XIcon className="w-6 h-6 text-slate-500 dark:text-zinc-400" />
                    </button>
                </header>

                {sessionState === 'learning' && (
                    <div className="px-6 pt-6 flex-shrink-0">
                        <div className="flex justify-between items-center mb-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                           <span>Progression</span>
                           <span>Étape {currentIndex + 1} / {steps.length}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                            <div
                                className="bg-emerald-500 h-full rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}
                
                <main className="flex-grow overflow-y-auto flex flex-col justify-center">
                    {renderContent()}
                </main>
            </div>
        </div>
    );
};

export default ActiveLearningModal;
