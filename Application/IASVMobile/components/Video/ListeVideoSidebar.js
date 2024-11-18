import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { useClubContext } from './../ClubContext';

// Constante de scale
const scale = 0.85;

// Fonction pour reformater la date au format "dd/MM/yyyy"
const formatDate = (dateString) => {
  let date;

  // Vérifier si la date est un timestamp Unix (en millisecondes)
  if (!isNaN(dateString)) {
    date = new Date(Number(dateString));
  } else {
    date = new Date(dateString);

    // Si ce n'est pas valide, tenter de diviser et reformater
    if (isNaN(date.getTime())) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Mois commence à 0
        const year = parseInt(parts[2], 10);
        date = new Date(year, month, day);
      }
    }
  }

  // Vérification finale de la validité de la date
  if (!isNaN(date.getTime())) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return 'Date non valide'; // Retourne un message si la date n'est pas valide
};

const ListeVideoSidebar = ({ onVideoSelect }) => {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { selectedClub } = useClubContext();

  const handleSearch = async () => {
    setLoading(true);
    setError(null);

    if (selectedClub) {
      const folder = selectedClub.name;
      const url = `https://ia-sport.oa.r.appspot.com/api/videos?folder=${encodeURIComponent(folder)}`;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Erreur lors de la récupération des vidéos');
        }

        const data = await response.json();
        const sortedVideos = (data.videos || []).sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));

        setVideos(sortedVideos);
        setSelectedVideo(null);
      } catch (error) {
        console.error("Erreur lors de la recherche des vidéos:", error);
        setError('Impossible de charger les vidéos. Veuillez réessayer plus tard.');
      } finally {
        setLoading(false);
      }
    } else {
      setVideos([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch();
  }, [selectedClub]);

  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
    onVideoSelect(video);
  };

  const renderVideoItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.videoItem, selectedVideo === item ? styles.selectedVideo : null]}
      onPress={() => handleVideoSelect(item)}
    >
      <Image source={require('../../assets/ImageDeConverture.jpg')} style={styles.videoImage} />
      <View style={styles.videoDetails}>
      <Text style={styles.videoName}>{item.name || 'Nom non disponible'}</Text>
        <Text style={styles.creationDate}>
          {item.creationDate ? formatDate(item.creationDate) : 'Date non disponible'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading && <ActivityIndicator size="large" color="#00BFFF" />}
      {error && <Text style={styles.errorMessage}>{error}</Text>}
      {!loading && !error && (
        <FlatList
          data={videos}
          renderItem={renderVideoItem}
          keyExtractor={(item, index) => index.toString()}
          ListEmptyComponent={<Text style={styles.noVideos}>Aucune vidéo disponible</Text>}
          ListHeaderComponent={<Text style={styles.header}></Text>}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

// Styles ici (modifiés pour inclure le scale)
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  videoItem: {
    flexDirection: 'column',
    alignItems: 'center',
    elevation: 2,
    marginVertical : 10,
  },
  videoImage: {
    width: '100%', // Utiliser 100% pour remplir l'espace disponible
    height: undefined, // Ne pas définir la hauteur
    aspectRatio: 256 / 144, // Maintenir le ratio d'aspect

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
  noVideos: {
    textAlign: 'center',
    marginTop: 20 * scale,
    fontSize: 16 * scale,
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 20 * scale,
  },
});

export default ListeVideoSidebar;
