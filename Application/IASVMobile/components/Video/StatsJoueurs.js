import React, { useState } from 'react';
import { View, Image, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity } from 'react-native';

const scale = 0.85;

// Liste des joueurs (même pour les deux équipes)
const joueurStats = Array.from({ length: 14 }, (_, i) => ({
  id: (i + 1).toString(),
  nom: `Joueur ${i + 1}`,
  buts: Math.floor(Math.random() * 6),
  passesDecisives: Math.floor(Math.random() * 4),
  tirs: Math.floor(Math.random() * 5),
  precisionTirs: Math.floor(Math.random() * 100),
  passes: Math.floor(Math.random() * 5),
  precisionPasses: Math.floor(Math.random() * 100),
  dribles: Math.floor(Math.random() * 5),
  precisionDribles: Math.floor(Math.random() * 100),
  tacles: Math.floor(Math.random() * 7),
  taclesReussis: Math.floor(Math.random() * 100),
  horsJeu: Math.floor(Math.random() * 3),
  fautesComises: Math.floor(Math.random() * 3),
  ballonRecuperes: Math.floor(Math.random() * 5),
  ballonPerdus: Math.floor(Math.random() * 5),
  distanceParcourue: (Math.random() * 10 + 6).toFixed(2),
  tempsJeu: `${70 + Math.floor(Math.random() * 21)} min`
}));

const StatsJoueurs = () => {
  const [selectedJoueur, setSelectedJoueur] = useState(joueurStats[0]); // Joueur initialement sélectionné

  const renderItem = ({ item }) => (
    <TouchableOpacity onPress={() => setSelectedJoueur(item)}>
      <View style={[styles.joueurItem, selectedJoueur.id === item.id && styles.selectedJoueurItem]}>
      <Text style={[styles.joueurNom, selectedJoueur.id === item.id && styles.selectedJoueurNom]}>
          {item.nom}
        </Text>
        <Image source={require('../../assets/joueur-7.png')} style={styles.statsImage} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.playerListContainer}>
        <FlatList
          data={joueurStats} // Liste commune des joueurs
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          horizontal={true}
          showsHorizontalScrollIndicator={false}
        />
      </View>

      <View style={styles.hrContainer}>
        <View style={[styles.hr, { backgroundColor: '#fff', opacity: 0.1 }]} />
      </View>

      <ScrollView style={styles.statCardContainer}>
        {selectedJoueur ? (
          <View style={styles.statCard}>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={styles.tableHeader}>Equipe A</Text>
                <Text style={styles.tableHeader}>Statistiques</Text>
                <Text style={styles.tableHeader}>Equipe B</Text>
              </View>

              {[
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
                  <Text style={styles.tableCell}>{selectedJoueur[key]}</Text>
                  <Text style={styles.tableCell}>{title}</Text>
                  <Text style={styles.tableCell}>{selectedJoueur[key]}</Text>
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
    marginVertical: 1,
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
    marginBottom: 16,
  },
  statCard: {
    padding: 16,
    borderRadius: 8,
  },
  table: {
    marginTop: 10,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
  },
  tableHeader: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#fff',
    width: '33%',
    textAlign: 'center',
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
