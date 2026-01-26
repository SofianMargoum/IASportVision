import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  BackHandler,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useEffectifContext } from './../../tools/EffectifContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Statistiques = ({ onBack }) => {
  const { effectif } = useEffectifContext();
  const [stats, setStats] = useState({});
  const [topThree, setTopThree] = useState([]);
  const [loadingPodium, setLoadingPodium] = useState(true);
function updateValue(numero, field, delta) {
  setStats((prev) => ({
    ...prev,
    [numero]: {
      ...prev[numero],
      [field]: Math.max(0, (prev[numero]?.[field] || 0) + delta),
    },
  }));
}

  // Gérer le bouton retour physique
  useEffect(() => {
    const backAction = () => {
      onBack();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [onBack]);

  // Charger les stats sauvegardées
  useEffect(() => {
    const loadStats = async () => {
      try {
        const saved = await AsyncStorage.getItem('@player_stats');
        if (saved) {
          setStats(JSON.parse(saved));
        } else {
          const initialStats = {};
          effectif.forEach((player) => {
            initialStats[player.numero] = {
              buts: 0,
              passes: 0,
              cles: 0,
              recups: 0,
            };
          });
          setStats(initialStats);
        }
      } catch (err) {
        console.error('Erreur de chargement des stats', err);
      }
    };
    loadStats();
  }, [effectif]);

  // Sauvegarder à chaque modification
  useEffect(() => {
    AsyncStorage.setItem('@player_stats', JSON.stringify(stats)).catch(() => {});
    calculerPodium(); // recalcul à chaque changement de stats
  }, [stats]);

  // Calcule le podium des meilleurs joueurs
  const calculerPodium = () => {
    if (!effectif.length) return;

    try {
      setLoadingPodium(true);
      const playersWithTotal = effectif.map((p) => {
        const s = stats[p.numero] || { buts: 0, passes: 0, cles: 0, recups: 0 };
        const total = s.buts + s.passes + s.cles + s.recups;
        return { ...p, total };
      });
      const sorted = playersWithTotal.sort((a, b) => b.total - a.total).slice(0, 3);
      setTopThree(sorted);
    } finally {
      setLoadingPodium(false);
    }
  };

  // Trouver le meilleur joueur pour chaque catégorie
  const getBestPlayer = (field) => {
    if (!effectif.length) return null;
    let best = null;
    let max = -1;
    effectif.forEach((p) => {
      const val = stats[p.numero]?.[field] || 0;
      if (val > max) {
        max = val;
        best = p;
      }
    });
    return { player: best, value: max };
  };

  const bestScorer = getBestPlayer('buts');
  const bestAssister = getBestPlayer('passes');
  const bestKeyPass = getBestPlayer('cles');
  const bestRecovery = getBestPlayer('recups');

  // Totaux d'équipe
  const totalTeam = (field) =>
    Object.values(stats).reduce((sum, s) => sum + (s[field] || 0), 0);

  const totalButs = totalTeam('buts');
  const totalPasses = totalTeam('passes');
  const totalCles = totalTeam('cles');
  const totalRecups = totalTeam('recups');

  const bestCards = [
    {
      label: 'Buteur',
      icon: require('./../../assets/but.png'),
      data: bestScorer,
    },
    {
      label: 'Passeur décisif',
      icon: require('./../../assets/oeil.png'),
      data: bestAssister,
    },
    {
      label: 'Passe clé',
      icon: require('./../../assets/cle.png'),
      data: bestKeyPass,
    },
    {
      label: 'Récupérateur',
      icon: require('./../../assets/interdit.png'),
      data: bestRecovery,
    },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Statistiques</Text>

        {/* 📊 Totaux d'équipe */}
        <View style={styles.totalContainer}>
          <Text style={styles.totalTitle}>📊 Totaux de l’équipe</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalText}>⚽ Buts : {totalButs}</Text>
            <Text style={styles.totalText}>🎯 Passes : {totalPasses}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalText}>🔑 Clés : {totalCles}</Text>
            <Text style={styles.totalText}>🧱 Récups : {totalRecups}</Text>
          </View>
        </View>

        {/* 🥇 Podium des joueurs */}
        <View style={styles.podiumContainer}>
          <Text style={styles.podiumTitle}>🏅 Podium des Joueurs</Text>

          {loadingPodium ? (
            <ActivityIndicator color="#00A0E9" style={{ marginTop: 10 }} />
          ) : topThree.length > 0 ? (
            <>
              <View style={styles.podiumRow}>
                {/* 2e place */}
                <View style={[styles.podiumItem, styles.secondPlace]}>
                  <Text style={[styles.podiumName, { color: '#C0C0C0' }]}>
                    {topThree[1]?.joueur || '-'}
                  </Text>
                  <Text style={styles.podiumScore}>{topThree[1]?.total || 0}</Text>
                </View>

                {/* 1re place */}
                <View style={[styles.podiumItem, styles.firstPlace]}>
                  <Text style={[styles.podiumName, { color: '#FFD700' }]}>
                    {topThree[0]?.joueur || '-'}
                  </Text>
                  <Text style={styles.podiumScore}>{topThree[0]?.total || 0}</Text>
                </View>

                {/* 3e place */}
                <View style={[styles.podiumItem, styles.thirdPlace]}>
                  <Text style={[styles.podiumName, { color: '#CD7F32' }]}>
                    {topThree[2]?.joueur || '-'}
                  </Text>
                  <Text style={styles.podiumScore}>{topThree[2]?.total || 0}</Text>
                </View>
              </View>
              <Image
                source={require('./../../assets/podium.png')}
                style={styles.podiumImage}
              />
            </>
          ) : (
            <Text style={styles.totalText}>Aucune donnée disponible</Text>
          )}
        </View>

        {/* 🏆 Meilleurs Joueurs */}
        <View style={styles.bestContainer}>
          <Text style={styles.bestTitle}>🏆 Meilleurs Joueurs</Text>

          <View style={styles.bestGrid}>
            {bestCards.map((card, index) => {
              const hasValue = card.data?.value > 0;
              return (
                <View
                  key={index}
                  style={[
                    styles.bestSquare,
                    hasValue && styles.bestSquareGlow,
                  ]}
                >
                  <Image source={card.icon} style={styles.bestIcon} />
                  <Text style={styles.bestLabel}>{card.label}</Text>
                  <Text style={styles.bestPlayer}>
                    {card.data?.player?.joueur || '-'} ({card.data?.value || 0})
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 📋 Liste des joueurs */}
        <FlatList
          data={effectif}
          keyExtractor={(item) => item.numero.toString()}
          renderItem={({ item }) => (
            <View style={styles.playerCard}>
              <Text style={styles.playerName}>
                {item.numero} - {item.joueur}
              </Text>

              <View style={styles.statsRow}>
                {['buts', 'passes', 'cles', 'recups'].map((field) => (
                  <View key={field} style={styles.counterBox}>
                    <Text style={styles.statLabel}>
                      {field === 'buts'
                        ? 'Buts'
                        : field === 'passes'
                        ? 'Passes'
                        : field === 'cles'
                        ? 'Clés'
                        : 'Récups'}
                    </Text>

                    <View style={styles.counter}>
                      <TouchableOpacity
                        style={styles.button}
                        onPress={() => updateValue(item.numero, field, 1)}
                      >
                        <Text style={styles.buttonText}>+</Text>
                      </TouchableOpacity>

                      <Text style={styles.valueText}>
                        {stats[item.numero]?.[field] || 0}
                      </Text>

                      <TouchableOpacity
                        style={styles.button}
                        onPress={() => updateValue(item.numero, field, -1)}
                      >
                        <Text style={styles.buttonText}>−</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
          contentContainerStyle={styles.list}
        />
      </ScrollView>

      {/* Bouton retour */}
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Retour</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent', width: '100%', height: '100%' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 20 },

  // --- Totaux ---
  totalContainer: {
    backgroundColor: '#010E1E',
    borderRadius: 10,
    marginBottom: 10,
    padding: 15,
  },
  totalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  totalText: { color: '#fff', fontSize: 14 },

  // --- Podium ---
  podiumContainer: {
    backgroundColor: '#010E1E',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  podiumTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  podiumRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    marginTop: 10,
  },
  podiumItem: { flex: 1, alignItems: 'center', marginHorizontal: 5 },
  firstPlace: { height: 70 },
  secondPlace: { height: 60 },
  thirdPlace: { height: 50 },
  podiumName: { fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  podiumScore: { color: '#fff', fontSize: 13, marginTop: 4, textAlign: 'center' },
  podiumImage: {
    opacity: 0.8,
    width: '100%',
    height: 100,
    resizeMode: 'contain',
    marginTop: 5,
  },

  // --- Meilleurs joueurs ---
  bestContainer: { backgroundColor: '#010E1E', borderRadius: 10, padding: 15, marginBottom: 20 },
  bestTitle: { fontSize: 20, color: '#fff', marginBottom: 10, fontWeight: 'bold', textAlign: 'center' },
  bestGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  bestSquare: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: '#0B1736',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  bestSquareGlow: { shadowColor: '#00A0E9', shadowOpacity: 0.7, shadowRadius: 10, elevation: 6 },
  bestIcon: { width: 40, height: 40, tintColor: '#FFD700', marginBottom: 6 },
  bestLabel: { color: '#ccc', fontSize: 14, marginBottom: 4, textAlign: 'center' },
  bestPlayer: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },

  // --- Liste joueurs ---
  playerCard: { backgroundColor: '#010E1E', borderRadius: 10, marginBottom: 15 },
  playerName: { fontSize: 18, fontWeight: 'bold', color: '#fff', padding: 10, marginBottom: 10 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  counterBox: { flex: 1, alignItems: 'center' },
  statLabel: { color: '#aaa', fontSize: 14, marginBottom: 5 },
  counter: { alignItems: 'center', backgroundColor: '#0B1736', borderRadius: 8, width: 45 },
  button: { alignItems: 'center', width: 45, height: 30, paddingVertical: 5 },
  buttonText: { color: '#fff', fontSize: 20, lineHeight: 24, fontWeight: 'bold' },
  valueText: { color: '#fff', fontSize: 18, marginVertical: 2 },
  list: { width: '100%' },

  // --- Bouton retour ---
  backButton: { width: '80%', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  backButtonText: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#001A31',
    borderRadius: 10,
    shadowColor: '#00A0E9',
    shadowOpacity: 1,
    elevation: 3,
    backgroundColor: '#010914',
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
  },
});

export default Statistiques;
