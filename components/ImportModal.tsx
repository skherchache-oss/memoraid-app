import React, { useState } from 'react';
import { XIcon, BookOpenIcon, DownloadIcon, CheckCircleIcon, RefreshCwIcon } from '../constants';
import type { ExternalPlatform, SchoolCourse, SchoolMaterial } from '../types';

interface ImportModalProps {
    onClose: () => void;
    onImport: (text: string, sourceTitle?: string) => void;
}

// Données simulées pour la démonstration
const MOCK_COURSES: Record<ExternalPlatform, SchoolCourse[]> = {
    classroom: [
        {
            id: 'c1', name: 'Biologie - Terminale S', platform: 'classroom', materials: [
                { id: 'm1', title: 'Chapitre 3 : La Photosynthèse (Notes)', type: 'text', content: "La photosynthèse est le processus bioénergétique qui permet aux plantes de synthétiser de la matière organique en utilisant la lumière du soleil. Équation globale : 6CO2 + 6H2O + Lumière -> C6H12O6 + 6O2. Elle se déroule dans les chloroplastes." },
                { id: 'm2', title: 'TP Génétique : Mendel', type: 'pdf', content: "Les lois de Mendel décrivent la transmission des caractères héréditaires. 1ère loi : Uniformité des hybrides de première génération. 2ème loi : Pureté des gamètes." }
            ]
        },
        {
            id: 'c2', name: 'Histoire - La Guerre Froide', platform: 'classroom', materials: [
                { id: 'm3', title: 'Résumé du cours : Bloc de l\'Est vs Ouest', type: 'doc', content: "La guerre froide est une période de tensions géopolitiques entre les États-Unis et leurs alliés (bloc de l'Ouest) et l'Union soviétique et ses alliés (bloc de l'Est), qui s'étend de la fin de la Seconde Guerre mondiale (1945) jusqu'à la chute des régimes communistes en Europe (1989-1991)." }
            ]
        }
    ],
    pronote: [
        {
            id: 'p1', name: 'Mathématiques - Mr. Dupont', platform: 'pronote', materials: [
                { id: 'm4', title: 'Dérivées et Intégrales', type: 'pdf', content: "La dérivée d'une fonction mesure le taux de variation instantané. L'intégrale mesure l'aire sous la courbe. Théorème fondamental de l'analyse : l'intégration et la dérivation sont des opérations inverses." },
                { id: 'm5', title: 'Probabilités conditionnelles', type: 'text', content: "P(A|B) = P(A inter B) / P(B). Formule de Bayes. Arbres de probabilité." }
            ]
        }
    ],
    moodle: [
        {
            id: 'mo1', name: 'Philosophie - La Conscience', platform: 'moodle', materials: [
                { id: 'm6', title: 'Texte : Descartes et le Cogito', type: 'pdf', content: "Je pense, donc je suis. Le doute méthodique. La conscience comme fondement de la certitude." }
            ]
        }
    ]
};

const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImport }) => {
    const [step, setStep] = useState<'select' | 'auth' | 'list' | 'loading'>('select');
    const [platform, setPlatform] = useState<ExternalPlatform | null>(null);
    const [courses, setCourses] = useState<SchoolCourse[]>([]);
    const [selectedCourse, setSelectedCourse] = useState<SchoolCourse | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(false);

    const handleSelectPlatform = (p: ExternalPlatform) => {
        setPlatform(p);
        setStep('auth');
    };

    const handleAuth = () => {
        setIsAuthLoading(true);
        // Simulation de l'appel API / OAuth
        setTimeout(() => {
            setIsAuthLoading(false);
            if (platform) {
                setCourses(MOCK_COURSES[platform]);
                setStep('list');
            }
        }, 1500);
    };

    const handleImportMaterial = (material: SchoolMaterial) => {
        setStep('loading');
        // Simulation récupération contenu fichier
        setTimeout(() => {
            // On envoie le contenu simulé au générateur principal
            const contentToImport = material.content || "Contenu vide";
            const importTitle = `${selectedCourse?.name} - ${material.title}`;
            onImport(contentToImport, importTitle);
            onClose();
        }, 1000);
    };

    const renderPlatformSelect = () => (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button 
                onClick={() => handleSelectPlatform('classroom')}
                className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 dark:border-zinc-800 rounded-xl hover:border-yellow-500/50 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 transition-all group"
            >
                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-3 text-yellow-600 dark:text-yellow-500 group-hover:scale-110 transition-transform">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.22-7.52-3.22 7.52 3.22z"/></svg>
                </div>
                <span className="font-bold text-slate-700 dark:text-zinc-200">Google Classroom</span>
                <span className="text-xs text-slate-400 mt-1 text-center">Importez vos devoirs et supports</span>
            </button>
            <button 
                onClick={() => handleSelectPlatform('pronote')}
                className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 dark:border-zinc-800 rounded-xl hover:border-green-500/50 hover:bg-green-50 dark:hover:bg-green-900/10 transition-all group"
            >
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-3 text-green-600 dark:text-green-500 group-hover:scale-110 transition-transform">
                   <BookOpenIcon className="w-6 h-6" />
                </div>
                <span className="font-bold text-slate-700 dark:text-zinc-200">Pronote</span>
                <span className="text-xs text-slate-400 mt-1 text-center">Cahier de textes et ressources</span>
            </button>
            <button 
                onClick={() => handleSelectPlatform('moodle')}
                className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 dark:border-zinc-800 rounded-xl hover:border-orange-500/50 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-all group"
            >
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-3 text-orange-600 dark:text-orange-500 group-hover:scale-110 transition-transform">
                    <span className="text-xl font-bold">M</span>
                </div>
                <span className="font-bold text-slate-700 dark:text-zinc-200">Moodle</span>
                <span className="text-xs text-slate-400 mt-1 text-center">Cours universitaires et fichiers</span>
            </button>
        </div>
    );

    const renderAuth = () => (
        <div className="flex flex-col items-center text-center p-4">
            <div className="mb-6 w-16 h-16 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                {platform === 'classroom' && <span className="text-yellow-600 font-bold">G</span>}
                {platform === 'pronote' && <BookOpenIcon className="text-green-600 w-8 h-8" />}
                {platform === 'moodle' && <span className="text-orange-600 font-bold text-2xl">M</span>}
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                Connexion à {platform === 'classroom' ? 'Google Classroom' : platform === 'pronote' ? 'Pronote' : 'Moodle'}
            </h3>
            <p className="text-slate-500 dark:text-zinc-400 mb-6 max-w-sm">
                Memoraid va récupérer la liste de vos cours récents et les documents associés pour générer des capsules.
            </p>

            {platform !== 'classroom' && (
                <div className="w-full max-w-xs mb-4">
                    <input type="text" placeholder="URL de l'établissement (facultatif pour démo)" className="w-full px-4 py-2 mb-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800" disabled />
                    <input type="text" value="demo_student" readOnly className="w-full px-4 py-2 mb-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-500" />
                </div>
            )}

            <button 
                onClick={handleAuth}
                disabled={isAuthLoading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-70 font-semibold w-full max-w-xs"
            >
                {isAuthLoading ? (
                    <>
                        <RefreshCwIcon className="w-5 h-5 animate-spin" />
                        Connexion en cours...
                    </>
                ) : (
                    'Autoriser l\'accès'
                )}
            </button>
            <p className="text-xs text-slate-400 mt-4 italic">Aucun mot de passe n'est stocké. Simulation pour la démo.</p>
        </div>
    );

    const renderList = () => (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">Vos cours récents</h3>
                <button onClick={() => setStep('select')} className="text-sm text-blue-500 hover:underline">Changer</button>
            </div>
            <div className="flex-grow overflow-y-auto space-y-4 pr-2">
                {courses.map(course => (
                    <div key={course.id} className="bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden">
                        <div 
                            className="p-3 bg-slate-100 dark:bg-zinc-800 font-semibold text-slate-700 dark:text-zinc-200 cursor-pointer flex justify-between items-center"
                            onClick={() => setSelectedCourse(selectedCourse?.id === course.id ? null : course)}
                        >
                            {course.name}
                            <DownloadIcon className={`w-4 h-4 transition-transform ${selectedCourse?.id === course.id ? 'rotate-180' : ''}`} />
                        </div>
                        {selectedCourse?.id === course.id && (
                            <div className="p-2 space-y-1">
                                {course.materials.map(material => (
                                    <button
                                        key={material.id}
                                        onClick={() => handleImportMaterial(material)}
                                        className="w-full text-left p-3 rounded-md hover:bg-white dark:hover:bg-zinc-700 flex items-center gap-3 group transition-colors"
                                    >
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                                            {material.type === 'pdf' ? 'PDF' : 'DOC'}
                                        </div>
                                        <div className="flex-grow">
                                            <p className="text-sm font-medium text-slate-700 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">{material.title}</p>
                                            <p className="text-xs text-slate-400">Importable en 1 clic</p>
                                        </div>
                                        <DownloadIcon className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl min-h-[500px] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-zinc-800 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <DownloadIcon className="w-6 h-6 text-blue-600" />
                        Import Scolaire Intelligent
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800">
                        <XIcon className="w-6 h-6 text-slate-500" />
                    </button>
                </header>

                <div className="p-6 flex-grow flex flex-col">
                    {step === 'select' && renderPlatformSelect()}
                    {step === 'auth' && renderAuth()}
                    {step === 'list' && renderList()}
                    {step === 'loading' && (
                         <div className="flex-grow flex flex-col items-center justify-center text-center">
                            <div className="loader ease-linear rounded-full border-4 border-t-4 border-slate-200 h-12 w-12 mb-4 animate-spin border-t-blue-500"></div>
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Récupération du cours...</h3>
                            <p className="text-slate-500 dark:text-zinc-400">Extraction du contenu et préparation de l'analyse.</p>
                         </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportModal;