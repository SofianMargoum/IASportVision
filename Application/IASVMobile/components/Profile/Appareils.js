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
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useDeviceContext } from './../../tools/DeviceContext';
import { fetchAllCameras } from './../../tools/api';

const scale = 0.85;

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
  const [showAddForm, setShowAddForm] = useState(false);

  // Import Hik-Connect
  const [isImporting, setIsImporting] = useState(false);

  const flatListRef = useRef(null);
  const [shouldScrollToEnd, setShouldScrollToEnd] = useState(false);

  // Édition
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDeviceId, setEditDeviceId] = useState('');
  const [editCameraId, setEditCameraId] = useState('');

  // Back Android
  useEffect(() => {
    const backAction = () => { onBack(); return true; };
    const sub = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => sub.remove();
  }, [onBack]);

  // Auto-scroll
  useEffect(() => {
    if (shouldScrollToEnd) {
      flatListRef.current?.scrollToEnd({ animated: true });
      setShouldScrollToEnd(false);
    }
  }, [devices, shouldScrollToEnd]);

  // Auto-sélection
  useEffect(() => {
    if (!devices || devices.length === 0) return;
    const invalid =
      selectedIndex === null ||
      selectedIndex === undefined ||
      selectedIndex < 0 ||
      selectedIndex >= devices.length;
    if (invalid) setSelectedIndex(0);
  }, [devices, selectedIndex, setSelectedIndex]);

  // ─── Hik-Connect helpers ───

  const extractCamerasFromResponse = (res) => {
    const payload = res?.data ?? res;
    const cameras =
      payload?.data?.camera ??
      payload?.data?.cameras ??
      payload?.camera ??
      payload?.cameras ??
      [];
    return Array.isArray(cameras) ? cameras : [];
  };

  const mapCameraToDevice = (cam) => ({
    nom: cam?.name ?? 'Caméra',
    deviceId: cam?.device?.devInfo?.id,
    cameraId: cam?.id,
  });

  const importFirstCameraIfNeeded = async () => {
    if (isImporting) return;
    if (devices && devices.length > 0) return;
    try {
      setIsImporting(true);
      const res = await fetchAllCameras();
      const cams = extractCamerasFromResponse(res);
      if (!cams.length) return;
      const dev = mapCameraToDevice(cams[0]);
      if (!dev.deviceId || !dev.cameraId) return;
      addDevice(dev);
      setSelectedIndex(0);
      setShouldScrollToEnd(true);
    } catch (e) {
      // silencieux
    } finally {
      setIsImporting(false);
    }
  };

  useEffect(() => {
    importFirstCameraIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Actions ───

  const handleAddDevice = () => {
    if (!newDeviceName.trim() || !newDeviceId.trim() || !newCameraId.trim()) {
      Alert.alert('Champs requis', 'Nom, Device ID et Camera ID sont obligatoires.');
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
    setShowAddForm(false);
    setShouldScrollToEnd(true);
  };

  const confirmDelete = (index) => {
    Alert.alert('Supprimer', 'Voulez-vous vraiment supprimer cet appareil ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteDevice(index) },
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
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    if (!editName.trim() || !editDeviceId.trim() || !editCameraId.trim()) {
      Alert.alert('Champs requis', 'Nom, Device ID et Camera ID sont obligatoires.');
      return;
    }
    updateDevice(editingIndex, {
      nom: editName.trim(),
      deviceId: editDeviceId.trim(),
      cameraId: editCameraId.trim(),
    });
    setIsEditOpen(false);
  };

  // ─── Render ───

  const renderDeviceItem = ({ item, index }) => {
    const isSelected = selectedIndex === index;
    return (
      <TouchableOpacity
        style={[styles.deviceCard, isSelected && styles.deviceCardSelected]}
        onPress={() => setSelectedIndex(index)}
        activeOpacity={0.7}
      >
        <View style={styles.deviceRow}>
          <Icon
            name={isSelected ? 'radio-button-on' : 'radio-button-off'}
            size={20}
            color={isSelected ? '#fff' : '#455A64'}
          />
          <View style={styles.deviceInfo}>
            <Text style={[styles.deviceName, isSelected && styles.deviceNameSelected]} numberOfLines={1}>
              {item?.nom}
            </Text>
            <View style={styles.idRow}>
              <Icon name="hardware-chip-outline" size={12 * scale} color="#607D8B" />
              <Text style={styles.idText} numberOfLines={1}>Device: {item?.deviceId}</Text>
            </View>
            <View style={styles.idRow}>
              <Icon name="videocam-outline" size={12 * scale} color="#607D8B" />
              <Text style={styles.idText} numberOfLines={1}>Camera: {item?.cameraId}</Text>
            </View>
          </View>
          <View style={styles.deviceActions}>
            <TouchableOpacity
              onPress={() => openEdit(index)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.actionBtn}
            >
              <Icon name="create-outline" size={18} color="#607D8B" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => confirmDelete(index)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.actionBtn}
            >
              <Icon name="trash-outline" size={18} color="#D0021B" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-back" size={22} color="#C5D0DC" />
        </TouchableOpacity>
        <Text style={styles.title}>Appareils</Text>
        {devices && devices.length > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{devices.length}</Text>
          </View>
        ) : (
          <View style={{ width: 30 }} />
        )}
      </View>

      {/* Import indicator */}
      {isImporting && (
        <View style={styles.importBar}>
          <ActivityIndicator size="small" color="#C5D0DC" />
          <Text style={styles.importText}>Import Hik-Connect…</Text>
        </View>
      )}

      {/* Device list */}
      <FlatList
        ref={flatListRef}
        data={devices}
        keyExtractor={(item, idx) => item.id ?? String(idx)}
        renderItem={renderDeviceItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isImporting ? (
            <View style={styles.emptyState}>
              <Icon name="videocam-off-outline" size={42} color="#1A2D45" />
              <Text style={styles.emptyTitle}>Aucun appareil</Text>
              <Text style={styles.emptyText}>Ajoutez une caméra pour commencer</Text>
            </View>
          ) : null
        }
      />

      {/* Add form (collapsible) */}
      {showAddForm ? (
        <View style={styles.addCard}>
          <View style={styles.addHeader}>
            <Text style={styles.addTitle}>Nouvel appareil</Text>
            <TouchableOpacity onPress={() => setShowAddForm(false)}>
              <Icon name="close" size={20} color="#607D8B" />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Nom de l'appareil"
            placeholderTextColor="#455A64"
            value={newDeviceName}
            onChangeText={setNewDeviceName}
          />
          <TextInput
            style={styles.input}
            placeholder="Device ID"
            placeholderTextColor="#455A64"
            value={newDeviceId}
            onChangeText={setNewDeviceId}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Camera ID"
            placeholderTextColor="#455A64"
            value={newCameraId}
            onChangeText={setNewCameraId}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.confirmBtn} onPress={handleAddDevice} activeOpacity={0.7}>
            <Icon name="checkmark" size={18} color="#fff" />
            <Text style={styles.confirmBtnText}>Ajouter</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.addFloating}
          onPress={() => setShowAddForm(true)}
          activeOpacity={0.7}
        >
          <Icon name="add" size={22} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal d'édition */}
      <Modal visible={isEditOpen} transparent animationType="fade" onRequestClose={cancelEdit}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Icon name="create-outline" size={20} color="#C5D0DC" />
              <Text style={styles.modalTitle}>Modifier l'appareil</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Nom de l'appareil"
              placeholderTextColor="#455A64"
              value={editName}
              onChangeText={setEditName}
            />
            <TextInput
              style={styles.input}
              placeholder="Device ID"
              placeholderTextColor="#455A64"
              value={editDeviceId}
              onChangeText={setEditDeviceId}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Camera ID"
              placeholderTextColor="#455A64"
              value={editCameraId}
              onChangeText={setEditCameraId}
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={cancelEdit}>
                <Text style={styles.modalBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={saveEdit}>
                <Icon name="checkmark" size={16} color="#fff" />
                <Text style={styles.modalBtnText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

// ═══════════════════════════════════════
// ─── Styles ───
// ═══════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16 * scale,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  backBtn: {
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: 18 * scale,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  countBadge: {
    backgroundColor: '#111D2E',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countText: {
    color: '#C5D0DC',
    fontSize: 13 * scale,
    fontWeight: '700',
  },

  // ── Import bar ──
  importBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#010E1E',
    borderRadius: 8,
    padding: 10 * scale,
    marginBottom: 10,
    gap: 8,
  },
  importText: {
    color: '#607D8B',
    fontSize: 13 * scale,
  },

  // ── List ──
  listContent: {
    paddingBottom: 8,
    flexGrow: 1,
  },

  // ── Device card ──
  deviceCard: {
    backgroundColor: '#010E1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A2D45',
    padding: 12 * scale,
    marginBottom: 8 * scale,
  },
  deviceCardSelected: {
    borderColor: '#455A64',
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  deviceName: {
    color: '#C5D0DC',
    fontSize: 15 * scale,
    fontWeight: '600',
    marginBottom: 4,
  },
  deviceNameSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  idText: {
    color: '#607D8B',
    fontSize: 11 * scale,
  },
  deviceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 8,
  },
  actionBtn: {
    padding: 4,
  },

  // ── Empty ──
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: '#C5D0DC',
    fontSize: 16 * scale,
    fontWeight: '700',
    marginTop: 12,
  },
  emptyText: {
    color: '#607D8B',
    fontSize: 13 * scale,
    marginTop: 4,
  },

  // ── Add card ──
  addCard: {
    backgroundColor: '#010E1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A2D45',
    padding: 14 * scale,
    marginTop: 4,
  },
  addHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addTitle: {
    color: '#C5D0DC',
    fontSize: 15 * scale,
    fontWeight: '700',
  },

  // ── Input ──
  input: {
    backgroundColor: '#111D2E',
    color: '#fff',
    borderRadius: 8,
    padding: 10 * scale,
    fontSize: 14 * scale,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1A2D45',
  },

  // ── Confirm btn ──
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111D2E',
    borderRadius: 8,
    paddingVertical: 12 * scale,
    marginTop: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: '#1A2D45',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 14 * scale,
    fontWeight: '700',
  },

  // ── Floating add btn ──
  addFloating: {
    alignSelf: 'center',
    width: 48 * scale,
    height: 48 * scale,
    borderRadius: 24 * scale,
    backgroundColor: '#111D2E',
    borderWidth: 1,
    borderColor: '#1A2D45',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
  },

  // ── Modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(1,9,20,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#010E1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A2D45',
    padding: 16 * scale,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16 * scale,
    color: '#fff',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  modalBtnCancel: {
    paddingVertical: 10 * scale,
    paddingHorizontal: 16 * scale,
    borderRadius: 8,
    backgroundColor: '#111D2E',
    borderWidth: 1,
    borderColor: '#1A2D45',
  },
  modalBtnSave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10 * scale,
    paddingHorizontal: 16 * scale,
    borderRadius: 8,
    backgroundColor: '#1A2D45',
  },
  modalBtnText: {
    color: '#fff',
    fontSize: 14 * scale,
    fontWeight: '600',
  },
});

export default Appareils;
