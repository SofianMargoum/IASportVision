import React, { useContext } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClubContext } from './../tools/ClubContext';
import { UserContext } from './../tools/UserContext';
import { moderateScale, scale as s } from './../tools/responsive';

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
  // Top inset : encoche / barre status (Pixel, Samsung, Xiaomi, Oppo).
  const insets = useSafeAreaInsets();

  const clubLogoSource = resolveImageSource(selectedClub?.logo);
  const userPhotoSource = resolveImageSource(user?.photo);

  return (
    <View style={[styles.header, { paddingTop: insets.top + s(8) }]}>
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
    marginBottom: s(5),
    backgroundColor: '#010914',
    paddingBottom: s(12),
    // paddingHorizontal pour que le bloc "selectedClub" ne passe jamais sous le
    // bloc "admin" positionné à droite, même sur petits écrans (Redmi 360dp).
    paddingHorizontal: s(72),
  },
  logoMain: {
    position: 'absolute',
    right: s(10),
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedClubLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  clubLogo: {
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: moderateScale(25),
    marginRight: s(12),
  },
  adminLogo: {
    width: moderateScale(25),
    height: moderateScale(25),
    borderRadius: moderateScale(25),
    marginRight: s(6),
  },
  selectedClubText: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flexShrink: 1,
  },
  clubName: {
    fontSize: moderateScale(16),
    fontWeight: 'bold',
    color: '#fff',
    flexShrink: 1,
  },
  competitionLabel: {
    fontSize: moderateScale(12),
    fontStyle: 'italic',
    color: '#ffffff',
  },
  adminLabels: {
    fontSize: moderateScale(10),
    fontStyle: 'italic',
    color: '#ffffff',
  },
});

export default Header;
