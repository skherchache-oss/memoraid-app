
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { CognitiveCapsule, ChatMessage, CoachingMode, UserProfile } from '../types';
import { createCoachingSession } from '../services/geminiService';
import { XIcon, SendIcon, SparklesIcon, MicrophoneIcon, ImageIcon, Volume2Icon } from '../constants';
import type { Chat, GenerateContentResponse } from '@google/genai';
import { GoogleGenAI, Modality } from "@google/genai";
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../hooks/useToast';

// Interfaces for Web Speech API (inchangées)
interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
}

interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: (() => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
    onend: (() => any) | null;
    start(): void;
    stop(): void;
    abort(): void;
}


interface CoachingModalProps {
    capsule: CognitiveCapsule;
    onClose: () => void;
    userProfile: UserProfile;
}

type RecognitionState = 'idle' | 'recording' | 'error';

// Helper functions for audio
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

const CoachingModal: React.FC<CoachingModalProps> = ({ capsule, onClose, userProfile }) => {
    const { language } = useLanguage();
    const { addToast } = useToast();
    const [chatSession, setChatSession] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    // SPLIT STATE for Coach
    const [tempSpeech, setTempSpeech] = useState('');
    
    const [isLoading, setIsLoading] = useState(true);
    const [recognitionState, setRecognitionState] = useState<RecognitionState>('idle');
    const [selectedMode, setSelectedMode] = useState<CoachingMode>('standard');
    const [selectedImage, setSelectedImage] = useState<string | null>(null); // Base64 image for solver

    // Refs for managing speech recognition lifecycle
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const wasLastInputFromSpeech = useRef<boolean>(false);
    
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    // Initialize AudioContext for TTS in Oral Mode
    useEffect(() => {
        if (!audioContextRef.current) {
            try {
                const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                audioContextRef.current = new AudioContext({ sampleRate: 24000 });
            } catch (e) {
                console.error("Web Audio API is not supported.", e);
            }
        }
    }, []);

    // Initialize Chat Session
    const initializeChat = useCallback(async () => {
        setIsLoading(true);
        setMessages([]); // Clear history on mode switch
        try {
            const session = createCoachingSession(capsule, selectedMode, userProfile, language);
            setChatSession(session);
            
            // Initial prompt message depends on mode
            let introMsg = "";
            if (selectedMode === 'solver') introMsg = language === 'fr' ? "Bonjour. Quel exercice ou problème souhaitez-vous résoudre aujourd'hui ? Vous pouvez envoyer une photo." : "Hello. What exercise or problem would you like to solve today? You can upload a photo.";
            else introMsg = ""; // Standard modes prompt AI to start

            const initialResponse: GenerateContentResponse = await session.sendMessage({ message: introMsg });
            const text = initialResponse.text || (language === 'fr' ? "Bonjour, je suis prêt." : "Hello, I am ready.");
            setMessages([{ role: 'model', content: text }]);
            
            // Auto-speak in Oral Mode
            if (selectedMode === 'oral') {
                playTTS(text);
            }

        } catch (error) {
            console.error("Failed to initialize coaching session:", error);
            setMessages([{ role: 'model', content: language === 'fr' ? "Désolé, une erreur est survenue lors du démarrage du coaching." : "Sorry, an error occurred while starting the coaching session." }]);
        } finally {
            setIsLoading(false);
        }
    }, [capsule, selectedMode, userProfile, language]);

    useEffect(() => {
        initializeChat();
        return () => {
            if (recognitionRef.current) recognitionRef.current.abort();
        };
    }, [initializeChat]);

    const playTTS = async (text: string) => {
        if (!process.env.API_KEY || !audioContextRef.current) return;
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
            if (base64Audio) {
                const audioBuffer = await decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContextRef.current.destination);
                source.start();
            }
        } catch (e) {
            console.error("TTS Error", e);
        }
    };

    const cleanTranscription = (text: string): string => {
        return text
            .replace(/\b(euh+|hum+|ben|bah|genre|bref|enfin|um+|uh+|like|you know)\b/gi, '')
            .replace(/\s+/g, ' ')
            .replace(/\s+([.,!?])/g, '$1')
            .trim()
            .replace(/^\w/, c => c.toUpperCase());
    };

    const startRecording = useCallback(() => {
        const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
            addToast("Ce navigateur ne supporte pas la dictée vocale. Utilisez Google Chrome ou Edge.", "error");
            return;
        }
        if (recognitionRef.current) recognitionRef.current.abort();

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language === 'fr' ? 'fr-FR' : 'en-US';

        // 1. Blur
        if (textareaRef.current) textareaRef.current.blur();

        // 2. Reset temp speech
        setTempSpeech('');
        wasLastInputFromSpeech.current = true; 
        
        setRecognitionState('recording');

        recognition.onstart = () => { /* already handled via setRecognitionState */ };
        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; ++i) {
                transcript += event.results[i][0].transcript;
            }
            const cleaned = cleanTranscription(transcript);
            setTempSpeech(cleaned);
        };
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (event.error === 'not-allowed' || event.error === 'permission-denied') {
                addToast("Accès au micro refusé.", "error");
            }
            if (event.error !== 'no-speech') {
                stopRecording();
                setRecognitionState('error');
            }
        };
        recognition.onend = () => {
            if (recognitionState === 'recording') {
                // Auto stop (silence) - update UI
                stopRecording();
            }
        };

        recognitionRef.current = recognition;
        try { 
            recognition.start(); 
        } catch (e) { 
            setRecognitionState('error');
            addToast("Erreur micro.", "error");
        }
    }, [language, addToast, recognitionState]);

    const stopRecording = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setRecognitionState('idle');
        
        // Commit temp speech to main input
        if (tempSpeech) {
            setUserInput(prev => {
                const prefix = prev.trim();
                const suffix = tempSpeech.trim();
                if (!prefix) return suffix;
                return prefix + " " + suffix;
            });
            setTempSpeech('');
        }
    }, [tempSpeech]);

    const handleToggleRecording = () => {
        recognitionState === 'recording' ? stopRecording() : startRecording();
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setSelectedImage(base64String); 
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // If recording, stop and commit before sending
        if (recognitionState === 'recording') {
            stopRecording();
        }

        // Use a small timeout to ensure state update if recording was just stopped
        // Or construct the final string directly
        const finalInput = (userInput + (userInput && tempSpeech ? ' ' : '') + tempSpeech).trim();

        if ((!finalInput && !selectedImage) || !chatSession || isLoading) return;
        
        const userMessage: ChatMessage = { 
            role: 'user', 
            content: finalInput,
            image: selectedImage || undefined
        };
        
        setMessages(prev => [...prev, userMessage]);
        setUserInput('');
        setTempSpeech('');
        setSelectedImage(null);
        setIsLoading(true);

        try {
            // Build message content for Gemini
            let messageParts: any[] = [];
            
            if (userMessage.image) {
                const base64Data = userMessage.image.split(',')[1];
                messageParts.push({
                    inlineData: {
                        mimeType: "image/jpeg",
                        data: base64Data
                    }
                });
            }
            
            if (userMessage.content) {
                messageParts.push({ text: userMessage.content });
            }

            const response = await chatSession.sendMessage({ 
                message: messageParts.length === 1 && messageParts[0].text ? messageParts[0].text : { parts: messageParts }
            } as any);

            const responseText = response.text;
            const modelMessage: ChatMessage = { role: 'model', content: responseText };
            setMessages(prev => [...prev, modelMessage]);

            if (selectedMode === 'oral') {
                playTTS(responseText);
            }

        } catch (error) {
            console.error("Error sending message:", error);
            setMessages(prev => [...prev, { role: 'model', content: language === 'fr' ? "Oups, je n'ai pas pu traiter votre message. Réessayons." : "Oops, I couldn't process your message. Let's try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const isRecording = recognitionState === 'recording';
    const displayValue = isRecording 
        ? (userInput + (userInput && tempSpeech ? ' ' : '') + tempSpeech)
        : userInput;

    const modes: { id: CoachingMode, label: string, icon: any }[] = [
        { id: 'standard', label: language === 'fr' ? 'Coach' : 'Coach', icon: SparklesIcon },
        { id: 'oral', label: language === 'fr' ? 'Entraînement Oral' : 'Oral Training', icon: MicrophoneIcon },
        { id: 'exam', label: language === 'fr' ? 'Examen Blanc' : 'Mock Exam', icon: SendIcon },
        { id: 'solver', label: language === 'fr' ? 'Résolveur' : 'Solver', icon: ImageIcon },
    ];

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col overflow-hidden">
                <header className="flex flex-col border-b border-slate-200 dark:border-zinc-800 flex-shrink-0 bg-white dark:bg-zinc-900 z-10">
                    <div className="flex items-center justify-between p-4 pb-2">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Coach IA</h2>
                            <p className="text-sm text-slate-500 dark:text-zinc-400 truncate max-w-xs">{capsule.title}</p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800">
                            <XIcon className="w-6 h-6 text-slate-500 dark:text-zinc-400" />
                        </button>
                    </div>
                    
                    {/* Mode Selector */}
                    <div className="flex px-4 pb-3 gap-2 overflow-x-auto no-scrollbar">
                        {modes.map(mode => (
                            <button
                                key={mode.id}
                                onClick={() => setSelectedMode(mode.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                                    selectedMode === mode.id 
                                    ? 'bg-blue-600 text-white shadow-md' 
                                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                                }`}
                            >
                                <mode.icon className="w-3 h-3" />
                                {mode.label}
                            </button>
                        ))}
                    </div>
                </header>

                <div className="flex-grow p-4 overflow-y-auto space-y-4 bg-slate-50 dark:bg-zinc-950/30">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                             {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-1"><SparklesIcon className="w-4 h-4 text-white"/></div>}
                            <div className={`max-w-[85%] p-3 rounded-2xl shadow-sm ${
                                msg.role === 'user' 
                                    ? 'bg-blue-600 text-white rounded-br-none' 
                                    : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-bl-none border border-slate-100 dark:border-zinc-700'
                            }`}>
                                {msg.image && (
                                    <img src={msg.image} alt="Upload" className="max-w-full h-auto rounded-lg mb-2 border border-white/20" />
                                )}
                                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex items-start gap-3">
                             <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-4 h-4 text-white"/></div>
                             <div className="p-3 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700">
                                <div className="flex items-center space-x-1.5">
                                    <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-zinc-500 rounded-full animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-zinc-500 rounded-full animate-bounce delay-75"></div>
                                    <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-zinc-500 rounded-full animate-bounce delay-150"></div>
                                </div>
                             </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                
                <footer className="p-3 border-t border-slate-200 dark:border-zinc-800 flex-shrink-0 bg-white dark:bg-zinc-900">
                    {/* Image Preview */}
                    {selectedImage && (
                        <div className="mb-2 flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 p-2 rounded-lg inline-block">
                            <img src={selectedImage} alt="Preview" className="h-12 w-12 object-cover rounded" />
                            <button onClick={() => setSelectedImage(null)} className="p-1 rounded-full bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300">
                                <XIcon className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                        {selectedMode === 'solver' && (
                            <>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    ref={fileInputRef} 
                                    onChange={handleImageUpload} 
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-3 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                    title="Ajouter une image"
                                >
                                    <ImageIcon className="w-5 h-5" />
                                </button>
                            </>
                        )}
                        
                        <div className="flex-grow relative">
                             <textarea
                                ref={textareaRef}
                                value={displayValue}
                                onChange={(e) => {
                                    if (isRecording) return;
                                    setUserInput(e.target.value);
                                    wasLastInputFromSpeech.current = false;
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage(e);
                                    }
                                }}
                                readOnly={isRecording} 
                                placeholder={isRecording ? (language === 'fr' ? "Je vous écoute..." : "I'm listening...") : (language === 'fr' ? "Message..." : "Message...")}
                                className={`w-full pl-4 pr-10 py-3 bg-slate-100 dark:bg-zinc-800 rounded-xl focus:outline-none focus:ring-2 transition-colors resize-none max-h-32 min-h-[48px] ${isRecording ? 'ring-2 ring-red-500 bg-red-50 dark:bg-zinc-900' : 'focus:ring-blue-500'}`}
                                disabled={isLoading}
                                rows={1}
                            />
                             <button
                                type="button"
                                onClick={handleToggleRecording}
                                disabled={isLoading}
                                className={`absolute right-2 bottom-2 p-1.5 rounded-full transition-all duration-200 ${
                                    isRecording 
                                        ? 'text-red-600 animate-pulse' 
                                        : 'text-slate-400 hover:text-blue-500'
                                }`}
                            >
                                <MicrophoneIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <button type="submit" disabled={isLoading || (!displayValue.trim() && !selectedImage)} className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-800 transition-colors shadow-sm">
                            <SendIcon className="w-5 h-5" />
                        </button>
                    </form>
                </footer>
            </div>
        </div>
    );
};

export default CoachingModal;
