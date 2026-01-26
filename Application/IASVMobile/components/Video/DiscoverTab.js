import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import Video from 'react-native-video';
import { fetchVideosByClub } from '../../tools/api';

const { height } = Dimensions.get('window');
const scale = 0.85;
const discoverClubName = 'Promotion';

const DiscoverTab = () => {
  const [discoverVideos, setDiscoverVideos] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleMomentumScrollEnd = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const newIndex = Math.round(offsetY / height);
    setActiveIndex(newIndex);
  };

  useEffect(() => {
    const loadDiscoverVideos = async () => {
      setDiscoverLoading(true);
      setDiscoverError(null);
      try {
        const data = await fetchVideosByClub(discoverClubName);
        setDiscoverVideos(data || []);
      } catch (error) {
        console.error('Erreur lors de la recherche des vidéos (Promotion):', error);
        setDiscoverError("Impossible de charger les vidéos de 'Promotion'.");
      } finally {
        setDiscoverLoading(false);
      }
    };

    loadDiscoverVideos();
  }, []);

  return (
    <>
      <View style={styles.discoverContainer}>
        <FlatList
          data={discoverVideos}
          keyExtractor={(item, index) => `${item.url}-${index}`}
          renderItem={({ item, index }) => (
            <View style={styles.discoverItem}>
              <Video
                source={{ uri: item.url || item.videoUrl || item.gcsUrl || item.mp4Url }}
                style={styles.discoverVideo}
                resizeMode="contain"
                muted={activeIndex !== index}
                repeat
                paused={activeIndex !== index}
                controls={false}
              />
            </View>
          )}
          style={styles.discoverList}
          contentContainerStyle={styles.discoverListContent}
          numColumns={1}
          pagingEnabled
          snapToInterval={height}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
        />
        <TouchableOpacity
          style={styles.discoverCta}
          onPress={() => Linking.openURL('https://iasportvision.com')}
        >
          <Text style={styles.discoverCtaText}>Découvrir iasportvision.com</Text>
          <Icon name="external-link" size={14} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  discoverContainer: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  discoverList: {
    flex: 1,
    width: '100%',
  },
  discoverListContent: {
    paddingBottom: 70,
    width: '100%',
  },
  discoverItem: {
    width: '100%',
    height: height,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 0,
  },
  discoverVideo: {
    width: '100%',
    height: undefined,
    aspectRatio: 9 / 16,
    borderRadius: 0,
    backgroundColor: '#010914',
  },
  discoverCta: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#010914',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  discoverCtaText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14 * scale,
  },
});

export default DiscoverTab;
