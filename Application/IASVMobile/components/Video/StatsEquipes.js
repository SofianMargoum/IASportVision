import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const StatsEquipes = () => {
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
          {/* Ordre des statistiques selon la demande */}
          
        <View style={styles.header}>
          <Text style={styles.headerTeam}>{matchStats.team1}</Text>
          <Text style={styles.headerTitle}>-</Text>
          <Text style={styles.headerTeam}>{matchStats.team2}</Text>
        </View>
          <View style={styles.row}>
            <Text style={styles.teamStat}>{matchStats.possession.team1}%</Text>
            <Text style={styles.statTitle}>Possession</Text>
            <Text style={styles.teamStat}>{matchStats.possession.team2}%</Text>
            </View>
          <View style={styles.row}>
            <Text style={styles.teamStat}>{matchStats.shots.team1}</Text>
            <Text style={styles.statTitle}>Tirs</Text>
            <Text style={styles.teamStat}>{matchStats.shots.team2}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.teamStat}>{matchStats.shotsOnTarget.team1}</Text>
            <Text style={styles.statTitle}>Tirs cadrés</Text>
            <Text style={styles.teamStat}>{matchStats.shotsOnTarget.team2}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.teamStat}>{matchStats.passes.team1}</Text>
            <Text style={styles.statTitle}>Passes</Text>
            <Text style={styles.teamStat}>{matchStats.passes.team2}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.teamStat}>{matchStats.tackles.team1}</Text>
            <Text style={styles.statTitle}>Tacles</Text>
            <Text style={styles.teamStat}>{matchStats.tackles.team2}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.teamStat}>{matchStats.interceptions.team1}</Text>
            <Text style={styles.statTitle}>Interceptions</Text>
            <Text style={styles.teamStat}>{matchStats.interceptions.team2}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.teamStat}>{matchStats.saves.team1}</Text>
            <Text style={styles.statTitle}>Arrêts</Text>
            <Text style={styles.teamStat}>{matchStats.saves.team2}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.teamStat}>{matchStats.offsides.team1}</Text>
            <Text style={styles.statTitle}>Hors-jeu</Text>
            <Text style={styles.teamStat}>{matchStats.offsides.team2}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.teamStat}>{matchStats.fouls.team1}</Text>
            <Text style={styles.statTitle}>Fautes</Text>
            <Text style={styles.teamStat}>{matchStats.fouls.team2}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.teamStat}>{matchStats.corners.team1}</Text>
            <Text style={styles.statTitle}>Corners</Text>
            <Text style={styles.teamStat}>{matchStats.corners.team2}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.teamStat}>{matchStats.freeKicks.team1}</Text>
            <Text style={styles.statTitle}>Coups Francs</Text>
            <Text style={styles.teamStat}>{matchStats.freeKicks.team2}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.teamStat}>{matchStats.penalties.team1}</Text>
            <Text style={styles.statTitle}>Pénaltys</Text>
            <Text style={styles.teamStat}>{matchStats.penalties.team2}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.teamStat}>{matchStats.yellowCards.team1}</Text>
            <Text style={styles.statTitle}>Cartons Jaunes</Text>
            <Text style={styles.teamStat}>{matchStats.yellowCards.team2}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.teamStat}>{matchStats.redCards.team1}</Text>
            <Text style={styles.statTitle}>Cartons Rouges</Text>
            <Text style={styles.teamStat}>{matchStats.redCards.team2}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  scrollView: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomColor: '#001A31',
    borderBottomWidth: 1,
    marginBottom:20,
  },
  headerTeam: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00A0E9', // Couleur dorée pour les équipes
    flex: 1,
    textAlign: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00A0E9',
    flex: 1,
    textAlign: 'center',
  },
  grid: {
    borderRadius: 8,
    overflow: 'hidden',
    maxWidth: 400,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomColor: '#001A31',
    borderBottomWidth: 1,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  teamStat: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
});

export default StatsEquipes;
