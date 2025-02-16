import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, ScrollView } from 'react-native';
import { fetchMatchesForClub, fetchClassementJournees } from './../api';
import { useClubContext } from './../ClubContext';
import LinearGradient from 'react-native-linear-gradient';

const scale = 0.85;

function StatsContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { selectedClub, competition, phase, poule, cp_no } = useClubContext();

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
        const classementsData = await fetchClassementJournees(cp_no, phase, poule);

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
    return data.reduce((prev, curr) => {
      const prevDifference = prev.goalsFor - prev.goalsAgainst;
      const currDifference = curr.goalsFor - curr.goalsAgainst;
      return currDifference > prevDifference ? { ...curr, goalDifference: currDifference } : { ...prev, goalDifference: prevDifference };
    }, { ...data[0], goalDifference: data[0].goalsFor - data[0].goalsAgainst });
  };
  
  const findLeastBalanced = (data) => {
    return data.reduce((prev, curr) => {
      const prevDifference = prev.goalsFor - prev.goalsAgainst;
      const currDifference = curr.goalsFor - curr.goalsAgainst;
      return currDifference < prevDifference ? { ...curr, goalDifference: currDifference } : { ...prev, goalDifference: prevDifference };
    }, { ...data[0], goalDifference: data[0].goalsFor - data[0].goalsAgainst });
  };
  
  // Affichage en cas d'erreur
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Erreur lors du chargement des statistiques : {error.message}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }}
    showsVerticalScrollIndicator={false} // Masquer la scrollbar verticale
    >
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
    fontSize: 14,
  },
  loadingText: {
    color: '#000',
    fontSize: 14,
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
    fontSize: 16 * scale,
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
    fontSize: 14 ,
    fontWeight: 'bold',
    color: '#640914',
    textAlign: 'center',
    marginBottom: 10,
  },  
  statTitlev: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#016D14',
    textAlign: 'center',
    marginBottom: 10,
  },
  statsText: {
    fontSize: 14 * scale,
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
    justifyContent: 'space-around', // Répartition équitable des podiums
    alignItems: 'flex-end', // Aligner les podiums en bas pour un effet visuel harmonieux
    marginTop: 10,
  },
  podiumItem: {
    flex: 1, // Chaque podium prend un tiers de la largeur
    alignItems: 'center', // Centrer le contenu horizontalement
    marginHorizontal: 5, // Espacement entre les podiums
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    padding: 5, // Ajout de padding pour contenir le texte
  },
  firstPlace: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    height: 60, // Hauteur maximale pour le podium de première place
    justifyContent: 'flex-start',
  },
  secondPlace: {
    color: '#C0C0C0',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    height: 50, // Hauteur légèrement inférieure pour la deuxième place
    justifyContent: 'center',
  },
  thirdPlace: {
    color: '#CD7F32',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: 'bold',
    height: 40, // Hauteur la plus basse pour la troisième place
    justifyContent: 'flex-end',
  },
  podiumText: {
    fontSize: 14, // Taille de texte unifiée
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 2, // Espacement interne pour éviter les débordements
    numberOfLines: 1, // Limite le texte à une ligne
    ellipsizeMode: 'tail', // Ajout des points de suspension pour les textes trop longs
  },
});

export default StatsContent;
