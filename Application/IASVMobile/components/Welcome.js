import React, { useState } from 'react';
import { View, Text, StyleSheet, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SearchClub from './Explore/SearchClub';

const Welcome = () => {
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
      console.log('Permission fine location:', granted);
      if (granted === PermissionsAndroid.RESULTS.GRANTED) return true;
      const coarseGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      );
      console.log('Permission coarse location:', coarseGranted);
      return coarseGranted === PermissionsAndroid.RESULTS.GRANTED;
    }

    const status = await Geolocation.requestAuthorization?.('whenInUse');
    console.log('Permission iOS status:', status);
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
    console.log('Nominatim status:', response.status, 'content-type:', contentType);
    if (!contentType.includes('application/json')) {
      throw new Error('Réponse non JSON');
    }

    const data = JSON.parse(responseText);
    console.log('Nominatim raw address:', data?.address);
    const address = data?.address || {};
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county ||
      '';

    console.log('City candidates:', {
      city: address.city,
      town: address.town,
      village: address.village,
      municipality: address.municipality,
      county: address.county,
      chosen: city,
    });

    return city;
  };

  const getPosition = (options) =>
    new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(resolve, reject, options);
    });

  const resolveCityFromLocation = async () => {
    const allowed = await requestLocationPermission();
    if (!allowed) {
      console.warn('Permission de localisation refusée');
      return '';
    }

    try {
      const position = await getPosition({ enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 });
      const { latitude, longitude } = position.coords;
      console.log('Geoloc coords:', { latitude, longitude });
      return await fetchCityFromCoords(latitude, longitude);
    } catch (error) {
      console.warn('Erreur de géolocalisation (précision élevée):', error);
      try {
        const position = await getPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
        const { latitude, longitude } = position.coords;
        console.log('Geoloc coords (faible précision):', { latitude, longitude });
        return await fetchCityFromCoords(latitude, longitude);
      } catch (fallbackError) {
        console.warn('Erreur de géolocalisation (fallback):', fallbackError);
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
    <View style={styles.container}>
      <View style={styles.backgroundGlow} />
      <View style={styles.header}>
        <Text style={styles.kicker}>IA Sport Vision</Text>
        <Text style={styles.welcomeText}>Bienvenue !</Text>
        <View style={styles.titleUnderline} />
        <Text style={styles.instructionText}>
          Sélectionnez votre club pour commencer.
        </Text>
      </View>
      <View style={styles.searchContainer}>
        <SearchClub
          locationCity={locationCity}
          locationRequestId={locationRequestId}
          onLocatePress={handleLocatePress}
          isLocating={isLocating}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010914',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backgroundGlow: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(0, 153, 255, 0.18)',
  },
  header: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 2,
    color: '#7FB6FF',
    marginBottom: 6,
    fontWeight: '600',
  },
  welcomeText: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
  },
  titleUnderline: {
    width: 64,
    height: 4,
    backgroundColor: '#2F8CFF',
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 14,
  },
  instructionText: {
    fontSize: 15,
    color: '#C8D4E3',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  searchContainer: {
    width: '100%',
    backgroundColor: '#0A1424',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
});

export default Welcome;