import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, ScrollView, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchMatchesForClub, fetchClubByClNo } from './../../tools/api';
import { useClubContext } from './../../tools/ClubContext';
import { moderateScale, scale as s } from './../../tools/responsive';

const ms = moderateScale;

const CalendrierContent = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { selectedClub, competition, phase, poule, cp_no, setSelectedClub, setClNo } = useClubContext();

  const handleOpponentClick = useCallback(
    async (clNo, name, logo) => {
      if (!clNo || clNo === selectedClub?.cl_no) return;

      let resolvedName = name || '';
      let resolvedLogo = logo || '';
      if (!resolvedLogo) {
        const fetched = await fetchClubByClNo(clNo);
        if (fetched) {
          resolvedLogo = fetched.logo || resolvedLogo;
          resolvedName = resolvedName || fetched.name || '';
        }
      }

      const club = { cl_no: clNo, name: resolvedName, logo: resolvedLogo };
      setSelectedClub(club);
      setClNo(clNo);

      try {
        await AsyncStorage.setItem('selectedClub', JSON.stringify(club));
        const stored = await AsyncStorage.getItem('recentClubs');
        let recent = [];
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) recent = parsed;
          } catch { /* ignore */ }
        }
        const updated = [club, ...recent.filter((c) => c?.cl_no !== clNo)].slice(0, 3);
        await AsyncStorage.setItem('recentClubs', JSON.stringify(updated));
      } catch (e) {
        if (__DEV__) console.error('Erreur sélection club adversaire:', e?.message);
      }
    },
    [selectedClub, setSelectedClub, setClNo]
  );

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      if (!selectedClub?.cl_no) {
        if (isMounted) {
          setMatches([]);
          setLoading(false);
        }
        return;
      }

      try {
        const data = await fetchMatchesForClub(cp_no, phase, poule, selectedClub.cl_no);
        if (isMounted) {
          // On garde uniquement les matchs à venir : score non encore renseigné
          const upcoming = Array.isArray(data)
            ? data
                .filter((m) => m.home_score == null && m.away_score == null)
                .sort((a, b) => new Date(a.date) - new Date(b.date))
            : [];
          setMatches(upcoming);
        }
      } catch (e) {
        if (isMounted) setError('Erreur lors de la récupération du calendrier.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => { isMounted = false; };
  }, [selectedClub?.cl_no, competition, cp_no, phase, poule]);

  // --- Rendu ---

  if (!selectedClub?.cl_no && !loading) {
    return <Text style={styles.info}>Sélectionne un club pour voir le calendrier.</Text>;
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator />
        <Text style={styles.info}>Chargement du calendrier…</Text>
      </View>
    );
  }

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  if (matches.length === 0) {
    return <Text style={styles.info}>Aucun match à venir pour {selectedClub?.name || 'ce club'}.</Text>;
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {matches.map((match, index) => (
          <View key={match.id || `cal-${index}`} style={styles.matchItem}>
            {/* Date + compétition */}
            <Text style={styles.matchDate}>
              {new Date(match.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              {match.time ? ` - ${match.time}` : ''}
              {match.competitionName ? ` - ${match.competitionName}` : ''}
            </Text>

            {/* Équipe domicile */}
            <View style={styles.matchContent}>
              <TouchableOpacity
                style={styles.matchDetailsTeam}
                activeOpacity={0.6}
                disabled={!match.homeClNo}
                onPress={() => handleOpponentClick(match.homeClNo, match.homeClubName || match.homeTeam, match.homeLogo)}
              >
                {match.homeLogo ? <Image source={{ uri: match.homeLogo }} style={styles.teamLogo} /> : null}
                <Text style={styles.teamName}>{match.homeTeam}</Text>
              </TouchableOpacity>
            </View>

            {/* Équipe extérieure */}
            <View style={styles.matchContent}>
              <TouchableOpacity
                style={styles.matchDetailsTeam}
                activeOpacity={0.6}
                disabled={!match.awayClNo}
                onPress={() => handleOpponentClick(match.awayClNo, match.awayClubName || match.awayTeam, match.awayLogo)}
              >
                {match.awayLogo ? <Image source={{ uri: match.awayLogo }} style={styles.teamLogo} /> : null}
                <Text style={styles.teamName}>{match.awayTeam}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: s(10) },
  scrollContainer: { flexGrow: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  info: { color: '#aaaaaa', textAlign: 'center', marginTop: s(10) },
  error: { color: 'red', textAlign: 'center' },
  matchItem: {
    borderWidth: 1, padding: s(10), marginBottom: s(12),
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16,
    borderColor: 'rgba(255, 255, 255, 0.2)', borderRadius: ms(12), elevation: 2,
  },
  matchDate: { fontSize: ms(11), color: '#aaaaaa', marginBottom: s(8), textAlign: 'center' },
  matchContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchDetailsTeam: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: s(8) },
  teamLogo: { width: ms(20), height: ms(20), marginRight: s(8), borderRadius: ms(10), overflow: 'hidden' },
  teamName: { fontSize: ms(14), color: '#ffffff', flexShrink: 1 },
});

export default CalendrierContent;
