
import React, { useState } from 'react';
import type { QuizQuestion } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface QuizProps {
    questions: QuizQuestion[];
    onComplete?: (score: number) => void; // Optional callback for reporting score
}

const Quiz: React.FC<QuizProps> = ({ questions, onComplete }) => {
    const { t } = useLanguage();
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [score, setScore] = useState(0);
    const [quizFinished, setQuizFinished] = useState(false);

    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

    const handleSelectAnswer = (answer: string) => {
        if (showResult) return;
        setSelectedAnswer(answer);
    };

    const handleCheckAnswer = () => {
        if (selectedAnswer) {
            if (selectedAnswer === currentQuestion.correctAnswer) {
                setScore(s => s + 1);
            }
            setShowResult(true);
        }
    };
    
    const handleNextQuestion = () => {
        setShowResult(false);
        setSelectedAnswer(null);
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(i => i + 1);
        } else {
            finishQuiz(score);
        }
    };
    
    const finishQuiz = (currentScore: number) => {
         setQuizFinished(true);
         if (onComplete) {
             // Calculate percentage
             const percentage = Math.round((currentScore / questions.length) * 100);
             onComplete(percentage);
         }
    };

    const handleRestartQuiz = () => {
        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setShowResult(false);
        setScore(0);
        setQuizFinished(false);
    }
    
    if (quizFinished) {
        return (
             <div className="p-6 bg-slate-100 dark:bg-zinc-900/50 rounded-lg border border-slate-200 dark:border-zinc-800">
                <h3 className="text-xl font-semibold text-slate-800 dark:text-zinc-100 mb-2">{t('quiz_finished')}</h3>
                <p className="text-lg text-slate-600 dark:text-zinc-300 mb-4">
                    {t('your_score')} <span className="font-bold text-emerald-600 dark:text-emerald-400">{score} / {questions.length}</span>
                </p>
                <button 
                    onClick={handleRestartQuiz}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors font-semibold"
                >
                    {t('restart')}
                </button>
            </div>
        );
    }

    return (
        <div className="p-6 bg-slate-50 dark:bg-zinc-900/50 rounded-lg border border-slate-100 dark:border-zinc-800">
            <h3 className="text-xl font-semibold text-slate-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full">
                    {currentQuestionIndex + 1}/{questions.length}
                </span>
                {t('quiz_title')}
            </h3>
            <p className="text-slate-700 dark:text-zinc-200 mb-6 font-medium text-lg leading-relaxed">{currentQuestion.question}</p>
            
            <div className="space-y-3 mb-6">
                {currentQuestion.options.map((option, index) => {
                    const isSelected = selectedAnswer === option;
                    let buttonClass = "w-full text-left p-4 rounded-xl border transition-all duration-200 font-medium text-sm ";
                    
                    if (showResult) {
                        if (option === currentQuestion.correctAnswer) {
                            buttonClass += "bg-emerald-100 dark:bg-emerald-900/50 border-emerald-500 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500";
                        } else if (isSelected) {
                            buttonClass += "bg-red-100 dark:bg-red-900/50 border-red-500 text-red-800 dark:text-red-200";
                        } else {
                            buttonClass += "bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 opacity-60";
                        }
                    } else {
                         buttonClass += isSelected 
                            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 ring-1 ring-emerald-500 text-emerald-800 dark:text-emerald-200 shadow-sm" 
                            : "bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-zinc-700/50 text-slate-700 dark:text-zinc-300";
                    }

                    return (
                        <button key={index} onClick={() => handleSelectAnswer(option)} className={buttonClass} disabled={showResult}>
                            {option}
                        </button>
                    );
                })}
            </div>
            
            {showResult && (
                <div className={`p-4 rounded-xl mb-6 ${isCorrect ? 'bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800'}`}>
                    <h4 className={`font-bold ${isCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                        {isCorrect ? t('correct_answer') : t('wrong_answer')}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed">{currentQuestion.explanation}</p>
                </div>
            )}

            {!showResult ? (
                <button
                    onClick={handleCheckAnswer}
                    disabled={!selectedAnswer}
                    className="w-full sm:w-auto px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed transition-colors font-bold shadow-md shadow-emerald-200/50 dark:shadow-none"
                >
                    {t('check_answer')}
                </button>
            ) : (
                <button
                    onClick={() => {
                         const nextScore = isCorrect ? score + 1 : score;
                         if (currentQuestionIndex >= questions.length - 1) {
                             setScore(nextScore);
                             finishQuiz(nextScore);
                         } else {
                             handleNextQuestion();
                         }
                    }}
                    className="w-full sm:w-auto px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-bold shadow-md shadow-emerald-200/50 dark:shadow-none"
                >
                    {currentQuestionIndex < questions.length - 1 ? t('next_question') : t('see_results')}
                </button>
            )}
        </div>
    );
};

export default Quiz;
