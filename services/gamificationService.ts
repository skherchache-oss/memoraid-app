
import type { Badge, BadgeId, GamificationStats, CognitiveCapsule } from '../types';

// --- CONSTANTS ---

const XP_PER_QUIZ = 50;
const XP_PER_FLASHCARD_SESSION = 20;
const XP_PER_CAPSULE_CREATION = 100;
const XP_PER_CHALLENGE = 150;

// Niveaux : XP nécessaire = niveau * 100 (Ex: Niveau 2 = 200 XP, Niveau 10 = 1000 XP)
const XP_TO_LEVEL_MULTIPLIER = 200;

const BADGES_DEFINITIONS: Badge[] = [
    { id: 'first_capsule', name: 'Premier Pas', description: 'Créez votre première capsule.', icon: 'seed' },
    { id: 'creator_10', name: 'Savant Fou', description: 'Créez 10 capsules.', icon: 'flask' },
    { id: 'quiz_master', name: 'Expert', description: 'Obtenez 100% à un quiz.', icon: 'trophy' },
    { id: 'streak_3', name: 'Régulier', description: 'Étudiez 3 jours de suite.', icon: 'flame' },
    { id: 'streak_7', name: 'Métronome', description: 'Étudiez 7 jours de suite.', icon: 'fire' },
    { id: 'social_butterfly', name: 'Collaborateur', description: 'Rejoignez un groupe.', icon: 'users' },
];

// --- HELPERS ---

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const isYesterday = (dateString: string) => {
    const today = new Date();
    const date = new Date(dateString);
    const diffTime = Math.abs(today.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    // Approx, robust enough for streaks
    return diffDays <= 2 && diffDays >= 1 && today.getDate() !== date.getDate();
};

// --- CORE LOGIC ---

export const calculateLevel = (xp: number): number => {
    return Math.floor(xp / XP_TO_LEVEL_MULTIPLIER) + 1;
};

export const getLevelProgress = (xp: number): number => {
    const currentLevelXp = (calculateLevel(xp) - 1) * XP_TO_LEVEL_MULTIPLIER;
    const nextLevelXp = calculateLevel(xp) * XP_TO_LEVEL_MULTIPLIER;
    const progress = ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;
    return Math.min(100, Math.max(0, progress));
};

export const getInitialGamificationStats = (): GamificationStats => ({
    xp: 0,
    level: 1,
    currentStreak: 0,
    lastStudyDate: '',
    badges: []
});

export const processGamificationAction = (
    currentStats: GamificationStats,
    action: 'create' | 'quiz' | 'flashcard' | 'join_group' | 'challenge',
    capsulesCount: number,
    quizScore?: number
): { stats: GamificationStats, newBadges: Badge[], levelUp: boolean } => {
    
    let newStats = { ...currentStats };
    const newBadges: Badge[] = [];
    let xpGain = 0;

    // 1. Calculate XP
    switch (action) {
        case 'create': xpGain = XP_PER_CAPSULE_CREATION; break;
        case 'quiz': xpGain = XP_PER_QUIZ; break;
        case 'flashcard': xpGain = XP_PER_FLASHCARD_SESSION; break;
        case 'challenge': xpGain = XP_PER_CHALLENGE; break;
        case 'join_group': xpGain = 50; break;
    }
    
    // Bonus for perfect quiz
    if (action === 'quiz' && quizScore === 100) {
        xpGain += 20;
    }

    newStats.xp += xpGain;
    const oldLevel = newStats.level;
    newStats.level = calculateLevel(newStats.xp);
    const levelUp = newStats.level > oldLevel;

    // 2. Update Streak
    const today = getTodayDateString();
    if (newStats.lastStudyDate !== today) {
        if (newStats.lastStudyDate && isYesterday(newStats.lastStudyDate)) {
            newStats.currentStreak += 1;
        } else if (newStats.lastStudyDate !== today) {
            newStats.currentStreak = 1; // Reset if missed a day, or start new
        }
        newStats.lastStudyDate = today;
    }

    // 3. Check Badges
    const unlockedIds = new Set(newStats.badges.map(b => b.id));

    const awardBadge = (id: BadgeId) => {
        if (!unlockedIds.has(id)) {
            const badgeDef = BADGES_DEFINITIONS.find(b => b.id === id);
            if (badgeDef) {
                const newBadge = { ...badgeDef, unlockedAt: Date.now() };
                newStats.badges.push(newBadge);
                newBadges.push(newBadge);
            }
        }
    };

    if (action === 'create') {
        if (capsulesCount >= 1) awardBadge('first_capsule');
        if (capsulesCount >= 10) awardBadge('creator_10');
    }

    if (action === 'quiz' && quizScore === 100) {
        awardBadge('quiz_master');
    }

    if (newStats.currentStreak >= 3) awardBadge('streak_3');
    if (newStats.currentStreak >= 7) awardBadge('streak_7');
    
    if (action === 'join_group') awardBadge('social_butterfly');

    return { stats: newStats, newBadges, levelUp };
};
