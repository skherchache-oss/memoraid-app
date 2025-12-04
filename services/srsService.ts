
import type { CognitiveCapsule } from '../types';

// Review intervals in days for each stage, as requested.
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60, 90, 120];
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Calculates the next review interval in milliseconds for a given review stage.
 */
const getReviewInterval = (stage: number): number => {
    const days = stage >= REVIEW_INTERVALS_DAYS.length 
        ? REVIEW_INTERVALS_DAYS[REVIEW_INTERVALS_DAYS.length - 1]
        : REVIEW_INTERVALS_DAYS[stage];
    return days * ONE_DAY_IN_MS;
};

/**
 * Checks if a cognitive capsule is due for review.
 */
export const isCapsuleDue = (capsule: CognitiveCapsule): boolean => {
    const now = Date.now();
    
    if (capsule.lastReviewed === null) {
        // Due immediately (or 1 day after creation depending on logic, here immediate)
        return true; 
    }

    const interval = getReviewInterval(capsule.reviewStage);
    const nextReviewDate = capsule.lastReviewed + interval;
    
    return now >= nextReviewDate;
};

/**
 * Calculates the probability of retention (forgetting curve approximation).
 * Based on Ebbinghaus: R = e^(-t/S) where t is time elapsed and S is stability (interval).
 * Returns a percentage (0-100).
 */
export const calculateRetentionProbability = (capsule: CognitiveCapsule): number => {
    if (capsule.lastReviewed === null) return 0; // Not reviewed yet implies unknown retention

    const now = Date.now();
    const timeElapsed = now - capsule.lastReviewed;
    const interval = getReviewInterval(capsule.reviewStage);

    // Avoid division by zero
    if (interval === 0) return 0;

    // Using a simplified exponential decay
    // When timeElapsed == interval, retention is approx 85% in a well-tuned SRS.
    // We verify: e^(-1) is 0.36 (too harsh). We scale t/S.
    // Let's use a linear approximation for UI friendliness or a tuned exponential.
    // R = 100 * (2 ^ -(timeElapsed / interval)) is a standard half-life model.
    
    // Let's assume the 'interval' is the point where retention drops to 90% for a "due" item.
    // Actually, simple UI logic: 
    // 100% immediately after review.
    // 0% when timeElapsed = 2 * interval (completely forgotten).
    
    const ratio = timeElapsed / interval;
    
    // We model that at 1.0 (due date), retention is around 80-90%.
    // Let's use: 100 * e^(-0.2 * ratio)
    const probability = 100 * Math.exp(-0.15 * ratio);
    
    return Math.max(0, Math.min(100, Math.round(probability)));
};

/**
 * Calculates a Global Mastery Score (0-100) based on stage and quiz history.
 */
export const calculateMasteryScore = (capsule: CognitiveCapsule): number => {
    // Base score from SRS stage (Consistency) - up to 60 points
    const maxStage = REVIEW_INTERVALS_DAYS.length;
    const stageScore = Math.min(capsule.reviewStage, maxStage) / maxStage * 60;

    // Performance score from history (Quality) - up to 40 points
    let performanceScore = 0;
    if (capsule.history && capsule.history.length > 0) {
        // Take average of last 3 sessions
        const recentLogs = capsule.history.slice(-3);
        const avgScore = recentLogs.reduce((acc, log) => acc + log.score, 0) / recentLogs.length;
        performanceScore = (avgScore / 100) * 40;
    } else {
        // Default performance if no history yet but stage advanced manually
        performanceScore = capsule.reviewStage > 0 ? 20 : 0; 
    }

    return Math.round(stageScore + performanceScore);
};

/**
 * Analyses global user performance.
 */
export const analyzeGlobalPerformance = (capsules: CognitiveCapsule[]) => {
    const total = capsules.length;
    if (total === 0) return {
        globalMastery: 0,
        retentionAverage: 0,
        dueCount: 0,
        overdueCount: 0,
        upcomingCount: 0
    };

    let totalMastery = 0;
    let totalRetention = 0;
    let dueCount = 0;
    let overdueCount = 0;
    const now = Date.now();

    capsules.forEach(c => {
        totalMastery += calculateMasteryScore(c);
        totalRetention += calculateRetentionProbability(c);
        
        if (isCapsuleDue(c)) {
            dueCount++;
            // Consider "Overdue" if 1.5x the interval has passed since due date
            const interval = getReviewInterval(c.reviewStage);
            const dueDate = (c.lastReviewed || c.createdAt) + interval;
            if (now > dueDate + (interval * 0.5)) {
                overdueCount++;
            }
        }
    });

    return {
        globalMastery: Math.round(totalMastery / total),
        retentionAverage: Math.round(totalRetention / total),
        dueCount,
        overdueCount,
        upcomingCount: total - dueCount
    };
};


export interface ReviewStageInfo {
    stage: number;
    intervalDays: number;
    reviewDate: number;
    status: 'completed' | 'due' | 'upcoming';
}

export const getReviewSchedule = (capsule: CognitiveCapsule): ReviewStageInfo[] => {
    const schedule: ReviewStageInfo[] = [];
    const now = Date.now();

    // 1. Completed Stages
    for (let i = 0; i < capsule.reviewStage; i++) {
        if (i < REVIEW_INTERVALS_DAYS.length) {
            schedule.push({
                stage: i + 1,
                intervalDays: REVIEW_INTERVALS_DAYS[i],
                reviewDate: 0, 
                status: 'completed',
            });
        }
    }

    // 2. The Next Stage
    let lastKnownReviewDate = capsule.lastReviewed || capsule.createdAt;
    const nextStageIndex = capsule.reviewStage;

    if (nextStageIndex < REVIEW_INTERVALS_DAYS.length) {
        const intervalMs = getReviewInterval(nextStageIndex);
        const nextReviewDate = lastKnownReviewDate + intervalMs;
        schedule.push({
            stage: nextStageIndex + 1,
            intervalDays: REVIEW_INTERVALS_DAYS[nextStageIndex],
            reviewDate: nextReviewDate,
            status: now >= nextReviewDate ? 'due' : 'upcoming',
        });

        // 3. Project one future stage
        const futureStageIndex = nextStageIndex + 1;
        if (futureStageIndex < REVIEW_INTERVALS_DAYS.length) {
            const futureIntervalMs = getReviewInterval(futureStageIndex);
            const futureReviewDate = nextReviewDate + futureIntervalMs; 
            schedule.push({
                stage: futureStageIndex + 1,
                intervalDays: REVIEW_INTERVALS_DAYS[futureStageIndex],
                reviewDate: futureReviewDate,
                status: 'upcoming',
            });
        }
    }

    return schedule;
};
