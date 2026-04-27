import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useClubContext } from './../tools/ClubContext';
import { useContext } from 'react';
import { UserContext } from './../tools/UserContext';

const scale = 0.85;

const resolveImageSource = (value) => {
  if (!value) return null;
  const uri = String(value).trim();
  if (!uri) return null;

  // Remote / file / base64 URIs
  if (/^(https?:|file:|content:|data:|asset:|res:)/i.test(uri)) {
    return { uri };
  }

  // Known local drawable key used in logs
  if (uri === 'assets_fcmiramas') {
    return require('../assets/assets_fcmiramas.jpg');
  }

  return null;
};

const Header = ({ windowWidth }) => {
  const { selectedClub, competition } = useClubContext();
  const { user } = useContext(UserContext);

  const clubLogoSource = resolveImageSource(selectedClub?.logo);
  const userPhotoSource = resolveImageSource(user?.photo);

  return (
    <View style={styles.header}>
      {selectedClub && (
        <View style={styles.selectedClubLabel}>
          {clubLogoSource ? <Image source={clubLogoSource} style={styles.clubLogo} /> : null}
          <View style={styles.selectedClubText}>
            <Text style={styles.clubName}>{selectedClub.name}</Text>
            {competition && <Text style={styles.competitionLabel}>{competition}</Text>}
          </View>
        </View>
      )}
      {userPhotoSource && (
        <View style={styles.logoMain}>
          <Image source={userPhotoSource} style={styles.adminLogo} />
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
