import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { fetchClassementJournees } from './../../tools/api';
import { useClubContext } from './../../tools/ClubContext';

const scale = 0.85;

function ClassementsContent() {
  const [classements, setClassements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { selectedClub, competition, phase, poule, cp_no } = useClubContext();

  useEffect(() => {
    let isMounted = true;

    const loadClassements = async () => {
      setLoading(true);
      setError(null);

      // Contexte pas prêt → on n'appelle pas l’API
      if (!selectedClub?.cl_no) {
        if (isMounted) {
          setClassements([]);
          setLoading(false);
        }
        return;
      }

      try {
        const data = await fetchClassementJournees(cp_no, phase, poule);
        if (isMounted) setClassements(Array.isArray(data) ? data : []);
      } catch (e) {
        if (isMounted) setError("Erreur lors du chargement des classements.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadClassements();
    return () => { isMounted = false; };
  }, [selectedClub?.cl_no, competition, cp_no, phase, poule]);

  // --- Rendu ---

  // Contexte pas prêt (pas de club)
  if (!selectedClub?.cl_no && !loading && !error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.infoText}>Sélectionne un club pour voir le classement.</Text>
      </View>
    );
  }

  // En cours de chargement
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Chargement du classement…</Text>
      </View>
    );
  }

  // Erreur
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // Aucun résultat après chargement
  if (classements.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.infoText}>
          Aucun classement trouvé {selectedClub?.name ? `pour ${selectedClub.name}` : ''}.
        </Text>
      </View>
    );
  }

  // Rendu du tableau des classements
  const renderClassementItem = ({ item }) => (
    <View style={styles.row}>
      <Text style={styles.cell}>{item.points}</Text>
      <Text style={styles.cell}>{item.totalGames}</Text>
      <Text style={styles.cell}>{item.wonGames}</Text>
      <Text style={styles.cell}>{item.drawGames}</Text>
      <Text style={styles.cell}>{item.lostGames}</Text>
      <Text style={styles.cell}>{item.goalsFor}</Text>
      <Text style={styles.cell}>{item.goalsAgainst}</Text>
      <Text style={styles.cell}>{(item.goalsFor ?? 0) - (item.goalsAgainst ?? 0)}</Text>
    </View>
  );

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.container}>
        {/* Colonne fixe : rang + club */}
        <View style={styles.fixedColumn}>
          <View style={styles.headerRow}>
            <Text style={styles.headerCell}>Rang</Text>
            <Text style={[styles.headerCell, styles.teamName, { color: '#00A0E9' }]}>Club</Text>
          </View>
          <FlatList
            data={classements}
            keyExtractor={(item, idx) => String(item.teamId ?? item.teamName ?? idx)}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.cell}>{item.rank}</Text>
                <Text
                  style={[styles.cell, styles.teamName]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {item.teamName}
                </Text>
              </View>
            )}
            scrollEnabled={false}
          />
        </View>

        {/* Colonnes scrollables : stats */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollableContent}>
          <View>
            <View style={styles.headerRow}>
              <Text style={styles.headerCell}>Pts</Text>
              <Text style={styles.headerCell}>MJ</Text>
              <Text style={styles.headerCell}>G</Text>
              <Text style={styles.headerCell}>N</Text>
              <Text style={styles.headerCell}>P</Text>
              <Text style={styles.headerCell}>BP</Text>
              <Text style={styles.headerCell}>BC</Text>
              <Text style={styles.headerCell}>DB</Text>
            </View>
            <FlatList
              data={classements}
              keyExtractor={(item, idx) => String(item.teamId ?? item.teamName ?? idx)}
              renderItem={renderClassementItem}
              contentContainerStyle={{ paddingBottom: 20 * scale }}
              scrollEnabled={false}
            />
          </View>
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flex: 1,
    padding: 10 * scale,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    color: '#00A0E9',
    fontSize: 16 * scale,
    marginTop: 10,
    textAlign: 'center',
  },
  infoText: {
    color: '#aaaaaa',
    fontSize: 14 * scale,
    textAlign: 'center',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 16 * scale,
    textAlign: 'center',
  },
  fixedColumn: {
    width: 200,
    height: '100%',
  },
  scrollableContent: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    marginBottom: 10 * scale,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 8 * scale,
    padding: 5,
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.3)',
  },
  cell: {
    width: 50,
    color: '#FFFFFF',
    textAlignVertical: 'center',
    textAlign: 'center',
    borderBottomColor: '#001A31',
    borderBottomWidth: 1,
    padding: 5,
    fontSize: 14,
  },
  teamName: {
    flex: 1,
    minWidth: 50,
    padding: 5,
    justifyContent: 'center',
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#FFFFFF',
    fontSize: 14,
    overflow: 'hidden',
  },
  headerCell: {
    width: 50,
    color: '#00A0E9',
    fontWeight: 'bold',
    textAlignVertical: 'center',
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 5,
  },
});

export default ClassementsContent;
