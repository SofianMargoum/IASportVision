import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { debounce } from 'lodash';
import { searchClubs, fetchCompetitionsForClub } from './../api';
import config from './../../config';
import { useClubContext } from './../ClubContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const scale = 0.85;

const SearchClub = () => {
  const { setSelectedClub, setClNo, setCompetition, selectedClub } = useClubContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [clubs, setClubs] = useState([]);
  const [recentClubs, setRecentClubs] = useState([]);
  const [recentlySelectedClubs, setRecentlySelectedClubs] = useState([]);
  const [competitionNames, setCompetitionNames] = useState([]);
  const [selectedCompetition, setSelectedCompetition] = useState('');

  const previousSearchTerm = useRef('');

  useEffect(() => {
    const loadStoredData = async () => {
      const savedRecentClubs = await AsyncStorage.getItem('recentClubs');
      const savedSelectedClub = await AsyncStorage.getItem('selectedClub');
      const savedSelectedCompetition = await AsyncStorage.getItem('selectedCompetition');

      if (savedRecentClubs) setRecentClubs(JSON.parse(savedRecentClubs));
      if (savedSelectedClub) {
        const club = JSON.parse(savedSelectedClub);
        setSelectedClub(club);
        setRecentlySelectedClubs([club]);
        setClNo(club.cl_no);
      }
      if (savedSelectedCompetition) {
        setSelectedCompetition(savedSelectedCompetition);
        setCompetition(savedSelectedCompetition);
      }
    };

    loadStoredData();
  }, [setSelectedClub, setClNo, setCompetition]);

  useEffect(() => {
    const loadRecentClubs = async () => {
      const savedRecentClubs = await config.getRecentClubs();
      setRecentClubs(savedRecentClubs);
      if (searchTerm.trim().length === 0) setClubs(savedRecentClubs);
    };

    loadRecentClubs();
  }, [searchTerm]);

  useEffect(() => {
    const loadCompetition = async () => {
      const savedCompetition = await config.getSelectedCompetition();
      if (savedCompetition) handleCompetitionClick(savedCompetition);
    };

    loadCompetition();
  }, []);

  const handleCompetitionClick = useCallback(
    (competitionName) => {
      config.setSelectedCompetition(competitionName);
      setCompetition(competitionName);
      setSelectedCompetition(competitionName);
      AsyncStorage.setItem('selectedCompetition', competitionName);
    },
    [setCompetition]
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

      setRecentlySelectedClubs((prevClubs) => {
        const updatedClubs = [club, ...prevClubs.filter((c) => c.cl_no !== club.cl_no)];
        AsyncStorage.setItem('recentlySelectedClubs', JSON.stringify(updatedClubs.slice(0, 3)));
        return updatedClubs.slice(0, 3);
      });

      const storedCompetitions = await fetchCompetitionsForClub(club.cl_no);
      const sortedCompetitions = storedCompetitions.sort((a, b) => a.localeCompare(b));
      setCompetitionNames(sortedCompetitions);

      if (sortedCompetitions.length > 0) handleCompetitionClick(sortedCompetitions[0]);

      AsyncStorage.setItem('selectedClub', JSON.stringify(club));
    },
    [handleCompetitionClick, setSelectedClub, setClNo]
  );

  const memoizedClubList = useMemo(() => {
    return searchTerm.trim().length === 0 ? [...recentClubs, ...recentlySelectedClubs] : clubs;
  }, [clubs, recentClubs, recentlySelectedClubs, searchTerm]);

  const data = [
    { title: 'Sélectionner un club', data: memoizedClubList, showSuggestions: true },
    { title: 'Sélectionner une équipe', data: competitionNames, showSuggestions: competitionNames.length > 0 },
  ];

  const renderClubItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleClubClick(item)} style={styles.clubItem}>
      <Image source={{ uri: item.logo }} style={styles.logo} />
      <Text style={[styles.clubName, item.cl_no === selectedClub?.cl_no && styles.selectedClub]}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderCompetitionItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleCompetitionClick(item)} style={styles.competitionItem}>
      <Text style={item === selectedCompetition ? styles.selectedCompetition : styles.competitionName}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={data}
      keyExtractor={(item, index) => index.toString()}
      renderItem={({ item }) => (
        <View style={styles.section}>
          {item.title === 'Sélectionner une équipe' && (
            <View style={styles.hrContainer}>
              {/* Ligne horizontale dégradée simulée avec plusieurs vues */}
              <View style={[styles.hr, { backgroundColor: '#fff', opacity: 0.1 }]} />
            </View>
          )}
          <Text style={styles.title}>{item.title}</Text>
          {item.title === 'Sélectionner un club' && (
            <TextInput
              style={styles.input}
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Rechercher un club"
              placeholderTextColor="#888"
            />
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
    marginVertical: 1, // Espacement entre les vues pour simuler un dégradé
  },
  title: {
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    fontSize: 20 * scale,
    fontWeight: 'bold',
    color: '#fff',
    paddingVertical: 15 * scale,
    width: '100%',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    padding: 10 * scale,
    marginBottom: 20 * scale,
    borderRadius: 4,
    fontSize: 16 * scale,
    backgroundColor: '#010E1E',
    color: '#ffffff',
  },
  suggestions: {
    fontStyle: 'italic',
    fontSize: 12 * scale,
    marginBottom: 10,
    textAlign: 'left',
    opacity: 0.5,
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
