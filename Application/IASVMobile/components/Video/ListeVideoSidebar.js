import React, { useState, useEffect } from 'react'; 
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  StyleSheet, 
  Image, 
  RefreshControl, 
  Dimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useClubContext } from '../../tools/ClubContext';
import { fetchVideosByClub } from '../../tools/api'; 
import DiscoverTab from './DiscoverTab';

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

const VideoItem = ({ item, handleVideoSelect, isGridView }) => {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <TouchableOpacity
      style={[
        styles.videoItem,
        isGridView && styles.gridItem,
        { opacity: isPressed ? 1 : 0.99 },
      ]}
      onPress={() => handleVideoSelect(item)}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
    >
      <Image
        source={{ uri: item.coverUrl }}
        style={[styles.videoImage, { opacity: isPressed ? 1 : 0.8 }]}
        defaultSource={require('../../assets/cover.png')}
      />
      <View style={styles.videoDetails}>
        <Text style={styles.videoName}>{item.name || 'Nom non disponible'}</Text>
        <Text style={styles.creationDate}>
          {item.creationDate ? formatDate(item.creationDate) : 'Date non disponible'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const ListeVideoSidebar = ({ onVideoSelect, isActive }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [isGridView, setIsGridView] = useState(false);
  const [activeTab, setActiveTab] = useState('videos');

  const { selectedClub } = useClubContext();

  const handleSearch = async () => {
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
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await handleSearch();
    setRefreshing(false);
  };

  useEffect(() => {
    handleSearch();
  }, [selectedClub]);

  useEffect(() => {
    if (videos && videos.length > 0) {
      setActiveTab('videos');
    } else {
      setActiveTab('discover');
    }
  }, [videos]);

  const hasVideos = videos && videos.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.tabHeader}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'videos' && styles.tabButtonActive]}
          onPress={() => setActiveTab('videos')}
        >
          <Text style={[styles.tabText, activeTab === 'videos' && styles.tabTextActive]}>Vidéos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'discover' && styles.tabButtonActive]}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}>Découvrir</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'discover' ? (
        <DiscoverTab />
      ) : (
        <View style={styles.videosTabContainer}>
          {hasVideos && (
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
            hasVideos ? (
              <FlatList
                key={isGridView ? 'grid' : 'list'}
                data={videos}
                renderItem={({ item }) => (
                  <VideoItem
                    item={item}
                    handleVideoSelect={onVideoSelect}
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
              // 🎬 Message si aucune vidéo trouvée
              <View style={styles.emptyStateContainer}>
                <View style={styles.emptyIconWrapper}>
                  <Icon name="video-camera" size={32} color="#ffffff" />
                </View>
                <Text style={styles.emptyTitle}>Aucune vidéo trouvée</Text>
                <Text style={styles.emptySubtitle}>
                  {selectedClub
                    ? `Aucune vidéo n'est disponible pour ${selectedClub.name}.`
                    : "Sélectionnez un club pour afficher les vidéos."}
                </Text>

                <TouchableOpacity style={styles.emptyAction} onPress={onRefresh}>
                  <Icon name="refresh" size={16} color="#ffffff" />
                  <Text style={styles.emptyActionText}>Rafraîchir</Text>
                </TouchableOpacity>
              </View>
            )
          )}
        </View>
      )}
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
    gap: 12,
    backgroundColor: '#010E1E',
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#010E1E',
  },
  tabButtonActive: {
    backgroundColor: '#010914',
  },
  tabText: {
    color: '#808080',
    fontWeight: '700',
    fontSize: 14,
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
  noVideoText: {
    color: '#ffffff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
  },
});

export default ListeVideoSidebar;
