import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { fetchMatchesForClub } from './../../tools/api';
import { useClubContext } from './../../tools/ClubContext';

const scale = 0.85;

const MatchsContent = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { selectedClub, competition, phase, poule, cp_no } = useClubContext();

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      // Si le contexte n’est pas encore prêt, on attend.
      if (!selectedClub?.cl_no) {
        if (isMounted) {
          setMatches([]);
          setLoading(false);
        }
        return;
      }

      try {
        const data = await fetchMatchesForClub(cp_no, phase, poule, selectedClub.cl_no);
        if (isMounted) setMatches(Array.isArray(data) ? data : []);
      } catch (e) {
        if (isMounted) setError('Erreur lors de la récupération des matchs.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => { isMounted = false; };
  }, [selectedClub?.cl_no, competition, cp_no, phase, poule]);

  // --- Rendu ---

  // Contexte pas prêt
  if (!selectedClub?.cl_no && !loading) {
    return <Text style={styles.info}>Sélectionne un club pour voir les matchs.</Text>;
  }

  // En cours de chargement
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator />
        <Text style={styles.info}>Chargement des matchs…</Text>
      </View>
    );
  }

  // Erreur
  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  // Aucun match après chargement
  if (matches.length === 0) {
    return <Text style={styles.info}>Aucun match trouvé pour {selectedClub?.name || 'ce club'}.</Text>;
  }

  // Résultats
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {matches.map((match, index) => (
          <View key={match.id || `match-${index}`} style={styles.matchItem}>
            <Text style={styles.matchDate}>
              {new Date(match.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              {` - ${match.time} - ${match.competitionName}`}
            </Text>
            <View style={styles.matchContent}>
              <View style={styles.matchDetailsTeam}>
                {match.homeLogo ? <Image source={{ uri: match.homeLogo }} style={styles.teamLogo} /> : null}
                <Text style={styles.teamName}>{match.homeTeam}</Text>
              </View>
              <Text style={styles.matchScore}>{match.home_score}</Text>
            </View>
            <View style={styles.matchContent}>
              <View style={styles.matchDetailsTeam}>
                {match.awayLogo ? <Image source={{ uri: match.awayLogo }} style={styles.teamLogo} /> : null}
                <Text style={styles.teamName}>{match.awayTeam}</Text>
              </View>
              <Text style={styles.matchScore}>{match.away_score}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 * scale },
  scrollContainer: { flexGrow: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  info: { color: '#aaaaaa', textAlign: 'center', marginTop: 10 },
  error: { color: 'red', textAlign: 'center' },
  matchItem: {
    borderWidth: 1, padding: 10 * scale, marginBottom: 15 * scale,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16,
    borderColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 12, elevation: 2,
  },
  matchDate: { fontSize: 12 * scale, color: '#aaaaaa', marginBottom: 10 * scale, textAlign: 'center' },
  matchContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchDetailsTeam: { flexDirection: 'row', alignItems: 'center' },
  teamLogo: { width: 20 * scale, height: 20 * scale, marginRight: 10, borderRadius: 10, overflow: 'hidden' },
  teamName: { fontSize: 16 * scale, color: '#ffffff' },
  matchScore: { fontSize: 18 * scale, color: '#00A0E9', fontWeight: '700' },
});

export default MatchsContent;
