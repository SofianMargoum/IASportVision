import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  TextInput,
  Alert, BackHandler,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useEffectifContext } from './../../tools/EffectifContext';

const Effectif = ({ onBack }) => {
  const { effectif, addPlayer, removePlayer } = useEffectifContext();
  const [newPlayer, setNewPlayer] = useState('');
  const [newNumero, setNewNumero] = useState('');

  const handleAddPlayer = () => {
    if (!newPlayer.trim() || !newNumero.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un nom et un numéro.');
      return;
    }

    addPlayer(newPlayer.trim(), Number(newNumero));
    setNewPlayer('');
    setNewNumero('');
  };

  useEffect(() => {
    const backAction = () => {
      onBack(); // même effet que ton bouton "← Retour"
      return true; // empêche la fermeture automatique de l'app
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove(); // nettoyage
  }, [onBack]);
  const handleDeletePlayer = (index) => {
    Alert.alert('Confirmation', 'Voulez-vous vraiment supprimer ce joueur ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removePlayer(index) },
    ]);
  };
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Effectif</Text>

      {/* Formulaire d’ajout */}
      <View style={styles.addPlayerContainer}>
        <TextInput
          style={[styles.input, { flex: 0.6 }]}
          placeholder="Nom du joueur"
          placeholderTextColor="#ccc"
          value={newPlayer}
          onChangeText={setNewPlayer}
        />
        <TextInput
          style={[styles.input, { flex: 0.3 }]}
          placeholder="N°"
          placeholderTextColor="#ccc"
          keyboardType="numeric"
          value={newNumero}
          onChangeText={setNewNumero}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddPlayer}>
          <Text style={styles.addButtonText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* Liste des joueurs */}
      <FlatList
        data={effectif}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item, index }) => (
          <View style={styles.listItem}>
            <View style={styles.itemContent}>
              <Image
                source={require('./../../assets/player.png')}
                style={styles.icon}
              />
              <Text style={styles.listText}>
                {item.numero ? `${item.numero} - ${item.joueur}` : item.joueur}
              </Text>
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

      {/* Bouton retour */}
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
    width: '100%', // ✅ pleine largeur
    alignItems: 'center',
  },
  input: {
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#001A31',
    marginRight: 10,
    color: '#fff',
    width: '100%',
  },
  addButton: {
    backgroundColor: '#010E1E',
    padding: 10,
    borderRadius: 8,
    borderColor:"#ccc",
    margin:5,
  borderWidth: 1,
  },
  addButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
    borderColor:"#ccc",
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
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deleteButton: {
    borderRadius: 5,
    padding: 5,
    marginLeft: 10,
  },
  listText: {
    fontSize: 18,
    color: '#ffffff',
    flex: 1,
    marginLeft: 10,
  },
  icon: {
    width: 30,
    height: 30,
  },
backButton: {
  width: '80%', // un peu moins large pour être plus élégant
  alignSelf: 'center', // ✅ centre horizontalement
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 10,
},
backButtonText: {
  padding: 15,
  borderWidth: 1,
  borderColor: '#001A31',
  borderRadius: 10,
  shadowColor: '#00A0E9',
  shadowOpacity: 1,
  elevation: 3,
  backgroundColor: '#010914',
  color: '#fff',
  fontSize: 16,
  fontWeight: 'bold',
  textAlign: 'center',
  width: '100%',
},

});

export default Effectif;
