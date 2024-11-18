import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { fetchMatchesForClub, fetchClassementJournees } from './../api';
import { useClubContext } from './../ClubContext';

const scale = 0.85; // Ajustez cette valeur selon vos besoins

function ClassementsContent() {
  const [classements, setClassements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { selectedClub, competition } = useClubContext();

  useEffect(() => {
    const loadClassements = async () => {
      setLoading(true);
      setError(null);
      setClassements([]);

      if (!selectedClub) {
        setError(new Error('Aucun club sélectionné.'));
        setLoading(false);
        return;
      }

      try {
        const matches = await fetchMatchesForClub(selectedClub.cl_no);
        const foundMatch = matches.find(match => match.competitionName === competition);

        if (!foundMatch) {
          throw new Error('Aucun match trouvé pour la compétition sélectionnée.');
        }

        const { competitionNumber, phaseNumber, pouleNumber } = foundMatch;
        const classementsData = await fetchClassementJournees(competitionNumber, phaseNumber, pouleNumber);
        setClassements(classementsData);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError(error);
      } finally {
        setLoading(false);
      }
    };

    loadClassements();
  }, [selectedClub, competition]);

  // Affichage si les données sont en cours de chargement
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00BFFF" />
        <Text style={styles.loadingText}>Chargement des classements...</Text>
      </View>
    );
  }

  // Affichage en cas d'erreur
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Erreur lors du chargement des classements : {error.message}</Text>
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
      <Text style={styles.cell}>{item.goalDifference}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Conteneur principal avec les classements */}
      <View style={styles.container}>
        <View style={styles.fixedColumn}>
          <View style={styles.headerRow}>
            <Text style={styles.headerCell}>Rang</Text>
            <Text style={[styles.headerCell, styles.teamName]}>Club</Text>
          </View>
          <FlatList
            data={classements}
            keyExtractor={(item) => item.teamId || item.teamName}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.cell}>{item.rank}</Text>
                <Text style={[styles.cell, styles.teamName]}>{item.teamName}</Text>
              </View>
            )}
            scrollEnabled={false}
          />
        </View>

        {/* Section défilable avec les détails des classements */}
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
              keyExtractor={(item) => item.teamId || item.teamName}
              renderItem={renderClassementItem}
              contentContainerStyle={{ paddingBottom: 20 * scale }}
              scrollEnabled={false}
            />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flex: 1,
    padding: 10 * scale,
    borderRadius: 8,
    marginTop: 10 * scale,
    borderColor: '#001A31',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    elevation: 5,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#00BFFF',
    fontSize: 16 * scale,
    marginTop: 10,
  },
  errorText: {
    color: '#FF0000',
    fontSize: 16 * scale,
  },
  fixedColumn: {
    width: 200,
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
    borderBottomColor: '#001A31',
    borderBottomWidth: 1,
    flex: 1,
  },
  cell: {
    width: 50,
    color: '#FFFFFF',
    textAlignVertical: 'center',
    textAlign: 'center',
    padding: 5,
    fontSize: 14 * scale,
  },
  teamName: {
    flex: 1,
    minWidth: 50,
    padding: 5,
    justifyContent: 'center',
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  headerCell: {
    width: 50,
    color: '#00BFFF',
    fontWeight: 'bold',
    textAlignVertical: 'center',
    textAlign: 'center',
    fontSize: 14 * scale,
    paddingVertical: 5,
  },
});

export default ClassementsContent;
