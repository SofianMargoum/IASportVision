import React, { useState, useEffect } from 'react';
import {View,Text,FlatList,TouchableOpacity,ActivityIndicator,StyleSheet,Image,RefreshControl} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useClubContext } from './../ClubContext';

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
    console.error("Date invalide détectée :", dateString);
    return 'Date non valide';
  } catch (error) {
    console.error("Erreur lors de la conversion de la date :", error);
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
        {
          opacity: isPressed ? 1 : 0.99, // Opacité dynamique pour toute la vue
        },
      ]}
      onPress={() => handleVideoSelect(item)}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
    >
     <Image
        source={{
          uri: item.coverUrl,
        }}
        style={[
          styles.videoImage,
          {
            opacity:  isPressed ? 1 : 0.8, // Gardez l'opacité de l'image fixe ici pour qu'elle suive celle du conteneur
          },
        ]}
        defaultSource={require('../../assets/cover.png')} // Image par défaut
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
const ListeVideoSidebar = ({ onVideoSelect }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [isGridView, setIsGridView] = useState(false);

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
        const sortedVideos = (data.videos || []).sort((a, b) => {
          const convertToISO = (dateStr) => {
            const [datePart, timePart] = dateStr.split(' ');
            const [day, month, year] = datePart.split('/');
            return `${year}-${month}-${day}T${timePart || '00:00:00'}`;
          };
          const dateA = new Date(convertToISO(a.creationDate));
          const dateB = new Date(convertToISO(b.creationDate));
          return dateB - dateA; // Trie du plus récent au plus ancien
        });

        setVideos(sortedVideos);
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

  const onRefresh = async () => {
    setRefreshing(true);
    await handleSearch();
    setRefreshing(false);
  };

  useEffect(() => {
    handleSearch();
  }, [selectedClub]);

  return (
    <View style={styles.container}>
      <View style={styles.switchContainer}>
        <TouchableOpacity
          style={[styles.switchButton, isGridView ? styles.inactiveButton : styles.activeButton]}
          onPress={() => setIsGridView(false)}
        >
          <Icon name="list" size={24} color={isGridView ? '#808080' : '#fff'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.switchButton, isGridView ? styles.activeButton : styles.inactiveButton]}
          onPress={() => setIsGridView(true)}
        >
          <Icon name="th-large" size={24} color={isGridView ? '#fff' : '#808080'} />
        </TouchableOpacity>
      </View>
      {loading && <ActivityIndicator size="large" color="#00A0E9" />}
      {error && <Text style={styles.errorMessage}>{error}</Text>}
      {!loading && !error && (
        <FlatList
          key={isGridView ? 'grid' : 'list'} // Change la clé selon la vue
          data={videos}
          renderItem={({ item }) => (
            <VideoItem item={item} handleVideoSelect={onVideoSelect} isGridView={isGridView} />
          )}
          keyExtractor={(item, index) => index.toString()}
          ListEmptyComponent={<Text style={styles.noVideos}>Aucune vidéo disponible</Text>}
          numColumns={isGridView ? 3 : 1} // Définit le nombre de colonnes
          contentContainerStyle={[
            styles.listContent,
            isGridView && styles.gridContent,
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
};

const scale = 0.85;
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 3,
  },
  switchButton: {
    marginHorizontal: 85,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'transparent', // Bordure transparente si nécessaire
    backgroundColor: 'transparent', // Fond transparent
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
  gridImage: {
    aspectRatio: 16 / 9,
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
  gridContent: {
    paddingHorizontal: 5,
  },
});

export default ListeVideoSidebar;
