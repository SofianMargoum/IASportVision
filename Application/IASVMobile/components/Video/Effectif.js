import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { useEffectifContext } from './../../tools/EffectifContext';

const TITULAIRES_COUNT = 11;

const Effectif = React.memo(() => {
  const { effectif } = useEffectifContext();

  const titulaires = effectif.slice(0, TITULAIRES_COUNT);
  const remplacants = effectif.slice(TITULAIRES_COUNT);

  const renderPlayer = (player, index, isEven) => (
    <View
      key={`${player.numero || 'x'}-${index}`}
      style={[styles.playerRow, isEven && styles.playerRowEven]}
    >
      <Image
        source={require('./../../assets/player.png')}
        style={styles.icon}
      />
      <View style={styles.numberBadge}>
        <Text style={styles.number}>{player.numero}</Text>
      </View>
      <Text style={styles.name}>{player.joueur}</Text>
    </View>
  );

  const renderSection = (title, players, count) => (
    <>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionLine} />
        <Text style={styles.sectionTitle}>
          {title} ({count})
        </Text>
        <View style={styles.sectionLine} />
      </View>
      {players.map((player, index) => renderPlayer(player, index, index % 2 === 0))}
    </>
  );

  return (
    <ScrollView
      style={styles.listContainer}
      showsVerticalScrollIndicator={false}
    >
      {effectif.length === 0 ? (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>Aucun joueur dans l'effectif.</Text>
        </View>
      ) : (
        <>
          {titulaires.length > 0 && renderSection('Titulaires', titulaires, titulaires.length)}
          {remplacants.length > 0 && renderSection('Remplaçants', remplacants, remplacants.length)}
        </>
      )}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 10,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#FFFFFF',
    opacity: 0.15,
  },
  sectionTitle: {
    color: '#A8B4C0',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginVertical: 2,
    width: '100%',
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  playerRowEven: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  numberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  number: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  name: {
    flex: 1,
    textAlign: 'left',
    color: '#FFFFFF',
    fontSize: 14,
  },
  icon: {
    width: 18,
    height: 18,
    marginRight: 8,
  },
  emptyRow: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});

export default Effectif;
