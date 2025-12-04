
import React, { useRef, useEffect, useMemo } from 'react';
import type { CognitiveCapsule } from '../types';
import { ClockIcon, Trash2Icon, ChevronDownIcon, BrainIcon } from '../constants';
import { getReviewSchedule, calculateRetentionProbability } from '../services/srsService';
import SpacedRepetitionCurve from './SpacedRepetitionCurve';

interface CapsuleListItemProps {
    capsule: CognitiveCapsule;
    isActive: boolean;
    isExpanded: boolean;
    isSelected: boolean;
    isDue: boolean;
    onToggleExpand: () => void;
    onToggleSelection: () => void;
    onRequestDelete: (capsule: CognitiveCapsule) => void;
    newlyAddedCapsuleId: string | null;
    onClearNewCapsule: () => void;
}

const CapsuleListItem: React.FC<CapsuleListItemProps> = ({ capsule, isActive, isExpanded, isSelected, isDue, onToggleExpand, onToggleSelection, onRequestDelete, newlyAddedCapsuleId, onClearNewCapsule }) => {
    const itemRef = useRef<HTMLDivElement>(null);
    const isNew = newlyAddedCapsuleId === capsule.id;

    useEffect(() => {
        const node = itemRef.current;
        if (isNew && node) {
            const handleAnimationEnd = () => {
                onClearNewCapsule();
            };
            node.addEventListener('animationend', handleAnimationEnd);
            return () => {
                node.removeEventListener('animationend', handleAnimationEnd);
            };
        }
    }, [isNew, onClearNewCapsule, capsule.id]);
    
    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent the expand toggle
        onRequestDelete(capsule);
    };

    const reviewSchedule = useMemo(() => getReviewSchedule(capsule), [capsule]);
    const retention = useMemo(() => calculateRetentionProbability(capsule), [capsule]);

    // Calcul du texte de délai
    const nextReviewText = useMemo(() => {
        if (isDue) return "À réviser !";
        const nextStage = reviewSchedule.find(s => s.status === 'upcoming');
        if (!nextStage) return "Maîtrisé";
        
        const diffMs = nextStage.reviewDate - Date.now();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 0) return "Demain";
        return `Dans ${diffDays}j`;
    }, [isDue, reviewSchedule]);

    // Dynamic font size for the title, without truncation
    const titleClassName = `font-semibold pr-2 ${isActive ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-800 dark:text-zinc-200'} ${capsule.title.length > 45 ? 'text-sm' : ''}`;

    // Couleur de la barre de rétention
    const retentionColor = retention > 80 ? 'bg-emerald-500' : retention > 50 ? 'bg-blue-500' : retention > 25 ? 'bg-amber-500' : 'bg-red-500';

    return (
        <div ref={itemRef} className={`relative rounded-xl md:rounded-lg overflow-hidden transition-all duration-300 ${isExpanded ? 'shadow-lg md:shadow-md ring-2 ring-emerald-100 dark:ring-emerald-900' : 'shadow-sm border border-slate-100 dark:border-zinc-800'} ${isNew ? 'animate-add-capsule' : ''} active:scale-[0.98] md:active:scale-100 transform`}>
            <div
                onClick={onToggleExpand}
                className={`w-full text-left transition-all duration-200 relative z-10 cursor-pointer p-1
                    ${isActive
                        ? 'bg-emerald-50 dark:bg-emerald-900/30'
                        : isDue 
                            ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100/70 dark:hover:bg-amber-900/40' 
                            : 'bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800'
                    }`}
            >
                <div className="flex items-center p-3">
                     <div className="checkbox-container mr-3 p-2 -ml-2" onClick={(e) => { e.stopPropagation(); onToggleSelection(); }}>
                        <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="w-5 h-5 rounded border-slate-300 dark:border-zinc-600 text-emerald-600 focus:ring-emerald-500 bg-white dark:bg-zinc-700 dark:checked:bg-emerald-500 cursor-pointer pointer-events-none"
                        />
                    </div>
                    <div className="flex-grow min-w-0">
                         <div className="flex justify-between items-start">
                             <p className={titleClassName}>{capsule.title}</p>
                             {/* Badge Prochaine Révision */}
                             <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 ${
                                 isDue 
                                 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 animate-pulse' 
                                 : 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'
                             }`}>
                                 {nextReviewText}
                             </span>
                         </div>
                         
                         {/* Barre de Rétention (Courbe de l'oubli simplifiée) */}
                         <div className="flex items-center gap-2 mt-2">
                             <div className="flex-grow h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                 <div 
                                     className={`h-full rounded-full ${retentionColor} transition-all duration-500`} 
                                     style={{ width: `${retention}%` }}
                                 ></div>
                             </div>
                             <span className="text-[10px] font-medium text-slate-400 w-8 text-right">{retention}%</span>
                         </div>
                    </div>
                    
                    <div className="flex items-center flex-shrink-0 ml-3 gap-1">
                        {isDue && <ClockIcon className="w-5 h-5 text-amber-500 flex-shrink-0 hidden md:block" />}
                        <button
                            onClick={handleDeleteClick}
                            className="p-2 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:text-zinc-500 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                            aria-label="Supprimer la capsule"
                        >
                            <Trash2Icon className="w-5 h-5" />
                        </button>
                        <div 
                           className={`p-1 transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                           aria-hidden="true"
                        >
                           <ChevronDownIcon className="w-5 h-5 text-slate-400 dark:text-zinc-500" />
                        </div>
                    </div>
                </div>
            </div>
            {isExpanded && (
                <div className="z-0 animate-fade-in-fast bg-slate-50 dark:bg-zinc-800/30 border-t border-slate-100 dark:border-zinc-800 p-3">
                    <SpacedRepetitionCurve schedule={reviewSchedule} />
                    <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400 flex justify-between items-center">
                        <span>Créée le {new Date(capsule.createdAt).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1">
                            <BrainIcon className="w-3 h-3"/>
                            Stade {capsule.reviewStage}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CapsuleListItem;
