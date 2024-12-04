import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Image, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { fetchMatchesForClub } from './../api'; // Assurez-vous que le chemin d'importation est correct
import { useClubContext } from './../ClubContext'; // Import du contexte

const scale = 0.85; // Ajustez cette valeur selon vos besoins

const MatchsContent = () => {
  const [matches, setMatches] = useState([]); // État pour stocker les matchs récupérés
  const [loading, setLoading] = useState(true); // État pour suivre le statut de chargement
  const [error, setError] = useState(null); // État pour gérer les erreurs lors de la récupération des données

  const { selectedClub, competition,phase,poule,cp_no } = useClubContext(); // Récupère le club et la compétition depuis le contexte

  useEffect(() => {
    const loadMatches = async () => {
      setLoading(true);
      try {
        // Vérifie si le club est bien défini avant de faire l'appel API
        if (selectedClub?.cl_no) {
          const data = await fetchMatchesForClub(cp_no, phase, poule, selectedClub.cl_no); // Appel API pour récupérer les matchs
          setMatches(data); // Met à jour l'état avec les données récupérées
        }
      } catch (error) {
        setError('Erreur lors de la récupération des matchs.'); // Gère l'erreur
      } finally {
        setLoading(false); // Met à jour le statut de chargement une fois l'opération terminée
      }
    };

    // Appelle loadMatches si le club est défini
    if (selectedClub?.cl_no) { 
      loadMatches();
    }

    // Nettoyage lors du démontage du composant
    return () => {
      setMatches([]); // Réinitialise les matchs lors du démontage
    };
  }, [selectedClub, competition]); // Ajout de `competition` comme dépendance


  // Filtrer les matchs en fonction du club et de la compétition sélectionnés
  const filteredMatches = matches; // Pas de filtrage, on garde tous les matchs
 // Se met à jour lorsque matches, selectedClub ou competition changent

  // Affiche un indicateur de chargement pendant que les données sont récupérées
  if (loading) {
    return <ActivityIndicator size="large" color="#ffffff" />;
  }

  // Affiche une alerte si une erreur s'est produite
  if (error) {
    Alert.alert("Erreur", error);
    return null; // Ne rien afficher si une erreur s'est produite
  }

  // Rendu du contenu
  return (
    <View style={styles.container}>
      {filteredMatches.length === 0 ? (
        <Text style={styles.error}>Aucun match trouvé pour {selectedClub?.name}.</Text>
      ) : (
        <ScrollView style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}>
          {filteredMatches.map((match) => (
            <View key={match.id} style={styles.matchItem}>
              <Text style={styles.matchDate}>
                {new Date(match.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {match.time} - {match.competitionName}
              </Text>
              <View style={styles.matchContent}>
                <View style={styles.matchDetailsTeam}>
                  <Image source={{ uri: match.homeLogo }} style={styles.teamLogo} />
                  <Text style={styles.teamName}>{match.homeTeam}</Text>
                </View>
                <Text style={styles.matchScore}>{match.home_score}</Text>
              </View>
              <View style={styles.matchContent}>
                <View style={styles.matchDetailsTeam}>
                  <Image source={{ uri: match.awayLogo }} style={styles.teamLogo} />
                  <Text style={styles.teamName}>{match.awayTeam}</Text>
                </View>
                <Text style={styles.matchScore}>{match.away_score}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

// Styles intégrés dans le même fichier
const styles = StyleSheet.create({
  container: {
    flex: 1, // Permet au conteneur de prendre tout l'espace disponible
    padding: 10 * scale, // Échelle appliquée ici
  },
  scrollContainer: {
    flexGrow: 1, // Assure que le contenu occupe tout l'espace disponible et peut défiler si nécessaire
  },
  matchItem: {
	borderWidth : 1,
    padding: 10 * scale, // Échelle appliquée ici
    marginBottom: 15 * scale, // Échelle appliquée ici
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    elevation: 2,
  },
  matchDate: {
    fontSize: 12 * scale, // Échelle appliquée ici
    color: '#aaaaaa',
    marginBottom: 10 * scale, // Échelle appliquée ici
    textAlign: 'center',
  },
  matchContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchDetailsTeam: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamLogo: {
    width: 20 * scale, // Échelle appliquée ici
    height: 20 * scale, // Échelle appliquée ici
    marginRight: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  teamName: {
    fontSize: 16 * scale, // Échelle appliquée ici
    color: '#ffffff',
  },
  matchScore: {
    fontSize: 18 * scale, // Échelle appliquée ici
    color: '#00A0E9',
    fontWeight: '700',
  },
  error: {
    color: 'red',
    textAlign: 'center',
  },
});

export default MatchsContent;
