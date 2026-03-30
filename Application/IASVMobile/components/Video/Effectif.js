import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { useEffectifContext } from './../../tools/EffectifContext';

const Effectif = () => {
  const { effectif } = useEffectifContext();

  return (
    <ScrollView
      style={styles.listContainer}
      showsVerticalScrollIndicator={false} // Cache la barre de défilement (optionnel)
    >
      {effectif.length === 0 ? (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>Aucun joueur dans l'effectif.</Text>
        </View>
      ) : (
        effectif.map((player, index) => {
          const showTitulaireHeader = index === 0;
          const showRemplacantHeader = index === 11 && effectif.length > 11;

          return (
            <React.Fragment key={`${player.numero || 'x'}-${index}`}>
              {showTitulaireHeader && (
                <Text style={styles.sectionTitle}>Titulaire</Text>
              )}
              {showRemplacantHeader && (
                <Text style={styles.sectionTitle}>Remplacant</Text>
              )}
              <View style={styles.playerRow}>
                <Image
                  source={require('./../../assets/player.png')}
                  style={styles.icon}
                />
                <Text style={styles.number}>{player.numero}</Text>
                <Text style={styles.name}>{player.joueur}</Text>
              </View>
            </React.Fragment>
          );
        })
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginVertical: 4, // Espace entre les items
    width: '100%', // Les items occupent toute la largeur
    backgroundColor: 'transparent',
  },
  number: {
    width: 32,
    textAlign: 'center',
    fontSize: 14,
    color: '#FFFFFF',
    marginRight: 6,
  },
  name: {
    flex: 1,
    textAlign: 'left',
    paddingVertical: 6,
    color: '#FFFFFF',
    fontSize: 14,
  },
  sectionTitle: {
    color: '#A8B4C0',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  icon: {
    width: 18,
    height: 18,
    marginRight: 6,
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
