import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchClassementJournees, fetchClubByClNo } from './../../tools/api';
import { useClubContext } from './../../tools/ClubContext';
import LinearGradient from 'react-native-linear-gradient';
import { moderateScale, scale as s } from './../../tools/responsive';

const ms = moderateScale;

// â”€â”€â”€ Couleurs podium â”€â”€â”€
const rankColors = {
  1: '#FFD700',
  2: '#C0C0C0',
  3: '#CD7F32',
};

// â”€â”€â”€ Mini barre de progression sous le nom â”€â”€â”€
const ProgressMini = ({ value, max, color }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={miniStyles.track}>
      <View style={[miniStyles.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
};

const miniStyles = StyleSheet.create({
  track: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    marginTop: 3,
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});

function ClassementsContent() {
  const [classements, setClassements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { selectedClub, competition, phase, poule, cp_no, setSelectedClub, setClNo } = useClubContext();

  // Sélectionne un club du classement : même comportement que
  // SearchClub.handleClubClick. La compétition persistée n'est pas effacée
  // pour qu'elle soit réappliquée si elle existe pour le nouveau club.
  const handleOpponentClick = useCallback(
    async (clNo, name, logo) => {
      if (!clNo || clNo === selectedClub?.cl_no) return;

      // Complète le logo / nom via l'API si manquant
      // (l'endpoint classement_journees ne renvoie pas le logo).
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
        if (__DEV__) console.error('Erreur sélection club classement:', e?.message);
      }
    },
    [selectedClub, setSelectedClub, setClNo]
  );

  useEffect(() => {
    let isMounted = true;

    const loadClassements = async () => {
      setLoading(true);
      setError(null);

      if (!selectedClub?.cl_no) {
        if (isMounted) {
          setClassements([]);
          setLoading(false);
        }
        return;
      }

      try {
        const data = await fetchClassementJournees(cp_no, phase, poule);
        if (isMounted) setClassements(Array.isArray(data) ? data : []);
      } catch (e) {
        if (isMounted) setError('Erreur lors du chargement des classements.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadClassements();
    return () => { isMounted = false; };
  }, [selectedClub?.cl_no, competition, cp_no, phase, poule]);

  const maxPoints = useMemo(() => {
    if (!classements.length) return 0;
    return Math.max(...classements.map((c) => c.points));
  }, [classements]);

  const isSelectedClub = (teamName) => {
    if (!selectedClub?.name || !teamName) return false;
    return (
      teamName.toLowerCase().includes(selectedClub.name.toLowerCase()) ||
      selectedClub.name.toLowerCase().includes(teamName.toLowerCase())
    );
  };

  // â”€â”€â”€ Ã‰tats de rendu â”€â”€â”€

  if (!selectedClub?.cl_no && !loading && !error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.infoText}>SÃ©lectionne un club pour voir le classement.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00A0E9" />
        <Text style={styles.loadingText}>Chargement du classementâ€¦</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (classements.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.infoText}>
          Aucun classement trouvÃ©{selectedClub?.name ? ` pour ${selectedClub.name}` : ''}.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* â•â•â•â•â•â• EN-TÃŠTE TABLEAU â•â•â•â•â•â• */}
      <View style={styles.tableHeader}>
        <Text style={[styles.thRank, styles.thText]}>#</Text>
        <Text style={[styles.thClub, styles.thText]}>Club</Text>
        <Text style={[styles.thStat, styles.thText]}>Pts</Text>
        <Text style={[styles.thStat, styles.thText]}>MJ</Text>
        <Text style={[styles.thStat, styles.thText]}>G</Text>
        <Text style={[styles.thStat, styles.thText]}>N</Text>
        <Text style={[styles.thStat, styles.thText]}>P</Text>
        <Text style={[styles.thStat, styles.thText]}>DB</Text>
      </View>

      {/* â•â•â•â•â•â• LIGNES â•â•â•â•â•â• */}
      {classements.map((item, idx) => {
        const isMyClub = isSelectedClub(item.teamName);
        const goalDiff = (item.goalsFor ?? 0) - (item.goalsAgainst ?? 0);
        const podiumColor = rankColors[item.rank];

        const content = (
          <RowContent
            item={item}
            goalDiff={goalDiff}
            podiumColor={podiumColor}
            isMyClub={isMyClub}
            maxPoints={maxPoints}
          />
        );

        const onPress = () => handleOpponentClick(item.clNo, item.clubName || item.teamName, item.clubLogo);
        const disabled = !item.clNo || item.clNo === selectedClub?.cl_no;

        return isMyClub ? (
          <TouchableOpacity
            key={item.teamName ?? idx}
            activeOpacity={0.7}
            disabled={disabled}
            onPress={onPress}
          >
            <LinearGradient
              colors={['rgba(0,160,233,0.15)', 'rgba(0,160,233,0.03)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.row, styles.myClubRow]}
            >
              {content}
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            key={item.teamName ?? idx}
            activeOpacity={0.7}
            disabled={disabled}
            onPress={onPress}
            style={styles.row}
          >
            {content}
          </TouchableOpacity>
        );
      })}

      {/* â•â•â•â•â•â• LÃ‰GENDE â•â•â•â•â•â• */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#016D14' }]} />
          <Text style={styles.legendText}>G = GagnÃ©</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F5A623' }]} />
          <Text style={styles.legendText}>N = Nul</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#D0021B' }]} />
          <Text style={styles.legendText}>P = Perdu</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={[styles.legendText]}>DB = Diff. buts</Text>
        </View>
      </View>

      <View style={{ height: s(20) }} />
    </ScrollView>
  );
}

// â”€â”€â”€ Contenu d'une ligne â”€â”€â”€
const RowContent = ({ item, goalDiff, podiumColor, isMyClub, maxPoints }) => (
  <>
    {/* Rang */}
    <View style={styles.rankCell}>
      {podiumColor ? (
        <View style={[styles.rankBadge, { backgroundColor: `${podiumColor}22` }]}>
          <Text style={[styles.rankText, { color: podiumColor }]}>{item.rank}</Text>
        </View>
      ) : (
        <Text style={styles.rankText}>{item.rank}</Text>
      )}
    </View>

    {/* Club */}
    <View style={styles.clubCell}>
      <Text
        style={[styles.clubName, isMyClub && styles.myClubName]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {item.teamName}
      </Text>
      <ProgressMini
        value={item.points}
        max={maxPoints}
        color={isMyClub ? '#00A0E9' : 'rgba(255,255,255,0.3)'}
      />
    </View>

    {/* Points */}
    <Text style={[styles.statCell, styles.pointsText]}>{item.points}</Text>

    {/* MJ */}
    <Text style={styles.statCell}>{item.totalGames}</Text>

    {/* G */}
    <Text style={[styles.statCell, { color: '#016D14' }]}>{item.wonGames}</Text>

    {/* N */}
    <Text style={[styles.statCell, { color: '#F5A623' }]}>{item.drawGames}</Text>

    {/* P */}
    <Text style={[styles.statCell, { color: '#D0021B' }]}>{item.lostGames}</Text>

    {/* DB */}
    <Text
      style={[
        styles.statCell,
        { color: goalDiff > 0 ? '#016D14' : goalDiff < 0 ? '#D0021B' : '#aaaaaa' },
      ]}
    >
      {goalDiff > 0 ? `+${goalDiff}` : goalDiff}
    </Text>
  </>
);

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#010914',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: s(16),
  },
  loadingText: {
    color: '#aaaaaa',
    fontSize: ms(13),
    marginTop: s(10),
  },
  infoText: {
    color: '#aaaaaa',
    fontSize: ms(13),
    textAlign: 'center',
  },
  errorText: {
    color: '#FF4444',
    fontSize: ms(13),
    textAlign: 'center',
  },

  /* Table header */
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(10),
    paddingHorizontal: s(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  thRank: {
    width: s(28),
    textAlign: 'center',
  },
  thClub: {
    flex: 1,
    paddingLeft: s(6),
  },
  thStat: {
    width: s(30),
    textAlign: 'center',
  },
  thText: {
    color: '#aaaaaa',
    fontSize: ms(11),
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  /* Rows */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(10),
    paddingHorizontal: s(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  myClubRow: {
    borderLeftWidth: 3,
    borderLeftColor: '#00A0E9',
    borderBottomColor: 'rgba(0,160,233,0.15)',
  },

  /* Rank cell */
  rankCell: {
    width: s(28),
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadge: {
    width: ms(24),
    height: ms(24),
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: '#ffffff',
    fontSize: ms(12),
    fontWeight: 'bold',
  },

  /* Club cell */
  clubCell: {
    flex: 1,
    paddingHorizontal: s(6),
    justifyContent: 'center',
  },
  clubName: {
    color: '#ffffff',
    fontSize: ms(12),
    fontWeight: '500',
  },
  myClubName: {
    color: '#00A0E9',
    fontWeight: 'bold',
  },

  /* Stat cells */
  statCell: {
    width: s(30),
    color: '#ffffff',
    fontSize: ms(12),
    textAlign: 'center',
    fontWeight: '600',
  },
  pointsText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: ms(13),
  },

  /* Legend */
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingVertical: s(14),
    paddingHorizontal: s(16),
    gap: s(12),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
    marginRight: s(4),
  },
  legendText: {
    color: '#aaaaaa',
    fontSize: ms(10),
  },
});

export default ClassementsContent;
