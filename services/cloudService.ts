
import { db } from './firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, writeBatch, getDoc, where, updateDoc, arrayUnion, getDocs } from "firebase/firestore";
import type { CognitiveCapsule, Group, GroupMember, Comment, CollaborativeTask, MemberProgress } from '../types';

// Nom de la collection racine pour les utilisateurs
const USERS_COLLECTION = 'users';
const GROUPS_COLLECTION = 'groups';
const CAPSULES_SUBCOLLECTION = 'capsules';

// --- CAPSULES PERSONNELLES ---

export const saveCapsuleToCloud = async (userId: string, capsule: CognitiveCapsule) => {
    if (!db || !userId) return;
    try {
        // Si c'est une capsule de groupe, on la sauvegarde dans le groupe
        if (capsule.groupId) {
            await updateGroupCapsule(capsule.groupId, capsule, userId);
        } else {
            // Sinon sauvegarde perso
            const capsuleRef = doc(db, USERS_COLLECTION, userId, CAPSULES_SUBCOLLECTION, capsule.id);
            await setDoc(capsuleRef, capsule, { merge: true });
        }
    } catch (error) {
        console.error("Erreur sauvegarde cloud:", error);
        throw error;
    }
};

export const deleteCapsuleFromCloud = async (userId: string, capsuleId: string) => {
    if (!db || !userId) return;
    try {
        const capsuleRef = doc(db, USERS_COLLECTION, userId, CAPSULES_SUBCOLLECTION, capsuleId);
        await deleteDoc(capsuleRef);
    } catch (error) {
        console.error("Erreur suppression cloud:", error);
        throw error;
    }
};

export const migrateLocalDataToCloud = async (userId: string, localCapsules: CognitiveCapsule[]) => {
    if (!db || !userId || localCapsules.length === 0) return;

    const batch = writeBatch(db);
    let operationCount = 0;

    for (const capsule of localCapsules) {
        const capsuleRef = doc(db, USERS_COLLECTION, userId, CAPSULES_SUBCOLLECTION, capsule.id);
        const docSnap = await getDoc(capsuleRef);
        if (!docSnap.exists()) {
            batch.set(capsuleRef, capsule);
            operationCount++;
        }
    }

    if (operationCount > 0) {
        await batch.commit();
    }
};

export const subscribeToCapsules = (userId: string, onUpdate: (capsules: CognitiveCapsule[]) => void) => {
    if (!db || !userId) return () => {};

    const capsulesQuery = query(
        collection(db, USERS_COLLECTION, userId, CAPSULES_SUBCOLLECTION),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(capsulesQuery, (snapshot) => {
        const capsules: CognitiveCapsule[] = [];
        snapshot.forEach((doc) => {
            capsules.push(doc.data() as CognitiveCapsule);
        });
        onUpdate(capsules);
    }, (error) => {
        console.error("Erreur sync cloud:", error);
    });
};

// --- GROUPES & COLLABORATION ---

/**
 * Crée un nouveau groupe.
 */
export const createGroup = async (userId: string, userName: string, groupName: string): Promise<Group> => {
    if (!db) throw new Error("DB non initialisée");
    
    const groupId = `grp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const newMember: GroupMember = {
        userId,
        name: userName,
        email: "",
        role: 'owner'
    };

    const newGroup: Group = {
        id: groupId,
        name: groupName,
        inviteCode,
        ownerId: userId,
        members: [newMember]
    };

    await setDoc(doc(db, GROUPS_COLLECTION, groupId), newGroup);
    return newGroup;
};

/**
 * Rejoindre un groupe via code d'invitation.
 */
export const joinGroup = async (userId: string, userName: string, inviteCode: string): Promise<Group> => {
    if (!db) throw new Error("DB non initialisée");

    const q = query(collection(db, GROUPS_COLLECTION), where("inviteCode", "==", inviteCode));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        throw new Error("Code d'invitation invalide.");
    }

    const groupDoc = querySnapshot.docs[0];
    const groupData = groupDoc.data() as Group;

    // Vérifier si déjà membre
    if (groupData.members.some(m => m.userId === userId)) {
        throw new Error("Vous êtes déjà membre de ce groupe.");
    }

    const newMember: GroupMember = {
        userId,
        name: userName,
        email: "",
        role: 'editor' // Par défaut, les membres peuvent éditer
    };

    await updateDoc(doc(db, GROUPS_COLLECTION, groupData.id), {
        members: arrayUnion(newMember)
    });

    return { ...groupData, members: [...groupData.members, newMember] };
};

/**
 * Récupère les groupes de l'utilisateur.
 */
export const subscribeToUserGroups = (userId: string, onUpdate: (groups: Group[]) => void) => {
    if (!db) return () => {};

    // Firestore ne permet pas de requêter directement dans un tableau d'objets facilement sans index complexe.
    // Pour simplifier ici, on récupère tous les groupes (attention scalabilité) ou on restructure.
    // Solution propre : stocker 'memberIds' array dans le groupe pour requêter.
    // On va assumer qu'on a peu de groupes pour cette démo et filtrer côté client ou ajouter un champ 'memberIds' lors de la création/join.
    // Hack pour la démo : On ne peut pas facilement faire "array-contains object".
    // On va tricher : on n'a pas ajouté memberIds. 
    // On va récupérer la collection et filtrer (PAS IDEAL POUR PROD).
    
    const q = query(collection(db, GROUPS_COLLECTION));
    
    return onSnapshot(q, (snapshot) => {
        const userGroups: Group[] = [];
        snapshot.forEach((doc) => {
            const g = doc.data() as Group;
            if (g.members.some(m => m.userId === userId)) {
                userGroups.push(g);
            }
        });
        onUpdate(userGroups);
    });
};

/**
 * Partage une capsule dans un groupe (crée une copie liée).
 */
export const shareCapsuleToGroup = async (userId: string, group: Group, capsule: CognitiveCapsule) => {
    if (!db) return;

    const sharedCapsule: CognitiveCapsule = {
        ...capsule,
        id: `shared_${capsule.id}_${Date.now()}`, // Nouvel ID pour la version partagée
        groupId: group.id,
        groupName: group.name,
        isShared: true,
        sharedLink: `https://memoraid.app/share/${group.inviteCode}/${capsule.id}`,
        comments: [],
        collaborativeTasks: [],
        groupProgress: [],
        lastModifiedBy: userId
    };

    const capsuleRef = doc(db, GROUPS_COLLECTION, group.id, CAPSULES_SUBCOLLECTION, sharedCapsule.id);
    await setDoc(capsuleRef, sharedCapsule);
    return sharedCapsule;
};

/**
 * Met à jour une capsule partagée.
 */
export const updateGroupCapsule = async (groupId: string, capsule: CognitiveCapsule, userId: string) => {
    if (!db) return;
    const capsuleRef = doc(db, GROUPS_COLLECTION, groupId, CAPSULES_SUBCOLLECTION, capsule.id);
    await setDoc(capsuleRef, { ...capsule, lastModifiedBy: userId }, { merge: true });
};

/**
 * Ajoute un commentaire à une capsule partagée.
 */
export const addCommentToCapsule = async (groupId: string, capsuleId: string, comment: Comment) => {
    if (!db) return;
    const capsuleRef = doc(db, GROUPS_COLLECTION, groupId, CAPSULES_SUBCOLLECTION, capsuleId);
    await updateDoc(capsuleRef, {
        comments: arrayUnion(comment)
    });
};

/**
 * Écoute les capsules d'un groupe spécifique.
 */
export const subscribeToGroupCapsules = (groupId: string, onUpdate: (capsules: CognitiveCapsule[]) => void) => {
    if (!db) return () => {};

    const q = query(collection(db, GROUPS_COLLECTION, groupId, CAPSULES_SUBCOLLECTION));
    return onSnapshot(q, (snapshot) => {
        const capsules: CognitiveCapsule[] = [];
        snapshot.forEach((doc) => {
            capsules.push(doc.data() as CognitiveCapsule);
        });
        onUpdate(capsules);
    });
};


// --- PREMIUM COLLABORATIVE FEATURES ---

/**
 * Assigne une tâche collaborative à un membre du groupe.
 */
export const assignTaskToMember = async (groupId: string, capsuleId: string, task: CollaborativeTask) => {
    if (!db) return;
    const capsuleRef = doc(db, GROUPS_COLLECTION, groupId, CAPSULES_SUBCOLLECTION, capsuleId);
    await updateDoc(capsuleRef, {
        collaborativeTasks: arrayUnion(task)
    });
};

/**
 * Met à jour le statut d'une tâche (terminée/non terminée).
 */
export const updateTaskStatus = async (groupId: string, capsuleId: string, taskId: string, isCompleted: boolean, currentTasks: CollaborativeTask[]) => {
    if (!db) return;
    const updatedTasks = currentTasks.map(t => t.id === taskId ? { ...t, isCompleted } : t);
    const capsuleRef = doc(db, GROUPS_COLLECTION, groupId, CAPSULES_SUBCOLLECTION, capsuleId);
    await updateDoc(capsuleRef, {
        collaborativeTasks: updatedTasks
    });
};

/**
 * Met à jour la progression d'un membre sur une capsule partagée (Vue Progression Groupe).
 */
export const updateSharedCapsuleProgress = async (groupId: string, capsuleId: string, progress: MemberProgress, currentProgressList?: MemberProgress[]) => {
    if (!db) return;
    
    // On filtre l'ancienne entrée pour cet utilisateur s'il existe, puis on ajoute la nouvelle
    const otherProgress = (currentProgressList || []).filter(p => p.userId !== progress.userId);
    const newProgressList = [...otherProgress, progress];

    const capsuleRef = doc(db, GROUPS_COLLECTION, groupId, CAPSULES_SUBCOLLECTION, capsuleId);
    await updateDoc(capsuleRef, {
        groupProgress: newProgressList
    });
};
