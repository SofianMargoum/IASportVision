import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { fetchMatchesForClub, fetchClassementJournees } from './../../tools/api';
import { useClubContext } from './../../tools/ClubContext';
import LinearGradient from 'react-native-linear-gradient';

const scale = 0.85;

const ClubContent = () => {
  const { selectedClub, competition, phase, poule, cp_no } = useClubContext();

  const [matches, setMatches] = useState([]);
  const [classement, setClassement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      if (!selectedClub?.cl_no) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const [matchData, classData] = await Promise.all([
          fetchMatchesForClub(cp_no, phase, poule, selectedClub.cl_no),
          fetchClassementJournees(cp_no, phase, poule),
        ]);

        if (!isMounted) return;

        setMatches(Array.isArray(matchData) ? matchData : []);

        // Trouver la ligne classement du club
        const clubRow = Array.isArray(classData)
          ? classData.find(
              (r) =>
                r.teamName?.toLowerCase().includes(selectedClub.name?.toLowerCase()) ||
                selectedClub.name?.toLowerCase().includes(r.teamName?.toLowerCase())
            )
          : null;
        setClassement(clubRow || null);
      } catch (e) {
        if (isMounted) setError('Erreur lors du chargement des données.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => { isMounted = false; };
  }, [selectedClub?.cl_no, competition, cp_no, phase, poule]);

  // --- Stats déduites des matchs ---
  const stats = useMemo(() => {
    if (!matches.length || !selectedClub) return null;

    const clubName = selectedClub.name?.toLowerCase() || '';

    // Matchs joués (score non nul ou date passée)
    const played = matches.filter(
      (m) => m.home_score != null && m.away_score != null
    );

    let wins = 0, draws = 0, losses = 0;
    let goalsScored = 0, goalsConceded = 0;
    let homeWins = 0, homeDraws = 0, homeLosses = 0;
    let awayWins = 0, awayDraws = 0, awayLosses = 0;
    let homeGames = 0, awayGames = 0;
    let biggestWin = null, biggestLoss = null;
    let cleanSheets = 0;
    let matchesScored = 0; // matchs où on a marqué

    played.forEach((m) => {
      const isHome =
        m.homeTeam?.toLowerCase().includes(clubName) ||
        clubName.includes(m.homeTeam?.toLowerCase());
      const myScore = isHome ? m.home_score : m.away_score;
      const oppScore = isHome ? m.away_score : m.home_score;

      goalsScored += myScore;
      goalsConceded += oppScore;

      if (myScore > oppScore) {
        wins++;
        if (isHome) homeWins++;
        else awayWins++;
      } else if (myScore === oppScore) {
        draws++;
        if (isHome) homeDraws++;
        else awayDraws++;
      } else {
        losses++;
        if (isHome) homeLosses++;
        else awayLosses++;
      }

      if (isHome) homeGames++;
      else awayGames++;

      if (oppScore === 0) cleanSheets++;
      if (myScore > 0) matchesScored++;

      const diff = myScore - oppScore;
      if (!biggestWin || diff > biggestWin.diff) {
        biggestWin = { ...m, diff, myScore, oppScore, isHome };
      }
      if (!biggestLoss || diff < biggestLoss.diff) {
        biggestLoss = { ...m, diff, myScore, oppScore, isHome };
      }
    });

    // Forme des 5 derniers matchs (triés par date desc)
    const sorted = [...played].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
    const lastFive = sorted.slice(0, 5).map((m) => {
      const isHome =
        m.homeTeam?.toLowerCase().includes(clubName) ||
        clubName.includes(m.homeTeam?.toLowerCase());
      const myScore = isHome ? m.home_score : m.away_score;
      const oppScore = isHome ? m.away_score : m.home_score;
      if (myScore > oppScore) return 'V';
      if (myScore === oppScore) return 'N';
      return 'D';
    });

    // Série en cours
    let currentStreak = { type: lastFive[0], count: 0 };
    for (const r of lastFive) {
      if (r === currentStreak.type) currentStreak.count++;
      else break;
    }

    const totalPlayed = played.length;
    const avgGoalsScored = totalPlayed > 0 ? (goalsScored / totalPlayed).toFixed(1) : '0';
    const avgGoalsConceded = totalPlayed > 0 ? (goalsConceded / totalPlayed).toFixed(1) : '0';
    const winRate = totalPlayed > 0 ? Math.round((wins / totalPlayed) * 100) : 0;

    return {
      totalPlayed,
      wins,
      draws,
      losses,
      goalsScored,
      goalsConceded,
      goalDiff: goalsScored - goalsConceded,
      homeGames,
      awayGames,
      homeWins,
      homeDraws,
      homeLosses,
      awayWins,
      awayDraws,
      awayLosses,
      cleanSheets,
      matchesScored,
      avgGoalsScored,
      avgGoalsConceded,
      winRate,
      lastFive,
      currentStreak,
      biggestWin,
      biggestLoss,
      totalMatches: matches.length,
      upcoming: matches.length - totalPlayed,
    };
  }, [matches, selectedClub]);

  // --- Rendu ---

  if (!selectedClub?.cl_no && !loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.info}>Sélectionne un club pour voir ses statistiques.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#C0C0C0" />
        <Text style={styles.loadingText}>Chargement des statistiques…</Text>
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

  const formColor = (r) => {
    if (r === 'V') return '#016D14';
    if (r === 'N') return '#F5A623';
    return '#D0021B';
  };

  const streakLabel = (type) => {
    if (type === 'V') return 'victoire(s)';
    if (type === 'N') return 'nul(s)';
    return 'défaite(s)';
  };

  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      {/* === CLASSEMENT ACTUEL === */}
      {classement && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CLASSEMENT</Text>
          <View style={styles.rankBadgeContainer}>
            <LinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.04)']}
              style={styles.rankBadge}
            >
              <Text style={styles.rankNumber}>{classement.rank}</Text>
              <Text style={styles.rankSuffix}>
                {classement.rank === 1 ? 'er' : 'e'}
              </Text>
            </LinearGradient>
            <View style={styles.rankDetails}>
              <Text style={styles.rankPoints}>{classement.points} pts</Text>
              <Text style={styles.rankSub}>
                {classement.totalGames} matchs joués
              </Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <StatBox label="Victoires" value={classement.wonGames} color="#016D14" />
            <StatBox label="Nuls" value={classement.drawGames} color="#F5A623" />
            <StatBox label="Défaites" value={classement.lostGames} color="#D0021B" />
            <StatBox label="Forfaits" value={classement.forfeits} color="#aaaaaa" />
          </View>
        </View>
      )}

      {/* === FORME DU MOMENT === */}
      {stats && stats.lastFive.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FORME DU MOMENT</Text>
          <View style={styles.formRow}>
            {stats.lastFive.map((r, i) => (
              <View key={i} style={[styles.formBadge, { backgroundColor: formColor(r) }]}>
                <Text style={styles.formText}>{r}</Text>
              </View>
            ))}
          </View>
          {stats.currentStreak.count > 0 && (
            <Text style={styles.streakText}>
              Série en cours : {stats.currentStreak.count} {streakLabel(stats.currentStreak.type)}
            </Text>
          )}
          <View style={styles.winRateContainer}>
            <Text style={styles.winRateLabel}>Taux de victoire</Text>
            <View style={styles.progressBarBg}>
              <LinearGradient
                colors={['#016D14', '#010914']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressBarFill, { width: `${stats.winRate}%` }]}
              />
            </View>
            <Text style={styles.winRateValue}>{stats.winRate}%</Text>
          </View>
        </View>
      )}

      {/* === BUTS === */}
      {stats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BUTS</Text>
          <View style={styles.goalsRow}>
            <LinearGradient
              colors={['#016D14', '#010914']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.15, y: 0 }}
              style={styles.goalCard}
            >
              <Image source={require('../../assets/but.png')} style={styles.goalIcon} />
              <Text style={styles.goalValue}>{stats.goalsScored}</Text>
              <Text style={styles.goalLabel}>Marqués</Text>
              <Text style={styles.goalAvg}>~{stats.avgGoalsScored}/match</Text>
            </LinearGradient>

            <LinearGradient
              colors={['#010914', '#640914']}
              start={{ x: 0.85, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.goalCard}
            >
              <Image source={require('../../assets/bouclier.png')} style={styles.goalIcon} />
              <Text style={styles.goalValue}>{stats.goalsConceded}</Text>
              <Text style={styles.goalLabel}>Encaissés</Text>
              <Text style={styles.goalAvg}>~{stats.avgGoalsConceded}/match</Text>
            </LinearGradient>
          </View>

          <View style={styles.diffRow}>
            <Text style={styles.diffLabel}>Différence de buts</Text>
            <Text
              style={[
                styles.diffValue,
                { color: stats.goalDiff >= 0 ? '#016D14' : '#D0021B' },
              ]}
            >
              {stats.goalDiff >= 0 ? '+' : ''}
              {stats.goalDiff}
            </Text>
          </View>

          <View style={styles.statsGrid}>
            <StatBox label="Clean sheets" value={stats.cleanSheets} color="#016D14" />
            <StatBox
              label="Matchs où a marqué"
              value={stats.matchesScored}
              color="#C0C0C0"
            />
          </View>
        </View>
      )}

      {/* === BILAN DÉTAILLÉ === */}
      {stats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BILAN DÉTAILLÉ</Text>
          <View style={styles.bilanTable}>
            <View style={styles.bilanHeaderRow}>
              <Text style={[styles.bilanHeaderCell, { flex: 2 }]}></Text>
              <Text style={styles.bilanHeaderCell}>MJ</Text>
              <Text style={styles.bilanHeaderCell}>V</Text>
              <Text style={styles.bilanHeaderCell}>N</Text>
              <Text style={styles.bilanHeaderCell}>D</Text>
            </View>
            <View style={styles.bilanRow}>
              <Text style={[styles.bilanCell, styles.bilanLabel, { flex: 2 }]}>Total</Text>
              <Text style={styles.bilanCell}>{stats.totalPlayed}</Text>
              <Text style={[styles.bilanCell, { color: '#016D14' }]}>{stats.wins}</Text>
              <Text style={[styles.bilanCell, { color: '#F5A623' }]}>{stats.draws}</Text>
              <Text style={[styles.bilanCell, { color: '#D0021B' }]}>{stats.losses}</Text>
            </View>
            <View style={styles.bilanRow}>
              <Text style={[styles.bilanCell, styles.bilanLabel, { flex: 2 }]}>Domicile</Text>
              <Text style={styles.bilanCell}>{stats.homeGames}</Text>
              <Text style={[styles.bilanCell, { color: '#016D14' }]}>{stats.homeWins}</Text>
              <Text style={[styles.bilanCell, { color: '#F5A623' }]}>{stats.homeDraws}</Text>
              <Text style={[styles.bilanCell, { color: '#D0021B' }]}>{stats.homeLosses}</Text>
            </View>
            <View style={styles.bilanRow}>
              <Text style={[styles.bilanCell, styles.bilanLabel, { flex: 2 }]}>Extérieur</Text>
              <Text style={styles.bilanCell}>{stats.awayGames}</Text>
              <Text style={[styles.bilanCell, { color: '#016D14' }]}>{stats.awayWins}</Text>
              <Text style={[styles.bilanCell, { color: '#F5A623' }]}>{stats.awayDraws}</Text>
              <Text style={[styles.bilanCell, { color: '#D0021B' }]}>{stats.awayLosses}</Text>
            </View>
          </View>
          {stats.upcoming > 0 && (
            <Text style={styles.upcomingText}>
              {stats.upcoming} match{stats.upcoming > 1 ? 's' : ''} à venir
            </Text>
          )}
        </View>
      )}

      {/* === RÉSULTATS REMARQUABLES === */}
      {stats?.biggestWin && stats.biggestWin.diff > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RÉSULTATS REMARQUABLES</Text>

          <LinearGradient
            colors={['#016D14', '#010914']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.15, y: 0 }}
            style={styles.remarkCard}
          >
            <Text style={styles.remarkLabel}>Plus large victoire</Text>
            <View style={styles.remarkMatch}>
              <Text style={styles.remarkTeam}>{stats.biggestWin.homeTeam}</Text>
              <Text style={styles.remarkScore}>
                {stats.biggestWin.home_score} - {stats.biggestWin.away_score}
              </Text>
              <Text style={styles.remarkTeam}>{stats.biggestWin.awayTeam}</Text>
            </View>
          </LinearGradient>

          {stats.biggestLoss && stats.biggestLoss.diff < 0 && (
            <LinearGradient
              colors={['#010914', '#640914']}
              start={{ x: 0.85, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.remarkCard, { marginTop: 8 }]}
            >
              <Text style={styles.remarkLabelBad}>Plus lourde défaite</Text>
              <View style={styles.remarkMatch}>
                <Text style={styles.remarkTeam}>{stats.biggestLoss.homeTeam}</Text>
                <Text style={styles.remarkScore}>
                  {stats.biggestLoss.home_score} - {stats.biggestLoss.away_score}
                </Text>
                <Text style={styles.remarkTeam}>{stats.biggestLoss.awayTeam}</Text>
              </View>
            </LinearGradient>
          )}
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

// --- Composant réutilisable pour les petites box de stat ---
const StatBox = ({ label, value, color }) => (
  <View style={styles.statBox}>
    <Text style={[styles.statBoxValue, { color }]}>{value}</Text>
    <Text style={styles.statBoxLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#010914',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    color: '#aaaaaa',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14 * scale,
  },
  loadingText: {
    color: '#aaaaaa',
    fontSize: 14 * scale,
    marginTop: 10,
  },
  errorText: {
    color: 'red',
    fontSize: 14 * scale,
    textAlign: 'center',
    margin: 20,
  },

  /* --- Sections --- */
  section: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sectionTitle: {
    fontSize: 14 * scale,
    fontWeight: 'bold',
    color: '#aaaaaa',
    letterSpacing: 1,
    alignSelf: 'stretch',
    textAlign: 'center',
    marginBottom: 12,
  },

  /* --- Classement --- */
  rankBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 14,
  },
  rankNumber: {
    color: '#C0C0C0',
    fontSize: 28 * scale,
    fontWeight: 'bold',
  },
  rankSuffix: {
    color: '#aaaaaa',
    fontSize: 12 * scale,
    fontWeight: 'bold',
  },
  rankDetails: {
    flex: 1,
  },
  rankPoints: {
    color: '#ffffff',
    fontSize: 18 * scale,
    fontWeight: 'bold',
  },
  rankSub: {
    color: '#aaaaaa',
    fontSize: 12 * scale,
    marginTop: 2,
  },

  /* --- Stats grid --- */
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statBox: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  statBoxValue: {
    fontSize: 22 * scale,
    fontWeight: 'bold',
  },
  statBoxLabel: {
    color: '#aaaaaa',
    fontSize: 11 * scale,
    marginTop: 4,
    textAlign: 'center',
  },

  /* --- Forme --- */
  formRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  formBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  streakText: {
    color: '#aaaaaa',
    fontSize: 12 * scale,
    textAlign: 'center',
    marginBottom: 14,
  },
  winRateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  winRateLabel: {
    color: '#aaaaaa',
    fontSize: 12 * scale,
    width: 100,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  winRateValue: {
    color: '#fff',
    fontSize: 14 * scale,
    fontWeight: 'bold',
    width: 42,
    textAlign: 'right',
  },

  /* --- Buts --- */
  goalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  goalCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  goalIcon: {
    width: 36 * scale,
    height: 36 * scale,
    marginBottom: 6,
    opacity: 0.8,
  },
  goalValue: {
    color: '#fff',
    fontSize: 28 * scale,
    fontWeight: 'bold',
  },
  goalLabel: {
    color: '#aaaaaa',
    fontSize: 12 * scale,
    marginTop: 2,
  },
  goalAvg: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11 * scale,
    marginTop: 4,
  },
  diffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  diffLabel: {
    color: '#aaaaaa',
    fontSize: 13 * scale,
  },
  diffValue: {
    fontSize: 20 * scale,
    fontWeight: 'bold',
  },

  /* --- Bilan table --- */
  bilanTable: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  bilanHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  bilanHeaderCell: {
    flex: 1,
    color: '#aaaaaa',
    fontSize: 12 * scale,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  bilanRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  bilanCell: {
    flex: 1,
    color: '#fff',
    fontSize: 14 * scale,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  bilanLabel: {
    textAlign: 'left',
    color: '#aaaaaa',
    fontWeight: 'normal',
  },
  upcomingText: {
    color: '#aaaaaa',
    fontSize: 12 * scale,
    textAlign: 'center',
    marginTop: 10,
  },

  /* --- Résultats remarquables --- */
  remarkCard: {
    borderRadius: 10,
    padding: 14,
  },
  remarkLabel: {
    color: '#016D14',
    fontSize: 12 * scale,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  remarkLabelBad: {
    color: '#640914',
    fontSize: 12 * scale,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  remarkMatch: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  remarkTeam: {
    color: '#fff',
    fontSize: 13 * scale,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  remarkScore: {
    color: '#C0C0C0',
    fontSize: 18 * scale,
    fontWeight: 'bold',
    marginHorizontal: 10,
  },
});

export default ClubContent;
