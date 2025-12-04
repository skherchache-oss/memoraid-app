
import React, { useState, useRef, useEffect } from 'react';
import type { AppData, UserProfile, CognitiveCapsule, UserLevel, LearningStyle, UserRole } from '../types';
import { XIcon, UserIcon, UploadIcon, DownloadIcon, BookOpenIcon, LayersIcon, BrainIcon, CrownIcon, TrophyIcon, MedalIcon, FlameIcon, ZapIcon, SchoolIcon, InfoIcon, MailIcon, UsersIcon } from '../constants';
import { downloadBlob } from '../services/pdfService';
import { ToastType } from '../hooks/useToast';
import ProgressionDashboard from './ProgressionDashboard';
import { auth } from '../services/firebase';
import { signOut, User } from 'firebase/auth';
import GroupModal from './GroupModal';
import { useLanguage } from '../contexts/LanguageContext';

interface ProfileModalProps {
    profile: AppData;
    onClose: () => void;
    onUpdateProfile: (newProfile: UserProfile) => void;
    onImport: (data: AppData) => void;
    addToast: (message: string, type: ToastType) => void;
    selectedCapsuleIds: string[];
    setSelectedCapsuleIds: React.Dispatch<React.SetStateAction<string[]>>;
    currentUser: User | null;
    onOpenGroupManager: () => void;
    isOpenAsPage?: boolean; // Nouvelle prop pour le mode affichage page vs modal
}

const ProfileModal: React.FC<ProfileModalProps> = ({ profile, onClose, onUpdateProfile, onImport, addToast, selectedCapsuleIds, setSelectedCapsuleIds, currentUser, onOpenGroupManager, isOpenAsPage = false }) => {
    const { t } = useLanguage();
    const [name, setName] = useState(profile.user.name);
    const [email, setEmail] = useState(profile.user.email || '');
    const [level, setLevel] = useState<UserLevel>(profile.user.level || 'intermediate');
    const [role, setRole] = useState<UserRole>(profile.user.role || 'student');
    const [learningStyle, setLearningStyle] = useState<LearningStyle>(profile.user.learningStyle || 'textual');
    const [isPremium, setIsPremium] = useState(profile.user.isPremium || false);
    
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync local state with props when they change from parent
    useEffect(() => {
        setName(profile.user.name);
        setEmail(profile.user.email || '');
        setLevel(profile.user.level || 'intermediate');
        setRole(profile.user.role || 'student');
        setLearningStyle(profile.user.learningStyle || 'textual');
        setIsPremium(profile.user.isPremium || false);
    }, [profile.user]);

    // Check for unsaved changes in form fields
    useEffect(() => {
        const isNameChanged = name.trim() !== profile.user.name;
        const isEmailChanged = email.trim() !== (profile.user.email || '');
        const isLevelChanged = level !== (profile.user.level || 'intermediate');
        const isRoleChanged = role !== (profile.user.role || 'student');
        const isStyleChanged = learningStyle !== (profile.user.learningStyle || 'textual');
        const isPremiumChanged = isPremium !== (profile.user.isPremium || false);
        
        setHasUnsavedChanges(isNameChanged || isEmailChanged || isLevelChanged || isStyleChanged || isPremiumChanged || isRoleChanged);
    }, [name, email, level, learningStyle, isPremium, role, profile.user]);

    const handleClose = () => {
        if (hasUnsavedChanges) {
            if (window.confirm(t('unsaved_changes'))) {
                handleSaveChanges();
                onClose();
            } else {
                onClose();
            }
        } else {
            onClose();
        }
    };

    const handleSaveChanges = () => {
        onUpdateProfile({
            ...profile.user,
            name: name.trim(),
            email: email.trim(),
            role,
            level,
            learningStyle,
            isPremium
        });
        // Toast handled by parent or app
    };

    const handleExport = () => {
        if (profile.capsules.length === 0) {
            addToast(t('empty_base'), 'info'); // Reused empty_base which makes sense or add another key
            return;
        }
        const dataStr = JSON.stringify(profile, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const exportFileDefaultName = `memoraid-backup-${new Date().toISOString().slice(0,10)}.json`;
        downloadBlob(blob, exportFileDefaultName);
        addToast(t('export_success'), 'success');
    };

    const handleExportSelection = () => {
        if (selectedCapsuleIds.length === 0) {
            addToast(t('no_selection_export'), 'info');
            return;
        }
        const selectedCapsules = profile.capsules.filter(c => selectedCapsuleIds.includes(c.id));
        
        const dataStr = JSON.stringify(selectedCapsules, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const exportFileDefaultName = `memoraid-selection-${new Date().toISOString().slice(0,10)}.json`;
        downloadBlob(blob, exportFileDefaultName);
        addToast(t('export_select_success').replace('{count}', selectedCapsules.length.toString()), 'success');
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const fileInput = event.target;
        const file = fileInput.files?.[0];
    
        if (!file) return;
    
        const reader = new FileReader();
    
        reader.onload = (e) => {
            fileInput.value = '';
            try {
                const text = e.target?.result;
                if (typeof text !== 'string' || text.trim() === '') {
                    addToast(t('import_error_empty'), 'error');
                    return;
                }
                
                const importedData = JSON.parse(text);
                
                const isValidProfile = typeof importedData === 'object' && importedData !== null &&
                    'user' in importedData && typeof importedData.user === 'object' && 'name' in importedData.user &&
                    'capsules' in importedData && Array.isArray(importedData.capsules);

                if (isValidProfile) {
                   if (window.confirm(t('confirm_import_override'))) {
                        onImport(importedData);
                   }
                } else {
                    addToast(t('import_error_invalid'), 'error');
                }
            } catch (err) {
                console.error("Import error:", err);
                addToast(t('import_error_invalid'), 'error');
            }
        };
    
        reader.onerror = () => {
            fileInput.value = '';
            addToast(`Error: ${reader.error?.message || 'Unknown'}`, 'error');
        };
    
        reader.readAsText(file);
    };
    
    const handleSendEmail = () => {
        if (selectedCapsuleIds.length === 0) {
            addToast(t('select_at_least_one'), 'info');
            return;
        }

        const selectedCapsules = profile.capsules.filter(c => selectedCapsuleIds.includes(c.id));
        
        const subjectKey = selectedCapsules.length === 1 ? 'email_subject_single' : 'email_subject_plural';
        const subject = t(subjectKey)
            .replace('{title}', selectedCapsules[0]?.title)
            .replace('{count}', selectedCapsules.length.toString());

        const body = selectedCapsules.map(capsule => {
            const concepts = capsule.keyConcepts.map(c => `- ${c.concept}: ${c.explanation}`).join('\n');
            const examples = capsule.examples.map(e => `- ${e}`).join('\n');
            return `
----------------------------------
${t('email_body_capsule')} : ${capsule.title}
----------------------------------

${t('email_body_summary')} :
${capsule.summary}

${t('email_body_concepts')} :
${concepts}

${t('email_body_examples')} :
${examples}
            `.trim();
        }).join('\n\n');

        const mailtoLink = `mailto:${email.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        window.location.href = mailtoLink;
    };

    const handleCapsuleSelectionChange = (capsuleId: string) => {
        setSelectedCapsuleIds(prev =>
            prev.includes(capsuleId)
                ? prev.filter(id => id !== capsuleId)
                : [...prev, capsuleId]
        );
    };
    
    const handleSignOut = async () => {
        if (auth) {
            await signOut(auth);
            addToast(t('logout_success'), "info");
            if (!isOpenAsPage) onClose();
        }
    };

    const content = (
        <div className={`bg-white dark:bg-zinc-900 flex flex-col ${isOpenAsPage ? 'h-full rounded-none shadow-none bg-transparent border-none' : 'rounded-2xl shadow-2xl w-full max-w-2xl h-[90vh] max-h-[90vh]'}`} onClick={e => e.stopPropagation()}>
            <header className={`flex items-center justify-between p-6 border-b border-slate-200 dark:border-zinc-800 flex-shrink-0 ${isOpenAsPage ? 'pt-0 px-0' : ''}`}>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('my_space')}</h2>
                {!isOpenAsPage && (
                    <button onClick={handleClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800">
                        <XIcon className="w-6 h-6 text-slate-500" />
                    </button>
                )}
            </header>

            <div className={`space-y-8 overflow-y-auto flex-grow ${isOpenAsPage ? 'py-6 px-0' : 'p-6'}`}>
                
                {/* GAMIFICATION / TROPHIES */}
                {profile.user.gamification && (
                    <section>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
                            <TrophyIcon className="w-5 h-5 text-yellow-500" />
                            {t('trophy_room')}
                        </h3>
                        <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200 dark:border-zinc-700">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-bold">
                                        {t('level')} {profile.user.gamification.level}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {profile.user.gamification.xp} XP
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 text-orange-500">
                                    <FlameIcon className="w-4 h-4" />
                                    <span className="font-bold text-sm">{profile.user.gamification.currentStreak} jours</span>
                                </div>
                            </div>

                            {/* MESSAGE 0 XP */}
                            {profile.user.gamification.xp === 0 && (
                                <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-lg text-center animate-fade-in">
                                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200 mb-1">
                                        {t('xp_start_title')}
                                    </p>
                                    <p className="text-xs text-emerald-600 dark:text-emerald-300">
                                        {t('xp_start_desc')}
                                    </p>
                                </div>
                            )}
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                                {profile.user.gamification.badges.map(badge => (
                                    <div key={badge.id} className="flex flex-col items-center text-center p-2 bg-white dark:bg-zinc-800 rounded-lg border border-yellow-200 dark:border-yellow-900/30 shadow-sm">
                                        <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-2 text-yellow-600 dark:text-yellow-500">
                                            {badge.icon === 'seed' && <BookOpenIcon className="w-5 h-5"/>}
                                            {badge.icon === 'flask' && <BrainIcon className="w-5 h-5"/>}
                                            {badge.icon === 'trophy' && <TrophyIcon className="w-5 h-5"/>}
                                            {badge.icon === 'flame' && <FlameIcon className="w-5 h-5"/>}
                                            {badge.icon === 'fire' && <ZapIcon className="w-5 h-5"/>}
                                            {badge.icon === 'users' && <UsersIcon className="w-5 h-5"/>}
                                        </div>
                                        <p className="font-bold text-xs text-slate-700 dark:text-zinc-200">{badge.name}</p>
                                        <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 leading-tight">{badge.description}</p>
                                    </div>
                                ))}
                                {profile.user.gamification.badges.length === 0 && (
                                    <div className="col-span-4 text-center py-2 text-slate-400 text-sm italic">
                                        Continuez à apprendre pour débloquer des badges !
                                    </div>
                                )}
                            </div>

                            {/* GUIDE XP PERMANENT */}
                            <div className="border-t border-slate-200 dark:border-zinc-700 pt-4">
                                <h4 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <InfoIcon className="w-3 h-3" /> 
                                    {t('xp_guide_title')}
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                    <div className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded border border-slate-100 dark:border-zinc-800">
                                        <span className="text-slate-600 dark:text-zinc-400">{t('xp_rule_create')}</span>
                                        <span className="font-bold text-green-600 dark:text-green-400">+100 XP</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded border border-slate-100 dark:border-zinc-800">
                                        <span className="text-slate-600 dark:text-zinc-400">{t('xp_rule_quiz')}</span>
                                        <span className="font-bold text-blue-600 dark:text-blue-400">+50 XP</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded border border-slate-100 dark:border-zinc-800">
                                        <span className="text-slate-600 dark:text-zinc-400">{t('xp_rule_flashcard')}</span>
                                        <span className="font-bold text-amber-600 dark:text-amber-400">+20 XP</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded border border-slate-100 dark:border-zinc-800">
                                        <span className="text-slate-600 dark:text-zinc-400">{t('xp_rule_social')}</span>
                                        <span className="font-bold text-purple-600 dark:text-purple-400">+50 XP</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* MODULE DE PROGRESSION - ANALYTICS */}
                <section>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-4">{t('analytics_title')}</h3>
                    <ProgressionDashboard capsules={profile.capsules} />
                </section>

                <hr className="border-slate-200 dark:border-zinc-800" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <h3 className="text-md font-semibold text-slate-700 dark:text-zinc-200">{t('personal_info')}</h3>
                        {currentUser ? (
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800/50 space-y-3">
                                <div>
                                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{t('connected_account')} ({role === 'teacher' ? t('role_teacher') : t('role_student')})</p>
                                    <p className="text-sm text-slate-600 dark:text-zinc-300 mt-1">{currentUser.email}</p>
                                </div>
                                
                                <button
                                    onClick={onOpenGroupManager}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-800 rounded-md text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors"
                                >
                                    <UsersIcon className="w-4 h-4" />
                                    {role === 'teacher' ? t('my_classes') : t('my_groups')}
                                </button>

                                <button 
                                    onClick={handleSignOut}
                                    className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline block"
                                >
                                    {t('logout')}
                                </button>
                            </div>
                        ) : (
                            <div>
                                <p className="text-sm text-slate-500 dark:text-zinc-400 mb-2">{t('guest_account')}</p>
                                <label htmlFor="username" className="text-sm font-medium text-slate-500 dark:text-zinc-400">{t('username')}</label>
                                <div className="relative mt-1">
                                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                                    <input 
                                        id="username"
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold text-slate-800 dark:text-white"
                                        placeholder={t('username_placeholder')}
                                    />
                                </div>
                            </div>
                        )}
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">{t('account_type')}</label>
                            <div className="flex p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg">
                                <button
                                    onClick={() => setRole('student')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                                        role === 'student' 
                                        ? 'bg-white dark:bg-zinc-600 shadow text-emerald-600 dark:text-white' 
                                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700'
                                    }`}
                                >
                                    {t('role_student')}
                                </button>
                                <button
                                    onClick={() => setRole('teacher')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                                        role === 'teacher' 
                                        ? 'bg-white dark:bg-zinc-600 shadow text-emerald-600 dark:text-white' 
                                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700'
                                    }`}
                                >
                                    {t('role_teacher')}
                                </button>
                            </div>
                        </div>
                        
                        <div>
                            <label htmlFor="user-email" className="text-sm font-medium text-slate-500 dark:text-zinc-400">{t('email_label')}</label>
                                <div className="relative mt-1">
                                <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                                <input 
                                    id="user-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 dark:text-white"
                                    placeholder={t('email_placeholder')}
                                />
                            </div>
                        </div>
                        
                        {/* PREMIUM TOGGLE SIMULATION */}
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CrownIcon className="w-5 h-5 text-amber-600" />
                                    <span className="font-bold text-amber-800 dark:text-amber-200">{t('premium_status')}</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-500"></div>
                                </label>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                                {t('premium_desc')}
                            </p>
                        </div>
                    </div>

                    {/* PREFERENCES PEDAGOGIQUES */}
                        <div className="space-y-4">
                        <h3 className="text-md font-semibold text-slate-700 dark:text-zinc-200 flex items-center gap-2">
                            <BrainIcon className="w-4 h-4" /> {t('pedagogy_prefs')}
                        </h3>
                            <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-slate-200 dark:border-zinc-700 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">{t('knowledge_level')}</label>
                                <select
                                    value={level}
                                    onChange={(e) => setLevel(e.target.value as UserLevel)}
                                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-600 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="beginner">{t('level_beginner')}</option>
                                    <option value="intermediate">{t('level_intermediate')}</option>
                                    <option value="advanced">{t('level_advanced')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">{t('learning_style')}</label>
                                <select
                                    value={learningStyle}
                                    onChange={(e) => setLearningStyle(e.target.value as LearningStyle)}
                                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-600 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="textual">{t('style_textual')}</option>
                                    <option value="visual">{t('style_visual')}</option>
                                    <option value="auditory">{t('style_auditory')}</option>
                                    <option value="kinesthetic">{t('style_kinesthetic')}</option>
                                </select>
                            </div>
                            </div>
                        </div>
                    
                    {/* ACTIONS */}
                    <div className="space-y-4">
                        <h3 className="text-md font-semibold text-slate-700 dark:text-zinc-200">{t('actions_data')}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="application/json"
                                className="sr-only"
                            />
                            <button 
                                onClick={handleImportClick} 
                                className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 dark:border-zinc-700 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium text-slate-700 dark:text-zinc-200"
                            >
                                <UploadIcon className="w-4 h-4" />
                                {t('import')}
                            </button>
                            <button 
                                onClick={handleExport} 
                                className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 dark:border-zinc-700 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium text-slate-700 dark:text-zinc-200"
                            >
                                <DownloadIcon className="w-4 h-4" />
                                {t('export_all')}
                            </button>
                            <button 
                                onClick={handleExportSelection} 
                                disabled={selectedCapsuleIds.length === 0}
                                className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 dark:border-zinc-700 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium text-slate-700 dark:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <LayersIcon className="w-4 h-4" />
                                {t('export_select')}
                            </button>
                            <button 
                                onClick={handleSendEmail} 
                                disabled={selectedCapsuleIds.length === 0}
                                className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 dark:border-zinc-700 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium text-slate-700 dark:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <MailIcon className="w-4 h-4" />
                                {t('send_email')}
                            </button>
                        </div>
                    </div>
                    
                        {/* LISTE CAPSULES */}
                        <div className="col-span-1 md:col-span-2 space-y-2">
                        <h3 className="text-md font-semibold text-slate-700 dark:text-zinc-200">{t('select_capsules')}</h3>
                        <div className="h-32 overflow-y-auto space-y-2 p-2 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-slate-200 dark:border-zinc-700">
                            {profile.capsules.length > 0 ? (
                                profile.capsules.map(capsule => (
                                    <div key={capsule.id} className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id={`capsule-select-${capsule.id}`}
                                            checked={selectedCapsuleIds.includes(capsule.id)}
                                            onChange={() => handleCapsuleSelectionChange(capsule.id)}
                                            className="w-4 h-4 rounded border-slate-300 dark:border-zinc-600 text-emerald-600 focus:ring-emerald-500 bg-white dark:bg-zinc-700 dark:checked:bg-emerald-500"
                                        />
                                        <label htmlFor={`capsule-select-${capsule.id}`} className="ml-2 text-sm text-slate-700 dark:text-zinc-300 truncate cursor-pointer">
                                            {capsule.title}
                                        </label>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-slate-500 dark:text-zinc-400 text-center py-4">{t('no_capsules_select')}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <footer className={`p-4 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-200 dark:border-zinc-800 flex-shrink-0 flex gap-3 ${isOpenAsPage ? 'mb-20 rounded-b-none' : ''}`}>
                    <button onClick={handleSaveChanges} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors font-semibold">
                    {t('save')}
                </button>
                {!isOpenAsPage && (
                    <button onClick={onClose} className="px-4 py-2 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700 rounded-md hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors font-semibold">
                        {t('close')}
                    </button>
                )}
            </footer>
        </div>
    );

    // Si mode "Page" (Mobile Tab), on retourne le contenu directement sans overlay
    if (isOpenAsPage) {
        return content;
    }

    // Sinon mode "Modal" (Desktop ou action spécifique), on retourne avec l'overlay
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={handleClose}>
            {content}
        </div>
    );
};

export default ProfileModal;
