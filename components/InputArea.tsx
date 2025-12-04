
import React, { useState, useRef } from 'react';
import { SparklesIcon, XIcon, UploadIcon, AlertTriangleIcon, RefreshCwIcon, ImageIcon, BookOpenIcon, MicrophoneIcon, LearningIllustration } from '../constants';
import ImportModal from './ImportModal';
import type { SourceType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Language } from '../i18n/translations';
import { useToast } from '../hooks/useToast';

interface InputAreaProps {
    onGenerate: (text: string, sourceType?: SourceType) => void;
    onGenerateFromFile: (file: File, sourceType?: SourceType) => void;
    isLoading: boolean;
    error: string | null;
    onClearError: () => void;
}

// --- Définitions TypeScript locales pour Web Speech API ---
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onresult: ((this: SpeechRecognition, ev: any) => any) | null;
    onerror: ((this: SpeechRecognition, ev: any) => any) | null;
}

// Limite ajustée à 5 Mo pour les documents (PDF, PPT). 
// Les images peuvent être plus lourdes car elles sont compressées côté client.
const MAX_DOC_SIZE_MB = 5;
const MAX_RAW_IMAGE_SIZE_MB = 30; // Limite dure pour éviter les crashs navigateurs

const InputArea: React.FC<InputAreaProps> = ({ onGenerate, onGenerateFromFile, isLoading, error, onClearError }) => {
    const { t, language } = useLanguage();
    const { addToast } = useToast();
    const [inputText, setInputText] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedSourceType, setSelectedSourceType] = useState<SourceType | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const [lastAttempt, setLastAttempt] = useState<{ type: 'text' | 'file'; content: string | File; sourceType?: SourceType } | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    
    // État pour la reconnaissance vocale (UI)
    const [isRecording, setIsRecording] = useState(false);
    // SPLIT STATE: tempSpeech holds the current dictation session content ONLY
    const [tempSpeech, setTempSpeech] = useState('');

    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleFileImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    // Fonction de nettoyage des tics de langage adaptée à la langue
    const cleanSpeechText = (text: string, lang: Language) => {
        let cleaned = text;
        if (lang === 'fr') {
            // Nettoyage Français
            cleaned = cleaned.replace(/\b(euh+|hum+|ben|bah|bref|genre|fin|du coup)\b/gi, '');
        } else {
            // Nettoyage Anglais
            cleaned = cleaned.replace(/\b(um+|uh+|like|you know|so|basically|actually)\b/gi, '');
        }
        // Nettoyage universel (espaces multiples, ponctuation flottante)
        cleaned = cleaned.replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
        
        // Capitalize first letter
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    };

    // --- LOGIQUE DICTÉE VOCALE ---
    const startRecording = () => {
        const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
            addToast("Ce navigateur ne supporte pas la dictée vocale. Veuillez utiliser Google Chrome ou Microsoft Edge.", "error");
            return;
        }

        if (recognitionRef.current) {
            recognitionRef.current.abort();
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true; // Permet de continuer même après une pause
        recognition.interimResults = true; // Affiche le texte en train d'être prononcé
        recognition.lang = language === 'fr' ? 'fr-FR' : 'en-US';

        // 1. Désactiver le clavier virtuel sur mobile pour éviter les conflits d'insertion
        // On utilise readOnly={isRecording} dans le JSX, mais le blur aide aussi
        if (textareaRef.current) {
            textareaRef.current.blur();
        }

        // Reset temp speech
        setTempSpeech('');
        
        // Mise à jour UI
        setIsRecording(true);

        recognition.onstart = () => {
            setSelectedSourceType('speech');
            setParseError(null);
            onClearError();
        };

        recognition.onresult = (event: any) => {
            let transcript = '';
            // The Web Speech API accumulates results in the event object for the current session
            for (let i = 0; i < event.results.length; ++i) {
                transcript += event.results[i][0].transcript;
            }

            // Clean and set to temp state ONLY. Do not touch inputText yet.
            // This prevents the "duplication loop" because inputText never changes during recording.
            const cleaned = cleanSpeechText(transcript, language);
            setTempSpeech(cleaned);
        };

        recognition.onerror = (event: any) => {
            if (event.error === 'not-allowed' || event.error === 'permission-denied') {
                addToast("Accès au micro refusé. Veuillez vérifier les permissions de votre navigateur.", "error");
                stopRecording();
            } else if (event.error === 'no-speech') {
                // Ignorer le silence
            } else {
                // En cas d'erreur, on arrête proprement
                console.warn("Speech error", event.error);
                stopRecording();
            }
        };

        recognition.onend = () => {
            if (isRecording) {
                setIsRecording(false);
            }
        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
        } catch (e) {
            console.error("Failed to start recognition:", e);
            addToast("Impossible de démarrer le micro.", "error");
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsRecording(false);
        
        // COMMIT PHASE: Merge temp speech into main text
        if (tempSpeech) {
            setInputText(prev => {
                const prefix = prev.trim();
                const suffix = tempSpeech.trim();
                if (!prefix) return suffix;
                return prefix + " " + suffix;
            });
            setTempSpeech('');
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            if(selectedFile) clearFile();
            startRecording();
        }
    };

    const clearFile = () => {
        setSelectedFile(null);
        setSelectedSourceType(null);
        setParseError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Fonction pour redimensionner l'image
    const resizeImage = (file: File): Promise<File> => {
        return new Promise((resolve, reject) => {
            // Optimisation : Si l'image est petite (< 2Mo), on ne la redimensionne pas pour gagner du temps
            if (file.size < 2 * 1024 * 1024) {
                resolve(file);
                return;
            }

            const img = document.createElement('img');
            const url = URL.createObjectURL(file);
            
            img.onload = () => {
                // Dimensions maximales augmentées à 1600px pour une meilleure lisibilité OCR
                const MAX_WIDTH = 1600;
                const MAX_HEIGHT = 1600;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    // Libérer la mémoire de l'image source immédiatement
                    img.src = ''; 
                    
                    canvas.toBlob((blob) => {
                        if (blob) {
                            // Qualité JPEG augmentée à 0.7 pour garder la netteté du texte
                            const resizedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            resolve(resizedFile);
                        } else {
                            reject(new Error("Erreur compression image"));
                        }
                        URL.revokeObjectURL(url);
                    }, 'image/jpeg', 0.7);
                } else {
                    reject(new Error("Erreur contexte canvas"));
                }
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Impossible de charger l'image"));
            };
            
            img.src = url;
        });
    };
    
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        onClearError();
        setParseError(null);
        
        if (file.size === 0) {
             setParseError("Le fichier est vide.");
             event.target.value = '';
             return;
        }

        const extension = file.name.split('.').pop()?.toLowerCase();
        const isImage = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(extension || '');
        const isPdf = file.type === 'application/pdf' || extension === 'pdf';
        const isText = file.type === 'text/plain' || extension === 'txt';
        const isPpt = file.type === 'application/vnd.ms-powerpoint' || 
                      file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
                      extension === 'ppt' || extension === 'pptx';

        if (!isPdf && !isText && !isPpt && !isImage) {
            setParseError(t('error_file_type'));
            setSelectedFile(null);
            event.target.value = '';
            return;
        }

        // Vérification taille (Différente pour Images vs Docs)
        if (!isImage && file.size > MAX_DOC_SIZE_MB * 1024 * 1024) {
            setParseError(t('error_file_size') + ` Max ${MAX_DOC_SIZE_MB} Mo pour les documents.`);
            setSelectedFile(null);
            event.target.value = ''; 
            return;
        }
        
        if (isImage && file.size > MAX_RAW_IMAGE_SIZE_MB * 1024 * 1024) {
             setParseError("L'image est trop volumineuse (> 30Mo).");
             setSelectedFile(null);
             event.target.value = '';
             return;
        }

        setIsProcessingImage(true);
        setInputText('');

        try {
            let finalFile = file;
            if (isImage) {
                await new Promise(resolve => setTimeout(resolve, 50));
                finalFile = await resizeImage(file);
            }
            setSelectedFile(finalFile);
            setSelectedSourceType(isImage ? 'ocr' : 'file');
        } catch (err) {
            console.error(err);
            setParseError("Erreur image. Essayez une photo moins lourde ou utilisez la galerie.");
            event.target.value = '';
        } finally {
            setIsProcessingImage(false);
        }
    };

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (isLoading || isProcessingImage) return;
        
        // Ensure we stop recording and commit text before submitting
        if (isRecording) stopRecording();

        // Small delay to allow state to update after stopRecording
        setTimeout(() => {
            // Combine text manually here to be sure, as state update might be async
            const combinedText = (inputText + (inputText && tempSpeech ? ' ' : '') + tempSpeech).trim();

            if (selectedFile) {
                onGenerateFromFile(selectedFile, selectedSourceType || undefined);
            } else if (combinedText) {
                // Clean final text one last time
                const finalContent = selectedSourceType === 'speech' 
                    ? cleanSpeechText(combinedText, language) 
                    : combinedText;
                
                const isSpeech = selectedSourceType === 'speech';
                setLastAttempt({ type: 'text', content: finalContent, sourceType: isSpeech ? 'speech' : undefined });
                onGenerate(finalContent, isSpeech ? 'speech' : undefined);
                
                // Clear inputs
                setInputText('');
                setTempSpeech('');
            }
        }, 100);
    };

    const handleRetry = () => {
        if (!lastAttempt) return;
        onClearError();
        if (lastAttempt.type === 'file') {
            onGenerateFromFile(lastAttempt.content as File, lastAttempt.sourceType);
        } else {
            onGenerate(lastAttempt.content as string, lastAttempt.sourceType);
        }
    };
    
    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        // When typing manually, update the main state
        setInputText(e.target.value);
        
        if (e.target.value.trim()) {
            onClearError();
        }
        // Si l'utilisateur tape, on sort du mode "source speech" exclusif
        if(selectedSourceType === 'speech') {
            setSelectedSourceType(null);
        }
        if (selectedFile) {
           clearFile();
        }
    };

    const handleSchoolImport = (content: string, title?: string) => {
        const textToProcess = title ? `TITRE DU COURS: ${title}\n\nCONTENU:\n${content}` : content;
        setInputText(textToProcess);
        setLastAttempt({ type: 'text', content: textToProcess });
        onGenerate(textToProcess);
    };
    
    React.useEffect(() => {
        if (error && selectedFile) {
             if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [error, selectedFile]);

    const isUrl = (text: string) => /^(http|https):\/\/[^ "]+$/.test(text.trim());

    // DYNAMIC DISPLAY VALUE
    // We construct the visual text by joining committed text + temp speech
    const displayValue = isRecording 
        ? (inputText + (inputText && tempSpeech ? ' ' : '') + tempSpeech)
        : inputText;

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/30 p-6 rounded-2xl shadow-lg border border-red-200 dark:border-red-800/50 flex flex-col items-center text-center animate-fade-in-fast">
                <AlertTriangleIcon className="w-12 h-12 text-red-500 mb-3" />
                <h3 className="text-xl font-bold text-red-800 dark:text-red-200">{t('error_generation')}</h3>
                <p className="text-red-600 dark:text-red-300 mt-1 mb-4 max-w-md">{error}</p>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleRetry}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold border border-red-500/50 rounded-full text-red-700 dark:text-red-200 bg-white/50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
                    >
                       <RefreshCwIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`}/>
                       {isLoading ? 'Tentative...' : t('retry')}
                    </button>
                    <button
                        onClick={onClearError}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-zinc-300 hover:underline"
                    >
                       {t('close')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="bg-white dark:bg-zinc-900 p-8 md:p-10 rounded-3xl shadow-xl border border-transparent dark:border-zinc-800 relative z-10">
                
                <h2 className="text-3xl font-bold text-emerald-900 dark:text-white mb-2 text-center">{t('create_capsule')}</h2>
                <p className="text-lg text-slate-500 dark:text-zinc-400 mt-1 mb-6 text-center">{t('input_instruction')}</p>
                
                <form onSubmit={handleSubmit}>
                     <div className="relative">
                        <textarea
                            ref={textareaRef}
                            value={displayValue}
                            onChange={handleTextChange}
                            readOnly={isRecording} // CRITIQUE: Empêche les conflits avec le clavier virtuel pendant la dictée
                            placeholder={isRecording ? t('input_placeholder_voice') : t('input_placeholder')}
                            className={`w-full h-48 md:h-64 p-6 text-lg rounded-2xl border transition-colors placeholder:text-slate-400 dark:placeholder:text-zinc-600 text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 ${isRecording ? 'bg-red-50 dark:bg-red-900/20 border-red-300 focus:ring-red-500' : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 focus:ring-emerald-500'}`}
                            disabled={isLoading || isProcessingImage}
                        />
                        {inputText && isUrl(inputText) && (
                            <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm font-bold rounded-md flex items-center gap-1">
                                <span>WEB</span>
                            </div>
                        )}
                        {isRecording && (
                            <div className="absolute bottom-4 right-4 flex items-center gap-2">
                                <span className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                                <span className="text-sm font-bold text-red-600 dark:text-red-400 uppercase">{t('recording')}</span>
                            </div>
                        )}
                     </div>
                    
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => handleFileChange(e)}
                        accept=".pdf,.txt,.ppt,.pptx,application/pdf,text/plain,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/*"
                        className="sr-only"
                    />

                    <div className="mt-6 grid grid-cols-3 gap-4">
                        <button
                            type="button"
                            onClick={handleFileImportClick}
                            disabled={isProcessingImage}
                            className="flex items-center justify-center gap-2 px-4 py-3 text-base font-semibold border border-emerald-100 dark:border-zinc-700 rounded-xl text-emerald-700 dark:text-zinc-300 bg-emerald-50/50 dark:bg-zinc-900/20 hover:bg-emerald-100 dark:hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-50"
                        >
                           <UploadIcon className="w-5 h-5"/>
                           <span>{t('file_button')}</span>
                        </button>

                        <button
                            type="button"
                            onClick={toggleRecording}
                            disabled={isProcessingImage}
                            className={`flex items-center justify-center gap-2 px-4 py-3 text-base font-semibold border rounded-xl transition-colors shadow-sm disabled:opacity-50 ${isRecording ? 'border-red-500 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200' : 'border-emerald-100 dark:border-zinc-700 text-emerald-700 dark:text-zinc-300 bg-emerald-50/50 dark:bg-zinc-900/20 hover:bg-emerald-100 dark:hover:bg-zinc-800'}`}
                        >
                           <MicrophoneIcon className={`w-5 h-5 ${isRecording ? 'text-red-600 animate-pulse' : 'text-emerald-600'}`}/>
                           <span>{isRecording ? t('stop_button') : t('dictate_button')}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setIsImportModalOpen(true)}
                            disabled={isProcessingImage}
                            className="flex items-center justify-center gap-2 px-4 py-3 text-base font-semibold border border-emerald-100 dark:border-zinc-700 rounded-xl text-emerald-700 dark:text-zinc-300 bg-emerald-50/50 dark:bg-zinc-900/20 hover:bg-emerald-100 dark:hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-50"
                        >
                           <BookOpenIcon className="w-5 h-5 text-emerald-600"/>
                           <span>{t('school_button')}</span>
                        </button>
                    </div>
                    
                    {isProcessingImage && (
                        <div className="mt-4 flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 animate-pulse bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-lg">
                            <RefreshCwIcon className="w-5 h-5 animate-spin" />
                            <span className="font-semibold">Traitement et compression de l'image en cours...</span>
                        </div>
                    )}

                    {selectedFile && !isProcessingImage && (
                        <div className="mt-4 flex items-center justify-between gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-base shadow-sm animate-fade-in-fast">
                            <span className="text-green-800 dark:text-green-200 pl-1 truncate flex items-center font-medium">
                                {selectedFile.type.startsWith('image/') ? <ImageIcon className="w-5 h-5 mr-3"/> : <UploadIcon className="w-5 h-5 mr-3"/>}
                                {selectedFile.name}
                            </span>
                            <button
                                type="button"
                                onClick={clearFile}
                                className="p-2 rounded-full text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800 transition-colors flex-shrink-0"
                                aria-label="Supprimer le fichier"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || isProcessingImage || (!displayValue.trim() && !selectedFile)}
                        className="w-full mt-8 flex items-center justify-center gap-3 px-8 py-4 border border-transparent text-lg font-bold rounded-2xl shadow-md shadow-emerald-200/50 dark:shadow-none text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.01]"
                    >
                        <SparklesIcon className="w-6 h-6"/>
                        {isLoading ? t('analyzing') : t('generate_button')}
                    </button>
                    
                     {parseError && <p className="text-red-500 mt-4 text-center font-semibold text-base bg-red-50 dark:bg-red-900/20 p-2 rounded">{parseError}</p>}

                </form>
                
                {isImportModalOpen && (
                    <ImportModal 
                        onClose={() => setIsImportModalOpen(false)}
                        onImport={handleSchoolImport}
                    />
                )}
            </div>
            
            {/* ILLUSTRATION EN BAS DE PAGE */}
            <div className="flex justify-center mt-12 opacity-90 relative z-0">
                <LearningIllustration className="w-full max-w-[280px] h-auto" />
            </div>
        </div>
    );
};

export default InputArea;
