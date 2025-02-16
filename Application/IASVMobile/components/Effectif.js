import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { fetchEffectif, inputEffectif } from './api';
import Icon from 'react-native-vector-icons/FontAwesome';

const Effectif = ({ onBack }) => {
  const [effectif, setEffectif] = useState([]);
  const [newPlayer, setNewPlayer] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchEffectif('F.C. VIDAUBAN');
        setEffectif(data);
      } catch (err) {
        setError('Impossible de récupérer les données de l\'effectif.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);
  const handleDeletePlayer = (indexToDelete) => {
    Alert.alert(
      "Confirmation",
      "Voulez-vous vraiment supprimer ce joueur ?",
      [
        {
          text: "Annuler",
          style: "cancel",
        },
        {
          text: "Supprimer",
          onPress: () => {
            setEffectif((prevEffectif) =>
              prevEffectif.filter((_, index) => index !== indexToDelete)
            );
          },
          style: "destructive",
        },
      ]
    );
  };
  
  const handleAddPlayer = async () => {
    if (newPlayer.trim()) {
      try {
        const response = await inputEffectif({
          joueur: newPlayer,
          equipe: 'D2',
          nom: 'F.C. VIDAUBAN',
        });

        if (response.message === 'Joueur ajouté avec succès.') {
          setEffectif((prevEffectif) => [...prevEffectif, response.joueur]);
          setNewPlayer('');
        }
      } catch (err) {
        Alert.alert('Erreur', 'Impossible d\'ajouter le joueur.');
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Effectif</Text>

      <View style={styles.addPlayerContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ajouter un joueur"
          placeholderTextColor="#000"
          value={newPlayer}
          onChangeText={setNewPlayer}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddPlayer}>
          <Text style={styles.addButtonText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Chargement des données...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
      <FlatList
        data={effectif}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => (
          <View style={styles.listItem}>
            <View style={styles.itemContent}>
          <Image
            source={require('./../assets/player.png')}
            style={styles.icon}
          />
              {/* Texte du joueur */}
              <Text style={styles.listText}>{item.joueur}</Text>

              {/* Bouton de suppression avec icône Font Awesome */}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeletePlayer(index)}
              >
                <Icon name="trash" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        contentContainerStyle={styles.list}
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
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  addPlayerContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#ccc',
    marginRight: 10,
  },
  addButton: {
    backgroundColor: '#010E1E',
    padding: 10,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#ffffff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#ffffff',
  },
  list: {
    width: '100%',
  },
  listItem: {
    width: '100%',
    backgroundColor: '#010E1E',
    borderRadius: 8,
    padding: 10,
    marginVertical: 5,
    flexDirection: 'row', // Aligne texte et bouton horizontalement
    alignItems: 'center',
    justifyContent: 'space-between', // Sépare le texte et le bouton
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row', // Aligne texte et bouton horizontalement
    alignItems: 'center',
    justifyContent: 'space-between', // Texte à gauche, bouton à droite
  },
  deleteButton: {
    borderRadius: 5,
    padding: 5,
    marginLeft: 10, // Espacement entre le texte et le bouton
  },
  deleteButtonText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  listText: {
    fontSize: 18,
    color: '#ffffff',
    flex: 1, // Assure que le texte prend l'espace disponible
  },
  icon: {
    width: 30,
    height: 30,
    marginRight: 10,
  },
  listText: {
    fontSize: 18,
    color: '#ffffff',
  },
  backButton: {
    marginTop: 20,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#555',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 18,
    color: '#010E1E',
  },
});

export default Effectif;
