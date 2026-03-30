import React, { useState } from 'react';
import { View, Image, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity } from 'react-native';
import { joueurStats } from './data/mockData';

const scale = 0.85;

// Fonction pour obtenir dynamiquement l'image du joueur
const getImageSource = (id) => {
  switch (id) {
    case '1': return require('../../assets/joueur-1.png');
    case '2': return require('../../assets/joueur-2.png');
    case '3': return require('../../assets/joueur-3.png');
    case '4': return require('../../assets/joueur-4.png');
    case '5': return require('../../assets/joueur-5.png');
    case '6': return require('../../assets/joueur-6.png');
    case '7': return require('../../assets/joueur-7.png');
    case '8': return require('../../assets/joueur-8.png');
    case '9': return require('../../assets/joueur-9.png');
    case '10': return require('../../assets/joueur-10.png');
    case '11': return require('../../assets/joueur-11.png');
    case '12': return require('../../assets/joueur-12.png');
    case '13': return require('../../assets/joueur-13.png');
    case '14': return require('../../assets/joueur-14.png');
    default: return require('../../assets/joueur-7.png'); // Image par défaut si le joueur n'existe pas
  }
};

const StatsJoueurs = () => {
  const [selectedJoueur, setSelectedJoueur] = useState(joueurStats[0]); // Joueur initialement sélectionné

  const renderItem = ({ item }) => (
    <TouchableOpacity onPress={() => setSelectedJoueur(item)}>
      <View style={[styles.joueurItem, selectedJoueur.id === item.id && styles.selectedJoueurItem]}>
        
        <Image source={getImageSource(item.id)} style={styles.statsImage} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.playerListContainer}>
        <FlatList
          data={joueurStats} // Liste des joueurs
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          horizontal={true}
          showsHorizontalScrollIndicator={false}
        />
      </View>

      <View style={styles.hrContainer}>
        <View style={[styles.hr, { backgroundColor: '#fff', opacity: 0.1 }]} />
      </View>

      <ScrollView
        style={styles.statCardContainer}
        showsVerticalScrollIndicator={false}
      >
        {selectedJoueur ? (
          <View style={styles.statCard}>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={styles.tableHeader}>F.C. VIDAUBAN</Text>
                <Text style={styles.tableHeader}>-</Text>
                <Text style={styles.tableHeader}>A.S. ARCOISE</Text>
              </View>

              {[ // Liste des statistiques à afficher
                ['Joueur', 'nom'],
                ['Buts', 'buts'],
                ['Passes décisives', 'passesDecisives'],
                ['Tirs', 'tirs'],
                ['Précision des tirs', 'precisionTirs'],
                ['Passes', 'passes'],
                ['Précision des passes', 'precisionPasses'],
                ['Dribles', 'dribles'],
                ['Précision des dribles', 'precisionDribles'],
                ['Tacles', 'tacles'],
                ['Tacles réussis', 'taclesReussis'],
                ['Hors-jeu', 'horsJeu'],
                ['Fautes commises', 'fautesComises'],
                ['Ballon récupérés', 'ballonRecuperes'],
                ['Ballon perdus', 'ballonPerdus'],
                ['Distance parcourue', 'distanceParcourue'],
                ['Temps de jeu', 'tempsJeu'],
              ].map(([title, key], index) => (
                <View style={styles.tableRow} key={index}>
                  <Text style={styles.tableCell}>{selectedJoueur.statsVidauban[key]}</Text>
                  <Text style={styles.tableCell}>{title}</Text>
                  <Text style={styles.tableCell}>{selectedJoueur.statsArcoise[key]}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.statText}>Sélectionnez un joueur pour voir ses statistiques.</Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 12,
    alignItems: 'stretch', // ✅ pleine largeur
  },

  hrContainer: {
    alignItems: 'stretch',
  },
  hr: {
    height: 1,
    width: '100%',
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
    width: 70 * scale,      // ✅ un peu plus compact
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.45,
  },
  selectedJoueurItem: {
    opacity: 1,
  },

  statCardContainer: {
    width: '100%',          // ✅ pleine largeur
    flex: 1,
  },

  statCard: {
    paddingVertical: 8,
    paddingHorizontal: 0,   // ✅ on enlève le padding latéral (déjà dans container)
  },

  table: {
    width: '100%',
  },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,     // ✅ plus compact
    paddingHorizontal: 4,
    borderBottomColor: '#001A31',
    borderBottomWidth: 0.5,
  },

  // ✅ Header compact et bien aligné
  tableHeader: {
    fontWeight: '700',
    fontSize: 13,
    color: '#00A0E9',
    flex: 1,               // ✅ au lieu de width:'33%'
    textAlign: 'center',
    marginBottom: 6,
  },

  // ✅ Cellules pleine largeur avec flex (plus fiable que %)
  tableCell: {
    fontSize: 12,
    color: '#fff',
    flex: 1,               // ✅ au lieu de width:'33%'
    textAlign: 'center',
  },

  statText: {
    fontSize: 13,
    color: '#fff',
    paddingTop: 10,
  },
});


export default StatsJoueurs;
