
import React, { useState } from 'react';
import { XIcon, UserIcon, SparklesIcon, ZapIcon } from '../constants';
import type { Group } from '../types';
import { createGroup, joinGroup } from '../services/cloudService';
import { ToastType } from '../hooks/useToast';

interface GroupModalProps {
    onClose: () => void;
    userId: string;
    userName: string;
    userGroups: Group[];
    addToast: (message: string, type: ToastType) => void;
}

const GroupModal: React.FC<GroupModalProps> = ({ onClose, userId, userName, userGroups, addToast }) => {
    const [mode, setMode] = useState<'list' | 'create' | 'join'>('list');
    const [newGroupName, setNewGroupName] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;
        setIsLoading(true);
        try {
            await createGroup(userId, userName, newGroupName);
            addToast("Groupe créé avec succès !", "success");
            setMode('list');
            setNewGroupName('');
        } catch (error) {
            console.error(error);
            addToast("Erreur lors de la création du groupe", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoinGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteCode.trim()) return;
        setIsLoading(true);
        try {
            await joinGroup(userId, userName, inviteCode.toUpperCase());
            addToast("Groupe rejoint avec succès !", "success");
            setMode('list');
            setInviteCode('');
        } catch (error) {
            console.error(error);
            // @ts-ignore
            addToast(error.message || "Erreur lors de l'adhésion", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleChallenge = (groupId: string) => {
        // Simuler l'envoi d'une notification de défi (dans une vraie app, cela passerait par le cloud)
        addToast("Défi lancé au groupe ! Tous les membres ont été notifiés.", "success");
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-zinc-800">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Mes Groupes</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800">
                        <XIcon className="w-6 h-6 text-slate-500" />
                    </button>
                </header>

                <div className="p-4 flex-grow overflow-y-auto min-h-[300px]">
                    {mode === 'list' && (
                        <div className="space-y-4">
                            {userGroups.length > 0 ? (
                                <ul className="space-y-3">
                                    {userGroups.map(group => (
                                        <li key={group.id} className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-slate-200 dark:border-zinc-700">
                                            <div className="flex justify-between items-center mb-1">
                                                <h3 className="font-bold text-slate-800 dark:text-white">{group.name}</h3>
                                                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full font-mono">
                                                    {group.inviteCode}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center mt-2">
                                                <p className="text-xs text-slate-500 dark:text-zinc-400">{group.members.length} membre(s)</p>
                                                <button 
                                                    onClick={() => handleChallenge(group.id)}
                                                    className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors"
                                                >
                                                    <ZapIcon className="w-3 h-3" />
                                                    Lancer un défi
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-center py-8 text-slate-500 dark:text-zinc-400">
                                    <UserIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>Vous n'êtes membre d'aucun groupe.</p>
                                </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-3 pt-4">
                                <button 
                                    onClick={() => setMode('create')}
                                    className="p-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Créer un groupe
                                </button>
                                <button 
                                    onClick={() => setMode('join')}
                                    className="p-3 text-sm font-semibold text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    Rejoindre
                                </button>
                            </div>
                        </div>
                    )}

                    {mode === 'create' && (
                        <form onSubmit={handleCreateGroup} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Nom du groupe</label>
                                <input
                                    type="text"
                                    value={newGroupName}
                                    onChange={e => setNewGroupName(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Ex: Classe de Bio 2024"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setMode('list')} className="flex-1 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg">Annuler</button>
                                <button type="submit" disabled={isLoading || !newGroupName} className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg disabled:opacity-50">Créer</button>
                            </div>
                        </form>
                    )}

                    {mode === 'join' && (
                        <form onSubmit={handleJoinGroup} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Code d'invitation</label>
                                <input
                                    type="text"
                                    value={inviteCode}
                                    onChange={e => setInviteCode(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono uppercase"
                                    placeholder="Ex: X8Y2Z1"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setMode('list')} className="flex-1 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg">Annuler</button>
                                <button type="submit" disabled={isLoading || !inviteCode} className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg disabled:opacity-50">Rejoindre</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GroupModal;
