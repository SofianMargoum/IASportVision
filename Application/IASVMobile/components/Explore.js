import React, { useState } from 'react';
import { View, StyleSheet, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SearchClub from './Explore/SearchClub';

const Explore = ({ selectedClub, selectedCompetition, onSelectClub, onCompetitionSelected }) => {
  const [locationCity, setLocationCity] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [locationRequestId, setLocationRequestId] = useState(0);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Autoriser la localisation',
          message: 'IASV Mobile a besoin de votre localisation pour suggérer votre ville.',
          buttonPositive: 'OK',
          buttonNegative: 'Annuler',
        }
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) return true;
      const coarseGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      );
      return coarseGranted === PermissionsAndroid.RESULTS.GRANTED;
    }

    const status = await Geolocation.requestAuthorization?.('whenInUse');
    return status === 'granted' || status === true;
  };

  const fetchCityFromCoords = async (latitude, longitude) => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'IASVMobile/1.0 (support@iasportvision.com)'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const responseText = await response.text();
    if (!contentType.includes('application/json')) {
      throw new Error('Réponse non JSON');
    }

    const data = JSON.parse(responseText);
    const address = data?.address || {};
    return (
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county ||
      ''
    );
  };

  const getPosition = (options) =>
    new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(resolve, reject, options);
    });

  const resolveCityFromLocation = async () => {
    const allowed = await requestLocationPermission();
    if (!allowed) {
      return '';
    }

    try {
      const position = await getPosition({ enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 });
      const { latitude, longitude } = position.coords;
      return await fetchCityFromCoords(latitude, longitude);
    } catch (error) {
      try {
        const position = await getPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
        const { latitude, longitude } = position.coords;
        return await fetchCityFromCoords(latitude, longitude);
      } catch (fallbackError) {
        return '';
      }
    }
  };

  const handleLocatePress = async () => {
    if (isLocating) return;
    setIsLocating(true);
    try {
      const cachedCity = await AsyncStorage.getItem('lastKnownCity');
      if (cachedCity) {
        setLocationCity(cachedCity);
      }

      const city = await resolveCityFromLocation();
      if (city) {
        setLocationCity(city);
        await AsyncStorage.setItem('lastKnownCity', city);
      }
    } finally {
      setLocationRequestId((id) => id + 1);
      setIsLocating(false);
    }
  };

  return (
    <View style={styles.scrollableDiv}>
      <SearchClub 
        selectedClub={selectedClub} 
        selectedCompetition={selectedCompetition} 
        onSelectClub={onSelectClub}
        onCompetitionSelected={onCompetitionSelected}
        locationCity={locationCity}
        locationRequestId={locationRequestId}
        onLocatePress={handleLocatePress}
        isLocating={isLocating}
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
