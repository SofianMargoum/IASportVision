import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, Alert, Modal, BackHandler,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useDeviceContext } from './../../tools/DeviceContext';

const Appareils = ({ onBack }) => {
  const {
    devices, addDevice, deleteDevice, updateDevice, // ⬅️ NEW
    selectedIndex, setSelectedIndex
  } = useDeviceContext();

  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newPort, setNewPort] = useState('');
  const flatListRef = useRef(null);
  const [shouldScrollToEnd, setShouldScrollToEnd] = useState(false);

  // État pour l’édition
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDomain, setEditDomain] = useState('');
  const [editPort, setEditPort] = useState('');
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
  useEffect(() => {
    if (shouldScrollToEnd) {
      flatListRef.current?.scrollToEnd({ animated: true });
      setShouldScrollToEnd(false);
    }
  }, [devices, shouldScrollToEnd]);

  const handleAddDevice = () => {
    if (!newDeviceName.trim() || !newDomain.trim() || !newPort.trim()) {
      Alert.alert("Champs requis", "Nom, domaine et port sont obligatoires.");
      return;
    }
    const portNum = parseInt(newPort.trim(), 10);
    if (Number.isNaN(portNum) || portNum <= 0 || portNum > 65535) {
      Alert.alert("Port invalide", "Entre un numéro de port entre 1 et 65535.");
      return;
    }
    addDevice({
      nom: newDeviceName.trim(),
      domaine: newDomain.trim(),
      port: portNum,
    });
    setNewDeviceName('');
    setNewDomain('');
    setNewPort('');
    setShouldScrollToEnd(true);
  };

  const openEdit = (index) => {
    const item = devices[index];
    setEditingIndex(index);
    setEditName(item.nom ?? '');
    setEditDomain(item.domaine ?? '');
    setEditPort(String(item.port ?? ''));
    setIsEditOpen(true);
  };

  const cancelEdit = () => {
    setIsEditOpen(false);
    setEditingIndex(null);
    setEditName('');
    setEditDomain('');
    setEditPort('');
  };

  const saveEdit = () => {
    if (!editName.trim() || !editDomain.trim() || !editPort.trim()) {
      Alert.alert("Champs requis", "Nom, domaine et port sont obligatoires.");
      return;
    }
    const portNum = parseInt(editPort.trim(), 10);
    if (Number.isNaN(portNum) || portNum <= 0 || portNum > 65535) {
      Alert.alert("Port invalide", "Entre un numéro de port entre 1 et 65535.");
      return;
    }
    updateDevice(editingIndex, {
      nom: editName.trim(),
      domaine: editDomain.trim(),
      port: portNum,
    });
    setIsEditOpen(false);
    // on garde l’index sélectionné identique si on éditait l’élément sélectionné
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gérer vos Appareils</Text>

      {/* Formulaire d’ajout */}
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
          placeholder="Nom de domaine"
          placeholderTextColor="#aaa"
          value={newDomain}
          onChangeText={setNewDomain}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Port"
          placeholderTextColor="#aaa"
          keyboardType="numeric"
          value={newPort}
          onChangeText={setNewPort}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddDevice}>
          <Text style={styles.addButtonText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* Liste */}
      <FlatList
        ref={flatListRef}
        data={devices}
        keyExtractor={(item, idx) => item.id ?? String(idx)}
        renderItem={({ item, index }) => {
          const isSelected = selectedIndex === index;
          return (
            <View style={styles.listItem}>
              <TouchableOpacity
                style={styles.radioButton}
                onPress={() => setSelectedIndex(index)}
              >
                <Icon
                  name={isSelected ? 'dot-circle-o' : 'circle-o'}
                  size={22}
                  color={isSelected ? '#007AFF' : '#bbb'}
                />
              </TouchableOpacity>

              <View style={styles.itemListContent}>
                <Text style={styles.listText}>Nom : {item.nom}</Text>
                <Text style={styles.macText}>Domaine : {item.domaine}</Text>
                <Text style={styles.macText}>Port : {item.port}</Text>
              </View>

              {/* Bouton éditer */}
              <TouchableOpacity style={{ marginRight: 12 }} onPress={() => openEdit(index)}>
                <Icon name="pencil" size={20} color="#F1C40F" />
              </TouchableOpacity>

              {/* Bouton supprimer */}
              <TouchableOpacity onPress={() => deleteDevice(index)}>
                <Icon name="trash" size={20} color="#E74C3C" />
              </TouchableOpacity>
            </View>
          );
        }}
      />

      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Retour</Text>
      </TouchableOpacity>

      {/* Modal d’édition */}
      <Modal
        visible={isEditOpen}
        transparent
        animationType="fade"
        onRequestClose={cancelEdit}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Modifier l’appareil</Text>

            <TextInput
              style={styles.input}
              placeholder="Nom de l'appareil"
              placeholderTextColor="#aaa"
              value={editName}
              onChangeText={setEditName}
            />
            <TextInput
              style={styles.input}
              placeholder="Nom de domaine"
              placeholderTextColor="#aaa"
              value={editDomain}
              onChangeText={setEditDomain}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Port"
              placeholderTextColor="#aaa"
              keyboardType="numeric"
              value={editPort}
              onChangeText={setEditPort}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#2A2A2A' }]} onPress={cancelEdit}>
                <Text style={styles.modalBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#007AFF' }]} onPress={saveEdit}>
                <Text style={styles.modalBtnText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, width: '100%' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 20 },
  addDeviceContainer: { backgroundColor: '#001A31', borderRadius: 10, padding: 15, marginBottom: 16 },
  input: { backgroundColor: '#010914', color: '#fff', borderRadius: 8, padding: 10, marginBottom: 10 },
  addButton: { 
  width: '80%', // un peu moins large pour être plus élégant
  alignSelf: 'center', // ✅ centre horizontalement
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 10, },
  addButtonText: { 
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
  width: '100%', },
  listItem: { backgroundColor: '#001A31', borderRadius: 8, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  radioButton: { marginRight: 10 },
  itemListContent: { flex: 1, marginHorizontal: 8 },
  listText: { fontSize: 18, color: '#fff' },
  macText: { fontSize: 14, color: '#bbb' },
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

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', backgroundColor: '#1E1E1E', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, color: '#fff', fontWeight: '600', marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  modalBtnText: { color: '#fff', fontWeight: '600' },
});

export default Appareils;
