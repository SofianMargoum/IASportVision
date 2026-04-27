import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { fetchClassementJournees } from './../../tools/api';
import { useClubContext } from './../../tools/ClubContext';
import LinearGradient from 'react-native-linear-gradient';

const scale = 0.85;

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

  const { selectedClub, competition, phase, poule, cp_no } = useClubContext();

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

        return isMyClub ? (
          <LinearGradient
            key={item.teamName ?? idx}
            colors={['rgba(0,160,233,0.15)', 'rgba(0,160,233,0.03)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.row, styles.myClubRow]}
          >
            {content}
          </LinearGradient>
        ) : (
          <View key={item.teamName ?? idx} style={styles.row}>
            {content}
          </View>
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

      <View style={{ height: 20 }} />
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
    padding: 16,
  },
  loadingText: {
    color: '#aaaaaa',
    fontSize: 14 * scale,
    marginTop: 10,
  },
  infoText: {
    color: '#aaaaaa',
    fontSize: 14 * scale,
    textAlign: 'center',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14 * scale,
    textAlign: 'center',
  },

  /* Table header */
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  thRank: {
    width: 30,
    textAlign: 'center',
  },
  thClub: {
    flex: 1,
    paddingLeft: 6,
  },
  thStat: {
    width: 32,
    textAlign: 'center',
  },
  thText: {
    color: '#aaaaaa',
    fontSize: 12 * scale,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  /* Rows */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
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
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: '#ffffff',
    fontSize: 13 * scale,
    fontWeight: 'bold',
  },

  /* Club cell */
  clubCell: {
    flex: 1,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  clubName: {
    color: '#ffffff',
    fontSize: 13 * scale,
    fontWeight: '500',
  },
  myClubName: {
    color: '#00A0E9',
    fontWeight: 'bold',
  },

  /* Stat cells */
  statCell: {
    width: 32,
    color: '#ffffff',
    fontSize: 13 * scale,
    textAlign: 'center',
    fontWeight: '600',
  },
  pointsText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14 * scale,
  },

  /* Legend */
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    color: '#aaaaaa',
    fontSize: 10 * scale,
  },
});

export default ClassementsContent;
