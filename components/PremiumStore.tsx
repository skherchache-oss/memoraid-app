
import React, { useState } from 'react';
import type { PremiumPack, PremiumCategory, CognitiveCapsule } from '../types';
import { ShoppingBagIcon, StarIcon, GraduationCapIcon, LockIcon, UnlockIcon, CheckCircleIcon, GlobeIcon } from '../constants';

interface PremiumStoreProps {
    onUnlockPack: (pack: PremiumPack) => void;
    unlockedPackIds: string[];
    isPremiumUser: boolean;
}

// --- MOCK DATA (In a real app, this would come from an API) ---

const MOCK_CAPSULES_BAC_PHILO: CognitiveCapsule[] = [
    {
        id: 'prem_bac_philo_1',
        title: 'La Conscience et l\'Inconscient',
        summary: 'Analyse approfondie des concepts de conscience, d\'inconscient freudien et de la subjectivité.',
        keyConcepts: [
            { concept: 'Cogito', explanation: 'Le "Je pense donc je suis" de Descartes, fondement de la certitude.' },
            { concept: 'Inconscient', explanation: 'Partie du psychisme qui échappe à la conscience (Freud).' },
            { concept: 'Intentionnalité', explanation: 'La conscience est toujours conscience de quelque chose (Husserl).' }
        ],
        examples: ['Le rêve comme voie royale vers l\'inconscient', 'L\'acte manqué'],
        quiz: [],
        createdAt: Date.now(),
        lastReviewed: null,
        reviewStage: 0,
        category: 'Philosophie'
    },
    {
        id: 'prem_bac_philo_2',
        title: 'L\'Art et la Technique',
        summary: 'Distinction entre l\'artiste et l\'artisan, le beau et l\'utile, et l\'impact de la technique sur l\'homme.',
        keyConcepts: [
            { concept: 'Esthétique', explanation: 'Théorie du beau et de l\'art.' },
            { concept: 'Techne', explanation: 'Mot grec désignant à la fois l\'art et la technique.' }
        ],
        examples: ['L\'urinoir de Duchamp', 'Le travail à la chaîne'],
        quiz: [],
        createdAt: Date.now(),
        lastReviewed: null,
        reviewStage: 0,
        category: 'Philosophie'
    }
];

const MOCK_PACKS: PremiumPack[] = [
    {
        id: 'pack_bac_philo',
        title: 'Pack Révision Bac Philo',
        description: 'Les notions essentielles pour réussir l\'épreuve de philosophie. Conscience, Art, État, Liberté.',
        category: 'bac',
        price: 4.99,
        capsuleCount: 12,
        coverColor: 'bg-pink-500',
        capsules: MOCK_CAPSULES_BAC_PHILO
    },
    {
        id: 'pack_prepa_hec',
        title: 'Géopolitique Prépa HEC',
        description: 'Analyse des dynamiques mondiales actuelles. Conçu par des professeurs de chaire supérieure.',
        category: 'concours',
        price: 9.99,
        capsuleCount: 20,
        coverColor: 'bg-blue-600',
        capsules: [] // Placeholder
    },
    {
        id: 'pack_python_expert',
        title: 'Python pour la Data Science',
        description: 'De zéro à héros en Python. Pandas, NumPy, Matplotlib expliqués simplement.',
        category: 'expert',
        price: 14.99,
        capsuleCount: 15,
        coverColor: 'bg-emerald-500',
        capsules: [] // Placeholder
    },
    {
        id: 'pack_english_b2',
        title: 'Anglais Business B2/C1',
        description: 'Vocabulaire professionnel, idiomes et structures pour briller en entretien.',
        category: 'langues',
        price: 6.99,
        capsuleCount: 10,
        coverColor: 'bg-purple-500',
        capsules: [] // Placeholder
    }
];

const PremiumStore: React.FC<PremiumStoreProps> = ({ onUnlockPack, unlockedPackIds, isPremiumUser }) => {
    const [filter, setFilter] = useState<PremiumCategory | 'all'>('all');
    const [loadingPackId, setLoadingPackId] = useState<string | null>(null);

    const filteredPacks = filter === 'all' 
        ? MOCK_PACKS 
        : MOCK_PACKS.filter(p => p.category === filter);

    const handleBuy = (pack: PremiumPack) => {
        setLoadingPackId(pack.id);
        // Simulate API delay
        setTimeout(() => {
            onUnlockPack(pack);
            setLoadingPackId(null);
        }, 1500);
    };

    const categories: { id: PremiumCategory | 'all', label: string }[] = [
        { id: 'all', label: 'Tout' },
        { id: 'bac', label: 'Bac & Lycée' },
        { id: 'concours', label: 'Prépas & Concours' },
        { id: 'expert', label: 'Pro & Experts' },
        { id: 'langues', label: 'Langues' },
    ];

    return (
        <div className="bg-white dark:bg-zinc-900 min-h-screen pb-20">
            {/* HEADER STORE */}
            <div className="bg-slate-900 text-white py-12 px-6 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                        <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white" />
                    </svg>
                </div>
                <div className="relative z-10 max-w-3xl mx-auto">
                    <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
                        <ShoppingBagIcon className="w-10 h-10 text-amber-400" />
                        Capsules Premium
                    </h1>
                    <p className="text-slate-300 text-lg">
                        Accédez à des contenus d'excellence préparés par des experts.
                        Révisions, concours, compétences pro : boostez votre savoir.
                    </p>
                </div>
            </div>

            {/* FILTERS */}
            <div className="sticky top-16 z-20 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-zinc-800">
                <div className="container mx-auto px-4 overflow-x-auto">
                    <div className="flex gap-2 py-4 min-w-max">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setFilter(cat.id)}
                                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                                    filter === cat.id 
                                    ? 'bg-slate-900 text-white dark:bg-white dark:text-black' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                                }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* GRID */}
            <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredPacks.map(pack => {
                        const isUnlocked = unlockedPackIds.includes(pack.id);
                        
                        return (
                            <div key={pack.id} className="group bg-white dark:bg-zinc-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-700 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col">
                                {/* Card Header Image */}
                                <div className={`h-32 ${pack.coverColor} relative flex items-center justify-center overflow-hidden`}>
                                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                                    {pack.category === 'bac' && <GraduationCapIcon className="w-16 h-16 text-white/80 transform group-hover:scale-110 transition-transform" />}
                                    {pack.category === 'expert' && <StarIcon className="w-16 h-16 text-white/80 transform group-hover:scale-110 transition-transform" />}
                                    {pack.category === 'concours' && <ShoppingBagIcon className="w-16 h-16 text-white/80 transform group-hover:scale-110 transition-transform" />}
                                    {pack.category === 'langues' && <GlobeIcon className="w-16 h-16 text-white/80 transform group-hover:scale-110 transition-transform" />}
                                    
                                    {isUnlocked && (
                                        <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-md p-1 rounded-full">
                                            <CheckCircleIcon className="w-5 h-5 text-white" />
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-6 flex-grow flex flex-col">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">{pack.category}</span>
                                        <span className="text-xs font-semibold bg-slate-100 dark:bg-zinc-700 px-2 py-1 rounded text-slate-600 dark:text-zinc-300">
                                            {pack.capsuleCount} capsules
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{pack.title}</h3>
                                    <p className="text-sm text-slate-600 dark:text-zinc-400 mb-6 flex-grow">{pack.description}</p>

                                    <div className="mt-auto pt-4 border-t border-slate-100 dark:border-zinc-700 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            {isPremiumUser ? (
                                                <span className="text-sm font-bold text-amber-500">Inclus Premium</span>
                                            ) : (
                                                <span className="text-xl font-bold text-slate-900 dark:text-white">{pack.price} €</span>
                                            )}
                                        </div>

                                        {isUnlocked ? (
                                            <button disabled className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 rounded-lg font-semibold cursor-default">
                                                <UnlockIcon className="w-4 h-4" />
                                                Débloqué
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleBuy(pack)}
                                                disabled={!!loadingPackId}
                                                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold text-white transition-all shadow-md hover:shadow-lg transform active:scale-95 ${
                                                    isPremiumUser 
                                                    ? 'bg-amber-500 hover:bg-amber-600' 
                                                    : 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-200'
                                                }`}
                                            >
                                                {loadingPackId === pack.id ? (
                                                    <span className="animate-pulse">Traitement...</span>
                                                ) : (
                                                    <>
                                                        {isPremiumUser ? 'Ajouter' : 'Acheter'}
                                                        <LockIcon className="w-4 h-4 opacity-70" />
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PremiumStore;
