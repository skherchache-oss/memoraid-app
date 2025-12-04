
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import type { CognitiveCapsule, QuizQuestion, Group, Comment, CollaborativeTask } from '../types';
import Quiz from './Quiz';
import { LightbulbIcon, ListChecksIcon, MessageSquareIcon, DownloadIcon, TagIcon, Volume2Icon, StopCircleIcon, RefreshCwIcon, ImageIcon, SparklesIcon, ChevronLeftIcon, PlayIcon, Share2Icon, FileTextIcon, UserIcon, SendIcon, MonitorIcon, CrownIcon, CheckSquareIcon, PresentationIcon, BookIcon, PrinterIcon } from '../constants';
import { isCapsuleDue } from '../services/srsService';
import { generateMemoryAidDrawing, expandKeyConcept, regenerateQuiz } from '../services/geminiService';
import { downloadFlashcardsPdf, downloadCapsulePdf, generateFilename, downloadQuizPdf } from '../services/pdfService';
import { exportToPPTX, exportToEPUB } from '../services/exportService';
import { ToastType } from '../hooks/useToast';
import { addCommentToCapsule, saveCapsuleToCloud, assignTaskToMember, updateTaskStatus } from '../services/cloudService';
import FocusMode from './FocusMode';
import { useLanguage } from '../contexts/LanguageContext';


// Helper functions for audio decoding (truncated for brevity, keep existing implementation)
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


interface CapsuleViewProps {
    capsule: CognitiveCapsule;
    allCapsules: CognitiveCapsule[];
    selectedCapsuleIds: string[];
    onStartCoaching: () => void;
    onStartFlashcards: () => void;
    onStartActiveLearning: () => void;
    onMarkAsReviewed: (capsuleId: string, score?: number, type?: 'quiz' | 'flashcard' | 'manual') => void;
    onSetCategory: (capsuleId: string, category: string) => void;
    allCategories: string[];
    onSetMemoryAid: (capsuleId: string, imageData: string | null, description: string | null) => void;
    onUpdateQuiz: (capsuleId: string, newQuiz: QuizQuestion[]) => void;
    onBackToList: () => void;
    addToast: (message: string, type: ToastType) => void;
    userGroups: Group[];
    onShareCapsule: (group: Group, capsule: CognitiveCapsule) => void;
    currentUserId?: string;
    currentUserName?: string;
    isPremium?: boolean;
}

const CapsuleView: React.FC<CapsuleViewProps> = ({ capsule, onUpdateQuiz, addToast, onBackToList, onSetMemoryAid, allCategories, onSetCategory, onMarkAsReviewed, onStartActiveLearning, onStartFlashcards, onStartCoaching, userGroups, onShareCapsule, currentUserId, currentUserName, isPremium }) => {
    const { language, t } = useLanguage();
    const isDue = isCapsuleDue(capsule);
    const [isEditingCategory, setIsEditingCategory] = useState(false);
    const [categoryInput, setCategoryInput] = useState(capsule.category || '');
    
    const [speakingId, setSpeakingId] = useState<string | null>(null);
    const [isBuffering, setIsBuffering] = useState<string | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    const [memoryAidImage, setMemoryAidImage] = useState<string | null>(null);
    const [memoryAidDescription, setMemoryAidDescription] = useState<string | null>(null);
    const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
    const [imageError, setImageError] = useState<string | null>(null);
    
    const [expandedConcepts, setExpandedConcepts] = useState<Record<string, string>>({});
    const [loadingConcepts, setLoadingConcepts] = useState<Record<string, boolean>>({});
    const [errorConcepts, setErrorConcepts] = useState<Record<string, string | null>>({});

    const [isRegeneratingQuiz, setIsRegeneratingQuiz] = useState(false);
    
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [newComment, setNewComment] = useState('');
    
    // Task assignment state
    const [newTaskDesc, setNewTaskDesc] = useState('');
    const [selectedAssignee, setSelectedAssignee] = useState('');

    // Focus Mode State
    const [isFocusMode, setIsFocusMode] = useState(false);

    // Stop audio playback when capsule changes or component unmounts
    useEffect(() => {
        setCategoryInput(capsule.category || '');
        setIsEditingCategory(false);
        setMemoryAidImage(capsule.memoryAidImage || null);
        setMemoryAidDescription(capsule.memoryAidDescription || null);
        setIsGeneratingImage(false);
        setImageError(null);
        setExpandedConcepts({});
        setLoadingConcepts({});
        setErrorConcepts({});
        setShowShareMenu(false);
        setIsFocusMode(false);
        setNewTaskDesc('');
        
        return () => {
            if (audioSourceRef.current) {
                audioSourceRef.current.stop();
                audioSourceRef.current.disconnect();
                audioSourceRef.current = null;
            }
            setSpeakingId(null);
            setIsBuffering(null);
        };
    }, [capsule]);

    // Quiz regeneration for due capsules
    useEffect(() => {
        const regenerate = async () => {
            if (isDue && !isRegeneratingQuiz && !capsule.isShared) {
                const alreadyRegeneratedKey = `quiz_regen_${capsule.id}_${capsule.lastReviewed}`;
                
                if (sessionStorage.getItem(alreadyRegeneratedKey)) {
                    return;
                }
                
                sessionStorage.setItem(alreadyRegeneratedKey, 'attempted');
                
                setIsRegeneratingQuiz(true);
                
                try {
                    const newQuiz = await regenerateQuiz(capsule, language);
                    if (newQuiz && newQuiz.length > 0) {
                        onUpdateQuiz(capsule.id, newQuiz);
                        addToast(t('quiz_updated'), 'success');
                    }
                } catch (e) {
                    console.warn("Quiz auto-regeneration failed:", e);
                } finally {
                    setIsRegeneratingQuiz(false);
                }
            }
        };

        regenerate();
    }, [capsule, isDue, onUpdateQuiz, addToast, isRegeneratingQuiz, language, t]);

    // Initialize AudioContext
    useEffect(() => {
        if (!audioContextRef.current) {
            try {
                const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                audioContextRef.current = new AudioContext({ sampleRate: 24000 });
            } catch (e) {
                console.error("Web Audio API is not supported in this browser.", e);
            }
        }
    }, []);

    const handleGenerateDrawing = async () => {
        setIsGeneratingImage(true);
        setImageError(null);
        setMemoryAidImage(null);
        setMemoryAidDescription(null);
        try {
            const result = await generateMemoryAidDrawing({
                title: capsule.title,
                summary: capsule.summary,
                keyConcepts: capsule.keyConcepts,
            }, language);
            
            const fullImageSrc = `data:image/png;base64,${result.imageData}`;
            setMemoryAidImage(fullImageSrc);
            setMemoryAidDescription(result.description);
            onSetMemoryAid(capsule.id, fullImageSrc, result.description);
        } catch (err) {
            setImageError(err instanceof Error ? err.message : 'Une erreur inconnue est survenue.');
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const handleClearDrawing = () => {
        setMemoryAidImage(null);
        setMemoryAidDescription(null);
        setImageError(null);
        onSetMemoryAid(capsule.id, null, null);
    };
    
    // ... keep existing expansion and audio functions ...
    const handleToggleConcept = async (concept: string, originalExplanation: string) => {
        if (expandedConcepts[concept]) {
            const newExpanded = { ...expandedConcepts };
            delete newExpanded[concept];
            setExpandedConcepts(newExpanded);
            return;
        }
    
        if (loadingConcepts[concept]) return;
    
        setLoadingConcepts(prev => ({ ...prev, [concept]: true }));
        setErrorConcepts(prev => ({ ...prev, [concept]: null }));
    
        try {
            const explanation = await expandKeyConcept(capsule.title, concept, originalExplanation, language);
            setExpandedConcepts(prev => ({ ...prev, [concept]: explanation }));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Une erreur est survenue.";
            setErrorConcepts(prev => ({ ...prev, [concept]: errorMessage }));
        } finally {
            setLoadingConcepts(prev => ({ ...prev, [concept]: false }));
        }
    };

    const handleDownloadDrawing = () => {
        if (!memoryAidImage) return;
        const link = document.createElement('a');
        link.href = memoryAidImage;
        link.download = generateFilename('Dessin', capsule.title || 'sans-titre', 'png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleToggleSpeech = async (id: string, text: string) => {
        if (!process.env.API_KEY) {
            addToast("La clé API n'est pas configurée pour la synthèse vocale.", 'error');
            return;
        }
        if (!audioContextRef.current) {
            addToast("L'API Audio n'est pas supportée par votre navigateur.", 'error');
            return;
        }
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
            audioSourceRef.current.disconnect();
            audioSourceRef.current = null;
        }
        if (speakingId === id || isBuffering === id) {
            setSpeakingId(null);
            setIsBuffering(null);
            return;
        }
        
        setSpeakingId(null);
        setIsBuffering(id);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                    },
                },
            });
            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!base64Audio) throw new Error("Aucune donnée audio reçue.");

            const audioBuffer = await decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            
            source.onended = () => {
                setSpeakingId(null);
                if (audioSourceRef.current === source) audioSourceRef.current = null;
            };
            source.start();
            audioSourceRef.current = source;
            setSpeakingId(id);
        } catch (error) {
            console.error("Erreur de synthèse vocale Gemini:", error);
            addToast("Impossible de générer l'audio. Veuillez réessayer.", 'error');
            setSpeakingId(null);
        } finally {
            setIsBuffering(null);
        }
    };

    const handleCategorySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSetCategory(capsule.id, categoryInput);
        setIsEditingCategory(false);
    };
    
    const handleShareClick = () => setShowShareMenu(!showShareMenu);

    const handleShareToGroup = (group: Group) => {
        onShareCapsule(group, capsule);
        setShowShareMenu(false);
        addToast(`Partagée avec le groupe "${group.name}"`, 'success');
    };

    const handlePostComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !currentUserId || !capsule.groupId) return;
        const comment: Comment = {
            id: `cmt_${Date.now()}`,
            userId: currentUserId,
            userName: currentUserName || 'Anonyme',
            content: newComment.trim(),
            timestamp: Date.now()
        };
        try {
            await addCommentToCapsule(capsule.groupId, capsule.id, comment);
            setNewComment('');
            addToast("Commentaire ajouté", 'success');
        } catch (error) {
            addToast("Erreur lors de l'ajout du commentaire", 'error');
        }
    };
    
    const handleAssignTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskDesc.trim() || !selectedAssignee || !capsule.groupId) return;
        
        const group = userGroups.find(g => g.id === capsule.groupId);
        const member = group?.members.find(m => m.userId === selectedAssignee);
        
        const newTask: CollaborativeTask = {
            id: `task_${Date.now()}`,
            capsuleId: capsule.id,
            assigneeId: selectedAssignee,
            assigneeName: member?.name || 'Membre inconnu',
            description: newTaskDesc.trim(),
            isCompleted: false,
            createdAt: Date.now(),
            createdBy: currentUserId || ''
        };

        try {
            await assignTaskToMember(capsule.groupId, capsule.id, newTask);
            setNewTaskDesc('');
            addToast("Tâche assignée !", 'success');
        } catch (e) {
            addToast("Erreur d'assignation", 'error');
        }
    };

    const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
        if (!capsule.groupId) return;
        try {
            await updateTaskStatus(capsule.groupId, capsule.id, taskId, !currentStatus, capsule.collaborativeTasks || []);
        } catch(e) {
            addToast("Erreur mise à jour tâche", 'error');
        }
    };

    const handleDownloadFlashcards = useCallback(() => {
        addToast('Génération du PDF des flashcards...', 'info');
        downloadFlashcardsPdf(capsule).catch(error => {
            const errorMessage = error instanceof Error ? error.message : "Erreur lors de la génération du PDF.";
            addToast(errorMessage, 'error');
        });
    }, [capsule, addToast]);
    
    const handleDownloadCapsule = useCallback(() => {
        addToast('Génération du PDF de la capsule...', 'info');
        downloadCapsulePdf(capsule).catch(error => {
            addToast("Erreur lors de la génération du PDF.", 'error');
        });
    }, [capsule, addToast]);

    const handleDownloadQuiz = useCallback(() => {
        addToast('Génération du PDF du quiz...', 'info');
        downloadQuizPdf(capsule).catch(error => {
            const errorMessage = error instanceof Error ? error.message : "Erreur lors de la génération du PDF.";
            addToast(errorMessage, 'error');
        });
    }, [capsule, addToast]);

    const handleExportPPTX = useCallback(() => {
        addToast('Création de la présentation PowerPoint...', 'info');
        exportToPPTX(capsule).then(() => {
            addToast('Téléchargement PowerPoint démarré.', 'success');
        }).catch(error => {
            addToast("Erreur lors de l'export PowerPoint.", 'error');
        });
    }, [capsule, addToast]);

    const handleExportEPUB = useCallback(() => {
        addToast('Création du livre électronique (ePub)...', 'info');
        exportToEPUB(capsule).then(() => {
            addToast('Téléchargement ePub démarré.', 'success');
        }).catch(error => {
            addToast("Erreur lors de l'export ePub.", 'error');
        });
    }, [capsule, addToast]);

    const handleQuizComplete = (score: number) => {
        onMarkAsReviewed(capsule.id, score, 'quiz');
        addToast(`Quiz terminé ! Score enregistré : ${score}%`, 'success');
    };

    if (isFocusMode) {
        return (
            <FocusMode 
                capsule={capsule} 
                onExit={() => setIsFocusMode(false)}
                onMarkAsReviewed={onMarkAsReviewed}
            />
        );
    }

    const activeGroup = capsule.isShared && capsule.groupId ? userGroups.find(g => g.id === capsule.groupId) : null;

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-lg border border-slate-100 dark:border-zinc-800 overflow-hidden animate-fade-in">
            {/* Back button for mobile view */}
            <button 
                onClick={onBackToList}
                className="md:hidden flex items-center gap-1 p-4 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-zinc-800/50 w-full border-b border-slate-100 dark:border-zinc-800"
            >
                <ChevronLeftIcon className="w-5 h-5" />
                {t('back_list')}
            </button>
            <div className="p-6 md:p-10">
                {/* En-tête Collaboratif */}
                {capsule.isShared && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg mb-6 flex items-center gap-3 border border-purple-100 dark:border-purple-800/50">
                        <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-full">
                            <UserIcon className="w-5 h-5 text-purple-600 dark:text-purple-200" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-purple-900 dark:text-purple-200">{t('collaborative_capsule')}</p>
                            <p className="text-xs text-purple-700 dark:text-purple-300">
                                {t('shared_in')} <strong>{capsule.groupName}</strong> • {t('access_link')} : <span className="font-mono bg-purple-200 dark:bg-purple-900 px-1 rounded select-all">{capsule.sharedLink || 'N/A'}</span>
                            </p>
                        </div>
                    </div>
                )}

                {isDue && (
                    <div className="bg-amber-50 dark:bg-amber-900/40 p-4 rounded-lg mb-6 flex items-center justify-between flex-wrap gap-4 no-export">
                        <div>
                            <h4 className="font-semibold text-amber-800 dark:text-amber-200">{t('time_to_review')}</h4>
                            <p className="text-sm text-amber-700 dark:text-amber-300">{t('reinforce_knowledge')}</p>
                        </div>
                        <button
                            onClick={() => onMarkAsReviewed(capsule.id, 100, 'manual')}
                            className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors font-semibold whitespace-nowrap"
                        >
                            {t('review_done')}
                        </button>
                    </div>
                )}

                <div className="flex justify-between items-start mb-6">
                    <div className="flex-grow mr-4">
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-3">{capsule.title}</h2>
                        <div className="relative">
                            <p className="text-lg text-slate-600 dark:text-zinc-300 pr-10 leading-relaxed">{capsule.summary}</p>
                            <button
                                onClick={() => handleToggleSpeech('summary', capsule.summary)}
                                className="absolute top-0 right-0 p-1 rounded-full text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                aria-label={speakingId === 'summary' ? "Arrêter la lecture" : "Lire le résumé à voix haute"}
                                disabled={isBuffering === 'summary'}
                            >
                                {isBuffering === 'summary' ? <RefreshCwIcon className="w-5 h-5 animate-spin" /> : speakingId === 'summary' ? <StopCircleIcon className="w-5 h-5 text-emerald-500" /> : <Volume2Icon className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                     <div className="flex-shrink-0 flex items-center gap-2 relative">
                         <button 
                            onClick={() => setIsFocusMode(true)}
                            className="p-3 rounded-full text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-zinc-700"
                            title="Mode Focus (Plein écran)"
                        >
                           <MonitorIcon className="w-6 h-6"/>
                        </button>
                        <button 
                            onClick={handleShareClick}
                            className="p-3 rounded-full text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                            title="Partager la capsule"
                        >
                           <Share2Icon className="w-6 h-6"/>
                        </button>
                        {showShareMenu && userGroups.length > 0 && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-slate-200 dark:border-zinc-700 z-20 animate-fade-in-fast">
                                <div className="p-2 border-b border-slate-200 dark:border-zinc-700">
                                    <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 px-2 uppercase">{t('share_group')}</p>
                                </div>
                                <div className="p-1">
                                    {userGroups.map(group => (
                                        <button
                                            key={group.id}
                                            onClick={() => handleShareToGroup(group)}
                                            className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-md"
                                        >
                                            {group.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {showShareMenu && userGroups.length === 0 && (
                             <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-slate-200 dark:border-zinc-700 z-20 p-3">
                                <p className="text-sm text-slate-500 dark:text-zinc-400">{t('no_group_msg')}</p>
                             </div>
                        )}
                    </div>
                </div>

                
                <div className="flex items-center gap-2 mb-8 text-sm">
                    <TagIcon className="w-5 h-5 text-slate-400 dark:text-zinc-500 flex-shrink-0" />
                    {!isEditingCategory ? (
                        capsule.category ? (
                            <button 
                                onClick={() => setIsEditingCategory(true)}
                                className="px-3 py-1 text-sm font-semibold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200 border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
                                title="Modifier la catégorie"
                            >
                                {capsule.category}
                            </button>
                        ) : (
                            <button 
                                onClick={() => setIsEditingCategory(true)}
                                className="flex items-center gap-1 px-3 py-1 text-sm font-semibold rounded-full border-2 border-dashed border-emerald-200 dark:border-emerald-800/80 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors"
                            >
                                {t('category_add')}
                            </button>
                        )
                    ) : (
                        <form onSubmit={handleCategorySubmit} className="flex items-center gap-2 animate-fade-in-fast">
                            <input
                                type="text"
                                value={categoryInput}
                                onChange={(e) => setCategoryInput(e.target.value)}
                                placeholder={t('category_placeholder')}
                                className="px-2 py-1 text-sm bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                autoFocus
                                list="category-suggestions"
                            />
                            <datalist id="category-suggestions">
                                {allCategories.map(cat => (
                                    <option key={cat} value={cat} />
                                ))}
                            </datalist>
                            <button type="submit" className="px-3 py-1 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700">
                                {t('validate')}
                            </button>
                            <button type="button" onClick={() => { setIsEditingCategory(false); setCategoryInput(capsule.category || ''); }} className="text-xs text-slate-500 dark:text-zinc-400 hover:underline">
                                {t('cancel')}
                            </button>
                        </form>
                    )}
                </div>

                <div className="space-y-12">
                    {/* Key Concepts */}
                    <div>
                        <h3 className="flex items-center text-xl font-bold text-slate-800 dark:text-zinc-100 mb-4">
                            <LightbulbIcon className="w-6 h-6 mr-3 text-amber-500" />
                            <span>{t('key_concepts')}</span>
                            <button
                                onClick={() => handleToggleSpeech('concepts-all', capsule.keyConcepts.map(c => `${c.concept}. ${c.explanation}`).join('\n\n'))}
                                className="ml-auto p-1 rounded-full text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                aria-label={speakingId === 'concepts-all' ? "Arrêter la lecture" : "Lire tous les concepts clés"}
                                disabled={isBuffering === 'concepts-all'}
                            >
                                {isBuffering === 'concepts-all' ? <RefreshCwIcon className="w-5 h-5 animate-spin" /> : speakingId === 'concepts-all' ? <StopCircleIcon className="w-5 h-5 text-emerald-500" /> : <Volume2Icon className="w-5 h-5" />}
                            </button>
                        </h3>
                        <ul className="grid gap-4">
                            {capsule.keyConcepts.map((item, index) => (
                                <li key={index} className="p-5 bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-slate-100 dark:border-zinc-800 hover:shadow-sm transition-shadow">
                                    <p className="font-bold text-slate-900 dark:text-white text-lg mb-1">{item.concept}</p>
                                    <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">{item.explanation}</p>
                                    <div className="mt-3">
                                        {expandedConcepts[item.concept] ? (
                                            <div className="animate-fade-in-fast">
                                                <div className="p-4 bg-white dark:bg-zinc-800 rounded-lg border-l-4 border-emerald-400 shadow-sm mt-2">
                                                    <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{expandedConcepts[item.concept]}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleConcept(item.concept, item.explanation)}
                                                    className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold mt-2 hover:underline"
                                                >
                                                    Masquer
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleToggleConcept(item.concept, item.explanation)}
                                                disabled={loadingConcepts[item.concept]}
                                                className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm font-semibold hover:text-emerald-800 dark:hover:text-emerald-300 disabled:opacity-50 disabled:cursor-wait transition-colors mt-2"
                                            >
                                                <SparklesIcon className={`w-4 h-4 ${loadingConcepts[item.concept] ? 'animate-spin' : ''}`} />
                                                <span>{loadingConcepts[item.concept] ? t('generating') : t('expand')}</span>
                                            </button>
                                        )}
                                        {errorConcepts[item.concept] && (
                                            <p className="text-red-500 text-xs mt-1">{errorConcepts[item.concept]}</p>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                    {/* Examples */}
                    <div>
                        <h3 className="flex items-center text-xl font-bold text-slate-800 dark:text-zinc-100 mb-4">
                            <ListChecksIcon className="w-6 h-6 mr-3 text-sky-500" />
                            <span>{t('examples')}</span>
                             <button
                                onClick={() => handleToggleSpeech('examples-all', capsule.examples.join('\n\n'))}
                                className="ml-auto p-1 rounded-full text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                aria-label={speakingId === 'examples-all' ? "Arrêter la lecture" : "Lire tous les exemples"}
                                disabled={isBuffering === 'examples-all'}
                            >
                                {isBuffering === 'examples-all' ? <RefreshCwIcon className="w-5 h-5 animate-spin" /> : speakingId === 'examples-all' ? <StopCircleIcon className="w-5 h-5 text-emerald-500" /> : <Volume2Icon className="w-5 h-5" />}
                            </button>
                        </h3>
                        <ul className="space-y-3 bg-slate-50 dark:bg-zinc-900/50 p-6 rounded-xl border border-slate-100 dark:border-zinc-800">
                            {capsule.examples.map((example, index) => (
                                <li key={index} className="flex items-start gap-3">
                                    <span className="mt-1.5 flex-shrink-0 h-2 w-2 rounded-full bg-sky-500"></span>
                                    <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">{example}</p>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Dessin Aide-Mémoire */}
                    <div>
                        <h3 className="flex items-center text-xl font-bold text-slate-800 dark:text-zinc-100 mb-4">
                            <ImageIcon className="w-6 h-6 mr-3 text-violet-500" />
                            <span>{t('memory_aid_sketch')}</span>
                        </h3>
                        {!memoryAidImage && !isGeneratingImage && !imageError && (
                            <div className="p-8 bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-slate-100 dark:border-zinc-800 text-center">
                                <p className="text-slate-600 dark:text-zinc-400 mb-4">
                                    Générez un croquis simple pour ancrer visuellement les concepts.
                                </p>
                                <button
                                    onClick={handleGenerateDrawing}
                                    className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors font-semibold shadow-sm"
                                >
                                    <SparklesIcon className="w-5 h-5 text-violet-500"/>
                                    {t('generate_sketch')}
                                </button>
                            </div>
                        )}
                        {isGeneratingImage && (
                            <div className="w-full h-64 flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-slate-100 dark:border-zinc-800">
                                <div className="loader ease-linear rounded-full border-4 border-t-4 border-slate-200 h-10 w-10 mb-4 animate-spin border-t-violet-500"></div>
                                <p className="text-slate-600 dark:text-zinc-400">{t('sketching')}</p>
                            </div>
                        )}
                        {imageError && (
                             <div className="p-6 bg-red-50 dark:bg-red-900/40 rounded-xl text-center border border-red-100 dark:border-red-800">
                                 <p className="text-red-700 dark:text-red-300">{imageError}</p>
                                 <button
                                    onClick={handleGenerateDrawing}
                                    className="mt-4 flex items-center justify-center gap-2 mx-auto px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors font-semibold"
                                >
                                    <RefreshCwIcon className="w-5 h-5"/>
                                    {t('retry')}
                                </button>
                             </div>
                        )}
                        {memoryAidImage && (
                            <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-slate-100 dark:border-zinc-800">
                                <img src={memoryAidImage} alt="Dessin aide-mémoire" className="rounded-lg w-full bg-white shadow-sm" />
                                {memoryAidDescription && (
                                    <div className="mt-4 p-4 bg-white dark:bg-zinc-800 rounded-lg border-l-4 border-violet-400 shadow-sm">
                                        <p className="text-sm text-slate-700 dark:text-zinc-300 italic">
                                            <span className="font-semibold text-violet-600 dark:text-violet-400 not-italic mr-1">{t('info')}</span>
                                            {memoryAidDescription}
                                        </p>
                                    </div>
                                )}
                                <div className="mt-4 flex justify-center items-center gap-6">
                                    <button onClick={handleClearDrawing} className="text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors">
                                        {t('erase')}
                                    </button>
                                    <button onClick={handleGenerateDrawing} className="text-sm font-semibold text-violet-500 hover:text-violet-700 dark:hover:text-violet-400 transition-colors flex items-center gap-1">
                                        <RefreshCwIcon className="w-4 h-4" />
                                        {t('regenerate')}
                                    </button>
                                    <button onClick={handleDownloadDrawing} className="text-sm font-semibold text-sky-500 hover:text-sky-700 dark:hover:text-sky-400 transition-colors flex items-center gap-1">
                                        <DownloadIcon className="w-4 h-4" />
                                        {t('download')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Section Commentaires & Collaboration */}
                    {capsule.isShared && (
                        <div>
                            <h3 className="flex items-center text-xl font-semibold text-slate-800 dark:text-zinc-100 mb-3">
                                <MessageSquareIcon className="w-6 h-6 mr-3 text-pink-500" />
                                <span>{t('collaborative_space')}</span>
                            </h3>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* COMMENTAIRES */}
                                <div className="bg-slate-50 dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800 rounded-lg p-4">
                                    <h4 className="font-bold text-slate-700 dark:text-zinc-200 mb-3 text-sm uppercase tracking-wide">{t('discussion')}</h4>
                                    <div className="space-y-4 mb-4 max-h-60 overflow-y-auto">
                                        {capsule.comments && capsule.comments.length > 0 ? (
                                            capsule.comments.map((comment) => (
                                                <div key={comment.id} className="flex gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900 text-pink-600 dark:text-pink-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                        {comment.userName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="bg-white dark:bg-zinc-800 p-3 rounded-lg rounded-tl-none shadow-sm flex-grow">
                                                        <div className="flex justify-between items-baseline mb-1">
                                                            <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">{comment.userName}</span>
                                                            <span className="text-xs text-slate-400">{new Date(comment.timestamp).toLocaleDateString()}</span>
                                                        </div>
                                                        <p className="text-sm text-slate-600 dark:text-zinc-300">{comment.content}</p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-slate-400 text-center italic py-4">{t('no_comments')}</p>
                                        )}
                                    </div>
                                    <form onSubmit={handlePostComment} className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            placeholder={t('add_comment')}
                                            className="flex-grow px-3 py-2 bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-md text-sm focus:ring-2 focus:ring-pink-500 outline-none"
                                        />
                                        <button type="submit" disabled={!newComment.trim()} className="p-2 bg-pink-500 text-white rounded-md hover:bg-pink-600 disabled:opacity-50">
                                            <SendIcon className="w-4 h-4" />
                                        </button>
                                    </form>
                                </div>

                                {/* GESTION PREMIUM */}
                                {isPremium ? (
                                     <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="font-bold text-amber-800 dark:text-amber-200 text-sm uppercase tracking-wide flex items-center gap-2">
                                                <CrownIcon className="w-4 h-4" />
                                                {t('team_management')}
                                            </h4>
                                        </div>

                                        {/* Assignation Tâches */}
                                        <div className="mb-6">
                                            <h5 className="text-xs font-semibold text-slate-500 mb-2">Assigner une tâche</h5>
                                            <form onSubmit={handleAssignTask} className="space-y-2">
                                                <select 
                                                    className="w-full p-2 text-sm rounded bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700"
                                                    value={selectedAssignee}
                                                    onChange={e => setSelectedAssignee(e.target.value)}
                                                >
                                                    <option value="">Choisir un membre...</option>
                                                    {activeGroup?.members.map(m => (
                                                        <option key={m.userId} value={m.userId}>{m.name}</option>
                                                    ))}
                                                </select>
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Ex: Relire la section 1"
                                                        value={newTaskDesc}
                                                        onChange={e => setNewTaskDesc(e.target.value)}
                                                        className="flex-grow p-2 text-sm rounded bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700"
                                                    />
                                                    <button type="submit" disabled={!newTaskDesc || !selectedAssignee} className="px-3 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:opacity-50">
                                                        +
                                                    </button>
                                                </div>
                                            </form>
                                        </div>

                                        {/* Liste Tâches */}
                                        {capsule.collaborativeTasks && capsule.collaborativeTasks.length > 0 && (
                                            <div className="mb-6">
                                                <h5 className="text-xs font-semibold text-slate-500 mb-2">Tâches en cours</h5>
                                                <div className="space-y-2">
                                                    {capsule.collaborativeTasks.map(task => (
                                                        <div key={task.id} className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-2 rounded border border-slate-200 dark:border-zinc-700">
                                                            <button 
                                                                onClick={() => handleToggleTask(task.id, task.isCompleted)}
                                                                className={`p-1 rounded ${task.isCompleted ? 'text-emerald-500' : 'text-slate-300 hover:text-slate-500'}`}
                                                            >
                                                                <CheckSquareIcon className="w-4 h-4" />
                                                            </button>
                                                            <div className="flex-grow text-sm">
                                                                <p className={`font-medium ${task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-zinc-200'}`}>{task.description}</p>
                                                                <p className="text-xs text-slate-400">Pour: {task.assigneeName}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Progression Groupe */}
                                        <div>
                                            <h5 className="text-xs font-semibold text-slate-500 mb-2">Progression du groupe</h5>
                                            {capsule.groupProgress && capsule.groupProgress.length > 0 ? (
                                                <div className="space-y-2">
                                                    {capsule.groupProgress.map(prog => (
                                                        <div key={prog.userId} className="flex items-center justify-between text-sm bg-white dark:bg-zinc-900 p-2 rounded border border-slate-200 dark:border-zinc-700">
                                                            <span className="font-medium text-slate-700 dark:text-zinc-300">{prog.userName}</span>
                                                            <div className="text-right">
                                                                <div className="text-xs font-bold text-blue-600">{prog.masteryScore}% Maîtrise</div>
                                                                <div className="text-[10px] text-slate-400">Vu le {new Date(prog.lastReviewed).toLocaleDateString()}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic">Aucune donnée de progression.</p>
                                            )}
                                        </div>
                                     </div>
                                ) : (
                                    <div className="bg-slate-100 dark:bg-zinc-800 p-6 rounded-lg flex flex-col items-center justify-center text-center">
                                        <CrownIcon className="w-8 h-8 text-slate-400 mb-2" />
                                        <h4 className="font-bold text-slate-600 dark:text-zinc-400">Fonctionnalités Premium</h4>
                                        <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1 mb-3">
                                            Débloquez la gestion de tâches, le suivi de progression d'équipe et plus.
                                        </p>
                                        <button disabled className="px-3 py-1 bg-slate-200 dark:bg-zinc-700 text-slate-500 rounded text-sm cursor-not-allowed">
                                            Passer Premium (Profil)
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {/* CTAs */}
                    <div className="!mt-12 space-y-10 no-export">
                        <div>
                            <h4 className="text-lg font-bold text-slate-800 dark:text-zinc-200 mb-4">{t('learning_modes')}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <button 
                                     onClick={onStartFlashcards}
                                     className="w-full flex items-center justify-center gap-3 text-center p-5 rounded-xl bg-white dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:border-blue-300 hover:bg-slate-50 hover:shadow-md transition-all"
                                 >
                                    <div className="p-2 bg-blue-50 rounded-full text-blue-600">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M4 6H20M4 10H20M4 14H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </div>
                                    <span className="font-semibold">{t('mode_flashcards')}</span>
                                 </button>
                                 <button 
                                     onClick={onStartCoaching}
                                     className="w-full flex items-center justify-center gap-3 text-center p-5 rounded-xl bg-white dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:border-emerald-300 hover:bg-slate-50 hover:shadow-md transition-all"
                                 >
                                    <MessageSquareIcon className="w-6 h-6 text-emerald-500"/>
                                    <span className="font-semibold">{t('mode_coach')}</span>
                                 </button>
                                 <button 
                                     onClick={onStartActiveLearning}
                                     className="w-full flex items-center justify-center gap-3 text-center p-5 rounded-xl bg-white dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:border-amber-300 hover:bg-slate-50 hover:shadow-md transition-all"
                                 >
                                    <PlayIcon className="w-6 h-6 text-amber-500"/>
                                    <span className="font-semibold">{t('mode_active')}</span>
                                 </button>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-slate-800 dark:text-zinc-200 mb-4">{t('advanced_export')}</h4>
                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                 <button 
                                     onClick={handleDownloadCapsule}
                                     className="w-full flex items-center justify-center gap-2 text-center p-4 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-transparent hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors font-medium"
                                 >
                                    <FileTextIcon className="w-5 h-5 text-amber-500"/>
                                    <span>{t('export_pdf')}</span>
                                 </button>
                                 <button 
                                     onClick={handleExportPPTX}
                                     className="w-full flex items-center justify-center gap-2 text-center p-4 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-transparent hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors font-medium"
                                 >
                                    <PresentationIcon className="w-5 h-5 text-orange-500"/>
                                    <span>{t('export_ppt')}</span>
                                 </button>
                                 <button 
                                     onClick={handleExportEPUB}
                                     className="w-full flex items-center justify-center gap-2 text-center p-4 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-transparent hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors font-medium"
                                 >
                                    <BookIcon className="w-5 h-5 text-emerald-500"/>
                                    <span>{t('export_epub')}</span>
                                 </button>
                                 <button 
                                     onClick={handleDownloadFlashcards}
                                     className="w-full flex items-center justify-center gap-2 text-center p-4 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-transparent hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors font-medium"
                                 >
                                    <PrinterIcon className="w-5 h-5 text-purple-500"/>
                                    <span>{t('export_cards')}</span>
                                 </button>
                            </div>
                            <div className="mt-3 text-right">
                                <button onClick={handleDownloadQuiz} className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 hover:underline flex items-center justify-end gap-1 w-full font-medium">
                                    <ListChecksIcon className="w-3 h-3"/> {t('download_quiz')}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Quiz */}
                    <div className="relative">
                        {isRegeneratingQuiz && (
                            <div className="absolute inset-0 bg-white/70 dark:bg-zinc-900/70 z-10 flex flex-col items-center justify-center rounded-lg">
                                <div className="loader ease-linear rounded-full border-4 border-t-4 border-slate-200 h-8 w-8 mb-3 animate-spin border-t-emerald-500"></div>
                                <p className="font-semibold text-slate-600 dark:text-zinc-300">Mise à jour du quiz...</p>
                            </div>
                        )}
                        <Quiz questions={capsule.quiz} onComplete={handleQuizComplete} />
                    </div>

                </div>
            </div>
        </div>
    );
};

export default CapsuleView;
