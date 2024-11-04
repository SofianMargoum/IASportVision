import React, { useState, useMemo, Suspense } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
  Image,
  ActivityIndicator,
} from 'react-native';
import Video from 'react-native-video';
import { TabView, SceneMap } from 'react-native-tab-view';

const scale = 0.85; // Constante pour l'échelle

const ListeVideo = ({ selectedVideo, resumeVideoUrl }) => {
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'video', title: 'VIDEO' },
    { key: 'resume', title: 'RESUME' },
    { key: 'statsEquipes', title: 'STATS EQUIPES' },
    { key: 'statsJoueurs', title: 'STATS JOUEURS' },
  ]);
  const [shareVisible, setShareVisible] = useState(false);

  // Fonction pour rendre la scène vidéo
  const renderVideoScene = () => (
    <View style={styles.videoContainer}>
      {selectedVideo ? (
        <Video
          source={{ uri: selectedVideo.url }}
          style={styles.video}
          resizeMode="cover"
          controls
        />
      ) : (
        <Text style={styles.noContentText}>Aucune vidéo sélectionnée.</Text>
      )}
    </View>
  );

  // Fonction pour rendre la scène de résumé
  const renderResumeScene = () => (
    <View style={styles.videoContainer}>
      {selectedVideo ? (
        <>
          <Video
            source={{ uri: selectedVideo.url }}
            style={styles.video}
            resizeMode="cover"
            controls
          />
          <View style={styles.shareButtonsContainer}>
            {shareVisible && (
              <View style={styles.socialMediaButtons}>
                <TouchableOpacity onPress={shareOnSocialMedia}>
                  <Text style={styles.shareButtonText}>Partager</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </>
      ) : (
        <Text style={styles.noContentText}>Aucune vidéo sélectionnée.</Text>
      )}
    </View>
  );

  const renderStatsEquipesScene = () => (
    <Image source={require('../../assets/stat equipe.jpg')} style={styles.statsImage} />
  );

  const renderStatsJoueursScene = () => (
    <Image source={require('../../assets/stat joueur.jpg')} style={styles.statsImage} />
  );

  const renderScene = SceneMap({
    video: renderVideoScene,
    resume: renderResumeScene,
    statsEquipes: renderStatsEquipesScene,
    statsJoueurs: renderStatsJoueursScene,
  });

  const shareOnSocialMedia = async () => {
    let urlToShare;
    if (index === 0 && selectedVideo) {
      urlToShare = selectedVideo.url; // URL de la vidéo sélectionnée
    } else if (index === 1) {
      urlToShare = resumeVideoUrl; // URL de la vidéo de résumé
    }

    if (!urlToShare) {
      alert('Aucune vidéo disponible à partager.');
      return;
    }

    try {
      await Share.share({
        message: `Check this out: ${urlToShare}`,
      });
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <View style={styles.resultatContainer}>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={{ width: '100%' }}
        renderTabBar={props => (
          <View style={styles.nav}>
            {props.navigationState.routes.map((route, i) => (
              <TouchableOpacity
                key={route.key}
                style={[styles.button, index === i && styles.activeButton]}
                onPress={() => setIndex(i)}
              >
                <Text style={[styles.buttonText, index === i && styles.activeButtonText]}>{route.title}</Text>
                {index === i && <View style={styles.activeIndicator} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  resultatContainer: {
    flex: 1,
    padding: 20 * scale,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30 * scale,
    borderBottomWidth: 2 * scale,
    borderBottomColor: '#00BFFF', // Couleur de bordure inférieure
  },
  button: {
    flex: 1,
    paddingVertical: 12 * scale,
    paddingHorizontal: 16 * scale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButton: {
    color: '#00BFFF', // Bleu clair pour l'onglet actif
  },
  buttonText: {
    color: '#ffffff', // Texte par défaut en blanc
    fontSize: 14 * scale,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  activeButtonText: {
    color: '#00BFFF', // Texte bleu clair pour le texte actif
    fontWeight: 'bold',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -2 * scale,
    width: '100%',
    height: 3 * scale,
    backgroundColor: '#00BFFF', // Couleur de bordure active
  },
  videoContainer: {
    alignItems: 'center',
    marginBottom: 20 * scale,
    borderRadius: 10 * scale,
    overflow: 'hidden',
    padding: 10 * scale,
  },
  video: {
    width: '100%',
    height: 200 * scale,
    borderRadius: 10 * scale,
  },
  shareButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10 * scale,
    width: '100%',
  },
  socialMediaButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10 * scale,
  },
  statsImage: {
    width: '100%',
    height: 200 * scale,
    resizeMode: 'cover',
    borderRadius: 10 * scale, // Arrondi pour l'image
  },
  noContentText: {
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 20 * scale,
    fontSize: 16 * scale,
  },
  shareButtonText: {
    color: '#00BFFF',
    fontWeight: 'bold',
  },
});

export default ListeVideo;
