import React, { useState, useEffect, useRef, useMemo } from 'react';
import { fetchMatchesForClub } from './../api'; // Assurez-vous que le chemin d'importation est correct
import './css/MatchsContent.css'; // Importation du CSS
import config from '../../config';  // Import du fichier config.js

function MatchsContent() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const matchRefs = useRef([]);
  const scrollContainerRef = useRef(null); // Ajouter une ref pour le conteneur
  const [selectedClub, setSelectedClub] = useState(config.getSelectedClub());  // Initialiser avec le club sélectionné
  const [selectedCompetition, setSelectedCompetition] = useState(config.getSelectedCompetition());  // Initialiser avec la compétition sélectionnée

  useEffect(() => {
    // Fonction pour charger les matchs
    const loadMatches = async () => {
      setLoading(true);
      try {
        if (selectedClub && selectedClub.cl_no) {  // Vérifier si le club est bien défini
          const data = await fetchMatchesForClub(selectedClub.cl_no);
          setMatches(data);
        }
      } catch (error) {
        setError('Erreur lors de la récupération des matchs.');
      } finally {
        setLoading(false);
      }
    };

    // Charger les matchs au démarrage et lorsque le club change
    if (selectedClub && selectedClub.cl_no) {
      loadMatches();
    }

    // Écouter les changements de club et de compétition
    const handleClubChange = (club) => {
      setSelectedClub(club);
      setMatches([]);  // Réinitialiser les matchs lors du changement de club
    };

    const handleCompetitionChange = (competition) => {
      setSelectedCompetition(competition);
    };

    // Ajouter les gestionnaires d'événements
    config.onClubChange(handleClubChange);
    config.onCompetitionChange(handleCompetitionChange);

    // Nettoyer les gestionnaires d'événements lors du démontage du composant
    return () => {
      config.onClubChange(() => {});
      config.onCompetitionChange(() => {});
    };
  }, [selectedClub]);

  const filteredMatches = useMemo(() => {
    return matches.filter(
      match =>
        (match.homeTeam === selectedClub.name && match.homeCompetitionName === selectedCompetition) ||
        (match.awayTeam === selectedClub.name && match.awayCompetitionName === selectedCompetition)
    );
  }, [matches, selectedClub.name, selectedCompetition]);

  useEffect(() => {
    if (filteredMatches.length > 0) {
      const today = new Date();
      const lastMatchIndex = filteredMatches.reduce((lastIndex, match, index) => {
        const matchDate = new Date(match.date);
        return matchDate < today && (lastIndex === -1 || matchDate < new Date(filteredMatches[lastIndex].date))
          ? index
          : lastIndex;
      }, -1);

      if (lastMatchIndex >= 0 && matchRefs.current[lastMatchIndex]) {
        // Scroller le conteneur spécifique vers le dernier match avant aujourd'hui
        scrollContainerRef.current.scrollTo({
          top: matchRefs.current[lastMatchIndex].offsetTop, // Défile vers la position du dernier match avant aujourd'hui
          behavior: 'smooth',
        });
      }
    }
  }, [filteredMatches]);

  if (loading) {
    return <div className="loading">Chargement des matchs...</div>;
  }

  if (error) {
    return <div className="error">Erreur : {error}</div>;
  }

  return (
    <div className="tab-content-match">
      {filteredMatches.length === 0 ? (
        <p className="error">Aucun match trouvé pour {selectedClub.name}.</p>
      ) : (
        <div className="scroll-container" ref={scrollContainerRef}> {/* Ajout de la classe scroll-container */}
          {filteredMatches.map((match, index) => (
            <div
              key={match.id}
              className="match-item"
              ref={el => matchRefs.current[index] = el}
            >
              <div className="match-date">
                {new Date(match.date).toLocaleDateString()} - {match.time} - {match.competitionName}
              </div>
              <div className="match-content">
                <div className="match-details-team">
                  <img src={match.homeLogo} alt={`${match.homeTeam} logo`} className="team-logo" />
                  {match.homeTeam}
                </div>
                <div className="match-score">
                  {match.home_score}
                </div>
                <div className="match-details-team">
                  <img src={match.awayLogo} alt={`${match.awayTeam} logo`} className="team-logo" />
                  {match.awayTeam}
                </div>
                <div className="match-score">
                  {match.away_score}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MatchsContent;
