import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Alert,
  Modal,
  BackHandler,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useDeviceContext } from './../../tools/DeviceContext';

// ✅ adapte ce chemin si ton api.js est ailleurs
import { fetchAllCameras } from './../../tools/api';

const Appareils = ({ onBack }) => {
  const {
    devices,
    addDevice,
    deleteDevice,
    updateDevice,
    selectedIndex,
    setSelectedIndex,
  } = useDeviceContext();

  // Ajout manuel
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newCameraId, setNewCameraId] = useState('');

  // Import auto Hik-Connect
  const [isImporting, setIsImporting] = useState(false);

  const flatListRef = useRef(null);
  const [shouldScrollToEnd, setShouldScrollToEnd] = useState(false);

  // Édition
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDeviceId, setEditDeviceId] = useState('');
  const [editCameraId, setEditCameraId] = useState('');

  // ✅ Bouton back Android
  useEffect(() => {
    const backAction = () => {
      onBack();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [onBack]);

  // ✅ Auto-scroll
  useEffect(() => {
    if (shouldScrollToEnd) {
      flatListRef.current?.scrollToEnd({ animated: true });
      setShouldScrollToEnd(false);
    }
  }, [devices, shouldScrollToEnd]);

  // ✅ Auto-sélection si liste non vide et selectedIndex invalide
  useEffect(() => {
    if (!devices || devices.length === 0) return;

    const invalid =
      selectedIndex === null ||
      selectedIndex === undefined ||
      selectedIndex < 0 ||
      selectedIndex >= devices.length;

    if (invalid) setSelectedIndex(0);
  }, [devices, selectedIndex, setSelectedIndex]);

  // --- Hik-Connect import helpers ---
  const extractCamerasFromResponse = (res) => {
    // axios: res.data = payload
    const payload = res?.data ?? res;

    // Ton exemple: { data: { camera: [...] }, errorCode: "0" }
    const cameras =
      payload?.data?.camera ??
      payload?.data?.cameras ??
      payload?.camera ??
      payload?.cameras ??
      [];

    return Array.isArray(cameras) ? cameras : [];
  };

  const mapCameraToDevice = (cam) => {
    const cameraId = cam?.id;
    const deviceId = cam?.device?.devInfo?.id;
    const name = cam?.name ?? 'Caméra';
    return { nom: name, deviceId, cameraId };
  };

  const importFirstCameraIfNeeded = async () => {
    // 🔒 évite import multiple
    if (isImporting) return;

    // Si on a déjà des devices, on ne force pas d'import
    if (devices && devices.length > 0) return;

    try {
      setIsImporting(true);

      const res = await fetchAllCameras();
      const cams = extractCamerasFromResponse(res);

      if (!cams.length) return;

      const dev = mapCameraToDevice(cams[0]);
      if (!dev.deviceId || !dev.cameraId) return;

      addDevice(dev);

      // sélection du nouvel élément (premier)
      setSelectedIndex(0);
      setShouldScrollToEnd(true);
    } catch (e) {
      // silencieux: tu as demandé automatique (pas de bouton),
      // mais si tu préfères un alert, dis-moi.
    } finally {
      setIsImporting(false);
    }
  };

  // ✅ Import automatique au montage (et si la liste est vide)
  useEffect(() => {
    importFirstCameraIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // volontaire: 1 fois au montage

  const handleAddDevice = () => {
    if (!newDeviceName.trim() || !newDeviceId.trim() || !newCameraId.trim()) {
      Alert.alert('Champs requis', 'Nom, deviceId et cameraId sont obligatoires.');
      return;
    }

    const nextIndex = devices?.length ?? 0;

    addDevice({
      nom: newDeviceName.trim(),
      deviceId: newDeviceId.trim(),
      cameraId: newCameraId.trim(),
    });

    setSelectedIndex(nextIndex);
    setNewDeviceName('');
    setNewDeviceId('');
    setNewCameraId('');
    setShouldScrollToEnd(true);
  };

  const confirmDelete = (index) => {
    Alert.alert('Confirmation', 'Voulez-vous vraiment supprimer cet appareil ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          deleteDevice(index);
        },
      },
    ]);
  };

  const openEdit = (index) => {
    const item = devices[index];
    setEditingIndex(index);
    setEditName(item?.nom ?? '');
    setEditDeviceId(item?.deviceId ?? '');
    setEditCameraId(item?.cameraId ?? '');
    setIsEditOpen(true);
  };

  const cancelEdit = () => {
    setIsEditOpen(false);
    setEditingIndex(null);
    setEditName('');
    setEditDeviceId('');
    setEditCameraId('');
  };

  const saveEdit = () => {
    if (editingIndex === null || editingIndex === undefined) return;

    if (!editName.trim() || !editDeviceId.trim() || !editCameraId.trim()) {
      Alert.alert('Champs requis', 'Nom, deviceId et cameraId sont obligatoires.');
      return;
    }

    updateDevice(editingIndex, {
      nom: editName.trim(),
      deviceId: editDeviceId.trim(),
      cameraId: editCameraId.trim(),
    });

    setIsEditOpen(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gérer vos Appareils</Text>

      {/* Ajout manuel */}
      <View style={styles.addDeviceContainer}>
        <Text style={styles.sectionTitle}>Ajout manuel</Text>

        <TextInput
          style={styles.input}
          placeholder="Nom de l'appareil"
          placeholderTextColor="#aaa"
          value={newDeviceName}
          onChangeText={setNewDeviceName}
        />
        <TextInput
          style={styles.input}
          placeholder="deviceId"
          placeholderTextColor="#aaa"
          value={newDeviceId}
          onChangeText={setNewDeviceId}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="cameraId"
          placeholderTextColor="#aaa"
          value={newCameraId}
          onChangeText={setNewCameraId}
          autoCapitalize="none"
        />

        <TouchableOpacity style={styles.addButton} onPress={handleAddDevice}>
          <Text style={styles.addButtonText}>Ajouter</Text>
        </TouchableOpacity>

        {isImporting ? (
          <Text style={styles.importHint}>Import Hik-Connect automatique…</Text>
        ) : null}
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
              <TouchableOpacity style={styles.radioButton} onPress={() => setSelectedIndex(index)}>
                <Icon
                  name={isSelected ? 'dot-circle-o' : 'circle-o'}
                  size={22}
                  color={isSelected ? '#007AFF' : '#bbb'}
                />
              </TouchableOpacity>

              <View style={styles.itemListContent}>
                <Text style={styles.listText}>Nom : {item?.nom}</Text>
                <Text style={styles.macText}>deviceId : {item?.deviceId}</Text>
                <Text style={styles.macText}>cameraId : {item?.cameraId}</Text>
              </View>

              <TouchableOpacity style={{ marginRight: 12 }} onPress={() => openEdit(index)}>
                <Icon name="pencil" size={20} color="#F1C40F" />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => confirmDelete(index)}>
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
      <Modal visible={isEditOpen} transparent animationType="fade" onRequestClose={cancelEdit}>
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
              placeholder="deviceId"
              placeholderTextColor="#aaa"
              value={editDeviceId}
              onChangeText={setEditDeviceId}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="cameraId"
              placeholderTextColor="#aaa"
              value={editCameraId}
              onChangeText={setEditCameraId}
              autoCapitalize="none"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#2A2A2A' }]}
                onPress={cancelEdit}
              >
                <Text style={styles.modalBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#007AFF' }]}
                onPress={saveEdit}
              >
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
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 14 },

  addDeviceContainer: { backgroundColor: '#001A31', borderRadius: 10, padding: 15, marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 10 },

  input: { backgroundColor: '#010914', color: '#fff', borderRadius: 8, padding: 10, marginBottom: 10 },

  importHint: { color: '#bbb', fontSize: 12, marginTop: 8, textAlign: 'center' },

  addButton: {
    width: '80%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
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
    width: '100%',
  },

  listItem: {
    backgroundColor: '#001A31',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: { marginRight: 10 },
  itemListContent: { flex: 1, marginHorizontal: 8 },
  listText: { fontSize: 18, color: '#fff' },
  macText: { fontSize: 14, color: '#bbb' },

  backButton: {
    width: '80%',
    alignSelf: 'center',
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: { width: '100%', backgroundColor: '#1E1E1E', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, color: '#fff', fontWeight: '600', marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  modalBtnText: { color: '#fff', fontWeight: '600' },
});

export default Appareils;
