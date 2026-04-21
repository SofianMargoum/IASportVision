import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  TextInput,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useEffectifContext } from './../../tools/EffectifContext';

const scale = 0.85;

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
      onBack();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [onBack]);

  const handleDeletePlayer = (index) => {
    Alert.alert('Confirmation', 'Voulez-vous vraiment supprimer ce joueur ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removePlayer(index) },
    ]);
  };

  const renderPlayer = ({ item, index }) => (
    <View style={styles.listItem}>
      <View style={styles.numeroContainer}>
        <Text style={styles.numeroText}>{item.numero || '-'}</Text>
      </View>
      <Image
        source={require('./../../assets/player.png')}
        style={styles.icon}
      />
      <Text style={styles.listText} numberOfLines={1}>{item.joueur}</Text>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeletePlayer(index)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Icon name="trash-outline" size={18} color="#607D8B" />
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header avec retour */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-back" size={22} color="#C5D0DC" />
        </TouchableOpacity>
        <Text style={styles.title}>Effectif</Text>
        <View style={styles.headerRight}>
          <Text style={styles.countBadge}>{effectif.length}</Text>
        </View>
      </View>

      {/* Formulaire d'ajout */}
      <View style={styles.addPlayerContainer}>
        <TextInput
          style={[styles.input, styles.inputName]}
          placeholder="Nom du joueur"
          placeholderTextColor="#455A64"
          value={newPlayer}
          onChangeText={setNewPlayer}
        />
        <TextInput
          style={[styles.input, styles.inputNumero]}
          placeholder="N°"
          placeholderTextColor="#455A64"
          keyboardType="numeric"
          value={newNumero}
          onChangeText={setNewNumero}
          maxLength={3}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddPlayer} activeOpacity={0.7}>
          <Icon name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Liste des joueurs */}
      {effectif.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="people-outline" size={40} color="#1A2D45" />
          <Text style={styles.emptyText}>Aucun joueur dans l'effectif</Text>
          <Text style={styles.emptySubtext}>Ajoutez des joueurs avec le formulaire ci-dessus</Text>
        </View>
      ) : (
        <FlatList
          data={effectif}
          keyExtractor={(_, index) => index.toString()}
          renderItem={renderPlayer}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16 * scale,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  backButton: {
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: 18 * scale,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  headerRight: {
    width: 30,
    alignItems: 'center',
  },
  countBadge: {
    color: '#607D8B',
    fontSize: 13 * scale,
    fontWeight: '600',
  },
  addPlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  input: {
    backgroundColor: '#010E1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A2D45',
    padding: 12 * scale,
    fontSize: 15 * scale,
    color: '#fff',
  },
  inputName: {
    flex: 1,
  },
  inputNumero: {
    width: 56 * scale,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: '#010E1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A2D45',
    width: 46 * scale,
    height: 46 * scale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingBottom: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#010E1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A2D45',
    padding: 12 * scale,
    marginBottom: 6 * scale,
  },
  numeroContainer: {
    width: 32 * scale,
    height: 32 * scale,
    borderRadius: 16 * scale,
    backgroundColor: '#111D2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  numeroText: {
    color: '#C5D0DC',
    fontSize: 13 * scale,
    fontWeight: '700',
  },
  icon: {
    width: 28 * scale,
    height: 28 * scale,
    marginRight: 10,
  },
  listText: {
    flex: 1,
    fontSize: 15 * scale,
    color: '#C5D0DC',
    fontWeight: '500',
  },
  deleteButton: {
    padding: 6,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#607D8B',
    fontSize: 15 * scale,
    marginTop: 12,
    fontWeight: '500',
  },
  emptySubtext: {
    color: '#455A64',
    fontSize: 13 * scale,
    marginTop: 4,
  },
});

export default Effectif;
