
export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface KeyConcept {
  concept: string;
  explanation:string;
}

export interface FlashcardContent {
  front: string;
  back: string;
}

export interface ReviewLog {
  date: number;
  type: 'quiz' | 'flashcard' | 'active-learning' | 'manual';
  score: number; // 0 to 100
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: number;
}

export interface GroupMember {
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  members: GroupMember[];
}

// --- PREMIUM / COLLAB TYPES ---

export interface CollaborativeTask {
  id: string;
  capsuleId: string;
  assigneeId: string;
  assigneeName: string;
  description: string;
  isCompleted: boolean;
  createdAt: number;
  createdBy: string;
}

export interface MemberProgress {
  userId: string;
  userName: string;
  lastReviewed: number;
  masteryScore: number;
}

// --- GAMIFICATION TYPES ---

export type BadgeId = 'first_capsule' | 'quiz_master' | 'streak_3' | 'streak_7' | 'streak_30' | 'explorer' | 'creator_10' | 'social_butterfly';

export interface Badge {
  id: BadgeId;
  name: string;
  description: string;
  icon: string; // icon identifier
  unlockedAt?: number; // timestamp if unlocked, undefined otherwise
}

export interface GamificationStats {
  xp: number;
  level: number;
  currentStreak: number;
  lastStudyDate: string; // YYYY-MM-DD
  badges: Badge[];
}

export interface GroupChallenge {
  id: string;
  capsuleId: string;
  capsuleTitle: string;
  challengerName: string;
  targetScore: number;
  endDate: number;
}

// --- NOUVEAUX TYPES POUR VISUALISATIONS ---

export interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
}

export interface VisualizationData {
  type: 'mindmap' | 'timeline';
  data: MindMapNode | TimelineEvent[];
}

// --- TYPES POUR IMPORT SCOLAIRE ---

export type ExternalPlatform = 'classroom' | 'moodle' | 'pronote';

export interface SchoolCourse {
  id: string;
  name: string;
  platform: ExternalPlatform;
  materials: SchoolMaterial[];
}

export interface SchoolMaterial {
  id: string;
  title: string;
  type: 'pdf' | 'doc' | 'text';
  content?: string; // Contenu simulé pour la démo
  url?: string;
}

// --- TYPES POUR PLANNING ÉTUDE ---

export interface StudyTask {
  capsuleId: string;
  title: string;
  estimatedMinutes: number;
  status: 'pending' | 'completed';
  type: 'review' | 'learn' | 'quiz';
}

export interface DailySession {
  date: string; // ISO Date YYYY-MM-DD
  tasks: StudyTask[];
  totalMinutes: number;
  isRestDay?: boolean;
}

export interface StudyPlan {
  id: string;
  examDate: number; // timestamp
  name: string;
  dailyMinutesAvailable: number;
  schedule: DailySession[];
  createdAt: number;
  capsuleIds: string[];
}

// --- TYPES POUR PREMIUM STORE ---

export type PremiumCategory = 'bac' | 'concours' | 'expert' | 'langues';

export interface PremiumPack {
  id: string;
  title: string;
  description: string;
  category: PremiumCategory;
  price: number; // 0 for free/demo
  capsuleCount: number;
  coverColor: string; // tailwind class prefix e.g., "bg-blue-500"
  capsules: CognitiveCapsule[]; // The content to unlock
}

// ------------------------------------------

export type SourceType = 'text' | 'pdf' | 'web' | 'image' | 'presentation' | 'ocr' | 'speech' | 'unknown';

export interface CognitiveCapsule {
  id: string;
  title: string;
  summary: string;
  keyConcepts: KeyConcept[];
  examples: string[];
  quiz: QuizQuestion[];
  flashcards?: FlashcardContent[];
  createdAt: number;
  lastReviewed: number | null;
  reviewStage: number;
  category?: string;
  
  // Media & Visuals
  memoryAidImage?: string;
  memoryAidDescription?: string;
  visualizations?: VisualizationData[]; // Stockage des diagrammes interactifs

  history?: ReviewLog[];
  masteryLevel?: number;
  sourceType?: SourceType;
  
  // Collaborative fields
  isShared?: boolean;
  groupId?: string;
  groupName?: string;
  comments?: Comment[];
  sharedLink?: string;
  lastModifiedBy?: string;
  
  // Premium Collab Fields
  collaborativeTasks?: CollaborativeTask[];
  groupProgress?: MemberProgress[];
  activeChallenge?: GroupChallenge; // Défi en cours sur cette capsule
  
  // Store Origin
  isPremiumContent?: boolean;
  originalPackId?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  image?: string;
}

export type UserLevel = 'beginner' | 'intermediate' | 'advanced';
export type LearningStyle = 'visual' | 'auditory' | 'kinesthetic' | 'textual';
export type CoachingMode = 'standard' | 'oral' | 'exam' | 'solver';
export type UserRole = 'student' | 'teacher';

export interface UserProfile {
  name: string;
  email?: string;
  role: UserRole; // Added role
  level?: UserLevel;
  learningStyle?: LearningStyle;
  activePlan?: StudyPlan; // Le planning actif de l'utilisateur
  isPremium?: boolean; // Statut Premium
  unlockedPackIds?: string[]; // IDs des packs achetés
  gamification?: GamificationStats; // Stats de jeu
}

export interface AppData {
  user: UserProfile;
  capsules: CognitiveCapsule[];
}
