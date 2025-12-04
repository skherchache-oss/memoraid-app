
import React from 'react';
import type { ReviewStageInfo } from '../services/srsService';
import { ClockIcon } from '../constants';

interface SpacedRepetitionCurveProps {
    schedule: ReviewStageInfo[];
}

const SpacedRepetitionCurve: React.FC<SpacedRepetitionCurveProps> = ({ schedule }) => {
    
    const formatDate = (timestamp: number) => {
        if (timestamp === 0) return "Passé";
        return new Date(timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    };

    return (
        <div className="px-3 pt-2 pb-3 bg-slate-100 dark:bg-zinc-800/50 rounded-b-lg">
            <h4 className="text-xs font-bold text-slate-600 dark:text-zinc-300 mb-3 uppercase tracking-wider">Progression de Mémorisation</h4>
            <div className="flex items-center justify-between space-x-1">
                {schedule.map((item, index) => {
                    const isLast = index === schedule.length - 1;
                    const isCompleted = item.status === 'completed';
                    const isDue = item.status === 'due';
                    
                    let nodeClasses = 'w-4 h-4 rounded-full flex-shrink-0 border-2 ';
                    let lineClasses = 'flex-grow h-0.5 ';
                    let textClasses = 'text-xs mt-1 text-center ';

                    if (isCompleted) {
                        nodeClasses += 'bg-blue-500 border-blue-500';
                        lineClasses += 'bg-blue-500';
                        textClasses += 'text-slate-500 dark:text-zinc-400';
                    } else if (isDue) {
                        nodeClasses += 'bg-amber-500 border-amber-500 animate-pulse';
                        lineClasses += 'bg-gradient-to-r from-blue-500 to-amber-500/50';
                        textClasses += 'font-bold text-amber-600 dark:text-amber-400';
                    } else { // upcoming
                        nodeClasses += 'bg-white dark:bg-zinc-700 border-slate-300 dark:border-zinc-500';
                        lineClasses += 'bg-slate-300 dark:bg-zinc-600';
                        textClasses += 'text-slate-500 dark:text-zinc-400';
                    }

                    return (
                        <React.Fragment key={item.stage}>
                            <div className="flex flex-col items-center group relative w-12">
                                <div className={nodeClasses}></div>
                                <span className={textClasses}>{item.intervalDays}j</span>
                                <div className="absolute bottom-full mb-2 w-max px-2 py-1 bg-zinc-800 dark:bg-zinc-950 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    {isCompleted ? `Étape ${item.stage} complétée` : `Révision le ${formatDate(item.reviewDate)}`}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-zinc-800 dark:border-t-zinc-950"></div>
                                </div>
                            </div>
                            {!isLast && <div className={lineClasses}></div>}
                        </React.Fragment>
                    );
                })}
            </div>
             {schedule.find(s => s.status === 'due') &&
                <div className="flex items-center gap-2 mt-3 p-2 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs">
                   <ClockIcon className="w-4 h-4 flex-shrink-0"/>
                   <span className="font-semibold">Une révision est nécessaire pour cette capsule.</span>
                </div>
            }
        </div>
    );
};

export default SpacedRepetitionCurve;
