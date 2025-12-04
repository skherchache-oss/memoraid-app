
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { CognitiveCapsule, AppData, UserProfile, QuizQuestion, ReviewLog, Group, StudyPlan, MemberProgress, PremiumPack, Badge, SourceType } from './types';
import Header from './components/Header';
import InputArea from './components/InputArea';
import CapsuleView from './components/CapsuleView';
import KnowledgeBase from './components/KnowledgeBase';
import CoachingModal from './components/CoachingModal';
import FlashcardModal from './components/FlashcardModal';
import ProfileModal from './components/ProfileModal';
import AuthModal from './components/AuthModal';
import ActiveLearningModal from './components/ActiveLearningModal';
import GroupModal from './components/GroupModal';
import PlanningWizard from './components/PlanningWizard';
import AgendaView from './components/AgendaView';
import PremiumStore from './components/PremiumStore';
import MobileNavBar from './components/MobileNavBar';
import TeacherDashboard from './components/TeacherDashboard';
import { generateCognitiveCapsule, generateCognitiveCapsuleFromFile } from './services/geminiService';
import { isCapsuleDue, analyzeGlobalPerformance, calculateMasteryScore } from './services/srsService';
import { updateTaskStatus } from './services/planningService';
import { processGamificationAction, getInitialGamificationStats } from './services/gamificationService';
import { useTheme } from './hooks/useTheme';
import { ToastProvider, useToast } from './hooks/useToast';
import { StopIcon, CalendarIcon, ShoppingBagIcon, SchoolIcon } from './constants';
import { auth } from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { saveCapsuleToCloud, deleteCapsuleFromCloud, subscribeToCapsules, migrateLocalDataToCloud, subscribeToUserGroups, subscribeToGroupCapsules, shareCapsuleToGroup, updateGroupCapsule, updateSharedCapsuleProgress } from './services/cloudService';
import { useLanguage } from './contexts/LanguageContext';
import { translations } from './i18n/translations';

type View = 'create' | 'base' | 'agenda' | 'store' | 'profile';
type MobileTab = 'create' | 'library' | 'agenda' | 'store' | 'profile';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            if (result.includes(',')) {
                resolve(result.split(',')[1]);
            } else {
                resolve(result);
            }
        };
        reader.onerror = error => reject(error);
    });
};

const AppContent: React.FC = () => {
    const { theme } = useTheme();
    const { language, t } = useLanguage();
    const [view, setView] = useState<View>('create');
    const [mobileTab, setMobileTab] = useState<MobileTab>('create');
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isAuthInitializing, setIsAuthInitializing] = useState(true);

    const [profile, setProfile] = useState<AppData>(() => {
        try {
            const savedProfile = localStorage.getItem('memoraid_profile');
            if (savedProfile) {
                const parsedProfile = JSON.parse(savedProfile);
                if (parsedProfile.user && typeof parsedProfile.user.email === 'undefined') {
                    parsedProfile.user.email = '';
                }
                if (!parsedProfile.user.gamification) {
                    parsedProfile.user.gamification = getInitialGamificationStats();
                }
                if (!parsedProfile.user.role) {
                    parsedProfile.user.role = 'student';
                }
                return parsedProfile;
            }
            const savedCapsules = localStorage.getItem('memoraid_capsules');
            if (savedCapsules) {
                const capsules = JSON.parse(savedCapsules);
                const newProfileData = {
                    user: { name: translations.fr.default_username, email: '', role: 'student', gamification: getInitialGamificationStats() },
                    capsules: capsules
                };
                localStorage.setItem('memoraid_profile', JSON.stringify(newProfileData));
                localStorage.removeItem('memoraid_capsules');
                return newProfileData;
            }
        } catch (e) {
            console.error("Could not load data from localStorage", e);
        }

        return {
            user: { name: translations.fr.default_username, email: '', role: 'student', gamification: getInitialGamificationStats() },
            capsules: []
        };
    });
    
    const [activeCapsule, setActiveCapsule] = useState<CognitiveCapsule | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isCoaching, setIsCoaching] = useState<boolean>(false);
    const [isFlashcardMode, setIsFlashcardMode] = useState<boolean>(false);
    const [isActiveLearning, setIsActiveLearning] = useState<boolean>(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState<boolean>(false);
    const [isPlanningWizardOpen, setIsPlanningWizardOpen] = useState<boolean>(false);
    const [isTeacherDashboardOpen, setIsTeacherDashboardOpen] = useState<boolean>(false);
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => Notification.permission);
    const [newlyAddedCapsuleId, setNewlyAddedCapsuleId] = useState<string | null>(null);
    const [selectedCapsuleIds, setSelectedCapsuleIds] = useState<string[]>([]);
    
    const [userGroups, setUserGroups] = useState<Group[]>([]);
    const [groupCapsules, setGroupCapsules] = useState<CognitiveCapsule[]>([]);

    const mainContentRef = useRef<HTMLDivElement>(null);
    const { addToast } = useToast();
    const generationController = useRef({ isCancelled: false });

    useEffect(() => {
        const currentName = profile.user.name;
        const frDefault = translations.fr.default_username;
        const enDefault = translations.en.default_username;

        if (language === 'en' && currentName === frDefault) {
             setProfile(prev => ({ ...prev, user: { ...prev.user, name: enDefault } }));
        } else if (language === 'fr' && currentName === enDefault) {
             setProfile(prev => ({ ...prev, user: { ...prev.user, name: frDefault } }));
        }
    }, [language, profile.user.name]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            addToast(t('connection_restored'), "success");
        };
        const handleOffline = () => {
            setIsOnline(false);
            addToast(t('offline_mode'), "info");
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [addToast, t]);

    useEffect(() => {
        if (!auth) return;
        
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            setIsAuthInitializing(false);

            if (user) {
                setProfile(prev => ({
                    ...prev,
                    user: { 
                        ...prev.user,
                        name: user.displayName || prev.user.name, 
                        email: user.email || prev.user.email,
                        role: prev.user.role || 'student',
                        gamification: prev.user.gamification || getInitialGamificationStats()
                    }
                }));

                try {
                    const localCapsules = profile.capsules;
                    if (localCapsules.length > 0) {
                        if (navigator.onLine) {
                            addToast("Synchronisation de vos capsules vers le cloud...", "info");
                            await migrateLocalDataToCloud(user.uid, localCapsules);
                        }
                    }
                } catch (e) {
                    console.error("Migration error", e);
                }
            } else {
                const savedProfile = localStorage.getItem('memoraid_profile');
                if (savedProfile) {
                    setProfile(JSON.parse(savedProfile));
                } else {
                    setProfile({ user: { name: t('default_username'), email: '', role: 'student', gamification: getInitialGamificationStats() }, capsules: [] });
                }
                setActiveCapsule(null);
                setUserGroups([]);
                setGroupCapsules([]);
                setView('create');
                setMobileTab('create');
            }
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        let unsubscribeSync = () => {};

        if (currentUser) {
            unsubscribeSync = subscribeToCapsules(currentUser.uid, (cloudCapsules) => {
                setProfile(prev => ({ ...prev, capsules: cloudCapsules }));
                
                setActiveCapsule(currentActive => {
                    if (!currentActive) return null;
                    const updated = cloudCapsules.find(c => c.id === currentActive.id);
                    return updated || currentActive;
                });
            });
        }

        return () => unsubscribeSync();
    }, [currentUser]);
    
    useEffect(() => {
        let unsubscribeGroups = () => {};

        if (currentUser) {
            unsubscribeGroups = subscribeToUserGroups(currentUser.uid, (groups) => {
                setUserGroups(groups);
            });
        }

        return () => unsubscribeGroups();
    }, [currentUser]);

    useEffect(() => {
        const unsubscribers: (() => void)[] = [];
        
        if (currentUser && userGroups.length > 0) {
            setGroupCapsules([]);
            
            userGroups.forEach(group => {
                const unsub = subscribeToGroupCapsules(group.id, (capsules) => {
                    setGroupCapsules(prev => {
                        const others = prev.filter(c => c.groupId !== group.id);
                        return [...others, ...capsules];
                    });

                    setActiveCapsule(currentActive => {
                        if (!currentActive || !currentActive.groupId) return currentActive;
                        if (currentActive.groupId === group.id) {
                            const updated = capsules.find(c => c.id === currentActive.id);
                            return updated || currentActive;
                        }
                        return currentActive;
                    });
                });
                unsubscribers.push(unsub);
            });
        }

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [currentUser, userGroups]);

    useEffect(() => {
        if (!currentUser) {
            try {
                localStorage.setItem('memoraid_profile', JSON.stringify(profile));
            } catch (e) {
                console.error("Could not save profile to localStorage", e);
            }
        }
    }, [profile, currentUser]);

    const displayCapsules = useMemo(() => {
        return [...profile.capsules, ...groupCapsules].sort((a, b) => b.createdAt - a.createdAt);
    }, [profile.capsules, groupCapsules]);

    const saveCapsuleData = async (capsule: CognitiveCapsule) => {
        if (currentUser) {
            try {
                await saveCapsuleToCloud(currentUser.uid, capsule);
                if (!isOnline) {
                    addToast("Sauvegardé hors ligne. Synchro en attente.", "info");
                }
            } catch (e) {
                addToast(t('error_save'), "error");
            }
        } else {
            setProfile(prev => {
                const exists = prev.capsules.some(c => c.id === capsule.id);
                const updatedCapsules = exists 
                    ? prev.capsules.map(c => c.id === capsule.id ? capsule : c)
                    : [capsule, ...prev.capsules];
                return { ...prev, capsules: updatedCapsules };
            });
        }
    };

    const handleGamificationAction = (action: 'create' | 'quiz' | 'flashcard' | 'join_group' | 'challenge', quizScore?: number) => {
        const currentGamification = profile.user.gamification || getInitialGamificationStats();
        const { stats, newBadges, levelUp } = processGamificationAction(
            currentGamification, 
            action, 
            displayCapsules.length,
            quizScore
        );

        setProfile(prev => ({
            ...prev,
            user: { ...prev.user, gamification: stats }
        }));

        if (levelUp) {
            addToast(`Niveau Supérieur ! Vous êtes maintenant Niveau ${stats.level} !`, 'success');
        }
        if (newBadges.length > 0) {
            newBadges.forEach(b => addToast(`Badge Débloqué : ${b.name}`, 'success'));
        }
    };
    
    const handlePlanCreated = (plan: StudyPlan) => {
        setProfile(prev => ({
            ...prev,
            user: { ...prev.user, activePlan: plan }
        }));
        setIsPlanningWizardOpen(false);
        setView('agenda');
        setMobileTab('agenda');
        addToast(t('plan_generated'), 'success');
    };

    const handleUpdatePlanTask = (date: string, capsuleId: string, status: 'completed' | 'pending') => {
        if (!profile.user.activePlan) return;
        const updatedPlan = updateTaskStatus(profile.user.activePlan, date, capsuleId, status);
        setProfile(prev => ({
            ...prev,
            user: { ...prev.user, activePlan: updatedPlan }
        }));
    };

    const handleDeletePlan = () => {
        if (window.confirm("Voulez-vous vraiment supprimer votre planning actuel ?")) {
             setProfile(prev => ({
                ...prev,
                user: { ...prev.user, activePlan: undefined }
            }));
            setView('base');
            setMobileTab('create');
            addToast(t('plan_deleted'), 'info');
        }
    };

    const handleUnlockPack = async (pack: PremiumPack) => {
        try {
            const newUnlockedIds = [...(profile.user.unlockedPackIds || []), pack.id];
            
            setProfile(prev => ({
                ...prev,
                user: { ...prev.user, unlockedPackIds: newUnlockedIds }
            }));

            for (const cap of pack.capsules) {
                const newCap: CognitiveCapsule = {
                    ...cap,
                    id: `${cap.id}_${Date.now()}`,
                    isPremiumContent: true,
                    originalPackId: pack.id,
                    createdAt: Date.now(),
                    lastReviewed: null,
                    reviewStage: 0
                };
                await saveCapsuleData(newCap);
            }

            addToast(t('pack_added'), 'success');
            
            setTimeout(() => {
                setView('base');
                setMobileTab('library');
                setNewlyAddedCapsuleId(pack.capsules[0]?.id || null);
            }, 1000);

        } catch (e) {
            console.error(e);
            addToast("Erreur lors de l'ajout du pack.", 'error');
        }
    };

    const handleClearError = useCallback(() => {
        setError(null);
    }, []);

    const handleCancelGeneration = useCallback(() => {
        generationController.current.isCancelled = true;
        setIsLoading(false);
        addToast(t('generation_cancelled'), 'info');
    }, [addToast, t]);

    const handleGoHome = useCallback(() => {
        setView('create');
        setMobileTab('create');
        setActiveCapsule(null);
        setIsProfileModalOpen(false);
        setIsCoaching(false);
        setIsFlashcardMode(false);
    }, []);

    const handleGenerate = useCallback(async (inputText: string, sourceType?: SourceType) => {
        if (!isOnline) {
            setError("La génération par IA nécessite une connexion Internet.");
            return;
        }
        generationController.current.isCancelled = false;
        setIsLoading(true);
        setError(null);
        setActiveCapsule(null);
        try {
            const capsuleData = await generateCognitiveCapsule(inputText, sourceType, language);
            if (generationController.current.isCancelled) return;
            
            const uniqueId = `cap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const newCapsule: CognitiveCapsule = {
                ...capsuleData,
                id: uniqueId,
                createdAt: Date.now(),
                lastReviewed: null,
                reviewStage: 0,
                history: [],
                masteryLevel: 0
            };

            await saveCapsuleData(newCapsule);
            handleGamificationAction('create');
            
            setActiveCapsule(newCapsule);
            setNewlyAddedCapsuleId(newCapsule.id);
            setView('base');
            setMobileTab('library');
            addToast(t('capsule_created'), 'success');
        } catch (e) {
            if (generationController.current.isCancelled) return;
            setError(e instanceof Error ? e.message : 'Une erreur inconnue est survenue.');
        } finally {
            if (!generationController.current.isCancelled) {
                setIsLoading(false);
            }
        }
    }, [addToast, currentUser, profile, isOnline, language, t]); 
    
    const handleGenerateFromFile = useCallback(async (file: File, sourceType?: SourceType) => {
        if (!isOnline) {
            setError("L'analyse de fichiers nécessite une connexion Internet.");
            return;
        }
        generationController.current.isCancelled = false;
        setIsLoading(true);
        setError(null);
        setActiveCapsule(null);
        try {
            const base64Data = await fileToBase64(file);
            
            let mimeType = file.type;
            const extension = file.name.split('.').pop()?.toLowerCase();
            
            if (extension === 'pdf') mimeType = 'application/pdf';
            else if (extension === 'txt') mimeType = 'text/plain';
            else if (extension === 'ppt') mimeType = 'application/vnd.ms-powerpoint';
            else if (extension === 'pptx') mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

            if (!mimeType) mimeType = 'application/octet-stream';

            const fileData = { mimeType, data: base64Data };
            const capsuleData = await generateCognitiveCapsuleFromFile(fileData, sourceType, language);
            if (generationController.current.isCancelled) return;

            const uniqueId = `cap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const newCapsule: CognitiveCapsule = {
                ...capsuleData,
                id: uniqueId,
                createdAt: Date.now(),
                lastReviewed: null,
                reviewStage: 0,
                history: [],
                masteryLevel: 0
            };

            await saveCapsuleData(newCapsule);
            handleGamificationAction('create');

            setActiveCapsule(newCapsule);
            setNewlyAddedCapsuleId(newCapsule.id);
            setView('base');
            setMobileTab('library');
             addToast(t('capsule_created'), 'success');
        } catch (e) {
            if (generationController.current.isCancelled) return;
            setError(e instanceof Error ? e.message : 'Une erreur inconnue est survenue.');
        } finally {
            if (!generationController.current.isCancelled) {
                setIsLoading(false);
            }
        }
    }, [addToast, currentUser, profile, isOnline, language, t]);

    const handleSelectCapsule = useCallback((capsule: CognitiveCapsule) => {
        setActiveCapsule(capsule);
        setView('base');
        setMobileTab('library');
        setSelectedCapsuleIds([]);
        window.scrollTo(0, 0);
    }, []);
    
    const handleStartCoaching = () => {
        if (!isOnline) {
            addToast(t('coach_needs_online'), "error");
            return;
        }
        if (activeCapsule) setIsCoaching(true);
    };
    
    const handleStartFlashcards = () => {
        if (activeCapsule) setIsFlashcardMode(true);
    };
    
    const handleStartActiveLearning = () => {
        if (activeCapsule) setIsActiveLearning(true);
    };

    const handleImportProfile = (importedData: AppData) => {
        if (currentUser) {
            if (window.confirm("Vous êtes en mode Cloud. L'importation va ajouter ces capsules à votre compte. Continuer ?")) {
                 migrateLocalDataToCloud(currentUser.uid, importedData.capsules);
                 addToast("Importation vers le cloud lancée...", "info");
            }
        } else {
            setProfile(importedData);
            setActiveCapsule(null);
            setView('create');
            setMobileTab('create');
            addToast(`${importedData.capsules.length} capsule(s) importée(s) avec succès !`, 'success');
        }
        setIsProfileModalOpen(false);
    };

    const handleUpdateProfile = (newProfile: UserProfile) => {
        setProfile(prev => ({ ...prev, user: newProfile }));
        addToast(t('profile_updated'), 'success');
    };

    const handleSetCapsuleCategory = useCallback((capsuleId: string, category: string) => {
        const normalizedCategory = category.trim();
        const capsule = displayCapsules.find(c => c.id === capsuleId);
        if (capsule) {
            const updatedCapsule = { ...capsule, category: normalizedCategory || undefined };
            saveCapsuleData(updatedCapsule);
            setActiveCapsule(prev => prev && prev.id === capsuleId ? updatedCapsule : prev);
            addToast(t('category_updated'), 'info');
        }
    }, [addToast, displayCapsules, currentUser, isOnline, t]);

    const handleDeleteCapsule = useCallback(async (capsuleId: string) => {
        const capsule = displayCapsules.find(c => c.id === capsuleId);
        const capsuleTitle = capsule?.title || 'La capsule';
        
        if (currentUser) {
            try {
                await deleteCapsuleFromCloud(currentUser.uid, capsuleId);
            } catch(e) {
                addToast("Erreur lors de la suppression.", "error");
                return;
            }
        } else {
            setProfile(prev => ({
                ...prev,
                capsules: prev.capsules.filter(c => c.id !== capsuleId)
            }));
        }

        setSelectedCapsuleIds(prev => prev.filter(id => id !== capsuleId));
        if (activeCapsule?.id === capsuleId) {
            setActiveCapsule(null);
            setView('base');
        }
        addToast(`"${capsuleTitle}" ${t('capsule_deleted')}`, 'info');
    }, [activeCapsule?.id, displayCapsules, addToast, currentUser, t]);

    const handleMarkAsReviewed = useCallback((capsuleId: string, score: number = 100, type: ReviewLog['type'] = 'manual') => {
        const now = Date.now();
        const capsule = displayCapsules.find(c => c.id === capsuleId);
        
        if (capsule) {
            const newHistory: ReviewLog[] = [
                ...(capsule.history || []),
                { date: now, score, type }
            ];
            
            const updatedCapsule = {
                ...capsule,
                lastReviewed: now,
                reviewStage: capsule.reviewStage + 1,
                history: newHistory
            };
            
            saveCapsuleData(updatedCapsule);
            
            if (type === 'quiz' || type === 'flashcard') {
                handleGamificationAction(type, score);
            }

            if (capsule.isShared && currentUser && capsule.groupId) {
                const mastery = calculateMasteryScore(updatedCapsule);
                const progress: MemberProgress = {
                    userId: currentUser.uid,
                    userName: profile.user.name,
                    lastReviewed: now,
                    masteryScore: mastery
                };
                updateSharedCapsuleProgress(capsule.groupId, capsule.id, progress, capsule.groupProgress);
            }

            setActiveCapsule(prev => {
                 if (!prev || prev.id !== capsuleId) return prev;
                 return updatedCapsule;
            });
        }
    }, [displayCapsules, currentUser, isOnline, profile.user.name, profile.user.gamification]);

    const handleSetCapsuleMemoryAid = useCallback((capsuleId: string, imageData: string | null, description: string | null) => {
        const capsule = displayCapsules.find(c => c.id === capsuleId);
        if (capsule) {
            const updatedCapsule = { 
                ...capsule, 
                memoryAidImage: imageData || undefined,
                memoryAidDescription: description || undefined
            };
            saveCapsuleData(updatedCapsule);
            setActiveCapsule(prev => prev && prev.id === capsuleId ? updatedCapsule : prev);
        }
    }, [displayCapsules, currentUser, isOnline]);
    
    const handleUpdateCapsuleQuiz = useCallback((capsuleId: string, newQuiz: QuizQuestion[]) => {
        const capsule = displayCapsules.find(c => c.id === capsuleId);
        if (capsule) {
            const updatedCapsule = { ...capsule, quiz: newQuiz };
            saveCapsuleData(updatedCapsule);
            setActiveCapsule(prev => prev && prev.id === capsuleId ? updatedCapsule : prev);
        }
    }, [displayCapsules, currentUser, isOnline]);
    
    const handleShareCapsule = async (group: Group, capsule: CognitiveCapsule) => {
        if (!currentUser) return;
        if (!isOnline) {
            addToast("Le partage nécessite une connexion Internet.", "error");
            return;
        }
        try {
            await shareCapsuleToGroup(currentUser.uid, group, capsule);
            addToast("Capsule partagée avec le groupe.", "success");
        } catch (e) {
            console.error(e);
            addToast("Erreur lors du partage.", "error");
        }
    };

    const handleAssignTask = (groupId: string, capsule: CognitiveCapsule) => {
        if (!currentUser) return;
        handleShareCapsule(userGroups.find(g => g.id === groupId)!, capsule);
    };

    const handleRequestNotificationPermission = useCallback(async () => {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
        }
    }, []);
    
    const handleNewCapsule = useCallback(() => {
        setActiveCapsule(null);
        setView('create');
        setMobileTab('create');
        setSelectedCapsuleIds([]);
        setTimeout(() => {
            mainContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }, []);

    useEffect(() => {
        if (notificationPermission !== 'granted') return;
        const intervalId = setInterval(() => {
            const stats = analyzeGlobalPerformance(displayCapsules);
            const dueCapsules = displayCapsules.filter(isCapsuleDue);
            if (dueCapsules.length === 0) return;
            
            const notifiedCapsuleIds: string[] = JSON.parse(localStorage.getItem('memoraid_notified_capsules') || '[]');
            const capsuleToNotify = dueCapsules.find(c => !notifiedCapsuleIds.includes(c.id));
            
            if (capsuleToNotify) {
                const isCritical = stats.overdueCount > 0 && isCapsuleDue(capsuleToNotify);
                
                const notification = new Notification(isCritical ? '⚠️ Risque d\'oubli critique !' : 'Memoraid: Il est temps de réviser !', {
                    body: isCritical 
                        ? `Votre mémorisation de "${capsuleToNotify.title}" est en baisse. Révisez maintenant.` 
                        : `"${capsuleToNotify.title}" vous attend pour renforcer vos connaissances.`,
                    icon: '/vite.svg',
                    tag: capsuleToNotify.id,
                });
                notification.onclick = () => {
                    handleSelectCapsule(capsuleToNotify);
                    window.parent.focus();
                };
                localStorage.setItem('memoraid_notified_capsules', JSON.stringify([...notifiedCapsuleIds, capsuleToNotify.id]));
            }
        }, 60000);
        return () => clearInterval(intervalId);
    }, [notificationPermission, handleSelectCapsule, displayCapsules]);
    

    const allCategories = useMemo(() => {
        const categories = displayCapsules.map(c => c.category).filter((c): c is string => !!c);
        return [...new Set(categories)].sort((a: string, b: string) => a.localeCompare(b));
    }, [displayCapsules]);
    
    const loadingIndicator = (
        <div className="w-full h-96 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-emerald-100 dark:border-zinc-800 animate-fade-in-fast">
            <div className="loader ease-linear rounded-full border-4 border-t-4 border-slate-200 h-12 w-12 mb-4 animate-spin border-t-emerald-500"></div>
            <h2 className="text-xl font-semibold text-slate-700 dark:text-zinc-300">{t('loading_title')}</h2>
            <p className="text-slate-500 dark:text-zinc-400">{t('loading_desc')}</p>
            <button
                onClick={handleCancelGeneration}
                className="mt-6 p-2 rounded-full text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                aria-label="Arrêter la génération"
            >
                <StopIcon className="w-5 h-5" />
            </button>
        </div>
    );
    
    const handleOpenCapsuleFromAgenda = (id: string) => {
        const cap = displayCapsules.find(c => c.id === id);
        if(cap) {
            handleSelectCapsule(cap);
        }
    }

    const handleMobileTabChange = (tab: MobileTab) => {
        setMobileTab(tab);
        if (tab === 'create') setView('create');
        if (tab === 'library') {
            setView('base');
        }
        if (tab === 'agenda') setView('agenda');
        if (tab === 'store') setView('store');
        if (tab === 'profile') {
            setView('profile');
            setIsProfileModalOpen(false);
        }
    };

    const handleOpenStore = useCallback(() => {
        setView('store');
        setMobileTab('store');
    }, []);

    const renderMobileContent = () => {
        if (mobileTab === 'create') {
            return (
                <div className="space-y-6 pb-20">
                    {isLoading ? loadingIndicator : (
                        <InputArea 
                            onGenerate={handleGenerate} 
                            onGenerateFromFile={handleGenerateFromFile} 
                            isLoading={isLoading} 
                            error={error} 
                            onClearError={handleClearError}
                        />
                    )}
                    {!isLoading && !activeCapsule && (
                        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-emerald-100 dark:border-zinc-800">
                            <h3 className="font-bold text-lg mb-2 text-slate-800 dark:text-white">{t('recent_activity')}</h3>
                            {displayCapsules.length > 0 ? (
                                <p className="text-sm text-slate-600 dark:text-zinc-400">{t('recent_activity_desc').replace('{count}', displayCapsules.length.toString())}</p>
                            ) : (
                                <p className="text-sm text-slate-500 italic">{t('start_creating')}</p>
                            )}
                        </div>
                    )}
                </div>
            );
        }

        if (mobileTab === 'library') {
            if (activeCapsule) {
                return (
                    <div className="pb-20">
                        <CapsuleView 
                            capsule={activeCapsule}
                            allCapsules={displayCapsules}
                            selectedCapsuleIds={selectedCapsuleIds}
                            onStartCoaching={handleStartCoaching}
                            onStartFlashcards={handleStartFlashcards}
                            onStartActiveLearning={handleStartActiveLearning}
                            onMarkAsReviewed={handleMarkAsReviewed}
                            onSetCategory={handleSetCapsuleCategory}
                            allCategories={allCategories}
                            onSetMemoryAid={handleSetCapsuleMemoryAid}
                            onUpdateQuiz={handleUpdateCapsuleQuiz}
                            onBackToList={() => setActiveCapsule(null)}
                            addToast={addToast}
                            userGroups={userGroups}
                            onShareCapsule={handleShareCapsule}
                            currentUserId={currentUser?.uid}
                            currentUserName={profile.user.name}
                            isPremium={profile.user.isPremium}
                        />
                    </div>
                );
            }
            return (
                <div className="pb-20 h-full">
                    <KnowledgeBase 
                        capsules={displayCapsules} 
                        activeCapsuleId={activeCapsule?.id}
                        onSelectCapsule={handleSelectCapsule}
                        onNewCapsule={() => setMobileTab('create')}
                        notificationPermission={notificationPermission}
                        onRequestNotificationPermission={handleRequestNotificationPermission}
                        onDeleteCapsule={handleDeleteCapsule}
                        newlyAddedCapsuleId={newlyAddedCapsuleId}
                        onClearNewCapsule={() => setNewlyAddedCapsuleId(null)}
                        selectedCapsuleIds={selectedCapsuleIds}
                        setSelectedCapsuleIds={setSelectedCapsuleIds}
                        onOpenStore={handleOpenStore}
                    />
                </div>
            );
        }

        if (mobileTab === 'agenda') {
            if (profile.user.activePlan) {
                return <div className="pb-20 h-full"><AgendaView plan={profile.user.activePlan} onUpdateTask={handleUpdatePlanTask} onDeletePlan={handleDeletePlan} onOpenCapsule={handleOpenCapsuleFromAgenda} /></div>;
            }
            return (
                <div className="pb-20 p-6 flex flex-col items-center justify-center h-full text-center">
                    <CalendarIcon className="w-16 h-16 text-slate-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-700 dark:text-white">{t('no_planning')}</h3>
                    <p className="text-slate-500 dark:text-zinc-400 mb-6">{t('create_program')}</p>
                    <button 
                        onClick={() => setIsPlanningWizardOpen(true)}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg"
                    >
                        {t('create_planning_btn')}
                    </button>
                </div>
            );
        }

        if (mobileTab === 'store') {
            return (
                <div className="pb-20">
                    <PremiumStore 
                        onUnlockPack={handleUnlockPack}
                        unlockedPackIds={profile.user.unlockedPackIds || []}
                        isPremiumUser={!!profile.user.isPremium}
                    />
                </div>
            );
        }

        if (mobileTab === 'profile') {
            return (
                <div className="pb-20 h-full">
                    <ProfileModal
                        profile={profile}
                        onClose={() => setMobileTab('create')}
                        onUpdateProfile={handleUpdateProfile}
                        onImport={handleImportProfile}
                        addToast={addToast}
                        selectedCapsuleIds={selectedCapsuleIds}
                        setSelectedCapsuleIds={setSelectedCapsuleIds}
                        currentUser={currentUser}
                        onOpenGroupManager={() => setIsGroupModalOpen(true)}
                        isOpenAsPage={true}
                    />
                </div>
            );
        }
        
        return null;
    };

    return (
        <div className="relative min-h-screen bg-gray-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-200">
            <div className="sticky top-0 z-40">
                <Header
                    onOpenProfile={() => setIsProfileModalOpen(true)}
                    onLogin={() => setIsAuthModalOpen(true)}
                    currentUser={currentUser}
                    isOnline={isOnline}
                    gamification={profile.user.gamification}
                    addToast={addToast}
                    onLogoClick={handleGoHome}
                />
            </div>

            <main className="container mx-auto max-w-screen-2xl p-4 md:p-8 md:block hidden">
                {view === 'store' ? (
                    <div className="relative">
                        <button 
                            onClick={() => setView('base')}
                            className="fixed bottom-6 right-6 z-50 px-6 py-3 bg-slate-800 text-white rounded-full shadow-lg hover:bg-slate-700 transition-colors font-bold flex items-center gap-2"
                        >
                            {t('back_list')}
                        </button>
                        <PremiumStore 
                            onUnlockPack={handleUnlockPack}
                            unlockedPackIds={profile.user.unlockedPackIds || []}
                            isPremiumUser={!!profile.user.isPremium}
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-8 items-start">
                        <div ref={mainContentRef} className="col-span-2 space-y-8">
                            {profile.user.role === 'teacher' && (
                                <div className="p-4 bg-emerald-700 rounded-xl shadow-lg flex justify-between items-center text-white animate-fade-in-fast">
                                    <div className="flex items-center gap-3">
                                        <SchoolIcon className="w-8 h-8" />
                                        <div>
                                            <h3 className="font-bold text-lg">{t('teacher_mode_active')}</h3>
                                            <p className="text-emerald-200 text-sm">{t('teacher_mode_desc')}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setIsTeacherDashboardOpen(true)}
                                        className="px-4 py-2 bg-white text-emerald-700 font-bold rounded-lg hover:bg-emerald-50 transition-colors"
                                    >
                                        {t('open_dashboard')}
                                    </button>
                                </div>
                            )}

                            {view === 'create' && !activeCapsule && (
                                <div>
                                    {isLoading ? loadingIndicator : (
                                        <InputArea 
                                            onGenerate={handleGenerate} 
                                            onGenerateFromFile={handleGenerateFromFile} 
                                            isLoading={isLoading} 
                                            error={error} 
                                            onClearError={handleClearError}
                                        />
                                    )}
                                </div>
                            )}
                            {view === 'agenda' && profile.user.activePlan && (
                                <AgendaView 
                                    plan={profile.user.activePlan}
                                    onUpdateTask={handleUpdatePlanTask}
                                    onDeletePlan={handleDeletePlan}
                                    onOpenCapsule={handleOpenCapsuleFromAgenda}
                                />
                            )}
                            {activeCapsule && (
                                <CapsuleView 
                                    capsule={activeCapsule}
                                    allCapsules={displayCapsules}
                                    selectedCapsuleIds={selectedCapsuleIds}
                                    onStartCoaching={handleStartCoaching}
                                    onStartFlashcards={handleStartFlashcards}
                                    onStartActiveLearning={handleStartActiveLearning}
                                    onMarkAsReviewed={handleMarkAsReviewed}
                                    onSetCategory={handleSetCapsuleCategory}
                                    allCategories={allCategories}
                                    onSetMemoryAid={handleSetCapsuleMemoryAid}
                                    onUpdateQuiz={handleUpdateCapsuleQuiz}
                                    onBackToList={handleNewCapsule}
                                    addToast={addToast}
                                    userGroups={userGroups}
                                    onShareCapsule={handleShareCapsule}
                                    currentUserId={currentUser?.uid}
                                    currentUserName={profile.user.name}
                                    isPremium={profile.user.isPremium}
                                />
                            )}
                        </div>
                        <aside className="col-span-1 sticky top-24 space-y-8">
                            <div className="space-y-2">
                                <button 
                                    onClick={() => profile.user.activePlan ? setView('agenda') : setIsPlanningWizardOpen(true)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-semibold shadow-sm"
                                >
                                    <CalendarIcon className="w-5 h-5" />
                                    {profile.user.activePlan ? t('my_revision_agenda') : t('generate_planning_btn')}
                                </button>
                            </div>
                            <KnowledgeBase 
                                capsules={displayCapsules} 
                                activeCapsuleId={activeCapsule?.id}
                                onSelectCapsule={handleSelectCapsule}
                                onNewCapsule={handleNewCapsule}
                                notificationPermission={notificationPermission}
                                onRequestNotificationPermission={handleRequestNotificationPermission}
                                onDeleteCapsule={handleDeleteCapsule}
                                newlyAddedCapsuleId={newlyAddedCapsuleId}
                                onClearNewCapsule={() => setNewlyAddedCapsuleId(null)}
                                selectedCapsuleIds={selectedCapsuleIds}
                                setSelectedCapsuleIds={setSelectedCapsuleIds}
                                onOpenStore={handleOpenStore}
                            />
                        </aside>
                    </div>
                )}
            </main>

            <div className="md:hidden p-4 min-h-[calc(100vh-64px)]">
                {profile.user.role === 'teacher' && mobileTab === 'create' && (
                    <div className="mb-6 p-4 bg-emerald-700 rounded-xl shadow-lg text-white">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold flex items-center gap-2"><SchoolIcon className="w-5 h-5"/> {t('teacher_mode_active')}</h3>
                        </div>
                        <button 
                            onClick={() => setIsTeacherDashboardOpen(true)}
                            className="w-full py-2 bg-white text-emerald-700 font-bold rounded-lg text-sm"
                        >
                            {t('manage_class')}
                        </button>
                    </div>
                )}
                {renderMobileContent()}
            </div>

            <MobileNavBar 
                activeTab={mobileTab} 
                onTabChange={handleMobileTabChange}
                hasActivePlan={!!profile.user.activePlan}
            />

            {isCoaching && activeCapsule && (
                <CoachingModal 
                    capsule={activeCapsule} 
                    onClose={() => setIsCoaching(false)} 
                    userProfile={profile.user}
                />
            )}
            {isFlashcardMode && activeCapsule && (
                <FlashcardModal
                    capsule={activeCapsule}
                    onClose={() => { 
                        setIsFlashcardMode(false); 
                        handleMarkAsReviewed(activeCapsule.id, 100, 'flashcard'); 
                    }}
                    addToast={addToast}
                />
            )}
            {isActiveLearning && activeCapsule && (
                <ActiveLearningModal
                    capsule={activeCapsule}
                    onClose={() => { 
                        setIsActiveLearning(false); 
                        handleMarkAsReviewed(activeCapsule.id, 100, 'active-learning'); 
                    }}
                />
            )}
            {isProfileModalOpen && (
                <ProfileModal
                    profile={profile}
                    onClose={() => setIsProfileModalOpen(false)}
                    onUpdateProfile={handleUpdateProfile}
                    onImport={handleImportProfile}
                    addToast={addToast}
                    selectedCapsuleIds={selectedCapsuleIds}
                    setSelectedCapsuleIds={setSelectedCapsuleIds}
                    currentUser={currentUser}
                    onOpenGroupManager={() => setIsGroupModalOpen(true)}
                />
            )}
            {isGroupModalOpen && currentUser && (
                <GroupModal 
                    onClose={() => setIsGroupModalOpen(false)}
                    userId={currentUser.uid}
                    userName={profile.user.name}
                    userGroups={userGroups}
                    addToast={addToast}
                />
            )}
            {isAuthModalOpen && (
                <AuthModal 
                    onClose={() => setIsAuthModalOpen(false)} 
                    addToast={addToast}
                />
            )}
            {isPlanningWizardOpen && (
                <PlanningWizard 
                    capsules={displayCapsules}
                    onClose={() => setIsPlanningWizardOpen(false)}
                    onPlanCreated={handlePlanCreated}
                />
            )}
            {isTeacherDashboardOpen && (
                <TeacherDashboard 
                    onClose={() => setIsTeacherDashboardOpen(false)}
                    teacherGroups={userGroups.filter(g => g.ownerId === currentUser?.uid)}
                    allGroupCapsules={groupCapsules}
                    onAssignTask={handleAssignTask}
                />
            )}
        </div>
    );
};

const App: React.FC = () => (
    <ToastProvider>
        <AppContent />
    </ToastProvider>
);

export default App;
