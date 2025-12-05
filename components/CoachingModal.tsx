// components/CoachingModal.tsx
import React, { useState } from 'react';
import { createCoachingSession, generateCognitiveCapsule } from '../services/geminiService';
import type { CognitiveCapsule, CoachingMode, UserProfile } from '../types';
import { XIcon, SendIcon, SparklesIcon, MicrophoneIcon, ImageIcon, Volume2Icon } from '../constants';

interface CoachingModalProps {
  userProfile: UserProfile;
  mode: CoachingMode;
  onClose: () => void;
}

const CoachingModal: React.FC<CoachingModalProps> = ({ userProfile, mode, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [capsule, setCapsule] = useState<CognitiveCapsule | null>(null);

  const startSession = async () => {
    setLoading(true);
    setError(null);
    try {
      // Crée la session de coaching
      const newSession = await createCoachingSession(userProfile, mode);
      setSession(newSession);

      // Génère une capsule cognitive d’exemple
      const generatedCapsule = await generateCognitiveCapsule(
        `Créer une capsule cognitive pour ${userProfile.name} en mode ${mode}`,
        'text',
        'fr'
      );
      setCapsule(generatedCapsule);
    } catch (err: any) {
      console.error("Erreur session/capsule:", err);
      setError(err.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-xl relative">
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          onClick={onClose}
        >
          <XIcon />
        </button>

        <h2 className="text-xl font-bold mb-4">Session de Coaching</h2>

        {loading && <p>Chargement...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!session && !loading && (
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={startSession}
          >
            Démarrer la session
          </button>
        )}

        {session && (
          <div className="mt-4">
            <h3 className="font-semibold">Session ID: {session.sessionId}</h3>
            <p>Instructions: {session.instructions}</p>
          </div>
        )}

        {capsule && (
          <div className="mt-4 p-4 bg-gray-100 rounded">
            <h3 className="font-semibold">{capsule.title}</h3>
            <p>{capsule.summary}</p>
            <div className="mt-2">
              <h4 className="font-semibold">Key Concepts:</h4>
              <ul className="list-disc list-inside">
                {capsule.keyConcepts.map((k, idx) => (
                  <li key={idx}>{k.concept}: {k.explanation}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button className="p-2 bg-gray-200 rounded hover:bg-gray-300"><SendIcon /></button>
          <button className="p-2 bg-gray-200 rounded hover:bg-gray-300"><SparklesIcon /></button>
          <button className="p-2 bg-gray-200 rounded hover:bg-gray-300"><MicrophoneIcon /></button>
          <button className="p-2 bg-gray-200 rounded hover:bg-gray-300"><ImageIcon /></button>
          <button className="p-2 bg-gray-200 rounded hover:bg-gray-300"><Volume2Icon /></button>
        </div>
      </div>
    </div>
  );
};

export default CoachingModal;
