import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, ScrollView } from 'react-native';
import { fetchMatchesForClub, fetchClassementJournees } from './../api';
import { useClubContext } from './../ClubContext';
import LinearGradient from 'react-native-linear-gradient';

const scale = 0.85;

function StatsContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { selectedClub, competition } = useClubContext();

  // Statistiques supplémentaires
  const [bestAttack, setBestAttack] = useState(null);
  const [worstAttack, setWorstAttack] = useState(null);
  const [bestDefense, setBestDefense] = useState(null);
  const [worstDefense, setWorstDefense] = useState(null);
  const [mostBalanced, setMostBalanced] = useState(null);
  const [leastBalanced, setLeastBalanced] = useState(null);

  // Podium des 3 premières équipes
  const [topThree, setTopThree] = useState([]);

  useEffect(() => {
    const loadClassements = async () => {
      setLoading(true);
      setError(null);

      if (!selectedClub) {
        setError(new Error('Aucun club sélectionné.'));
        setLoading(false);
        return;
      }

      try {
        const matches = await fetchMatchesForClub(selectedClub.cl_no);
        const foundMatch = matches.find(match => match.competitionName === competition);

        if (!foundMatch) {
          throw new Error('Aucun match trouvé pour la compétition sélectionnée.');
        }

        const { competitionNumber, phaseNumber, pouleNumber } = foundMatch;
        const classementsData = await fetchClassementJournees(competitionNumber, phaseNumber, pouleNumber);

        // Calcul des statistiques supplémentaires
        setBestAttack(findBestAttack(classementsData));
        setWorstAttack(findWorstAttack(classementsData));
        setBestDefense(findBestDefense(classementsData));
        setWorstDefense(findWorstDefense(classementsData));
        setMostBalanced(findMostBalanced(classementsData));
        setLeastBalanced(findLeastBalanced(classementsData));

        // Sélection des trois meilleures équipes pour le podium
        const sortedTeams = classementsData.sort((a, b) => b.points - a.points); // Trie par points
        setTopThree(sortedTeams.slice(0, 3)); // Les trois premières équipes
      } catch (error) {
        console.error("Error fetching data:", error);
        setError(error);
      } finally {
        setLoading(false);
      }
    };

    loadClassements();
  }, [selectedClub, competition]);

  // Fonctions de calcul pour les meilleures et pires statistiques
  const findBestAttack = (data) => {
    return data.reduce((prev, curr) => (curr.goalsFor > prev.goalsFor ? curr : prev), data[0]);
  };

  const findWorstAttack = (data) => {
    return data.reduce((prev, curr) => (curr.goalsFor < prev.goalsFor ? curr : prev), data[0]);
  };

  const findBestDefense = (data) => {
    return data.reduce((prev, curr) => (curr.goalsAgainst < prev.goalsAgainst ? curr : prev), data[0]);
  };

  const findWorstDefense = (data) => {
    return data.reduce((prev, curr) => (curr.goalsAgainst > prev.goalsAgainst ? curr : prev), data[0]);
  };

  const findMostBalanced = (data) => {
    return data.reduce((prev, curr) => (
      Math.abs(curr.goalDifference) < Math.abs(prev.goalDifference) ? curr : prev
    ), data[0]);
  };

  const findLeastBalanced = (data) => {
    return data.reduce((prev, curr) => (
      Math.abs(curr.goalDifference) > Math.abs(prev.goalDifference) ? curr : prev
    ), data[0]);
  };

  // Affichage si les données sont en cours de chargement
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00BFFF" />
        <Text style={styles.loadingText}>Chargement des statistiques...</Text>
      </View>
    );
  }

  // Affichage en cas d'erreur
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Erreur lors du chargement des statistiques : {error.message}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }}>
      <View style={styles.statsContainer}>
                {/* Podium des 3 premières équipes */}
                <View style={styles.statBlock}>
          <View style={styles.podiumContainer}>
            {/* Deuxième : À gauche */}
            <View style={[styles.podiumItem, styles.secondPlace]}>
              <Text style={styles.secondPlace}>{topThree[1]?.teamName}</Text>
            </View>

            {/* Premier : Meilleur club au centre */}
            <View style={[styles.podiumItem, styles.firstPlace]}>
              <Text style={styles.firstPlace}>{topThree[0]?.teamName}</Text>
            </View>

            {/* Troisième : À droite */}
            <View style={[styles.podiumItem, styles.thirdPlace]}>
              <Text style={styles.thirdPlace}>{topThree[2]?.teamName}</Text>
            </View>
          </View>
          <Image source={require('../../assets/podium.png')} style={styles.statsImagepe} />
        </View>
        
      <View style={styles.hrContainer}>
        <View style={[styles.hr, { backgroundColor: '#fff', opacity: 0.1 }]} />
      </View>
        {/* Attaque */}
        <View style={styles.statBlock}>
          <Text style={styles.statCategory}>ATTAQUE</Text>
          <View style={styles.statRow}>
          <LinearGradient
      colors={['#016D14', '#010914']} // Couleurs du dégradé
      start={{ x: 0, y: 0 }} // Point de départ à gauche
      end={{ x: 0.1, y: 0 }}   // Point de fin à droite
      style={[styles.statColumn, styles.bestStatBlock]}>
      <Text style={styles.statTitlev}>Meilleure attaque</Text>
      <Text style={styles.statsText}>{bestAttack?.teamName}</Text>
      <View style={styles.statsRow}>
        <Text style={styles.statsText}>{bestAttack?.goalsFor} buts</Text>
      </View>
    </LinearGradient>

            {/* Image entre les deux blocs */}
            <Image source={require('../../assets/actionsblanc.png')} style={styles.statsImage} />
            <LinearGradient
      colors={['#010914', '#640914']} // Couleurs du dégradé
      start={{ x: 0.9, y: 0 }} // Point de départ à gauche
      end={{ x: 1, y: 0 }}   // Point de fin à droite
      style={[styles.statColumn, styles.worstStatBlock]}>
              <Text style={styles.statTitle}>Pire attaque</Text>
              <Text style={styles.statsText}>{worstAttack?.teamName}</Text>
              <View style={styles.statsRow}>
                <Text style={styles.statsText}>{worstAttack?.goalsFor} buts</Text>
              </View>
              </LinearGradient>
          </View>
        </View>

        {/* Défense */}
        <View style={styles.statBlock}>
          <Text style={styles.statCategory}>DÉFENSE</Text>
            <View style={styles.statRow}>
          <LinearGradient
      colors={['#016D14', '#010914']} // Couleurs du dégradé
      start={{ x: 0, y: 0 }} // Point de départ à gauche
      end={{ x: 0.1, y: 0 }}   // Point de fin à droite
      style={[styles.statColumn, styles.bestStatBlock]}>
              <Text style={styles.statTitlev}>Meilleure défense</Text>
              <Text style={styles.statsText}>{bestDefense?.teamName}</Text>
              <View style={styles.statsRow}>
                <Text style={styles.statsText}>{bestDefense?.goalsAgainst} buts encaissés</Text>
              </View>
              </LinearGradient>

            {/* Image entre les deux blocs */}
            <Image source={require('../../assets/bouclier.png')} style={styles.statsImage} />

            <LinearGradient
      colors={['#010914', '#640914']} // Couleurs du dégradé
      start={{ x: 0.9, y: 0 }} // Point de départ à gauche
      end={{ x: 1, y: 0 }}   // Point de fin à droite
      style={[styles.statColumn, styles.worstStatBlock]}>
              <Text style={styles.statTitle}>Pire défense</Text>
              <Text style={styles.statsText}>{worstDefense?.teamName}</Text>
              <View style={styles.statsRow}>
                <Text style={styles.statsText}>{worstDefense?.goalsAgainst} buts encaissés</Text>
                </View>
                </LinearGradient>
       </View>
       </View>

        {/* Équilibre */}
        <View style={styles.statBlock}>
          <Text style={styles.statCategory}>ÉQUILIBRE</Text>
          <View style={styles.statRow}>
          <LinearGradient
      colors={['#016D14', '#010914']} // Couleurs du dégradé
      start={{ x: 0, y: 0 }} // Point de départ à gauche
      end={{ x: 0.1, y: 0 }}   // Point de fin à droite
      style={[styles.statColumn, styles.bestStatBlock]}>
              <Text style={styles.statTitlev}>Plus équilibrée</Text>
              <Text style={styles.statsText}>{mostBalanced?.teamName}</Text>
              <View style={styles.statsRow}>
                <Text style={styles.statsText}>Différence : {mostBalanced?.goalDifference}</Text>
              </View>
              </LinearGradient>

            {/* Image entre les deux blocs */}
            <Image source={require('../../assets/equilibre.png')} style={styles.statsImage} />

            <LinearGradient
      colors={['#010914', '#640914']} // Couleurs du dégradé
      start={{ x: 0.9, y: 0 }} // Point de départ à gauche
      end={{ x: 1, y: 0 }}   // Point de fin à droite
      style={[styles.statColumn, styles.worstStatBlock]}>

      <Text style={styles.statTitle}>Moins équilibrée</Text>
      <Text style={styles.statsText}>{leastBalanced?.teamName}</Text>
      <View style={styles.statsRow}>
        <Text style={styles.statsText}>Différence : {leastBalanced?.goalDifference}</Text>
      </View>

    </LinearGradient>

          </View>
        </View>


      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
    fontSize: 18,
  },
  loadingText: {
    color: '#000',
    fontSize: 18,
  },
  statsContainer: {
    marginTop: 10,
  },
  hrContainer: {
    alignItems: 'center',
    marginBottom:10,
  },
  hr: {
    height: 2,
    width: '100%',
    marginVertical: 10,
  },
  statCategory: {
    fontSize: 20 * scale,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statColumn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTitle: {
    fontSize: 19 * scale,
    fontWeight: 'bold',
    color: '#640914',
    textAlign: 'center',
    marginBottom: 10,
  },  
  statTitlev: {
    fontSize: 19 * scale,
    fontWeight: 'bold',
    color: '#016D14',
    textAlign: 'center',
    marginBottom: 10,
  },
  statsText: {
    fontSize: 15 * scale,
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  statsRow: {
    marginTop: 5,
  },
  statsImage: {
    width: 70 * scale,
    height: 70 * scale,
    borderRadius: 35 * scale,
    marginVertical: 15 * scale,
    borderWidth: 3 * scale,
    margin: 10,
    opacity:0.8,
  },
  statsImagepe: {
    
  opacity:0.8,
  width: '100%',  // Prendre toute la largeur disponible
  height: 100,  // Fixer une hauteur maximale pour l'image
  resizeMode: 'contain',  // Garder l'image dans les limites de son conteneur sans la déformer
  },
  
  statsImagep1: {
    width: 130 * scale,
    height: 200 * scale,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3 * scale,
  },
  statsImagep2: {
    width: 150 * scale,
    height: 200 * scale,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3 * scale,
  },
  statBlock: {
    marginVertical: 10,
  },
  bestStatBlock: {
    padding: 10,
  },
  worstStatBlock: {
    padding: 10,
  },
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 10,
  },
  podiumItem: {
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  firstPlace: {
    color: '#FFD700', // Texte en noir
    zIndex: 3,
    fontSize: 18 * scale,
    paddingHorizontal :2,
    justifyContent: 'flex-start',
    fontWeight: 'bold',
    height:50,
  },
  secondPlace: {
    zIndex: 2,
    color: '#C0C0C0',
    fontSize: 18 * scale,
    height:30,
    justifyContent: 'center',
    fontWeight: 'bold',
  },
  thirdPlace: {
    color: '#CD7F32',
    fontSize: 18 * scale,
    justifyContent: 'flex-end',
    height:18,
    fontWeight: 'bold',
  },
});

export default StatsContent;
