import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import Video from 'react-native-video';
import { fetchVideosByClub } from '../../tools/api';
import { moderateScale, scale as s } from './../../tools/responsive';

const ms = moderateScale;
const discoverClubName = 'Promotion';

const DiscoverTab = () => {
  const { height } = useWindowDimensions();
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
        if (__DEV__) console.error('Erreur lors de la recherche des vidéos (Promotion):', error?.message);
        setDiscoverError("Impossible de charger les vidéos de 'Promotion'.");
      } finally {
        setDiscoverLoading(false);
      }
    };

    loadDiscoverVideos();
  }, []);

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
      paddingBottom: s(70),
      width: '100%',
    },
    discoverItem: {
      width: '100%',
      height: height,
      justifyContent: 'flex-start',
      alignItems: 'center',
      paddingTop: s(12),
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
      left: s(16),
      right: s(16),
      bottom: s(12),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(8),
      backgroundColor: '#010914',
      paddingVertical: s(10),
      borderRadius: ms(12),
      borderWidth: 1,
      borderColor: '#ffffff',
    },
    discoverCtaText: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: ms(13),
    },
  });

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

export default DiscoverTab;
