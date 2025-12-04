
import React, { useState, useMemo } from 'react';
import type { Group, CognitiveCapsule } from '../types';
import { SchoolIcon, UsersIcon, ClipboardListIcon, XIcon, BookOpenIcon, DownloadIcon, RefreshCwIcon, CheckCircleIcon, AlertCircleIcon } from '../constants';
import { downloadBlob, generateFilename } from '../services/pdfService';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface TeacherDashboardProps {
    onClose: () => void;
    teacherGroups: Group[];
    allGroupCapsules: CognitiveCapsule[];
    onAssignTask: (groupId: string, capsule: CognitiveCapsule) => void;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onClose, teacherGroups, allGroupCapsules, onAssignTask }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'classes' | 'assignments'>('overview');
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(teacherGroups[0]?.id || null);
    const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const selectedGroup = teacherGroups.find(g => g.id === selectedGroupId);
    
    // Capsules belonging to the selected group
    const classCapsules = useMemo(() => 
        allGroupCapsules.filter(c => c.groupId === selectedGroupId), 
    [allGroupCapsules, selectedGroupId]);

    // Calculate stats
    const stats = useMemo(() => {
        if (!selectedGroup) return null;
        
        const totalStudents = selectedGroup.members.filter(m => m.role !== 'owner').length;
        const totalCapsules = classCapsules.length;
        
        let totalMasterySum = 0;
        let recordedScores = 0;
        
        classCapsules.forEach(cap => {
            cap.groupProgress?.forEach(prog => {
                totalMasterySum += prog.masteryScore;
                recordedScores++;
            });
        });
        
        const averageMastery = recordedScores > 0 ? Math.round(totalMasterySum / recordedScores) : 0;

        return { totalStudents, totalCapsules, averageMastery };
    }, [selectedGroup, classCapsules]);

    const handleExportReport = async () => {
        if (!selectedGroup) return;
        setExportStatus('loading');
        
        try {
            const doc = await PDFDocument.create();
            const font = await doc.embedFont(StandardFonts.Helvetica);
            const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
            let page = doc.addPage();
            let y = page.getHeight() - 50;

            const addBrandingToDoc = (page: any, width: number, height: number) => {
                page.drawText('MEMORAID', {
                    x: width - 80,
                    y: height - 30,
                    size: 10,
                    font: fontBold,
                    color: rgb(0.06, 0.73, 0.5), // Emerald-500
                });
            };
            addBrandingToDoc(page, page.getWidth(), page.getHeight());

            // Title
            page.drawText(`Rapport de Classe : ${selectedGroup.name}`, { x: 50, y, size: 20, font: fontBold });
            y -= 30;
            page.drawText(`Date : ${new Date().toLocaleDateString()}`, { x: 50, y, size: 12, font });
            y -= 40;

            // Table Header
            page.drawText("Étudiant", { x: 50, y, size: 12, font: fontBold });
            page.drawText("Moyenne", { x: 200, y, size: 12, font: fontBold });
            page.drawText("Dernière activité", { x: 300, y, size: 12, font: fontBold });
            y -= 20;
            page.drawLine({ start: { x: 50, y }, end: { x: 500, y }, thickness: 1, color: rgb(0, 0, 0) });
            y -= 20;

            // Students
            const students = selectedGroup.members.filter(m => m.role !== 'owner');
            
            for (const student of students) {
                let studentTotal = 0;
                let studentCount = 0;
                let lastActive = 0;

                classCapsules.forEach(cap => {
                    const prog = cap.groupProgress?.find(p => p.userId === student.userId);
                    if (prog) {
                        studentTotal += prog.masteryScore;
                        studentCount++;
                        if (prog.lastReviewed > lastActive) lastActive = prog.lastReviewed;
                    }
                });

                const avg = studentCount > 0 ? Math.round(studentTotal / studentCount) : 0;
                const lastActiveDate = lastActive > 0 ? new Date(lastActive).toLocaleDateString() : '-';

                if (y < 50) {
                    page = doc.addPage();
                    addBrandingToDoc(page, page.getWidth(), page.getHeight());
                    y = page.getHeight() - 50;
                }

                page.drawText(student.name, { x: 50, y, size: 10, font });
                page.drawText(`${avg}%`, { x: 200, y, size: 10, font });
                page.drawText(lastActiveDate, { x: 300, y, size: 10, font });
                y -= 20;
            }

            const pdfBytes = await doc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            downloadBlob(blob, generateFilename('Rapport', selectedGroup.name, 'pdf'));
            
            setExportStatus('success');
            setTimeout(() => setExportStatus('idle'), 2000);

        } catch (e) {
            console.error(e);
            setExportStatus('error');
            setTimeout(() => setExportStatus('idle'), 3000);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 p-6 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                            <SchoolIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Espace Enseignant</h2>
                            <p className="text-sm text-slate-500 dark:text-zinc-400">Gestion de classe & Suivi</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <XIcon className="w-6 h-6 text-slate-500 dark:text-zinc-400" />
                    </button>
                </header>

                {/* Layout */}
                <div className="flex flex-grow overflow-hidden">
                    {/* Sidebar */}
                    <aside className="w-64 bg-emerald-50/30 dark:bg-zinc-950 border-r border-slate-100 dark:border-zinc-800 flex flex-col">
                        <div className="p-4">
                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2 block">Sélectionner une classe</label>
                            <select 
                                className="w-full p-2 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={selectedGroupId || ''}
                                onChange={(e) => setSelectedGroupId(e.target.value)}
                            >
                                {teacherGroups.length > 0 ? teacherGroups.map(g => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                )) : <option value="">Aucune classe</option>}
                            </select>
                        </div>
                        <nav className="flex-grow p-2 space-y-1">
                            <button 
                                onClick={() => setActiveTab('overview')}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${activeTab === 'overview' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 shadow-sm hover:shadow'}`}
                            >
                                <SchoolIcon className="w-5 h-5" /> Vue d'ensemble
                            </button>
                            <button 
                                onClick={() => setActiveTab('classes')}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${activeTab === 'classes' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 shadow-sm hover:shadow'}`}
                            >
                                <UsersIcon className="w-5 h-5" /> Étudiants
                            </button>
                            <button 
                                onClick={() => setActiveTab('assignments')}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${activeTab === 'assignments' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 shadow-sm hover:shadow'}`}
                            >
                                <ClipboardListIcon className="w-5 h-5" /> Devoirs & Capsules
                            </button>
                        </nav>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-grow p-8 overflow-y-auto bg-white dark:bg-zinc-900">
                        {!selectedGroup ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <SchoolIcon className="w-16 h-16 mb-4 opacity-20" />
                                <p>Sélectionnez ou créez une classe pour commencer.</p>
                                {teacherGroups.length === 0 && <p className="text-sm mt-2 text-center">Créez un groupe dans votre Profil ou la section "Groupes" pour l'utiliser comme classe.</p>}
                            </div>
                        ) : (
                            <>
                                {activeTab === 'overview' && (
                                    <div className="space-y-6">
                                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Tableau de bord : {selectedGroup.name}</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="p-6 bg-white dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700 shadow-sm">
                                                <p className="text-sm text-slate-500 dark:text-zinc-400 font-semibold uppercase">Étudiants</p>
                                                <div className="flex items-end justify-between mt-2">
                                                    <p className="text-4xl font-bold text-slate-800 dark:text-white">{stats?.totalStudents}</p>
                                                    <UsersIcon className="w-8 h-8 text-blue-200 dark:text-blue-900" />
                                                </div>
                                            </div>
                                            <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800 shadow-sm">
                                                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold uppercase">Moyenne Classe</p>
                                                <div className="flex items-end justify-between mt-2">
                                                    <p className="text-4xl font-bold text-emerald-700 dark:text-emerald-400">{stats?.averageMastery}%</p>
                                                    <SchoolIcon className="w-8 h-8 text-emerald-200 dark:text-emerald-900" />
                                                </div>
                                            </div>
                                            <div className="p-6 bg-white dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700 shadow-sm">
                                                <p className="text-sm text-slate-500 dark:text-zinc-400 font-semibold uppercase">Capsules Partagées</p>
                                                <div className="flex items-end justify-between mt-2">
                                                    <p className="text-4xl font-bold text-slate-800 dark:text-white">{stats?.totalCapsules}</p>
                                                    <BookOpenIcon className="w-8 h-8 text-purple-200 dark:text-purple-900" />
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-end mt-8">
                                            <button 
                                                onClick={handleExportReport}
                                                disabled={exportStatus !== 'idle'}
                                                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold shadow-lg shadow-emerald-200/50 dark:shadow-none transition-all duration-300 ${
                                                    exportStatus === 'error' ? 'bg-red-500 hover:bg-red-600' :
                                                    exportStatus === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' :
                                                    'bg-emerald-600 hover:bg-emerald-700'
                                                }`}
                                            >
                                                {exportStatus === 'loading' ? (
                                                    <RefreshCwIcon className="w-5 h-5 animate-spin" />
                                                ) : exportStatus === 'success' ? (
                                                    <CheckCircleIcon className="w-5 h-5" />
                                                ) : exportStatus === 'error' ? (
                                                    <AlertCircleIcon className="w-5 h-5" />
                                                ) : (
                                                    <DownloadIcon className="w-5 h-5" />
                                                )}
                                                {exportStatus === 'loading' ? 'Génération...' :
                                                 exportStatus === 'success' ? 'Rapport Téléchargé' :
                                                 exportStatus === 'error' ? 'Erreur Export' :
                                                 'Exporter le rapport PDF'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'classes' && (
                                    <div>
                                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Liste des étudiants</h3>
                                        <div className="bg-white dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-2xl overflow-hidden shadow-sm">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-50 dark:bg-zinc-900/50 text-slate-500 dark:text-zinc-400 text-xs uppercase font-bold tracking-wider">
                                                    <tr>
                                                        <th className="p-5">Nom</th>
                                                        <th className="p-5">Rôle</th>
                                                        <th className="p-5 text-right">Progression</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50 dark:divide-zinc-700">
                                                    {selectedGroup.members.length > 0 ? selectedGroup.members.map(member => (
                                                        <tr key={member.userId} className="hover:bg-slate-50 dark:hover:bg-zinc-700/30 transition-colors">
                                                            <td className="p-5 font-medium text-slate-700 dark:text-zinc-200 flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-sm font-bold">
                                                                    {member.name.charAt(0)}
                                                                </div>
                                                                {member.name}
                                                            </td>
                                                            <td className="p-5 text-sm text-slate-500">
                                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${member.role === 'owner' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300'}`}>
                                                                    {member.role === 'owner' ? 'Enseignant' : 'Étudiant'}
                                                                </span>
                                                            </td>
                                                            <td className="p-5 text-right text-sm text-slate-600 dark:text-zinc-300">
                                                                -
                                                            </td>
                                                        </tr>
                                                    )) : (
                                                        <tr>
                                                            <td colSpan={3} className="p-8 text-center text-slate-400 italic">Aucun étudiant dans cette classe.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'assignments' && (
                                    <div>
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-2xl font-bold text-slate-800 dark:text-white">Capsules de cours</h3>
                                        </div>
                                        <div className="space-y-4">
                                            {classCapsules.length > 0 ? (
                                                classCapsules.map(capsule => (
                                                    <div key={capsule.id} className="flex items-center justify-between p-5 bg-white dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow">
                                                        <div className="flex items-center gap-4">
                                                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
                                                                <BookOpenIcon className="w-6 h-6" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-slate-800 dark:text-white text-lg">{capsule.title}</h4>
                                                                <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">{capsule.keyConcepts.length} concepts • {capsule.quiz.length} questions</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-6">
                                                            <div className="text-right">
                                                                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Taux de complétion</p>
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <div className="w-24 h-2 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                                        <div 
                                                                            className="h-full bg-emerald-500 rounded-full"
                                                                            style={{ width: `${capsule.groupProgress ? Math.round((capsule.groupProgress.length / (selectedGroup.members.length - 1 || 1)) * 100) : 0}%` }}
                                                                        ></div>
                                                                    </div>
                                                                    <p className="font-bold text-emerald-600 dark:text-emerald-400">
                                                                        {capsule.groupProgress ? Math.round((capsule.groupProgress.length / (selectedGroup.members.length - 1 || 1)) * 100) : 0}%
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-12 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-700">
                                                    <p className="text-slate-400 italic">Aucune capsule partagée dans cette classe.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
};

export default TeacherDashboard;
