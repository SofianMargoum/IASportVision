import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons'; // Import de l'icône Ionicons
import { debounce } from 'lodash';
import { searchClubs, fetchCompetitionsForClub } from './../api';
import { useClubContext } from './../ClubContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const scale = 0.85;

const SearchClub = () => {
  const { setSelectedClub, setClNo, setCompetition, selectedClub, setPhase, setPoule, setCp_no } = useClubContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [clubs, setClubs] = useState([]);
  const [recentClubs, setRecentClubs] = useState([]);
  const [detailedCompetitions, setDetailedCompetitions] = useState([]);
  const [competitionNames, setCompetitionNames] = useState([]);
  const [selectedCompetition, setSelectedCompetition] = useState('');

  const previousSearchTerm = useRef('');

  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const savedSelectedClub = await AsyncStorage.getItem('selectedClub');
        const savedRecentClubs = await AsyncStorage.getItem('recentClubs');
        const savedSelectedCompetition = await AsyncStorage.getItem('selectedCompetition');

        if (savedRecentClubs) {
          setRecentClubs(JSON.parse(savedRecentClubs));
        }

        if (savedSelectedClub) {
          const club = JSON.parse(savedSelectedClub);
          setSelectedClub(club);
          setClNo(club.cl_no);

          const storedCompetitions = await fetchCompetitionsForClub(club.cl_no);
          const sortedCompetitions = storedCompetitions.sort((a, b) =>
            a.competitionName.localeCompare(b.competitionName)
          );

          setCompetitionNames(sortedCompetitions.map((comp) => comp.competitionName));
          setDetailedCompetitions(sortedCompetitions);

          if (
            savedSelectedCompetition &&
            sortedCompetitions.some((comp) => comp.competitionName === savedSelectedCompetition)
          ) {
            const selectedCompDetails = sortedCompetitions.find(
              (comp) => comp.competitionName === savedSelectedCompetition
            );
            setSelectedCompetition(selectedCompDetails.competitionName);
            setCompetition(selectedCompDetails.competitionName);
            setPhase(selectedCompDetails.phaseNumber);
            setPoule(selectedCompDetails.stageNumber);
            setCp_no(selectedCompDetails.cp_no);
          } else if (sortedCompetitions.length > 0) {
            const firstCompDetails = sortedCompetitions[0];
            setSelectedCompetition(firstCompDetails.competitionName);
            setCompetition(firstCompDetails.competitionName);
            setPhase(firstCompDetails.phaseNumber);
            setPoule(firstCompDetails.stageNumber);
            setCp_no(firstCompDetails.cp_no);
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      }
    };

    loadStoredData();
  }, [setSelectedClub, setCompetition]);

  const handleCompetitionClick = useCallback(
    (competitionName) => {
      const selectedCompDetails = detailedCompetitions.find(
        (comp) => comp.competitionName === competitionName
      );

      if (selectedCompDetails) {
        setSelectedCompetition(selectedCompDetails.competitionName);
        setCompetition(selectedCompDetails.competitionName);
        setPhase(selectedCompDetails.phaseNumber);
        setPoule(selectedCompDetails.stageNumber);
        setCp_no(selectedCompDetails.cp_no);

        AsyncStorage.setItem('selectedCompetition', selectedCompDetails.competitionName);
        AsyncStorage.setItem('selectedPhase', JSON.stringify(selectedCompDetails.phaseNumber));
        AsyncStorage.setItem('selectedPoule', JSON.stringify(selectedCompDetails.stageNumber));
      }
    },
    [detailedCompetitions, setCompetition, setSelectedCompetition, setPhase, setPoule, setCp_no]
  );

  const handleSearch = useCallback(
    debounce(async () => {
      if (searchTerm.trim().length < 3) {
        setClubs(recentClubs);
        return;
      }

      if (searchTerm === previousSearchTerm.current) return;

      previousSearchTerm.current = searchTerm;
      const clubData = await searchClubs(searchTerm);

      if (clubData && searchTerm === previousSearchTerm.current) {
        setClubs(clubData.slice(0, 30));
      }
    }, 300),
    [searchTerm, recentClubs]
  );

  useEffect(() => {
    handleSearch();
    return () => handleSearch.cancel();
  }, [searchTerm, handleSearch]);

  const handleClubClick = useCallback(
    async (club) => {
      setSearchTerm('');
      setSelectedClub(club);
      setClNo(club.cl_no);
  
      // Mettre à jour les clubs récents (sans doublons)
      setRecentClubs((prevClubs) => {
        const updatedClubs = [club, ...prevClubs.filter((c) => c.cl_no !== club.cl_no)];
        AsyncStorage.setItem('recentClubs', JSON.stringify(updatedClubs.slice(0, 3)));
        return updatedClubs.slice(0, 3);
      });
  
      // Charger les compétitions pour le club sélectionné
      const storedCompetitions = await fetchCompetitionsForClub(club.cl_no);
  
      // Trier les compétitions par nom (competitionName)
      const sortedCompetitions = storedCompetitions.sort((a, b) =>
        a.competitionName.localeCompare(b.competitionName)
      );
  
      // Mettre à jour les états avec les données enrichies
      setCompetitionNames(sortedCompetitions.map((comp) => comp.competitionName)); // Pour affichage simplifié
      setDetailedCompetitions(sortedCompetitions); // Conserver les données complètes pour utilisation ultérieure
  
      // Gérer la première compétition par défaut
      if (sortedCompetitions.length > 0) {
        const firstCompetition = sortedCompetitions[0];
        setSelectedCompetition(firstCompetition.competitionName);
        setCompetition(firstCompetition.competitionName);
        setPhase(firstCompetition.phaseNumber);
        setPoule(firstCompetition.stageNumber);
        setCp_no(firstCompetition.cp_no);
  
        // Sauvegarder la compétition sélectionnée par défaut
        AsyncStorage.setItem('selectedCompetition', firstCompetition.competitionName);
      }
  
      // Sauvegarder le club sélectionné
      AsyncStorage.setItem('selectedClub', JSON.stringify(club));
    },
    [setSelectedClub, setClNo, setCompetition, setPhase, setPoule, setCp_no]
  );
  
  

  const memoizedClubList = useMemo(() => {
    return searchTerm.trim().length === 0 ? recentClubs : clubs;
  }, [clubs, recentClubs, searchTerm]);

  const renderClubItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleClubClick(item)} style={styles.clubItem}>
      <Image source={{ uri: item.logo }} style={styles.logo} />
      <Text style={[styles.clubName, item.cl_no === selectedClub?.cl_no && styles.selectedClub]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderCompetitionItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleCompetitionClick(item)} style={styles.competitionItem}>
      <Text style={item === selectedCompetition ? styles.selectedCompetition : styles.competitionName}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  return (
    <FlatList
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      data={[
        { title: 'Sélectionner un club', data: memoizedClubList, showSuggestions: true },
        { title: 'Sélectionner une équipe', data: competitionNames, showSuggestions: competitionNames.length > 0 },
      ]}
      keyExtractor={(item, index) => index.toString()}
      renderItem={({ item }) => (
        <View style={styles.section}>
          {item.title === 'Sélectionner une équipe' && (
            <View style={styles.hrContainer}>
              <View style={[styles.hr, { backgroundColor: '#fff', opacity: 0.1 }]} />
            </View>
          )}
          <Text style={styles.title}>{item.title}</Text>
          {item.title === 'Sélectionner un club' && (
            <View style={styles.searchContainer}>
              <Icon name="search" size={20} color="#888" style={styles.searchIcon} />
              <TextInput
                style={styles.input}
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Rechercher un club"
                placeholderTextColor="#888"
              />
            </View>
          )}
          {item.showSuggestions && <Text style={styles.suggestions}>Suggestions</Text>}
          {item.title === 'Sélectionner un club' ? (
            <FlatList data={item.data} keyExtractor={(club) => club.cl_no.toString()} renderItem={renderClubItem} />
          ) : (
            <View style={styles.competitionList}>
              {competitionNames.length > 0 ? (
                <FlatList
                  data={competitionNames}
                  keyExtractor={(name, index) => index.toString()}
                  renderItem={renderCompetitionItem}
                />
              ) : (
                <Text style={styles.noCompetitions}>Aucune compétition disponible.</Text>
              )}
            </View>
          )}
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 10 * scale,
  },
  section: {
    marginBottom: 20 * scale,
    width: '100%',
  },
  hrContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  hr: {
    height: 2,
    width: '100%',
    marginVertical: 1,
  },
  title: {
    textAlign: 'center',
    fontSize: 20 * scale,
    fontWeight: 'bold',
    color: '#fff',
    paddingVertical: 15 * scale,
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#010E1E',
    paddingHorizontal: 10 * scale,
    borderRadius: 4,
    marginBottom: 20 * scale,
  },
  input: {
    width: '100%',
    padding: 10 * scale,
    fontSize: 16 * scale,
    color: '#ffffff',
  },
  searchIcon: {
    marginLeft: 10 * scale,
  },
  suggestions: {
    fontStyle: 'italic',
    fontSize: 12 * scale,
    marginBottom: 10,
    color: '#ffffff',
    width: '60%',
  },
  clubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10 * scale,
  },
  logo: {
    width: 50 * scale,
    height: 50 * scale,
    marginRight: 15 * scale,
    borderRadius: 50,
    borderColor: '#ccc',
    borderWidth: 1,
  },
  clubName: {
    fontSize: 18 * scale,
    fontWeight: '500',
    color: '#ffffff',
  },
  selectedClub: {
    fontWeight: 'bold',
    color: '#00A0E9',
  },
  competitionList: {
    width: '100%',
  },
  competitionItem: {
    padding: 10 * scale,
  },
  competitionName: {
    fontSize: 16 * scale,
    color: '#ffffff',
  },
  selectedCompetition: {
    fontWeight: 'bold',
    fontSize: 16 * scale,
    color: '#00A0E9',
  },
  noCompetitions: {
    color: '#888',
    textAlign: 'center',
    marginVertical: 10,
  },
});

export default SearchClub;
