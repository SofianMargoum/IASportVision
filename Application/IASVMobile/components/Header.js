import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useClubContext } from './../tools/ClubContext';
import { useContext } from 'react';
import { UserContext } from './../tools/UserContext';

const scale = 0.85;

const Header = ({ windowWidth }) => {
  const { selectedClub, competition } = useClubContext();
  const { user } = useContext(UserContext);

  return (
    <View style={styles.header}>
      {selectedClub && (
        <View style={styles.selectedClubLabel}>
          {selectedClub.logo ? (
            <Image source={{ uri: selectedClub.logo }} style={styles.clubLogo} />
          ) : null}
          <View style={styles.selectedClubText}>
            <Text style={styles.clubName}>{selectedClub.name}</Text>
            {competition && <Text style={styles.competitionLabel}>{competition}</Text>}
          </View>
        </View>
      )}
      {user && user.photo && (
        <View style={styles.logoMain}>
          <Image source={{ uri: user.photo }} style={styles.adminLogo} />
          <Text style={styles.adminLabels}>admin</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 5,
    backgroundColor: '#010914',
    paddingVertical: 15 * scale,
  },
  logoMain: {
    position: 'absolute',
    right: 10,
    height: '100%',
    alignItems: 'center',
  },
  selectedClubLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubLogo: {
    width: 50 * scale,
    height: 50 * scale,
    borderRadius: 25 * scale,
    marginRight: 15 * scale,
  },
  adminLogo: {
    width: 25 * scale,
    height: 25 * scale,
    borderRadius: 25 * scale,
    marginRight: 8 * scale,
  },
  selectedClubText: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  clubName: {
    fontSize: 18 * scale,
    fontWeight: 'bold',
    color: '#fff',
  },
  competitionLabel: {
    fontSize: 14 * scale,
    fontStyle: 'italic',
    color: '#ffffff',
  },
  adminLabels: {
    fontSize: 10 * scale,
    fontStyle: 'italic',
    color: '#ffffff',
  },
});

export default Header;
