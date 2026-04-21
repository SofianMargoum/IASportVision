import React, { useState, useCallback } from 'react';
import { View, Image, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity } from 'react-native';
import { joueurStats } from './data/mockData';

const scale = 0.85;

const PLAYER_IMAGES = {
  '1': require('../../assets/joueur-1.png'),
  '2': require('../../assets/joueur-2.png'),
  '3': require('../../assets/joueur-3.png'),
  '4': require('../../assets/joueur-4.png'),
  '5': require('../../assets/joueur-5.png'),
  '6': require('../../assets/joueur-6.png'),
  '7': require('../../assets/joueur-7.png'),
  '8': require('../../assets/joueur-8.png'),
  '9': require('../../assets/joueur-9.png'),
  '10': require('../../assets/joueur-10.png'),
  '11': require('../../assets/joueur-11.png'),
  '12': require('../../assets/joueur-12.png'),
  '13': require('../../assets/joueur-13.png'),
  '14': require('../../assets/joueur-14.png'),
};
const DEFAULT_IMAGE = require('../../assets/joueur-7.png');

const STATS_CONFIG = [
  { key: 'nom', label: 'Joueur' },
  { key: 'buts', label: 'Buts' },
  { key: 'passesDecisives', label: 'Passes décisives' },
  { key: 'tirs', label: 'Tirs' },
  { key: 'precisionTirs', label: 'Précision des tirs' },
  { key: 'passes', label: 'Passes' },
  { key: 'precisionPasses', label: 'Précision des passes' },
  { key: 'dribles', label: 'Dribles' },
  { key: 'precisionDribles', label: 'Précision des dribles' },
  { key: 'tacles', label: 'Tacles' },
  { key: 'taclesReussis', label: 'Tacles réussis' },
  { key: 'horsJeu', label: 'Hors-jeu' },
  { key: 'fautesComises', label: 'Fautes commises' },
  { key: 'ballonRecuperes', label: 'Ballons récupérés' },
  { key: 'ballonPerdus', label: 'Ballons perdus' },
  { key: 'distanceParcourue', label: 'Distance parcourue' },
  { key: 'tempsJeu', label: 'Temps de jeu' },
];

const isNumeric = (v) => typeof v === 'number' && !isNaN(v);

const StatRow = ({ label, value1, value2, isEven }) => {
  const highlight1 = isNumeric(value1) && isNumeric(value2) && value1 > value2;
  const highlight2 = isNumeric(value1) && isNumeric(value2) && value2 > value1;

  return (
    <View style={[styles.tableRow, isEven && styles.tableRowEven]}>
      <Text style={[styles.tableCell, highlight1 && styles.tableCellHighlight]}>{value1}</Text>
      <Text style={styles.tableCellLabel}>{label}</Text>
      <Text style={[styles.tableCell, highlight2 && styles.tableCellHighlight]}>{value2}</Text>
    </View>
  );
};

const StatsJoueurs = React.memo(() => {
  const [selectedJoueur, setSelectedJoueur] = useState(joueurStats[0]);

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity onPress={() => setSelectedJoueur(item)}>
      <View style={[styles.joueurItem, selectedJoueur.id === item.id && styles.selectedJoueurItem]}>
        <Image
          source={PLAYER_IMAGES[item.id] || DEFAULT_IMAGE}
          style={styles.statsImage}
        />
      </View>
    </TouchableOpacity>
  ), [selectedJoueur.id]);

  return (
    <View style={styles.container}>
      <View style={styles.playerListContainer}>
        <FlatList
          data={joueurStats}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
        />
      </View>

      <View style={styles.hrContainer}>
        <View style={styles.hr} />
      </View>

      <ScrollView
        style={styles.statCardContainer}
        showsVerticalScrollIndicator={false}
      >
        {selectedJoueur ? (
          <View style={styles.statCard}>
            <View style={styles.table}>
              <View style={styles.headerRow}>
                <Text style={styles.tableHeader}>F.C. VIDAUBAN</Text>
                <Text style={styles.tableHeaderSep}>-</Text>
                <Text style={styles.tableHeader}>A.S. ARCOISE</Text>
              </View>

              {STATS_CONFIG.map((stat, index) => (
                <StatRow
                  key={stat.key}
                  label={stat.label}
                  value1={selectedJoueur.statsVidauban[stat.key]}
                  value2={selectedJoueur.statsArcoise[stat.key]}
                  isEven={index % 2 === 0}
                />
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.statText}>Sélectionnez un joueur pour voir ses statistiques.</Text>
        )}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 12,
    alignItems: 'stretch',
  },
  hrContainer: {
    alignItems: 'stretch',
  },
  hr: {
    height: 1,
    width: '100%',
    backgroundColor: '#fff',
    opacity: 0.1,
  },
  playerListContainer: {
    width: '100%',
    height: 56 * scale,
    justifyContent: 'center',
    marginBottom: 8,
  },
  statsImage: {
    height: 52 * scale,
    width: 52 * scale,
    resizeMode: 'contain',
    borderRadius: 10 * scale,
  },
  joueurItem: {
    width: 70 * scale,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.45,
  },
  selectedJoueurItem: {
    opacity: 1,
  },
  statCardContainer: {
    width: '100%',
    flex: 1,
  },
  statCard: {
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  table: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomWidth: 1,
    marginBottom: 2,
  },
  tableHeader: {
    fontWeight: '700',
    fontSize: 13,
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  tableHeaderSep: {
    fontWeight: '600',
    fontSize: 13,
    color: '#808080',
    width: 20,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    borderBottomWidth: 0.5,
  },
  tableRowEven: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  tableCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  tableCellHighlight: {
    fontWeight: '800',
  },
  tableCellLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A8B4C0',
    flex: 1.2,
    textAlign: 'center',
  },
  statText: {
    fontSize: 13,
    color: '#fff',
    paddingTop: 10,
  },
});

export default StatsJoueurs;
