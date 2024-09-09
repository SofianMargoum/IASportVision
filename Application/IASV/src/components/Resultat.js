import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import './css/Resultat.css';  // Assurez-vous d'importer ce fichier CSS
import config from '../config';  // Import du fichier config.js

// Lazy loading des composants pour optimiser le temps de chargement initial
const MatchsContent = React.lazy(() => import('./Resultat/MatchsContent'));
const ClassementsContent = React.lazy(() => import('./Resultat/ClassementsContent'));
const StatsContent = React.lazy(() => import('./Resultat/StatsContent'));

function Resultat() {
  // Utiliser des fonctions dans useState pour éviter les recalculs à chaque rendu
  const [activeTab, setActiveTab] = useState('MATCHS');
  const [selectedClub, setSelectedClub] = useState(() => config.getSelectedClub());
  const [selectedCompetition, setSelectedCompetition] = useState(() => config.getSelectedCompetition());

  useEffect(() => {
    console.log('Resultat component mounted or dependencies changed');
  }, []);

  // Utilisation de useCallback pour éviter que setActiveTab ne change à chaque rendu
  const handleTabClick = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  // Utilisation de useMemo pour mémoriser le contenu à afficher en fonction de l'onglet actif
  const renderContent = useMemo(() => {
    switch (activeTab) {
      case 'MATCHS':
        return <MatchsContent club={selectedClub} competition={selectedCompetition} />;
      case 'CLASSEMENTS':
        return <ClassementsContent club={selectedClub} competition={selectedCompetition} />;
      case 'STATS':
        return <StatsContent club={selectedClub} competition={selectedCompetition} />;
      default:
        return null;
    }
  }, [activeTab, selectedClub, selectedCompetition]);

  return (
    <div className="resultat-container">    
      {/* Menu avec onglets */}
      <nav>
        <button
          className={activeTab === 'MATCHS' ? 'active' : ''}
          onClick={() => handleTabClick('MATCHS')}
        >
          MATCHS
        </button>
        <button
          className={activeTab === 'CLASSEMENTS' ? 'active' : ''}
          onClick={() => handleTabClick('CLASSEMENTS')}
        >
          CLASSEMENTS
        </button>
        <button
          className={activeTab === 'STATS' ? 'active' : ''}
          onClick={() => handleTabClick('STATS')}
        >
          STATS
        </button>
      </nav>

      {/* Affichage du contenu avec Suspense pour le lazy loading */}
      <Suspense fallback={<div>Loading...</div>}>
        {renderContent}
      </Suspense>
    </div>
  );
}

export default Resultat;
