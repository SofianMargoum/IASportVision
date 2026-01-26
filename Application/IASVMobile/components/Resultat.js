import React, { useState, useCallback, useMemo, Suspense, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  ScrollView,
  RefreshControl,
  Animated,
} from 'react-native';
import { TabView, SceneMap } from 'react-native-tab-view';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useClubContext } from './../tools/ClubContext'; // 👈 ton contexte

// Lazy loading components
const MatchsContent = React.lazy(() =>
  import('./Resultat/MatchsContent')
);
const ClassementsContent = React.lazy(() =>
  import('./Resultat/ClassementsContent')
);
const StatsContent = React.lazy(() =>
  import('./Resultat/StatsContent')
);


const scale = 0.85;
const { width } = Dimensions.get('window');
const initialLayout = { width };

const Resultat = ({ isActive }) => {
  const [index, setIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  const { selectedClub } = useClubContext(); // 👈 on se base sur le club sélectionné

  const [routes] = useState([
    { key: 'matchs', title: 'MATCHS' },
    { key: 'classements', title: 'CLASSEMENTS' },
    { key: 'stats', title: 'STATS' },
  ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 2000);
  }, []);

  // ⚙️ Détection du contenu (basé sur selectedClub)
  useEffect(() => {
    setHasContent(!!selectedClub);
  }, [selectedClub]);

  // 🎞️ Animation d’apparition de la vidéo
  useEffect(() => {
    if (!hasContent) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [hasContent]);

  const renderScene = useMemo(
    () =>
      SceneMap({
        matchs: () => (
          <Suspense fallback={null}>
            <ScrollView
              style={{ flex: 1 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
              <MatchsContent />
            </ScrollView>
          </Suspense>
        ),
        classements: () => (
          <Suspense fallback={null}>
            <ScrollView
              style={{ flex: 1 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
              <ClassementsContent />
            </ScrollView>
          </Suspense>
        ),
        stats: () => (
          <Suspense fallback={<ActivityIndicator size="large" color="#00A0E9" />}>
            <ScrollView
              style={{ flex: 1 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
              <StatsContent />
            </ScrollView>
          </Suspense>
        ),
      }),
    [refreshing]
  );

  const renderTabBar = useCallback(
    (props) =>
      hasContent && (
        <View style={styles.nav}>
          {props.navigationState.routes.map((route, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.button, index === i && styles.activeButton]}
              onPress={() => setIndex(i)}
            >
              <Text style={[styles.buttonText, index === i && styles.activeButtonText]}>
                {route.title}
              </Text>
              {index === i && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          ))}
        </View>
      ),
    [index, hasContent]
  );

  return (
    <GestureHandlerRootView style={styles.resultatContainer}>
      {hasContent ? (
        <TabView
          navigationState={{ index, routes }}
          renderScene={renderScene}
          onIndexChange={setIndex}
          initialLayout={initialLayout}
          renderTabBar={renderTabBar}
        />
      ) : (
        <Animated.View style={[styles.videoContainer, { opacity: fadeAnim }]}>
          <Text style={styles.noContentText}>Aucun résultat trouvé</Text>
        </Animated.View>
      )}
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  resultatContainer: {
    flex: 1,
    backgroundColor: '#010914',
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    borderBottomWidth: 2,
    borderBottomColor: '#00A0E9',
  },
  button: {
    paddingVertical: 12 * scale,
    paddingHorizontal: 16 * scale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButton: {
    color: '#00A0E9',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16 * scale,
  },
  activeButtonText: {
    color: '#00A0E9',
    fontWeight: 'bold',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -2,
    width: '100%',
    height: 3,
    backgroundColor: '#00A0E9',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#010914',
  },
  video: {
    alignSelf: 'center',
  },
  noContentText: {
    color: '#ffffff',
    fontSize: 18,
    textAlign: 'center',
  },
});

export default Resultat;
