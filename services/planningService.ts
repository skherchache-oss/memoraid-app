
import type { CognitiveCapsule, DailySession, StudyPlan, StudyTask } from '../types';
import { calculateMasteryScore } from './srsService';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Estime le temps nécessaire (en minutes) pour étudier une capsule
 * basé sur sa complexité (longueur du contenu) et la maîtrise actuelle.
 */
const estimateStudyTime = (capsule: CognitiveCapsule): number => {
    let baseTime = 15; // Temps de base minimal
    
    // Ajout basé sur la quantité de contenu
    baseTime += capsule.keyConcepts.length * 3; 
    if (capsule.flashcards) baseTime += capsule.flashcards.length * 1;
    if (capsule.quiz) baseTime += capsule.quiz.length * 2;

    // Ajustement selon la maîtrise : moins on maîtrise, plus il faut de temps
    const mastery = calculateMasteryScore(capsule);
    const masteryFactor = 1 + ((100 - mastery) / 100); // Facteur de 1.0 à 2.0

    return Math.round(baseTime * masteryFactor);
};

/**
 * Génère un plan d'étude distribué jusqu'à la date d'examen.
 */
export const generateStudyPlan = (
    planName: string,
    capsules: CognitiveCapsule[],
    examDate: number,
    dailyMinutesAvailable: number
): StudyPlan => {
    const now = Date.now();
    const daysUntilExam = Math.ceil((examDate - now) / ONE_DAY_MS);

    if (daysUntilExam <= 0) {
        throw new Error("La date d'examen doit être dans le futur.");
    }

    const schedule: DailySession[] = [];
    
    // 1. Préparer la liste de toutes les tâches nécessaires
    // Pour chaque capsule, on prévoit au moins une session de révision complète + quiz
    let allTasks: StudyTask[] = capsules.map(capsule => {
        const estimatedTime = estimateStudyTime(capsule);
        return {
            capsuleId: capsule.id,
            title: capsule.title,
            estimatedMinutes: estimatedTime,
            status: 'pending',
            type: 'review'
        };
    });

    // Trier les tâches : Priorité à celles avec le moins de maîtrise
    allTasks.sort((a, b) => {
        const capA = capsules.find(c => c.id === a.capsuleId)!;
        const capB = capsules.find(c => c.id === b.capsuleId)!;
        return calculateMasteryScore(capA) - calculateMasteryScore(capB);
    });

    // 2. Distribuer les tâches sur les jours disponibles
    let currentTaskIndex = 0;

    for (let i = 0; i < daysUntilExam; i++) {
        const currentDate = new Date(now + (i * ONE_DAY_MS)).toISOString().split('T')[0];
        const dailyTasks: StudyTask[] = [];
        let dailyTimeUsed = 0;

        // Remplir la journée tant qu'il y a de la place et des tâches
        while (currentTaskIndex < allTasks.length) {
            const task = allTasks[currentTaskIndex];
            
            if (dailyTimeUsed + task.estimatedMinutes <= dailyMinutesAvailable) {
                dailyTasks.push(task);
                dailyTimeUsed += task.estimatedMinutes;
                currentTaskIndex++;
            } else {
                // Si la tâche est trop grosse pour le temps restant, mais qu'il reste du temps significatif (> 20 min)
                // on pourrait la splitter (future feature). Pour l'instant, on passe au jour suivant
                // sauf si la journée est vide, auquel cas on force la tâche (sinon on n'avancera jamais)
                if (dailyTasks.length === 0) {
                    dailyTasks.push(task);
                    currentTaskIndex++;
                }
                break; 
            }
        }

        schedule.push({
            date: currentDate,
            tasks: dailyTasks,
            totalMinutes: dailyTasks.reduce((acc, t) => acc + t.estimatedMinutes, 0),
            isRestDay: dailyTasks.length === 0 && currentTaskIndex >= allTasks.length
        });
    }

    // Si après avoir rempli tous les jours il reste des tâches, on les distribue sur les derniers jours (mode cramming/urgence)
    // ou on ajoute des sessions doubles.
    if (currentTaskIndex < allTasks.length) {
        let dayIndex = 0;
        while (currentTaskIndex < allTasks.length) {
            const task = allTasks[currentTaskIndex];
            schedule[dayIndex % daysUntilExam].tasks.push(task);
            schedule[dayIndex % daysUntilExam].totalMinutes += task.estimatedMinutes;
            currentTaskIndex++;
            dayIndex++;
        }
    }
    
    // Sauvegarde des IDs des capsules concernées pour référence
    const capsuleIds = capsules.map(c => c.id);

    return {
        id: `plan_${Date.now()}`,
        name: planName,
        examDate,
        dailyMinutesAvailable,
        schedule,
        createdAt: now,
        capsuleIds
    };
};

export const updateTaskStatus = (plan: StudyPlan, date: string, capsuleId: string, status: 'completed' | 'pending'): StudyPlan => {
    const newSchedule = plan.schedule.map(session => {
        if (session.date !== date) return session;
        
        return {
            ...session,
            tasks: session.tasks.map(task => 
                task.capsuleId === capsuleId ? { ...task, status } : task
            )
        };
    });

    return { ...plan, schedule: newSchedule };
};
