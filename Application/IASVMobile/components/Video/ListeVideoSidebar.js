import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Dimensions,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useClubContext } from '../../tools/ClubContext';
import { fetchVideosByClub, deleteVideoByClub, renameVideoByClub } from '../../tools/api';

const { width, height } = Dimensions.get('window');
const scale = 0.85;
const promoVideoHeight = Math.round(height * 0.82);
const promoVideoWidth = Math.min(width - 32, Math.round(promoVideoHeight * 9 / 16));

const formatDate = (dateString) => {
  try {
    const [datePart] = dateString.split(' ');
    const [day, month, year] = datePart.split('/');
    const isoDateString = `${year}-${month}-${day}`;
    const date = new Date(isoDateString);

    if (!isNaN(date.getTime())) {
      const formattedDay = String(date.getDate()).padStart(2, '0');
      const formattedMonth = String(date.getMonth() + 1).padStart(2, '0');
      const formattedYear = date.getFullYear();
      return `${formattedDay}/${formattedMonth}/${formattedYear}`;
    }
    return 'Date non valide';
  } catch {
    return 'Date non valide';
  }
};

const normalizeForSearch = (value) => {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const matchesCategory = (video, categoryKey) => {
  if (categoryKey === 'tout') return true;

  const name = normalizeForSearch(video?.name);

  switch (categoryKey) {
    case 'amicaux':
      return name.includes('amical') || name.includes('amicaux');
    case 'resume':
      return (
        name.includes('resume') ||
        name.includes('resum') ||
        name.includes('highlight') ||
        name.includes('highlights')
      );
    case 'entrainement':
      return (
        name.includes('entrainement') ||
        name.includes('entrain') ||
        name.includes('training')
      );
    default:
      return false;
  }
};

const VideoItem = ({
  item,
  handleVideoSelect,
  handleVideoDelete,
  handleVideoEdit,
  isGridView,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <TouchableOpacity
      style={[
        styles.videoItem,
        isGridView && styles.gridItem,
        { opacity: isPressed ? 1 : 0.99 },
      ]}
      onPress={() => {
        if (menuOpen) {
          setMenuOpen(false);
          return;
        }
        handleVideoSelect(item);
      }}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
    >
      <Image
        source={{ uri: item.coverUrl }}
        style={[styles.videoImage, { opacity: isPressed ? 1 : 0.8 }]}
        defaultSource={require('../../assets/cover.png')}
      />
      <View style={styles.videoDetails}>
        <View style={styles.videoTextContainer}>
          <Text style={styles.videoName}>{item.name || 'Nom non disponible'}</Text>
          <Text style={styles.creationDate}>
            {item.creationDate ? formatDate(item.creationDate) : 'Date non disponible'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.menuButtonAbs}
          onPress={() => setMenuOpen((prev) => !prev)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="ellipsis-v" size={18} color="#ffffff" />
        </TouchableOpacity>

        {menuOpen && (
          <View style={styles.menuPopoverAbs}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                handleVideoDelete?.(item);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="trash" size={18} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemSecond]}
              onPress={() => {
                setMenuOpen(false);
                handleVideoEdit?.(item);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="pencil" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const tabLabels = {
  tout: 'Tout',
  officiel: 'Officiel',
  amicaux: 'Amicaux',
  resume: 'Résumé',
  entrainement: 'Entrainement',
};

const VideoTabPage = ({
  data,
  loading,
  error,
  isGridView,
  setIsGridView,
  onVideoSelect,
  onVideoDelete,
  onVideoEdit,
  onRefresh,
  refreshing,
  emptySubtitle,
}) => {
  const hasData = data.length > 0;

  return (
    <View style={styles.videosTabContainer}>
      {hasData && (
        <View style={styles.switchContainer}>
          <TouchableOpacity
            style={[
              styles.switchButton,
              isGridView ? styles.inactiveButton : styles.activeButton,
            ]}
            onPress={() => setIsGridView(false)}
          >
            <Icon name="list" size={20} color={isGridView ? '#808080' : '#fff'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.switchButton,
              isGridView ? styles.activeButton : styles.inactiveButton,
            ]}
            onPress={() => setIsGridView(true)}
          >
            <Icon name="th-large" size={20} color={isGridView ? '#fff' : '#808080'} />
          </TouchableOpacity>
        </View>
      )}

      {loading && <ActivityIndicator size="large" color="#00A0E9" />}
      {error && <Text style={styles.errorMessage}>{error}</Text>}

      {!loading && !error && (
        hasData ? (
          <FlatList
            key={isGridView ? 'grid' : 'list'}
            data={data}
            renderItem={({ item }) => (
              <VideoItem
                item={item}
                handleVideoSelect={onVideoSelect}
                handleVideoDelete={onVideoDelete}
                handleVideoEdit={onVideoEdit}
                isGridView={isGridView}
              />
            )}
            keyExtractor={(item, index) => index.toString()}
            numColumns={isGridView ? 3 : 1}
            contentContainerStyle={[
              styles.listContent,
              isGridView && styles.gridContent,
            ]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        ) : (
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconWrapper}>
              <Icon name="video-camera" size={32} color="#ffffff" />
            </View>
            <Text style={styles.emptyTitle}>Aucune vidéo trouvée</Text>
            <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>

            <TouchableOpacity style={styles.emptyAction} onPress={onRefresh}>
              <Icon name="refresh" size={16} color="#ffffff" />
              <Text style={styles.emptyActionText}>Rafraîchir</Text>
            </TouchableOpacity>
          </View>
        )
      )}
    </View>
  );
};

const ListeVideoSidebar = ({ onVideoSelect, isActive }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [isGridView, setIsGridView] = useState(false);

  const [renameVisible, setRenameVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  // ✅ 5 pages : Tout / Officiel / Amicaux / Résumé / Entrainement
  const tabs = ['tout', 'officiel', 'amicaux', 'resume', 'entrainement'];
  const [activeTab, setActiveTab] = useState('tout');

  const pagerRef = useRef(null);

  const { selectedClub } = useClubContext();

  const getIndexFromTab = (tab) => Math.max(0, tabs.indexOf(tab));
  const getTabFromIndex = (index) => tabs[Math.max(0, Math.min(index, tabs.length - 1))];

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (selectedClub) {
      try {
        const sortedVideos = await fetchVideosByClub(selectedClub.name);
        setVideos(sortedVideos);
      } catch (error) {
        console.error('Erreur lors de la recherche des vidéos:', error);
        setError('Impossible de charger les vidéos. Veuillez réessayer plus tard.');
      } finally {
        setLoading(false);
      }
    } else {
      setVideos([]);
      setLoading(false);
    }
  }, [selectedClub]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await handleSearch();
    setRefreshing(false);
  }, [handleSearch]);

  useEffect(() => {
    handleSearch();
  }, [handleSearch]);

  const confirmAndDeleteVideo = useCallback((video) => {
    if (!selectedClub) {
      Alert.alert('Suppression impossible', 'Sélectionnez un club avant de supprimer une vidéo.');
      return;
    }

    if (!video?.name) {
      Alert.alert('Suppression impossible', "Nom de vidéo introuvable.");
      return;
    }

    Alert.alert('Supprimer la vidéo ?', `"${video.name}"`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteVideoByClub(selectedClub.name, video.name);
            setVideos((prev) => (prev || []).filter((v) => v.name !== video.name));
          } catch (e) {
            console.error('Erreur suppression vidéo:', e);
            Alert.alert('Erreur', e?.message || 'Impossible de supprimer la vidéo.');
          }
        },
      },
    ]);
  }, [selectedClub]);

  const openRename = useCallback((video) => {
    if (!selectedClub) {
      Alert.alert('Renommage impossible', 'Sélectionnez un club avant de renommer une vidéo.');
      return;
    }
    if (!video?.name) {
      Alert.alert('Renommage impossible', 'Nom de vidéo introuvable.');
      return;
    }
    setRenameTarget(video);
    setRenameValue(video.name);
    setRenameVisible(true);
  }, [selectedClub]);

  const submitRename = useCallback(async () => {
    const oldName = renameTarget?.name;
    const newName = String(renameValue || '').trim();

    if (!selectedClub || !oldName) {
      setRenameVisible(false);
      return;
    }

    if (!newName) {
      Alert.alert('Erreur', 'Le nouveau nom est vide.');
      return;
    }

    if (newName === oldName) {
      setRenameVisible(false);
      return;
    }

    try {
      await renameVideoByClub(selectedClub.name, oldName, newName);
      setRenameVisible(false);
      setRenameTarget(null);
      setRenameValue('');
      await handleSearch();
    } catch (e) {
      console.error('Erreur renommage vidéo:', e);
      Alert.alert('Erreur', e?.message || 'Impossible de renommer la vidéo.');
    }
  }, [renameTarget, renameValue, selectedClub, handleSearch]);

  const goToTab = useCallback((tab) => {
    const index = getIndexFromTab(tab);
    setActiveTab(tab);
    pagerRef.current?.setPage(index);
  }, []);

  const videosByTab = React.useMemo(() => {
    const list = Array.isArray(videos) ? videos : [];

    const amicaux = list.filter((v) => matchesCategory(v, 'amicaux'));
    const resume = list.filter((v) => matchesCategory(v, 'resume'));
    const entrainement = list.filter((v) => matchesCategory(v, 'entrainement'));

    const officiel = list.filter((v) => {
      const isAmical = matchesCategory(v, 'amicaux');
      const isResume = matchesCategory(v, 'resume');
      const isEntrainement = matchesCategory(v, 'entrainement');
      return !isAmical && !isResume && !isEntrainement;
    });

    return {
      tout: list,
      officiel,
      amicaux,
      resume,
      entrainement,
    };
  }, [videos]);

  return (
    <View style={styles.container}>
      <Modal
        visible={renameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setRenameVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Renommer la vidéo</Text>

            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Nouveau nom"
              placeholderTextColor="#808080"
              style={styles.modalInput}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              onSubmitEditing={submitRename}
              returnKeyType="done"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionBtn, styles.modalCancelBtn]}
                onPress={() => setRenameVisible(false)}
              >
                <Text style={styles.modalActionText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionBtn, styles.modalConfirmBtn]}
                onPress={submitRename}
              >
                <Text style={styles.modalActionText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Header : 5 onglets */}
      <View style={styles.tabHeader}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            onPress={() => goToTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tabLabels[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Swipe gauche/droite */}
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={getIndexFromTab(activeTab)}
        onPageSelected={(e) => {
          const index = e.nativeEvent.position;
          setActiveTab(getTabFromIndex(index));
        }}
        overScrollMode="never"
      >
        {tabs.map((tab) => (
          <View key={tab} style={{ flex: 1 }}>
            <VideoTabPage
              data={videosByTab[tab] || []}
              loading={loading}
              error={error}
              isGridView={isGridView}
              setIsGridView={setIsGridView}
              onVideoSelect={onVideoSelect}
              onVideoDelete={confirmAndDeleteVideo}
              onVideoEdit={openRename}
              onRefresh={onRefresh}
              refreshing={refreshing}
              emptySubtitle={
                tab === 'tout'
                  ? (selectedClub
                      ? `Aucune vidéo n'est disponible pour ${selectedClub.name}.`
                      : "Sélectionnez un club pour afficher les vidéos.")
                  : 'Aucune vidéo dans cette catégorie.'
              }
            />
          </View>
        ))}
      </PagerView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010914',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 3,
    zIndex: 2,
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#010E1E',
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  tabButtonActive: {
    // inchangé
  },
  tabText: {
    color: '#808080',
    fontWeight: '700',
    fontSize: 12,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  videosTabContainer: {
    flex: 1,
  },
  switchButton: {
    marginHorizontal: 85,
    borderRadius: 5,
    backgroundColor: 'transparent',
  },
  activeButton: {
    backgroundColor: '#010E1E',
  },
  inactiveButton: {
    backgroundColor: 'transparent',
    opacity: 0.7,
  },
  videoItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 10,
  },
  gridItem: {
    marginHorizontal: 5,
  },
  videoImage: {
    width: '100%',
    height: undefined,
    aspectRatio: 256 / 144,
  },
  videoDetails: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 2,
    position: 'relative',
    paddingRight: 44,
  },
  videoTextContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButtonAbs: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuPopoverAbs: {
    position: 'absolute',
    right: 44,
    top: 4,
    backgroundColor: '#010E1E',
    borderWidth: 1,
    borderColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 50,
    elevation: 8,
  },
  menuItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  menuItemSecond: {
    marginLeft: 14,
  },
  creationDate: {
    fontSize: 14 * scale,
    color: '#CCCCCC',
    textAlign: 'center',
    paddingBottom: 5 * scale,
  },
  videoName: {
    fontSize: 16 * scale,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#FFFFFF',
  },
  errorMessage: {
    color: '#FF4C4C',
    fontSize: 16 * scale,
    textAlign: 'center',
    backgroundColor: 'rgba(255, 76, 76, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 76, 76, 0.2)',
    padding: 10 * scale,
    borderRadius: 5,
    marginVertical: 10 * scale,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#010E1E',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  emptyTitle: {
    fontSize: 18 * scale,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14 * scale,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    opacity: 0.75,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#010E1E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  emptyActionText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14 * scale,
  },
  listContent: {
    flexGrow: 1,
  },
  gridContent: {
    paddingHorizontal: 5,
  },
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#010914',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenVideo: {
    width: width,
    height: height,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(1, 9, 20, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#010E1E',
    borderWidth: 1,
    borderColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalActionBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ffffff',
    backgroundColor: '#010914',
    alignItems: 'center',
  },
  modalCancelBtn: {
    opacity: 0.85,
  },
  modalConfirmBtn: {
    backgroundColor: '#010914',
  },
  modalActionText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  noVideoText: {
    color: '#ffffff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
  },
});

export default ListeVideoSidebar;