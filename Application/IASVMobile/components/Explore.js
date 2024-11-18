import React from 'react';
import { View, StyleSheet } from 'react-native';
import SearchClub from './Explore/SearchClub';

const Explore = ({ selectedClub, selectedCompetition, onSelectClub, onCompetitionSelected }) => {
  return (
    <View style={styles.scrollableDiv}>
      <SearchClub 
        selectedClub={selectedClub} 
        selectedCompetition={selectedCompetition} 
        onSelectClub={onSelectClub}
        onCompetitionSelected={onCompetitionSelected} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  scrollableDiv: {
    flex: 1, // Remplit l'espace disponible
    backgroundColor: '#010914',
  },
});

export default Explore;
