import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { debounce } from 'lodash';
import { searchClubs, fetchCompetitionsForClub } from './../../tools/api';
import { useClubContext } from './../../tools/ClubContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const scale = 0.85;

const SearchClub = ({ initialSearchTerm, locationCity, locationRequestId, onLocatePress, isLocating }) => {
  const { setSelectedClub, setClNo, setCompetition, selectedClub, setPhase, setPoule, setCp_no } = useClubContext();
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [clubs, setClubs] = useState([]);
  const [recentClubs, setRecentClubs] = useState([]);
  const [detailedCompetitions, setDetailedCompetitions] = useState([]);
  const [competitionNames, setCompetitionNames] = useState([]);
  const [selectedCompetition, setSelectedCompetition] = useState('');

  const previousSearchTerm = useRef('');

  const sortByName = useCallback((list) => {
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) =>
      String(a?.name || '').localeCompare(String(b?.name || ''), 'fr', { sensitivity: 'base' })
    );
  }, []);

  const loadStoredData = async () => {
    try {
      const savedSelectedClub = await AsyncStorage.getItem('selectedClub');
      const savedRecentClubs = await AsyncStorage.getItem('recentClubs');
      const savedSelectedCompetition = await AsyncStorage.getItem('selectedCompetition');

      if (savedRecentClubs) {
        setRecentClubs(sortByName(JSON.parse(savedRecentClubs)));
      }

      if (savedSelectedClub) {
        const club = JSON.parse(savedSelectedClub);
        setSelectedClub(club);
        setClNo(club.cl_no);

        const storedCompetitions = await fetchCompetitionsForClub(club.cl_no);
        const sortedCompetitions = storedCompetitions.sort((a, b) =>
          a.competitionName.localeCompare(b.competitionName, 'fr', { sensitivity: 'base' })
        );

        const uniqueCompetitions = sortedCompetitions.filter((comp, index, self) =>
          self.findIndex((c) => c.competitionName === comp.competitionName) === index
        );

        setCompetitionNames(uniqueCompetitions.map((comp) => comp.competitionName));
        setDetailedCompetitions(uniqueCompetitions);

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

  useEffect(() => {
    loadStoredData();
  }, [setSelectedClub, setCompetition]);

  useEffect(() => {
    if (initialSearchTerm && searchTerm.trim().length === 0) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm, searchTerm]);

  useEffect(() => {
    if (!locationRequestId) return;
    if (locationCity) {
      setSearchTerm(locationCity);
    }
  }, [locationCity, locationRequestId]);

  // Recharger les données depuis le contexte quand selectedClub change
  useEffect(() => {
    if (selectedClub) {
      const syncWithContext = async () => {
        const storedCompetitions = await fetchCompetitionsForClub(selectedClub.cl_no);
        const sortedCompetitions = storedCompetitions.sort((a, b) =>
          a.competitionName.localeCompare(b.competitionName, 'fr', { sensitivity: 'base' })
        );
        const uniqueCompetitions = sortedCompetitions.filter((comp, index, self) =>
          self.findIndex((c) => c.competitionName === comp.competitionName) === index
        );
        setCompetitionNames(uniqueCompetitions.map((comp) => comp.competitionName));
        setDetailedCompetitions(uniqueCompetitions);
        
        // Synchroniser aussi la compétition sélectionnée depuis le contexte
        const savedSelectedCompetition = await AsyncStorage.getItem('selectedCompetition');
        if (savedSelectedCompetition && sortedCompetitions.some(comp => comp.competitionName === savedSelectedCompetition)) {
          setSelectedCompetition(savedSelectedCompetition);
        }
      };
      syncWithContext();
    }
  }, [selectedClub]);


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
        const sortedClubs = sortByName(clubData);
        setClubs(sortedClubs.slice(0, 30));
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

      // Met à jour la liste des clubs récents
      setRecentClubs((prevClubs) => {
        const updatedClubs = [club, ...prevClubs.filter((c) => c.cl_no !== club.cl_no)];
        const sortedUpdated = sortByName(updatedClubs).slice(0, 3);
        AsyncStorage.setItem('recentClubs', JSON.stringify(sortedUpdated));
        return sortedUpdated;
      });

      // Récupère les compétitions du club
      const storedCompetitions = await fetchCompetitionsForClub(club.cl_no);
      const sortedCompetitions = storedCompetitions.sort((a, b) =>
        a.competitionName.localeCompare(b.competitionName, 'fr', { sensitivity: 'base' })
      );

      const uniqueCompetitions = sortedCompetitions.filter((comp, index, self) =>
        self.findIndex((c) => c.competitionName === comp.competitionName) === index
      );

      setCompetitionNames(uniqueCompetitions.map((comp) => comp.competitionName));
      setDetailedCompetitions(uniqueCompetitions);

      if (sortedCompetitions.length > 0) {
        const firstCompetition = sortedCompetitions[0];
        setSelectedCompetition(firstCompetition.competitionName);
        setCompetition(firstCompetition.competitionName);
        setPhase(firstCompetition.phaseNumber);
        setPoule(firstCompetition.stageNumber);
        setCp_no(firstCompetition.cp_no);
        AsyncStorage.setItem('selectedCompetition', firstCompetition.competitionName);
      }

      AsyncStorage.setItem('selectedClub', JSON.stringify(club));
    },
    [setSelectedClub, setClNo, setCompetition, setPhase, setPoule, setCp_no]
  );

  const memoizedClubList = useMemo(() => {
    if (searchTerm.trim().length === 0) {
      const baseList = selectedClub && !recentClubs.some(club => club.cl_no === selectedClub.cl_no)
        ? [selectedClub, ...recentClubs]
        : recentClubs;
      return sortByName(baseList);
    }
    return sortByName(clubs);
  }, [clubs, recentClubs, searchTerm, selectedClub, sortByName]);

  const renderClubItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleClubClick(item)} style={styles.clubItem}>
      {item.logo ? <Image source={{ uri: item.logo }} style={styles.logo} /> : null}
      <Text style={[styles.clubName, item.cl_no === selectedClub?.cl_no && styles.selectedClub]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderCompetitionItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => selectedClub && handleCompetitionClick(item)}
      disabled={!selectedClub}
      style={[styles.competitionItem, !selectedClub && { opacity: 0.4 }]}
    >
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
        ...(selectedClub
          ? [{ title: 'Sélectionner une équipe', data: competitionNames, showSuggestions: competitionNames.length > 0 }]
          : []),
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
              <TouchableOpacity
                onPress={onLocatePress}
                style={styles.locationButton}
                disabled={isLocating}
                accessibilityLabel="Utiliser la localisation"
              >
                {isLocating ? (
                  <ActivityIndicator size="small" color="#00A0E9" />
                ) : (
                  <Icon name="location-outline" size={20} color="#00A0E9" />
                )}
              </TouchableOpacity>
            </View>
          )}
          {item.showSuggestions && memoizedClubList.length > 0 && (
            <Text style={styles.suggestions}>Suggestions</Text>
          )}
          {item.title === 'Sélectionner un club' ? (
            <FlatList
              data={item.data}
              keyExtractor={(club) => club.cl_no.toString()}
              renderItem={renderClubItem}
            />
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
    flex: 1,
    padding: 10 * scale,
    fontSize: 16 * scale,
    color: '#ffffff',
  },
  searchIcon: {
    marginLeft: 10 * scale,
    marginRight: 6 * scale,
  },
  locationButton: {
    paddingVertical: 8 * scale,
    paddingHorizontal: 8 * scale,
    marginLeft: 6 * scale,
  },
  suggestions: {
    fontStyle: 'italic',
    fontSize: 12 * scale,
    marginBottom: 10,
    color: '#aaa',
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
