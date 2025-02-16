import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import { fetchDevice, inputDevice } from './api';
import Icon from 'react-native-vector-icons/FontAwesome';

const Appareils = ({ onBack }) => {
  const [device, setDevice] = useState([]);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newMacAddress, setNewMacAddress] = useState('');
  const [newIpAddress, setNewIpAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchDevice();
        setDevice(data);
      } catch (err) {
        setError("Impossible de récupérer la liste des appareils.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDeleteDevice = (indexToDelete) => {
    Alert.alert("Confirmation", "Voulez-vous vraiment supprimer cet appareil ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        onPress: () => {
          setDevice((prevDevice) =>
            prevDevice.filter((_, index) => index !== indexToDelete)
          );
        },
        style: "destructive",
      },
    ]);
  };

  const handleAddDevice = async () => {
    if (newDeviceName.trim() && newMacAddress.trim()) {
      try {
        const response = await inputDevice({ nom: newDeviceName, mac: newMacAddress });
        if (response.message === "Appareil ajouté avec succès.") {
          setDevice((prevDevice) => [...prevDevice, response.device]);
          setNewDeviceName('');
          setNewMacAddress('');
          setNewIpAddress('');
        }
      } catch (err) {
        Alert.alert("Erreur", "Impossible d'ajouter l'appareil.");
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gérer vos Appareils</Text>
      <View style={styles.addDeviceContainer}>
        <TextInput
          style={styles.input}
          placeholder="Nom de l'appareil"
          placeholderTextColor="#aaa"
          value={newDeviceName}
          onChangeText={setNewDeviceName}
        />
        <TextInput
          style={styles.input}
          placeholder="Adresse MAC"
          placeholderTextColor="#aaa"
          value={newMacAddress}
          onChangeText={setNewMacAddress}
        />
        <TextInput
          style={styles.input}
          placeholder="Adresse IP"
          placeholderTextColor="#aaa"
          value={newIpAddress}
          onChangeText={setNewIpAddress}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddDevice}>
          <Text style={styles.addButtonText}>Ajouter</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={device}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item, index }) => (
            <View style={styles.listItem}>
              <View style={styles.itemContent}>
                  <Text style={styles.listText}>Club : {item.nom}</Text>
                <View style={styles.itemListContent}>
                  <Text style={styles.macText}>Mac : {item.mac}</Text>
                  <Text style={styles.macText}>IP : {item.ip}</Text>
                </View>
                  <TouchableOpacity onPress={() => handleDeleteDevice(index)}>
                    <Icon name="trash" size={20} color="#E74C3C" />
                  </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={{ width: '100%' }}
        />
      )}
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Retour</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#121212',
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
  },
  addDeviceContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#2A2A2A',
    color: '#ffffff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  addButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  listItem: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  itemContent: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemListContent: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'left',
  },
  listText: {
    fontSize: 18,
    color: '#ffffff',
  },
  macText: {
    fontSize: 14,
    color: '#bbbbbb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#ffffff',
  },
  errorText: {
    color: '#E74C3C',
    textAlign: 'center',
  },
  backButton: {
    marginTop: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 18,
    color: '#ffffff',
  },
});

export default Appareils;
