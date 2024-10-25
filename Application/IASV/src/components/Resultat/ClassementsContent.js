import React, { useState, useEffect } from 'react';
import { fetchMatchesForClub, fetchClassementJournees } from './../api'; // Import des fonctions API
import config from './../../config'; // Import de votre fichier de configuration
import './css/ClassementsContent.css';

function ClassementsContent() {
  const [classements, setClassements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const selectedCompetition = config.getSelectedCompetition();

  useEffect(() => {
    const selectedClub = config.getSelectedClub();

    if (selectedClub) {
      const fetchData = async () => {
        try {
          // Étape 1 : Récupérer les matches du club à l'aide de l'API fetchMatchesForClub
          const matches = await fetchMatchesForClub(selectedClub.cl_no);

          // Étape 2 : Trouver le premier match correspondant à la compétition sélectionnée
          let foundMatch = null;
          for (const match of matches) {
            if (match.competitionName === selectedCompetition) {
              foundMatch = match; // On stocke le match correspondant
              break; // Sortir de la boucle dès qu'on trouve une correspondance
            }
          }

          if (foundMatch) {
            // Extraire les informations competitionId, phaseId, pouleId du match trouvé
            const competitionId = foundMatch.competitionNumber;
            const phaseId = foundMatch.phaseNumber;
            const pouleId = foundMatch.pouleNumber;

            // Récupérer le classement
            const classementsData = await fetchClassementJournees(
              competitionId,
              phaseId,
              pouleId
            );
            setClassements(classementsData);
          } else {
            throw new Error('Aucun match trouvé pour la compétition sélectionnée.');
          }

          setLoading(false);
        } catch (error) {
          setError(error);
          setLoading(false);
        }
      };

      fetchData();
    } else {
      setError(new Error('Aucun club sélectionné.'));
      setLoading(false);
    }

    // Écouter les changements du club sélectionné
    config.onClubChange((club) => {
      // Lorsque le club change, relancer la récupération des données
      setLoading(true);
      setError(null);
      setClassements([]);
      
      // Relancer la récupération des données pour le nouveau club
      const fetchNewData = async () => {
        try {
          const matches = await fetchMatchesForClub(club.cl_no);
          let foundMatch = null;
          for (const match of matches) {
            if (match.competitionName === selectedCompetition) {
              foundMatch = match;
              break;
            }
          }

          if (foundMatch) {
            const competitionId = foundMatch.competitionNumber;
            const phaseId = foundMatch.phaseNumber;
            const pouleId = foundMatch.pouleNumber;

            const classementsData = await fetchClassementJournees(
              competitionId,
              phaseId,
              pouleId
            );
            setClassements(classementsData);
          } else {
            throw new Error('Aucun match trouvé pour la compétition sélectionnée.');
          }
          setLoading(false);
        } catch (error) {
          setError(error);
          setLoading(false);
        }
      };
      
      fetchNewData();
    });
  }, []);

  if (loading) {
    return <div>Chargement des classements...</div>;
  }

  if (error) {
    return <div>Erreur lors du chargement des classements : {error.message}</div>;
  }

  return (
    <div className="classement-content">
      {classements.length > 0 ? (
        <table className="classement-table">
          <thead>
            <tr>
              <th>Rang</th> {/* Classement / Rang */}
              <th>Club</th>
              <th>Pts</th>
              <th>MJ</th>
              <th>G</th>
              <th>N</th>
              <th>P</th>
              <th>BP</th> {/* Buts pour */}
              <th>BC</th> {/* Buts contre */}
              <th>DB</th> {/* Différence de buts */}
            </tr>
          </thead>
          <tbody>
            {classements.map((journee, index) => (
              <tr key={journee.teamName}> {/* Utilisation de teamName comme key pour éviter index */}
                <td>{journee.rank}</td> {/* Classement/Rang */}
                <td className="team-column">{journee.teamName}</td>
                <td className="points-column">{journee.points}</td>
                <td>{journee.totalGames}</td>
                <td>{journee.wonGames}</td>
                <td>{journee.drawGames}</td>
                <td>{journee.lostGames}</td>
                <td>{journee.goalsFor}</td> {/* Buts pour */}
                <td>{journee.goalsAgainst}</td> {/* Buts contre */}
                <td>{journee.goalDifference}</td> {/* Différence de buts */}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="error">Aucun classement disponible pour le moment.</p>
      )}
    </div>
  );
}

export default ClassementsContent;
