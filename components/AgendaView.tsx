
import React from 'react';
import type { StudyPlan, DailySession, StudyTask } from '../types';
import { ClockIcon, CheckCircleIcon, BookOpenIcon, Trash2Icon } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

interface AgendaViewProps {
    plan: StudyPlan;
    onUpdateTask: (date: string, capsuleId: string, status: 'completed' | 'pending') => void;
    onDeletePlan: () => void;
    onOpenCapsule: (capsuleId: string) => void;
}

const AgendaView: React.FC<AgendaViewProps> = ({ plan, onUpdateTask, onDeletePlan, onOpenCapsule }) => {
    const { language, t } = useLanguage();
    const today = new Date().toISOString().split('T')[0];
    const dateLocale = language === 'fr' ? 'fr-FR' : 'en-US';

    const getStatusColor = (session: DailySession) => {
        if (session.tasks.every(t => t.status === 'completed')) return 'border-l-emerald-500';
        if (session.date === today) return 'border-l-indigo-500';
        if (session.date < today) return 'border-l-red-400'; // Retard
        return 'border-l-slate-300 dark:border-l-zinc-600';
    };

    return (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-zinc-800 h-full flex flex-col">
            <header className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h2>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 flex items-center gap-2 mt-1">
                        {t('objective')} : {new Date(plan.examDate).toLocaleDateString(dateLocale)} • {Math.floor(plan.dailyMinutesAvailable/60)}h{plan.dailyMinutesAvailable%60 > 0 ? `${plan.dailyMinutesAvailable%60}` : ''}/jour
                    </p>
                </div>
                <button 
                    onClick={onDeletePlan}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                    title="Supprimer le planning"
                >
                    <Trash2Icon className="w-5 h-5" />
                </button>
            </header>

            <div className="flex-grow overflow-y-auto space-y-4 pr-2">
                {plan.schedule.map((session) => {
                    const isToday = session.date === today;
                    const isPast = session.date < today;
                    const isCompleted = session.tasks.every(t => t.status === 'completed');
                    
                    return (
                        <div key={session.date} className={`pl-4 border-l-4 ${getStatusColor(session)} py-1`}>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className={`font-bold ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-zinc-300'}`}>
                                    {isToday ? t('today') : new Date(session.date).toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'short' })}
                                </h3>
                                <span className="text-xs font-medium px-2 py-1 bg-slate-100 dark:bg-zinc-800 rounded-full text-slate-500">
                                    {session.totalMinutes} min
                                </span>
                            </div>
                            
                            {session.isRestDay ? (
                                <p className="text-sm text-slate-400 italic">{t('rest_day')}</p>
                            ) : (
                                <ul className="space-y-2">
                                    {session.tasks.map(task => (
                                        <li key={`${session.date}-${task.capsuleId}`} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-zinc-800/50 rounded-lg group hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <button 
                                                    onClick={() => onUpdateTask(session.date, task.capsuleId, task.status === 'completed' ? 'pending' : 'completed')}
                                                    className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${task.status === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-zinc-600 hover:border-indigo-500'}`}
                                                >
                                                    {task.status === 'completed' && <CheckCircleIcon className="w-3 h-3" />}
                                                </button>
                                                <div className="min-w-0 cursor-pointer" onClick={() => onOpenCapsule(task.capsuleId)}>
                                                    <p className={`text-sm font-medium truncate ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-zinc-200'}`}>
                                                        {task.title}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-xs text-slate-400">{task.estimatedMinutes} min</span>
                                                <button onClick={() => onOpenCapsule(task.capsuleId)} className="p-1 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded">
                                                    <BookOpenIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AgendaView;
