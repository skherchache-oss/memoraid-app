
import React, { useMemo, useState } from 'react';
import type { CognitiveCapsule } from '../types';
import { PlusIcon, BookOpenIcon, BellIcon, MemoraidLogoIcon, PlayIcon, SearchIcon, XIcon, ChevronRightIcon, CheckCircleIcon, LayersIcon, InfoIcon, ShoppingBagIcon, LearningIllustration } from '../constants';
import { isCapsuleDue } from '../services/srsService';
import ConfirmationModal from './ConfirmationModal';
import CapsuleListItem from './CapsuleListItem';
import { useLanguage } from '../contexts/LanguageContext';

interface KnowledgeBaseProps {
    capsules: CognitiveCapsule[];
    activeCapsuleId?: string;
    onSelectCapsule: (capsule: CognitiveCapsule) => void;
    onNewCapsule: () => void;
    notificationPermission: NotificationPermission;
    onRequestNotificationPermission: () => void;
    onDeleteCapsule: (capsuleId: string) => void;
    newlyAddedCapsuleId: string | null;
    onClearNewCapsule: () => void;
    selectedCapsuleIds: string[];
    setSelectedCapsuleIds: React.Dispatch<React.SetStateAction<string[]>>;
    onOpenStore: () => void;
}

const NotificationManager: React.FC<{ permission: NotificationPermission, onRequest: () => void, onShowInstructions: () => void }> = ({ permission, onRequest, onShowInstructions }) => {
    if (permission === 'default') {
        return (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 my-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-full">
                        <BellIcon className="w-5 h-5 text-blue-600 dark:text-blue-200 flex-shrink-0"/>
                    </div>
                    <div className="flex-grow">
                        <p className="font-bold text-sm text-blue-800 dark:text-blue-200">Ne manquez pas vos révisions</p>
                        <p className="text-xs text-blue-600 dark:text-blue-300">Activez les rappels intelligents.</p>
                    </div>
                    <button onClick={onRequest} className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm">
                        Activer
                    </button>
                </div>
            </div>
        );
    }
    if (permission === 'denied') {
         return (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 my-4">
                 <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-full mt-0.5">
                        <BellIcon className="w-5 h-5 text-amber-600 dark:text-amber-200 flex-shrink-0"/>
                    </div>
                    <div>
                       <p className="font-bold text-sm text-amber-800 dark:text-amber-200">Notifications bloquées</p>
                       <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                           Le navigateur empêche l'envoi de rappels.
                           <button onClick={onShowInstructions} className="block mt-1 underline hover:no-underline font-semibold">Voir comment débloquer</button>
                       </p>
                    </div>
                </div>
            </div>
         );
    }
    return null;
};


const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ capsules, activeCapsuleId, onSelectCapsule, onNewCapsule, notificationPermission, onRequestNotificationPermission, onDeleteCapsule, newlyAddedCapsuleId, onClearNewCapsule, selectedCapsuleIds, setSelectedCapsuleIds, onOpenStore }) => {
    const { t } = useLanguage();
    const [capsuleToDelete, setCapsuleToDelete] = useState<CognitiveCapsule | null>(null);
    const [isReviewConfirmOpen, setIsReviewConfirmOpen] = useState(false);
    const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
    const [expandedCapsuleId, setExpandedCapsuleId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredCapsules = useMemo(() => {
        if (!searchTerm.trim()) {
            return capsules;
        }
        const lowercasedFilter = searchTerm.toLowerCase();
        return capsules.filter(capsule => {
            const inTitle = capsule.title.toLowerCase().includes(lowercasedFilter);
            const inSummary = capsule.summary.toLowerCase().includes(lowercasedFilter);
            const inCategory = capsule.category?.toLowerCase().includes(lowercasedFilter) || false;
            const inKeyConcepts = capsule.keyConcepts.some(
                kc => kc.concept.toLowerCase().includes(lowercasedFilter) || kc.explanation.toLowerCase().includes(lowercasedFilter)
            );
            return inTitle || inSummary || inCategory || inKeyConcepts;
        });
    }, [capsules, searchTerm]);

    const dueCapsules = useMemo(() => 
        filteredCapsules
            .filter(isCapsuleDue)
            .sort((a,b) => (a.lastReviewed || a.createdAt) - (b.lastReviewed || b.createdAt)), 
        [filteredCapsules]
    );

    const groupedCapsules = useMemo(() => {
        const otherCapsules = filteredCapsules.filter(c => !isCapsuleDue(c));
        const groups: { [key: string]: CognitiveCapsule[] } = {};
        const uncategorized: CognitiveCapsule[] = [];

        otherCapsules.forEach(c => {
            if (c.category) {
                if (!groups[c.category]) groups[c.category] = [];
                groups[c.category].push(c);
            } else {
                uncategorized.push(c);
            }
        });
        
        const sortedCategories = Object.keys(groups).sort((a, b) => a.localeCompare(b));
        return { sortedCategories, groups, uncategorized };
    }, [filteredCapsules]);

    const handleRequestDelete = (capsule: CognitiveCapsule) => {
        setCapsuleToDelete(capsule);
    };

    const handleConfirmDelete = () => {
        if (capsuleToDelete) {
            onDeleteCapsule(capsuleToDelete.id);
            setCapsuleToDelete(null);
        }
    };
    
    const handleCancelDelete = () => {
        setCapsuleToDelete(null);
    };
    
    const handleToggleSelection = (capsuleId: string) => {
        setSelectedCapsuleIds(prev =>
            prev.includes(capsuleId)
                ? prev.filter(id => id !== capsuleId)
                : [...prev, capsuleId]
        );
    };
    
    const handleToggleSelectAll = () => {
        if (selectedCapsuleIds.length === filteredCapsules.length) {
            setSelectedCapsuleIds([]);
        } else {
            setSelectedCapsuleIds(filteredCapsules.map(c => c.id));
        }
    };

    const handleStartReview = () => {
        if (dueCapsules.length > 0) {
            onSelectCapsule(dueCapsules[0]);
        }
        setIsReviewConfirmOpen(false);
    };
    
    const handleCancelReview = () => {
        setIsReviewConfirmOpen(false);
    };

    const handleToggleExpand = (capsule: CognitiveCapsule) => {
        const newExpandedId = expandedCapsuleId === capsule.id ? null : capsule.id;
        setExpandedCapsuleId(newExpandedId);
        
        if (newExpandedId) {
            onSelectCapsule(capsule);
        }
    };

    return (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-lg h-full min-h-[80vh] flex flex-col border border-slate-100 dark:border-zinc-800">
            <h2 className="flex items-center text-2xl font-bold mb-2 text-slate-900 dark:text-white">
                <BookOpenIcon className="w-8 h-8 mr-3 text-emerald-500" />
                {t('my_knowledge_base')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
                {t('autosave_info')}
            </p>

            <div className="relative mb-6">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
                <input
                    type="text"
                    placeholder={t('search_placeholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-8 py-3 bg-slate-50 dark:bg-zinc-800 border border-transparent rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 dark:text-white placeholder:text-zinc-500 text-base"
                />
                {searchTerm && (
                    <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        aria-label="Effacer la recherche"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                    onClick={onNewCapsule}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-bold text-sm shadow-sm"
                >
                    <PlusIcon className="w-5 h-5"/>
                    {t('create_new')}
                </button>
                <button
                    onClick={onOpenStore}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-bold text-sm shadow-sm"
                >
                    <ShoppingBagIcon className="w-5 h-5" />
                    {t('store')}
                </button>
            </div>
            
            <NotificationManager permission={notificationPermission} onRequest={onRequestNotificationPermission} onShowInstructions={() => setIsInstructionsModalOpen(true)} />

            {dueCapsules.length > 0 && (
                <button
                    onClick={() => setIsReviewConfirmOpen(true)}
                    className="w-full flex items-center justify-center gap-2 mb-6 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-bold shadow-md"
                >
                    <PlayIcon className="w-5 h-5" />
                    {t('start_review')} ({dueCapsules.length})
                </button>
            )}

            {filteredCapsules.length > 0 && (
                <div className="mb-4 flex items-center justify-between">
                    <button onClick={handleToggleSelectAll} className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
                        {selectedCapsuleIds.length === filteredCapsules.length ? <XIcon className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
                        {selectedCapsuleIds.length === filteredCapsules.length ? t('deselect_all') : t('select_all')}
                    </button>
                    {selectedCapsuleIds.length > 0 && (
                        <span className="text-sm font-semibold text-slate-500 dark:text-zinc-400">{selectedCapsuleIds.length} {t('selected')}</span>
                    )}
                </div>
            )}


            <div className="space-y-3 flex-grow overflow-y-auto pr-2 -mr-2">
                {capsules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-10 px-4">
                        <LearningIllustration className="w-full max-w-[180px] h-auto mb-4" />
                        <h3 className="mt-2 text-lg font-bold text-slate-700 dark:text-zinc-300">{t('empty_base')}</h3>
                        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
                            {t('empty_base_desc')}
                        </p>
                    </div>
                ) : filteredCapsules.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full text-center py-10 px-4">
                        <SearchIcon className="h-16 w-16 text-slate-400 dark:text-zinc-600" />
                        <h3 className="mt-4 text-md font-semibold text-slate-700 dark:text-zinc-300">{t('no_results')}</h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                           {t('no_results_desc')}
                        </p>
                    </div>
                ) : (
                    <>
                        <details open className="group">
                            <summary className="list-none flex items-center justify-between cursor-pointer px-2 py-2 rounded hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <span className="text-sm font-bold text-amber-600 dark:text-amber-400 tracking-wide flex items-center uppercase">
                                    {t('to_review')}
                                    <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-amber-100 bg-amber-600 rounded-full shadow-sm">{dueCapsules.length}</span>
                                </span>
                                <ChevronRightIcon className="w-5 h-5 text-zinc-500 transform group-open:rotate-90 transition-transform"/>
                            </summary>
                            <div className="space-y-3 mt-2 pl-1">
                                {dueCapsules.length > 0 ? (
                                    dueCapsules.map(capsule => 
                                        <CapsuleListItem 
                                            key={capsule.id} 
                                            capsule={capsule} 
                                            isActive={activeCapsuleId === capsule.id}
                                            isExpanded={expandedCapsuleId === capsule.id}
                                            isSelected={selectedCapsuleIds.includes(capsule.id)}
                                            isDue={true} 
                                            onToggleExpand={() => handleToggleExpand(capsule)}
                                            onToggleSelection={() => handleToggleSelection(capsule.id)}
                                            onRequestDelete={handleRequestDelete}
                                            newlyAddedCapsuleId={newlyAddedCapsuleId}
                                            onClearNewCapsule={onClearNewCapsule}
                                        />
                                    )
                                ) : (
                                    <p className="px-4 py-3 text-sm text-slate-500 dark:text-zinc-400 italic bg-slate-50 dark:bg-zinc-800/30 rounded-lg">Aucune capsule à réviser.</p>
                                )}
                            </div>
                        </details>

                        {groupedCapsules.sortedCategories.map(category => (
                            <details key={category} open className="group mt-4">
                                <summary className="list-none flex items-center justify-between cursor-pointer px-2 py-2 rounded hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <span className="text-sm font-bold text-slate-600 dark:text-zinc-300 tracking-wide uppercase">{category}</span>
                                    <ChevronRightIcon className="w-5 h-5 text-zinc-500 transform group-open:rotate-90 transition-transform"/>
                                </summary>
                                <div className="space-y-3 mt-2 pl-1">
                                    {groupedCapsules.groups[category].map(capsule => 
                                        <CapsuleListItem 
                                            key={capsule.id} 
                                            capsule={capsule} 
                                            isActive={activeCapsuleId === capsule.id}
                                            isExpanded={expandedCapsuleId === capsule.id}
                                            isSelected={selectedCapsuleIds.includes(capsule.id)}
                                            isDue={false} 
                                            onToggleExpand={() => handleToggleExpand(capsule)}
                                            onToggleSelection={() => handleToggleSelection(capsule.id)}
                                            onRequestDelete={handleRequestDelete}
                                            newlyAddedCapsuleId={newlyAddedCapsuleId}
                                            onClearNewCapsule={onClearNewCapsule}
                                        />
                                    )}
                                </div>
                            </details>
                        ))}
                        
                        {groupedCapsules.uncategorized.length > 0 && (
                             <details open className="group mt-4">
                                <summary className="list-none flex items-center justify-between cursor-pointer px-2 py-2 rounded hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <span className="text-sm font-bold text-slate-600 dark:text-zinc-300 tracking-wide uppercase">{t('uncategorized')}</span>
                                    <ChevronRightIcon className="w-5 h-5 text-zinc-500 transform group-open:rotate-90 transition-transform"/>
                                </summary>
                                 <div className="space-y-3 mt-2 pl-1">
                                    {groupedCapsules.uncategorized.map(capsule => 
                                        <CapsuleListItem 
                                            key={capsule.id} 
                                            capsule={capsule} 
                                            isActive={activeCapsuleId === capsule.id}
                                            isExpanded={expandedCapsuleId === capsule.id}
                                            isSelected={selectedCapsuleIds.includes(capsule.id)}
                                            isDue={false} 
                                            onToggleExpand={() => handleToggleExpand(capsule)}
                                            onToggleSelection={() => handleToggleSelection(capsule.id)}
                                            onRequestDelete={handleRequestDelete}
                                            newlyAddedCapsuleId={newlyAddedCapsuleId}
                                            onClearNewCapsule={onClearNewCapsule}
                                        />
                                    )}
                                </div>
                            </details>
                        )}
                    </>
                )}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-zinc-800">
                <details className="group">
                    <summary className="list-none flex items-center justify-between cursor-pointer text-sm font-bold text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white transition-colors">
                        <span>{t('how_it_works')}</span>
                        <ChevronRightIcon className="w-4 h-4 text-zinc-500 transform group-open:rotate-90 transition-transform"/>
                    </summary>
                    <div className="mt-3 text-xs text-slate-500 dark:text-zinc-400 space-y-2 leading-relaxed">
                        <p>{t('how_it_works_desc1')}</p>
                        <p>{t('how_it_works_desc2')}</p>
                    </div>
                </details>
            </div>

            <ConfirmationModal
                isOpen={!!capsuleToDelete}
                onClose={handleCancelDelete}
                onConfirm={handleConfirmDelete}
                title="Supprimer la capsule"
                message={`Êtes-vous sûr de vouloir supprimer la capsule "${capsuleToDelete?.title}" ? Cette action est irréversible.`}
                confirmText="Supprimer"
                cancelText="Annuler"
            />
            <ConfirmationModal
                isOpen={isReviewConfirmOpen && dueCapsules.length > 0}
                onClose={handleCancelReview}
                onConfirm={handleStartReview}
                title="Démarrer la session de révision ?"
                message={`Vous avez ${dueCapsules.length} capsule(s) à réviser. Voulez-vous commencer avec "${dueCapsules[0]?.title}" ?`}
                confirmText="Commencer"
                cancelText="Plus tard"
                variant="info"
                icon={<PlayIcon />}
            />
             {isInstructionsModalOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setIsInstructionsModalOpen(false)}
                >
                    <div 
                        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md m-4 flex flex-col overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                         <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <InfoIcon className="w-6 h-6 text-blue-500"/>
                                Réactiver les notifications
                            </h3>
                            <button onClick={() => setIsInstructionsModalOpen(false)} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800" aria-label="Fermer">
                                <XIcon className="w-5 h-5 text-slate-500" />
                            </button>
                        </header>
                        <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
                            <p className="text-sm text-slate-700 dark:text-zinc-300">Pour réactiver les notifications :</p>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700 dark:text-zinc-300">
                                <li>Cliquez sur l'icône de cadenas dans la barre d'adresse.</li>
                                <li>Cliquez sur "Réinitialiser les autorisations".</li>
                                <li>Actualisez la page.</li>
                            </ol>
                        </div>
                         <div className="bg-slate-50 dark:bg-zinc-900/50 px-6 py-4 text-right border-t border-slate-200 dark:border-zinc-800">
                            <button
                                type="button"
                                className="inline-flex justify-center rounded-lg border border-transparent shadow-sm px-5 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
                                onClick={() => setIsInstructionsModalOpen(false)}
                            >
                                J'ai compris
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KnowledgeBase;
