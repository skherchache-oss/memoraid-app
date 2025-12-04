
import React, { useState } from 'react';
import type { CognitiveCapsule, StudyPlan } from '../types';
import { CalendarIcon, CheckCircleIcon, XIcon, ClockIcon } from '../constants';
import { generateStudyPlan } from '../services/planningService';
import { useLanguage } from '../contexts/LanguageContext';

interface PlanningWizardProps {
    capsules: CognitiveCapsule[];
    onClose: () => void;
    onPlanCreated: (plan: StudyPlan) => void;
}

const PlanningWizard: React.FC<PlanningWizardProps> = ({ capsules, onClose, onPlanCreated }) => {
    const { t } = useLanguage();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [planName, setPlanName] = useState('Révisions Partiels');
    const [examDate, setExamDate] = useState('');
    const [dailyMinutes, setDailyMinutes] = useState(60);
    const [selectedCapsuleIds, setSelectedCapsuleIds] = useState<string[]>([]);

    const handleSelectAll = () => {
        if (selectedCapsuleIds.length === capsules.length) setSelectedCapsuleIds([]);
        else setSelectedCapsuleIds(capsules.map(c => c.id));
    };

    const handleToggleCapsule = (id: string) => {
        setSelectedCapsuleIds(prev => 
            prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
        );
    };

    const handleGenerate = () => {
        if (!examDate || selectedCapsuleIds.length === 0) return;
        
        const selectedCapsules = capsules.filter(c => selectedCapsuleIds.includes(c.id));
        const examTimestamp = new Date(examDate).getTime();
        
        try {
            const plan = generateStudyPlan(
                planName, 
                selectedCapsules, 
                examTimestamp, 
                dailyMinutes
            );
            onPlanCreated(plan);
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erreur de génération");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <header className="p-6 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <CalendarIcon className="w-6 h-6 text-indigo-500" />
                        {t('planning_generator')}
                    </h2>
                    <button onClick={onClose}><XIcon className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                </header>

                <div className="p-6 flex-grow">
                    {step === 1 && (
                        <div className="space-y-4 animate-fade-in-fast">
                            <h3 className="text-lg font-semibold text-slate-700 dark:text-zinc-200">{t('step_1')}</h3>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1">{t('plan_name')}</label>
                                <input 
                                    type="text" 
                                    value={planName}
                                    onChange={e => setPlanName(e.target.value)}
                                    className="w-full p-2 border border-slate-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1">{t('exam_date')}</label>
                                <input 
                                    type="date" 
                                    value={examDate}
                                    min={new Date().toISOString().split('T')[0]}
                                    onChange={e => setExamDate(e.target.value)}
                                    className="w-full p-2 border border-slate-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1">{t('daily_time')} : <span className="font-bold text-indigo-600">{Math.floor(dailyMinutes/60)}h {dailyMinutes%60}min</span></label>
                                <input 
                                    type="range" 
                                    min="15" 
                                    max="480" 
                                    step="15"
                                    value={dailyMinutes}
                                    onChange={e => setDailyMinutes(Number(e.target.value))}
                                    className="w-full accent-indigo-600"
                                />
                                <div className="flex justify-between text-xs text-slate-400">
                                    <span>15 min</span>
                                    <span>8 heures</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4 h-64 flex flex-col animate-fade-in-fast">
                             <h3 className="text-lg font-semibold text-slate-700 dark:text-zinc-200">{t('step_2')}</h3>
                             <button onClick={handleSelectAll} className="text-sm text-indigo-500 font-semibold hover:underline self-start">
                                 {selectedCapsuleIds.length === capsules.length ? t('deselect_all') : t('select_all')}
                             </button>
                             <div className="flex-grow overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-lg p-2 space-y-1">
                                {capsules.map(cap => (
                                    <div key={cap.id} className="flex items-center p-2 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-md">
                                        <input 
                                            type="checkbox" 
                                            id={`plan-cap-${cap.id}`}
                                            checked={selectedCapsuleIds.includes(cap.id)}
                                            onChange={() => handleToggleCapsule(cap.id)}
                                            className="w-4 h-4 text-indigo-600 rounded"
                                        />
                                        <label htmlFor={`plan-cap-${cap.id}`} className="ml-3 text-sm text-slate-700 dark:text-zinc-300 cursor-pointer flex-grow truncate">
                                            {cap.title}
                                        </label>
                                    </div>
                                ))}
                             </div>
                             <p className="text-xs text-slate-500 text-right">{selectedCapsuleIds.length} {t('capsules_selected')}</p>
                        </div>
                    )}
                </div>

                <footer className="p-6 border-t border-slate-200 dark:border-zinc-800 flex justify-between">
                    {step > 1 ? (
                        <button onClick={() => setStep(s => s - 1 as any)} className="px-4 py-2 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg">
                            {t('back')}
                        </button>
                    ) : <div></div>}
                    
                    {step < 2 ? (
                        <button 
                            onClick={() => setStep(s => s + 1 as any)} 
                            disabled={!examDate}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-semibold"
                        >
                            {t('next')}
                        </button>
                    ) : (
                        <button 
                            onClick={handleGenerate}
                            disabled={selectedCapsuleIds.length === 0}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-semibold flex items-center gap-2"
                        >
                            <CheckCircleIcon className="w-5 h-5" /> {t('generate_plan')}
                        </button>
                    )}
                </footer>
            </div>
        </div>
    );
};

export default PlanningWizard;
