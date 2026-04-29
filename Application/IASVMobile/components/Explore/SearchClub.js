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
  const [isSearching, setIsSearching] = useState(false);

  const previousSearchTerm = useRef('');
  const searchTermRef = useRef(searchTerm);
  const recentClubsRef = useRef(recentClubs);
  // Garde-fou anti race-condition : on ignore les réponses liées à un cl_no
  // qui n'est plus le club sélectionné.
  const competitionsRequestRef = useRef(0);

  useEffect(() => { searchTermRef.current = searchTerm; }, [searchTerm]);
  useEffect(() => { recentClubsRef.current = recentClubs; }, [recentClubs]);

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

      if (savedRecentClubs) {
        try {
          const parsed = JSON.parse(savedRecentClubs);
          if (Array.isArray(parsed)) setRecentClubs(parsed);
        } catch {
          await AsyncStorage.removeItem('recentClubs');
        }
      }

      if (savedSelectedClub) {
        let club = null;
        try {
          club = JSON.parse(savedSelectedClub);
        } catch {
          await AsyncStorage.removeItem('selectedClub');
        }
        if (!club || typeof club !== 'object' || !club.cl_no) return;
        // Le useEffect([selectedClub]) se chargera de fetcher les compétitions :
        // une seule source de vérité pour éviter les races.
        setSelectedClub(club);
        setClNo(club.cl_no);
      }
    } catch (error) {
      if (__DEV__) console.error('Erreur lors du chargement des données:', error?.message);
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

  // Source unique de vérité : dès que selectedClub change, on (re)charge
  // ses compétitions, en ignorant toute réponse obsolète.
  useEffect(() => {
    if (!selectedClub?.cl_no) {
      setCompetitionNames([]);
      setDetailedCompetitions([]);
      return;
    }

    const requestId = ++competitionsRequestRef.current;
    const targetClNo = selectedClub.cl_no;

    (async () => {
      try {
        const storedCompetitions = await fetchCompetitionsForClub(targetClNo);
        // Réponse obsolète (l'utilisateur a changé de club entre-temps) ?
        if (requestId !== competitionsRequestRef.current) return;

        const sortedCompetitions = (storedCompetitions || []).sort((a, b) =>
          a.competitionName.localeCompare(b.competitionName, 'fr', { sensitivity: 'base' })
        );
        const uniqueCompetitions = sortedCompetitions.filter((comp, index, self) =>
          self.findIndex((c) => c.competitionName === comp.competitionName) === index
        );

        setCompetitionNames(uniqueCompetitions.map((comp) => comp.competitionName));
        setDetailedCompetitions(uniqueCompetitions);

        // Restaure la sélection persistée si elle est toujours valide,
        // sinon prend la première compétition.
        const savedSelectedCompetition = await AsyncStorage.getItem('selectedCompetition');
        if (requestId !== competitionsRequestRef.current) return;

        const matched = savedSelectedCompetition
          ? uniqueCompetitions.find((c) => c.competitionName === savedSelectedCompetition)
          : null;
        const target = matched || uniqueCompetitions[0] || null;
        if (target) {
          setSelectedCompetition(target.competitionName);
          setCompetition(target.competitionName);
          setPhase(target.phaseNumber);
          setPoule(target.stageNumber);
          setCp_no(target.cp_no);
          if (!matched) {
            AsyncStorage.setItem('selectedCompetition', target.competitionName);
          }
        } else {
          setSelectedCompetition('');
        }
      } catch (error) {
        if (__DEV__) console.error('Erreur fetch compétitions:', error?.message);
      }
    })();
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

  const handleSearch = useRef(
    debounce(async (term, sortFn) => {
      if (term.trim().length < 3) {
        setClubs([]);
        setIsSearching(false);
        return;
      }

      if (term === previousSearchTerm.current) {
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      previousSearchTerm.current = term;
      const clubData = await searchClubs(term);

      if (clubData && term === searchTermRef.current) {
        const sortedClubs = sortFn(clubData);
        setClubs(sortedClubs.slice(0, 30));
      }
      setIsSearching(false);
    }, 300)
  ).current;

  useEffect(() => {
    handleSearch(searchTerm, sortByName);
    return () => handleSearch.cancel();
  }, [searchTerm]);

  const handleClubClick = useCallback(
    async (club) => {
      setSearchTerm('');
      // Si on ré-élit le même club, on n'a rien à invalider.
      // Sinon on supprime la compétition précédemment persistée pour qu'elle
      // ne soit pas réappliquée à tort sur un autre club.
      if (selectedClub?.cl_no !== club.cl_no) {
        await AsyncStorage.removeItem('selectedCompetition');
      }
      setSelectedClub(club);
      setClNo(club.cl_no);

      // Met à jour la liste des clubs récents (ordre chronologique, dernier sélectionné en premier)
      setRecentClubs((prevClubs) => {
        const updatedClubs = [club, ...prevClubs.filter((c) => c.cl_no !== club.cl_no)].slice(0, 3);
        AsyncStorage.setItem('recentClubs', JSON.stringify(updatedClubs));
        return updatedClubs;
      });

      AsyncStorage.setItem('selectedClub', JSON.stringify(club));
      // NB : le fetch des compétitions est géré par le useEffect([selectedClub]).
    },
    [selectedClub, setSelectedClub, setClNo]
  );

  const memoizedClubList = useMemo(() => {
    if (searchTerm.trim().length < 3) {
      // Pas de recherche active : afficher les récents (ordre chronologique)
      const baseList = selectedClub && !recentClubs.some(club => club.cl_no === selectedClub.cl_no)
        ? [selectedClub, ...recentClubs]
        : recentClubs;
      return baseList;
    }
    return sortByName(clubs);
  }, [clubs, recentClubs, searchTerm, selectedClub, sortByName]);

  const isActiveSearch = searchTerm.trim().length >= 3;

  const renderClubItem = ({ item }) => {
    const isSelected = item.cl_no === selectedClub?.cl_no;
    return (
      <TouchableOpacity
        onPress={() => handleClubClick(item)}
        style={[styles.clubItem, isSelected && styles.clubItemSelected]}
        activeOpacity={0.7}
      >
        <View style={styles.clubLogoContainer}>
          {item.logo ? (
            <Image source={{ uri: item.logo }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoPlaceholder]}>
              <Icon name="shield-outline" size={22} color="#555" />
            </View>
          )}
        </View>
        <Text style={[styles.clubName, isSelected && styles.selectedClub]} numberOfLines={1}>
          {item.name}
        </Text>
        {isSelected && (
          <Icon name="checkmark-circle" size={18} color="#fff" style={styles.checkIcon} />
        )}
      </TouchableOpacity>
    );
  };

  const renderCompetitionItem = ({ item }) => {
    const isSelected = item === selectedCompetition;
    return (
      <TouchableOpacity
        onPress={() => selectedClub && handleCompetitionClick(item)}
        disabled={!selectedClub}
        style={[
          styles.competitionItem,
          isSelected && styles.competitionItemSelected,
          !selectedClub && { opacity: 0.4 },
        ]}
        activeOpacity={0.7}
      >
        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
          {isSelected && <View style={styles.radioInner} />}
        </View>
        <Text
          style={[styles.competitionName, isSelected && styles.selectedCompetition]}
          numberOfLines={1}
        >
          {item}
        </Text>
      </TouchableOpacity>
    );
  };

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
              <Icon name="search" size={18} color="#555" style={styles.searchIcon} />
              <TextInput
                style={styles.input}
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Rechercher un club ou une ville..."
                placeholderTextColor="#555"
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchTerm('')}
                  style={styles.clearButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name="close-circle" size={18} color="#555" />
                </TouchableOpacity>
              )}
              <View style={styles.searchDivider} />
              <TouchableOpacity
                onPress={onLocatePress}
                style={styles.locationButton}
                disabled={isLocating}
                accessibilityLabel="Utiliser la localisation"
              >
                {isLocating ? (
                  <ActivityIndicator size="small" color="#888" />
                ) : (
                  <Icon name="location-outline" size={20} color="#888" />
                )}
              </TouchableOpacity>
            </View>
          )}
          {item.title === 'Sélectionner un club' && (
            <>
              {isSearching ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#888" />
                  <Text style={styles.loadingText}>Recherche en cours...</Text>
                </View>
              ) : (
                <>
                  {memoizedClubList.length > 0 && (
                    <Text style={styles.suggestions}>
                      {isActiveSearch ? `${memoizedClubList.length} résultat${memoizedClubList.length > 1 ? 's' : ''}` : 'Récents'}
                    </Text>
                  )}
                  {memoizedClubList.length === 0 && isActiveSearch && (
                    <View style={styles.emptyState}>
                      <Icon name="search-outline" size={32} color="#333" />
                      <Text style={styles.emptyStateText}>Aucun club trouvé</Text>
                      <Text style={styles.emptyStateSubtext}>Essayez avec un autre nom ou une ville</Text>
                    </View>
                  )}
                  <FlatList
                    data={item.data}
                    keyExtractor={(club) => club.cl_no.toString()}
                    renderItem={renderClubItem}
                    scrollEnabled={false}
                  />
                </>
              )}
            </>
          )}
          {item.title === 'Sélectionner une équipe' && (
            <View style={styles.competitionList}>
              {competitionNames.length > 0 ? (
                <FlatList
                  data={competitionNames}
                  keyExtractor={(name, index) => index.toString()}
                  renderItem={renderCompetitionItem}
                  scrollEnabled={false}
                />
              ) : (
                <View style={styles.emptyState}>
                  <Icon name="trophy-outline" size={32} color="#333" />
                  <Text style={styles.noCompetitions}>Aucune compétition disponible</Text>
                </View>
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
    padding: 16 * scale,
  },
  section: {
    marginBottom: 20 * scale,
    width: '100%',
  },
  hrContainer: {
    marginVertical: 16,
    alignItems: 'center',
  },
  hr: {
    height: 1,
    width: '100%',
  },
  title: {
    textAlign: 'center',
    fontSize: 17 * scale,
    fontWeight: '600',
    color: '#fff',
    paddingVertical: 12 * scale,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#010E1E',
    paddingHorizontal: 12 * scale,
    borderRadius: 12,
    marginBottom: 16 * scale,
    borderWidth: 1,
    borderColor: '#1A2D45',
    height: 48 * scale,
  },
  input: {
    flex: 1,
    paddingVertical: 10 * scale,
    paddingHorizontal: 8 * scale,
    fontSize: 15 * scale,
    color: '#ffffff',
  },
  searchIcon: {
    marginRight: 4 * scale,
  },
  clearButton: {
    padding: 4,
    marginRight: 4,
  },
  searchDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#1A2D45',
    marginHorizontal: 8,
  },
  locationButton: {
    paddingVertical: 8 * scale,
    paddingHorizontal: 6 * scale,
  },
  suggestions: {
    fontSize: 12 * scale,
    marginBottom: 8,
    color: '#607D8B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
    paddingLeft: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  loadingText: {
    color: '#607D8B',
    marginLeft: 10,
    fontSize: 14 * scale,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    color: '#607D8B',
    fontSize: 15 * scale,
    marginTop: 10,
    fontWeight: '500',
  },
  emptyStateSubtext: {
    color: '#455A64',
    fontSize: 13 * scale,
    marginTop: 4,
  },
  clubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12 * scale,
    marginBottom: 6 * scale,
    backgroundColor: '#010E1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A2D45',
  },
  clubItemSelected: {
    borderColor: '#334155',
    backgroundColor: '#111D2E',
  },
  clubLogoContainer: {
    marginRight: 12 * scale,
  },
  logo: {
    width: 42 * scale,
    height: 42 * scale,
    borderRadius: 21 * scale,
    borderColor: '#1A2D45',
    borderWidth: 1,
  },
  logoPlaceholder: {
    backgroundColor: '#0D1B2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubName: {
    flex: 1,
    fontSize: 15 * scale,
    fontWeight: '500',
    color: '#C5D0DC',
  },
  selectedClub: {
    fontWeight: '700',
    color: '#fff',
  },
  checkIcon: {
    marginLeft: 8,
  },
  competitionList: {
    width: '100%',
  },
  competitionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14 * scale,
    marginBottom: 6 * scale,
    backgroundColor: '#010E1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A2D45',
  },
  competitionItemSelected: {
    borderColor: '#334155',
    backgroundColor: '#111D2E',
  },
  radioOuter: {
    width: 20 * scale,
    height: 20 * scale,
    borderRadius: 10 * scale,
    borderWidth: 2,
    borderColor: '#455A64',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12 * scale,
  },
  radioOuterSelected: {
    borderColor: '#fff',
  },
  radioInner: {
    width: 10 * scale,
    height: 10 * scale,
    borderRadius: 5 * scale,
    backgroundColor: '#fff',
  },
  competitionName: {
    flex: 1,
    fontSize: 15 * scale,
    color: '#C5D0DC',
  },
  selectedCompetition: {
    flex: 1,
    fontWeight: '700',
    fontSize: 15 * scale,
    color: '#fff',
  },
  noCompetitions: {
    color: '#607D8B',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14 * scale,
  },
});

export default SearchClub;
