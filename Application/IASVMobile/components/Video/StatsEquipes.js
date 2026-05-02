import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { moderateScale, scale as s } from './../../tools/responsive';

const ms = moderateScale;

const STATS_CONFIG = [
  { key: 'possession', label: 'Possession', suffix: '%' },
  { key: 'shots', label: 'Tirs' },
  { key: 'shotsOnTarget', label: 'Tirs cadrés' },
  { key: 'passes', label: 'Passes' },
  { key: 'tackles', label: 'Tacles' },
  { key: 'interceptions', label: 'Interceptions' },
  { key: 'saves', label: 'Arrêts' },
  { key: 'offsides', label: 'Hors-jeu' },
  { key: 'fouls', label: 'Fautes' },
  { key: 'corners', label: 'Corners' },
  { key: 'freeKicks', label: 'Coups Francs' },
  { key: 'penalties', label: 'Pénaltys' },
  { key: 'yellowCards', label: 'Cartons Jaunes' },
  { key: 'redCards', label: 'Cartons Rouges' },
];

const StatBar = ({ value1, value2 }) => {
  const total = value1 + value2;
  const ratio1 = total > 0 ? value1 / total : 0.5;
  const ratio2 = total > 0 ? value2 / total : 0.5;

  return (
    <View style={styles.barContainer}>
      <View style={[styles.barLeft, { flex: ratio1 }]} />
      <View style={styles.barGap} />
      <View style={[styles.barRight, { flex: ratio2 }]} />
    </View>
  );
};

const StatRow = ({ label, value1, value2, suffix = '', isEven }) => (
  <View style={[styles.row, isEven && styles.rowEven]}>
    <Text style={[styles.teamStat, value1 > value2 && styles.teamStatHighlight]}>
      {value1}{suffix}
    </Text>
    <View style={styles.statCenter}>
      <Text style={styles.statTitle}>{label}</Text>
      <StatBar value1={value1} value2={value2} />
    </View>
    <Text style={[styles.teamStat, value2 > value1 && styles.teamStatHighlight]}>
      {value2}{suffix}
    </Text>
  </View>
);

const StatsEquipes = React.memo(() => {
  const matchStats = {
    team1: 'F.C. VIDAUBAN',
    team2: 'A.S. ARCOISE',
    possession: { team1: 60, team2: 40 },
    shots: { team1: 12, team2: 8 },
    shotsOnTarget: { team1: 5, team2: 3 },
    passes: { team1: 350, team2: 270 },
    tackles: { team1: 15, team2: 10 },
    interceptions: { team1: 7, team2: 8 },
    saves: { team1: 4, team2: 6 },
    offsides: { team1: 2, team2: 3 },
    fouls: { team1: 12, team2: 10 },
    corners: { team1: 6, team2: 5 },
    freeKicks: { team1: 9, team2: 8 },
    penalties: { team1: 1, team2: 0 },
    yellowCards: { team1: 2, team2: 1 },
    redCards: { team1: 0, team2: 1 },
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          <View style={styles.header}>
            <Text style={styles.headerTeam}>{matchStats.team1}</Text>
            <Text style={styles.headerTitle}>-</Text>
            <Text style={styles.headerTeam}>{matchStats.team2}</Text>
          </View>

          {STATS_CONFIG.map((stat, index) => (
            <StatRow
              key={stat.key}
              label={stat.label}
              value1={matchStats[stat.key].team1}
              value2={matchStats[stat.key].team2}
              suffix={stat.suffix}
              isEven={index % 2 === 0}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: s(12),
    alignItems: 'stretch',
  },
  scrollView: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomWidth: 1,
    marginBottom: s(6),
    paddingBottom: s(8),
  },
  headerTeam: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  headerTitle: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#808080',
    flex: 0.3,
    textAlign: 'center',
  },
  grid: {
    width: '100%',
    borderRadius: ms(6),
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: s(8),
    paddingHorizontal: s(4),
    alignItems: 'center',
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    borderBottomWidth: 0.5,
  },
  rowEven: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  teamStat: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#FFFFFF',
    width: s(50),
    textAlign: 'center',
  },
  teamStatHighlight: {
    fontWeight: '800',
  },
  statCenter: {
    flex: 1,
    alignItems: 'center',
  },
  statTitle: {
    fontSize: ms(10),
    fontWeight: '600',
    color: '#A8B4C0',
    textAlign: 'center',
    marginBottom: s(4),
  },
  barContainer: {
    flexDirection: 'row',
    width: '80%',
    height: ms(4),
    borderRadius: 2,
    overflow: 'hidden',
  },
  barLeft: {
    height: ms(4),
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  barGap: {
    width: s(3),
  },
  barRight: {
    height: ms(4),
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 2,
  },
});

export default StatsEquipes;
