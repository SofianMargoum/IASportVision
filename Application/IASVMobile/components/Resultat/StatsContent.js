import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, ScrollView } from 'react-native';
import { fetchClassementJournees } from './../../tools/api';
import { useClubContext } from './../../tools/ClubContext';
import LinearGradient from 'react-native-linear-gradient';

const scale = 0.85;

// ─── Composants réutilisables ───

const SectionTitle = ({ children }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

const Separator = () => (
  <View style={styles.separatorContainer}>
    <View style={styles.separator} />
  </View>
);

const StatCompareRow = ({
  label,
  bestTitle,
  bestTeam,
  bestValue,
  bestSuffix,
  worstTitle,
  worstTeam,
  worstValue,
  worstSuffix,
  icon,
}) => (
  <View style={styles.statBlock}>
    <SectionTitle>{label}</SectionTitle>
    <View style={styles.compareRow}>
      <LinearGradient
        colors={['#016D14', '#010914']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.12, y: 0 }}
        style={styles.compareCard}
      >
        <Text style={styles.compareTitleGood}>{bestTitle}</Text>
        <Text style={styles.compareTeam} numberOfLines={1}>{bestTeam}</Text>
        <Text style={styles.compareValue}>{bestValue} <Text style={styles.compareSuffix}>{bestSuffix}</Text></Text>
      </LinearGradient>

      {icon && <Image source={icon} style={styles.compareIcon} />}

      <LinearGradient
        colors={['#010914', '#640914']}
        start={{ x: 0.88, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.compareCard}
      >
        <Text style={styles.compareTitleBad}>{worstTitle}</Text>
        <Text style={styles.compareTeam} numberOfLines={1}>{worstTeam}</Text>
        <Text style={styles.compareValue}>{worstValue} <Text style={styles.compareSuffix}>{worstSuffix}</Text></Text>
      </LinearGradient>
    </View>
  </View>
);

// ─── Barres horizontales proportionnelles ───

const HBar = ({ value, maxValue, color, label, suffix }) => {
  const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  return (
    <View style={styles.hBarRow}>
      <Text style={styles.hBarLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.hBarTrack}>
        <LinearGradient
          colors={[color, `${color}88`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.hBarFill, { width: `${pct}%` }]}
        />
      </View>
      <Text style={styles.hBarValue}>{value}{suffix ? ` ${suffix}` : ''}</Text>
    </View>
  );
};

// ─── Composant principal ───

function StatsContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [classements, setClassements] = useState([]);

  const { selectedClub, competition, phase, poule, cp_no } = useClubContext();

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
        const data = await fetchClassementJournees(cp_no, phase, poule);
        if (isMounted) setClassements(Array.isArray(data) ? data : []);
      } catch (e) {
        if (isMounted) setError(e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => { isMounted = false; };
  }, [selectedClub?.cl_no, competition, cp_no, phase, poule]);

  // ─── Stats calculées ───

  const stats = useMemo(() => {
    if (!classements.length) return null;

    const sorted = [...classements].sort((a, b) => b.points - a.points);
    const topThree = sorted.slice(0, 3);

    const best = (key, order = 'desc') =>
      classements.reduce((prev, curr) => {
        if (order === 'desc') return curr[key] > prev[key] ? curr : prev;
        return curr[key] < prev[key] ? curr : prev;
      }, classements[0]);

    const bestAttack = best('goalsFor', 'desc');
    const worstAttack = best('goalsFor', 'asc');
    const bestDefense = best('goalsAgainst', 'asc');
    const worstDefense = best('goalsAgainst', 'desc');
    const mostWins = best('wonGames', 'desc');
    const mostLosses = best('lostGames', 'desc');
    const mostDraws = best('drawGames', 'desc');

    // Différence de buts
    const withDiff = classements.map((t) => ({
      ...t,
      goalDiff: t.goalsFor - t.goalsAgainst,
    }));
    const mostBalanced = withDiff.reduce(
      (p, c) => (c.goalDiff > p.goalDiff ? c : p),
      withDiff[0]
    );
    const leastBalanced = withDiff.reduce(
      (p, c) => (c.goalDiff < p.goalDiff ? c : p),
      withDiff[0]
    );

    // Totaux compétition
    const totalGoals = classements.reduce((s, t) => s + t.goalsFor, 0);
    const totalMatches = classements.reduce((s, t) => s + t.totalGames, 0) / 2; // chaque match compté 2×
    const avgGoalsPerMatch = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(1) : '0';
    const totalTeams = classements.length;

    // Top 5 attaque pour barres
    const topAttack = [...classements].sort((a, b) => b.goalsFor - a.goalsFor).slice(0, 5);
    const topDefense = [...classements].sort((a, b) => a.goalsAgainst - b.goalsAgainst).slice(0, 5);

    return {
      topThree,
      bestAttack,
      worstAttack,
      bestDefense,
      worstDefense,
      mostBalanced,
      leastBalanced,
      mostWins,
      mostLosses,
      mostDraws,
      totalGoals,
      totalMatches: Math.round(totalMatches),
      avgGoalsPerMatch,
      totalTeams,
      topAttack,
      topDefense,
    };
  }, [classements]);

  // ─── Rendu ───

  if (!selectedClub?.cl_no && !loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.infoText}>Sélectionne un club pour voir les statistiques.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#C0C0C0" />
        <Text style={styles.infoText}>Calcul des statistiques…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          Erreur lors du chargement des statistiques : {error.message}
        </Text>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.centered}>
        <Text style={styles.infoText}>Aucune donnée disponible.</Text>
      </View>
    );
  }

  const { topThree } = stats;

  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* ══════ VUE D'ENSEMBLE ══════ */}
      <View style={styles.section}>
        <SectionTitle>VUE D'ENSEMBLE</SectionTitle>
        <View style={styles.overviewRow}>
          <OverviewBox value={stats.totalTeams} label="Équipes" color="#C0C0C0" />
          <OverviewBox value={stats.totalMatches} label="Matchs joués" color="#C0C0C0" />
          <OverviewBox value={stats.totalGoals} label="Buts marqués" color="#C0C0C0" />
          <OverviewBox value={stats.avgGoalsPerMatch} label="Buts / match" color="#C0C0C0" />
        </View>
      </View>

      <Separator />

      {/* ══════ PODIUM ══════ */}
      <View style={styles.section}>
        <SectionTitle>PODIUM</SectionTitle>
        <View style={styles.podiumRow}>
          {/* 2e */}
          <View style={styles.podiumSlot}>
            <View style={[styles.podiumBadge, { backgroundColor: 'rgba(192,192,192,0.15)' }]}>
              <Text style={[styles.podiumRank, { color: '#C0C0C0' }]}>2</Text>
            </View>
            <Text style={[styles.podiumName, { color: '#C0C0C0' }]} numberOfLines={2}>
              {topThree[1]?.teamName ?? '—'}
            </Text>
            <Text style={styles.podiumPts}>{topThree[1]?.points ?? '—'} pts</Text>
            <View style={[styles.podiumBar, { height: 50, backgroundColor: '#C0C0C0' }]} />
          </View>

          {/* 1er */}
          <View style={styles.podiumSlot}>
            <View style={[styles.podiumBadge, { backgroundColor: 'rgba(255,215,0,0.2)' }]}>
              <Text style={[styles.podiumRank, { color: '#FFD700' }]}>1</Text>
            </View>
            <Text style={[styles.podiumName, { color: '#FFD700' }]} numberOfLines={2}>
              {topThree[0]?.teamName ?? '—'}
            </Text>
            <Text style={styles.podiumPts}>{topThree[0]?.points ?? '—'} pts</Text>
            <View style={[styles.podiumBar, { height: 70, backgroundColor: '#FFD700' }]} />
          </View>

          {/* 3e */}
          <View style={styles.podiumSlot}>
            <View style={[styles.podiumBadge, { backgroundColor: 'rgba(205,127,50,0.15)' }]}>
              <Text style={[styles.podiumRank, { color: '#CD7F32' }]}>3</Text>
            </View>
            <Text style={[styles.podiumName, { color: '#CD7F32' }]} numberOfLines={2}>
              {topThree[2]?.teamName ?? '—'}
            </Text>
            <Text style={styles.podiumPts}>{topThree[2]?.points ?? '—'} pts</Text>
            <View style={[styles.podiumBar, { height: 35, backgroundColor: '#CD7F32' }]} />
          </View>
        </View>
      </View>

      <Separator />

      {/* ══════ ATTAQUE ══════ */}
      <StatCompareRow
        label="ATTAQUE"
        bestTitle="Meilleure"
        bestTeam={stats.bestAttack?.teamName}
        bestValue={stats.bestAttack?.goalsFor}
        bestSuffix="buts"
        worstTitle="Pire"
        worstTeam={stats.worstAttack?.teamName}
        worstValue={stats.worstAttack?.goalsFor}
        worstSuffix="buts"
        icon={require('../../assets/actionsblanc.png')}
      />

      {/* Top 5 Attaque */}
      <View style={styles.barSection}>
        <Text style={styles.barSectionTitle}>Top 5 — Buts marqués</Text>
        {stats.topAttack.map((t, i) => (
          <HBar
            key={t.teamName + i}
            label={t.teamName}
            value={t.goalsFor}
            maxValue={stats.topAttack[0]?.goalsFor || 1}
            color="#016D14"
          />
        ))}
      </View>

      <Separator />

      {/* ══════ DÉFENSE ══════ */}
      <StatCompareRow
        label="DÉFENSE"
        bestTitle="Meilleure"
        bestTeam={stats.bestDefense?.teamName}
        bestValue={stats.bestDefense?.goalsAgainst}
        bestSuffix="enc."
        worstTitle="Pire"
        worstTeam={stats.worstDefense?.teamName}
        worstValue={stats.worstDefense?.goalsAgainst}
        worstSuffix="enc."
        icon={require('../../assets/bouclier.png')}
      />

      {/* Top 5 Défense */}
      <View style={styles.barSection}>
        <Text style={styles.barSectionTitle}>Top 5 — Moins de buts encaissés</Text>
        {stats.topDefense.map((t, i) => (
          <HBar
            key={t.teamName + i}
            label={t.teamName}
            value={t.goalsAgainst}
            maxValue={stats.worstDefense?.goalsAgainst || 1}
            color="#016D14"
          />
        ))}
      </View>

      <Separator />

      {/* ══════ ÉQUILIBRE ══════ */}
      <StatCompareRow
        label="ÉQUILIBRE"
        bestTitle="Meilleure diff."
        bestTeam={stats.mostBalanced?.teamName}
        bestValue={stats.mostBalanced?.goalDiff >= 0 ? `+${stats.mostBalanced.goalDiff}` : stats.mostBalanced?.goalDiff}
        bestSuffix=""
        worstTitle="Pire diff."
        worstTeam={stats.leastBalanced?.teamName}
        worstValue={stats.leastBalanced?.goalDiff >= 0 ? `+${stats.leastBalanced.goalDiff}` : stats.leastBalanced?.goalDiff}
        worstSuffix=""
        icon={require('../../assets/equilibre.png')}
      />

      <Separator />

      {/* ══════ RECORDS ══════ */}
      <View style={styles.section}>
        <SectionTitle>RECORDS</SectionTitle>
        <View style={styles.recordsGrid}>
          <RecordCard
            title="Plus de victoires"
            team={stats.mostWins?.teamName}
            value={stats.mostWins?.wonGames}
            suffix="V"
            color="#016D14"
          />
          <RecordCard
            title="Plus de défaites"
            team={stats.mostLosses?.teamName}
            value={stats.mostLosses?.lostGames}
            suffix="D"
            color="#D0021B"
          />
          <RecordCard
            title="Plus de nuls"
            team={stats.mostDraws?.teamName}
            value={stats.mostDraws?.drawGames}
            suffix="N"
            color="#F5A623"
          />
          <RecordCard
            title="Meilleur buteur (éq.)"
            team={stats.bestAttack?.teamName}
            value={(stats.bestAttack?.goalsFor / (stats.bestAttack?.totalGames || 1)).toFixed(1)}
            suffix="buts/m"
            color="#C0C0C0"
          />
        </View>
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

// ─── Petits composants ───

const OverviewBox = ({ value, label, color }) => (
  <View style={styles.overviewBox}>
    <Text style={[styles.overviewValue, { color }]}>{value}</Text>
    <Text style={styles.overviewLabel}>{label}</Text>
  </View>
);

const RecordCard = ({ title, team, value, suffix, color }) => (
  <View style={styles.recordCard}>
    <Text style={styles.recordTitle}>{title}</Text>
    <Text style={[styles.recordValue, { color }]}>
      {value} <Text style={styles.recordSuffix}>{suffix}</Text>
    </Text>
    <Text style={styles.recordTeam} numberOfLines={1}>{team}</Text>
  </View>
);

// ─── Styles ───

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#010914',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    color: '#aaaaaa',
    fontSize: 14 * scale,
    margin: 10,
  },
  errorText: {
    color: 'red',
    fontSize: 14 * scale,
    textAlign: 'center',
    margin: 20,
  },

  /* Sections */
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
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

  /* Separator */
  separatorContainer: {
    paddingHorizontal: 16,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 6,
  },

  /* Vue d'ensemble */
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overviewBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingVertical: 12,
    marginHorizontal: 3,
  },
  overviewValue: {
    fontSize: 22 * scale,
    fontWeight: 'bold',
  },
  overviewLabel: {
    color: '#aaaaaa',
    fontSize: 10 * scale,
    marginTop: 4,
    textAlign: 'center',
  },

  /* Podium */
  podiumRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingTop: 8,
    paddingBottom: 4,
  },
  podiumSlot: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  podiumBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  podiumRank: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  podiumName: {
    fontSize: 12 * scale,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  podiumPts: {
    color: '#aaaaaa',
    fontSize: 11 * scale,
    marginBottom: 6,
  },
  podiumBar: {
    width: '60%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    opacity: 0.6,
  },

  /* Stat compare (attaque/défense/équilibre) */
  statBlock: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compareCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  compareTitleGood: {
    fontSize: 12 * scale,
    fontWeight: 'bold',
    color: '#016D14',
    marginBottom: 8,
  },
  compareTitleBad: {
    fontSize: 12 * scale,
    fontWeight: 'bold',
    color: '#640914',
    marginBottom: 8,
  },
  compareTeam: {
    fontSize: 13 * scale,
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  compareValue: {
    fontSize: 18 * scale,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  compareSuffix: {
    fontSize: 12 * scale,
    color: '#aaaaaa',
    fontWeight: 'normal',
  },
  compareIcon: {
    width: 50 * scale,
    height: 50 * scale,
    borderRadius: 25 * scale,
    marginHorizontal: 8,
    opacity: 0.8,
  },

  /* Horizontal bars */
  barSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  barSectionTitle: {
    color: '#aaaaaa',
    fontSize: 11 * scale,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  hBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  hBarLabel: {
    color: '#ffffff',
    fontSize: 11 * scale,
    width: 90,
  },
  hBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  hBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  hBarValue: {
    color: '#ffffff',
    fontSize: 12 * scale,
    fontWeight: 'bold',
    width: 30,
    textAlign: 'right',
  },

  /* Records grid */
  recordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  recordCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  recordTitle: {
    color: '#aaaaaa',
    fontSize: 11 * scale,
    marginBottom: 6,
    textAlign: 'center',
  },
  recordValue: {
    fontSize: 22 * scale,
    fontWeight: 'bold',
  },
  recordSuffix: {
    fontSize: 12 * scale,
    fontWeight: 'normal',
    color: '#aaaaaa',
  },
  recordTeam: {
    color: '#ffffff',
    fontSize: 12 * scale,
    fontWeight: 'bold',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default StatsContent;
