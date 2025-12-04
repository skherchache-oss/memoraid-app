import React, { useMemo } from 'react';
import type { CognitiveCapsule } from '../types';
import { isCapsuleDue } from '../services/srsService';

interface ProgressChartProps {
    capsules: CognitiveCapsule[];
}

const ProgressChart: React.FC<ProgressChartProps> = ({ capsules }) => {
    const stats = useMemo(() => {
        let due = 0;
        let inProgress = 0;
        let isNew = 0;

        capsules.forEach(capsule => {
            if (isCapsuleDue(capsule)) {
                due++;
            } else if (capsule.lastReviewed !== null) {
                inProgress++;
            } else {
                isNew++;
            }
        });

        const total = capsules.length;
        return {
            due: { count: due, percent: total > 0 ? (due / total) * 100 : 0 },
            inProgress: { count: inProgress, percent: total > 0 ? (inProgress / total) * 100 : 0 },
            isNew: { count: isNew, percent: total > 0 ? (isNew / total) * 100 : 0 },
            total,
        };
    }, [capsules]);

    if (stats.total === 0) {
        return (
             <div className="p-4 rounded-lg bg-slate-50 dark:bg-zinc-800/50 text-center">
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                    Aucune capsule pour afficher la progression. Créez-en une pour commencer !
                </p>
            </div>
        );
    }

    const segments = [
        { ...stats.due, color: 'text-amber-500', label: 'À réviser' },
        { ...stats.inProgress, color: 'text-blue-500', label: 'En cours' },
        { ...stats.isNew, color: 'text-slate-400 dark:text-zinc-500', label: 'Nouveau' },
    ];

    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    let strokeDashoffset = 0;

    return (
        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-lg bg-slate-50 dark:bg-zinc-800/50">
            <div className="relative w-32 h-32 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="-rotate-90">
                    {segments.map((segment, index) => {
                        if (segment.percent === 0) return null;
                        const strokeDasharray = `${(segment.percent / 100) * circumference} ${circumference}`;
                        const offset = strokeDashoffset;
                        strokeDashoffset += (segment.percent / 100) * circumference;

                        return (
                            <circle
                                key={index}
                                r={radius}
                                cx="50"
                                cy="50"
                                fill="transparent"
                                strokeWidth="10"
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={-offset}
                                className={segment.color}
                            />
                        );
                    })}
                </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-slate-800 dark:text-white">{stats.total}</span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">Capsule{stats.total > 1 ? 's' : ''}</span>
                </div>
            </div>
            <div className="flex-grow w-full">
                <ul className="space-y-2">
                    {segments.map((segment, index) => (
                        <li key={index} className="flex items-center justify-between text-sm">
                            <div className="flex items-center">
                                <span className={`w-3 h-3 rounded-full mr-2 ${segment.color.replace('text-', 'bg-')}`}></span>
                                <span className="font-medium text-slate-700 dark:text-zinc-300">{segment.label}</span>
                            </div>
                            <span className="font-semibold text-slate-800 dark:text-white">{segment.count}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default ProgressChart;