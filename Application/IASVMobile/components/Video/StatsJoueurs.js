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
  },
  hrContainer: {
    alignItems: 'center',
  },
  hr: {
    height: 2,
    width: '100%',
  },
  playerListContainer: {
    position: 'relative',
    width: '100%',
    height: 60 * scale,
    justifyContent: 'center',
    marginBottom: 10,
  },
  statsImage: {
    height: 60 * scale,
    width: 60 * scale,
    resizeMode: 'contain',
    borderRadius: 10 * scale,
  },
  joueurItem: {
    width: 80 * scale,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.5,
  },
  selectedJoueurItem: {
    opacity: 1,
  },
  joueurNom: {
    fontSize: 12 * scale,
    color: '#FFFFFF',
    fontWeight: 'bold',
    opacity: 1,
  },
  selectedJoueurNom: {
    color: '#FFFFFF',
    fontSize: 13 * scale,
  },
  statCardContainer: {
    borderRadius: 8,
  },
  statCard: {
    padding: 16,
    borderRadius: 8,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomColor: '#001A31',
    borderBottomWidth: 1,
  },
  tableHeader: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#00A0E9',
    width: '33%',
    textAlign: 'center',
    marginBottom : 10,
  },
  tableCell: {
    fontSize: 14,
    color: '#fff',
    width: '33%',
    textAlign: 'center',
  },
  statText: {
    fontSize: 16,
    color: '#fff',
  },
});

export default StatsJoueurs;
