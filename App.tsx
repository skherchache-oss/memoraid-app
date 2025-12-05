// App.tsx
import React, { useState } from 'react';
import CoachingModal from './components/CoachingModal';
import MobileNavBar from './components/MobileNavBar';
import TeacherDashboard from './components/TeacherDashboard';

import { generateCognitiveCapsule } from './services/geminiService';
import { isCapsuleDue, analyzeGlobalPerformance, calculateMasteryScore } from './services/srsService';
import { updateTaskStatus } from './services/planningService';
import type { UserProfile, CoachingMode } from './types';

const App: React.FC = () => {
  const [showCoachingModal, setShowCoachingModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    id: '1',
    name: 'Utilisateur Exemple',
    email: 'exemple@email.com',
  });
  const [mode, setMode] = useState<CoachingMode>('standard'); // ou 'intense', selon ton type

  const openCoachingModal = () => setShowCoachingModal(true);
  const closeCoachingModal = () => setShowCoachingModal(false);

  const handleGenerateCapsule = async () => {
    try {
      const capsule = await generateCognitiveCapsule(
        `Créer une capsule cognitive pour ${userProfile.name} en mode ${mode}`,
        'text',
        'fr'
      );
      console.log("Capsule générée:", capsule);
    } catch (err) {
      console.error("Erreur lors de la génération de capsule:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileNavBar />
      
      <header className="p-4 bg-blue-600 text-white flex justify-between items-center">
        <h1 className="text-xl font-bold">Memoraid Dashboard</h1>
        <button
          className="bg-white text-blue-600 px-3 py-1 rounded hover:bg-gray-100"
          onClick={openCoachingModal}
        >
          Lancer Coaching
        </button>
      </header>

      <main className="p-6">
        <TeacherDashboard
          userProfile={userProfile}
          onGenerateCapsule={handleGenerateCapsule}
          onUpdateTaskStatus={updateTaskStatus}
          isCapsuleDue={isCapsuleDue}
          analyzeGlobalPerformance={analyzeGlobalPerformance}
          calculateMasteryScore={calculateMasteryScore}
        />
      </main>

      {showCoachingModal && (
        <CoachingModal
          userProfile={userProfile}
          mode={mode}
          onClose={closeCoachingModal}
        />
      )}
    </div>
  );
};

export default App;
