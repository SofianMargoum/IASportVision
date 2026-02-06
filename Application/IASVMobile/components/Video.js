import React, { useState, useEffect } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import ListeVideo from './Video/ListeVideo';
import ListeVideoSidebar from './Video/ListeVideoSidebar';
import { useVideoOverlay } from '../tools/VideoOverlayContext';
import { useActiveTab } from '../tools/ActiveTabContext';

const Video = () => {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const { closeVideo, videoListResetPending, acknowledgeVideoListReset } = useVideoOverlay();
  const { activeKey } = useActiveTab();
  const isActive = activeKey === 'video';


  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
  };

  const handleBackClick = () => {
    setSelectedVideo(null);
    return true;
  };

  useEffect(() => {
    if (selectedVideo) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackClick);
      return () => backHandler.remove();
    }
  }, [selectedVideo]);

  useEffect(() => {
    if (!selectedVideo) {
      closeVideo();
    }
  }, [selectedVideo, closeVideo]);

  useEffect(() => {
    if (!videoListResetPending) return;
    if (selectedVideo) {
      setSelectedVideo(null);
    }
    acknowledgeVideoListReset?.();
  }, [videoListResetPending, selectedVideo, acknowledgeVideoListReset]);

  useEffect(() => {
    if (!isActive) {
      closeVideo();
      setSelectedVideo(null);
    }
  }, [isActive, closeVideo]);

  return (
    <View style={styles.container}>
      {selectedVideo ? (
        <View style={styles.listeVideo}>
          <ListeVideo selectedVideo={selectedVideo} />
        </View>
      ) : (
        <View style={styles.listeVideoSidebar}>
          <ListeVideoSidebar onVideoSelect={handleVideoSelect} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#010914',
  },
  listeVideo: {
    flex: 1,
  },
  listeVideoSidebar: {
    flex: 1,
  },
});

export default Video;