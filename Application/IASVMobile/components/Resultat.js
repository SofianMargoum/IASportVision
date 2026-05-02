import React, { useState, useCallback, useMemo, Suspense, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { TabView, SceneMap } from 'react-native-tab-view';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useClubContext } from './../tools/ClubContext'; // 👈 ton contexte
import { moderateScale, scale as s } from './../tools/responsive';

// Lazy loading components
const MatchsContent = React.lazy(() =>
  import('./Resultat/MatchsContent')
);
const CalendrierContent = React.lazy(() =>
  import('./Resultat/CalendrierContent')
);
const ClassementsContent = React.lazy(() =>
  import('./Resultat/ClassementsContent')
);
const StatsContent = React.lazy(() =>
  import('./Resultat/StatsContent')
);
const ClubContent = React.lazy(() =>
  import('./Resultat/ClubContent')
);


const Resultat = ({ isActive }) => {
  const { width } = useWindowDimensions();
  const initialLayout = useMemo(() => ({ width }), [width]);
  const [index, setIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  const { selectedClub } = useClubContext(); // 👈 on se base sur le club sélectionné

  const routes = useMemo(() => [
    { key: 'matchs', title: 'MATCHS' },
    { key: 'calendrier', title: 'CALENDRIER' },
    { key: 'classements', title: 'CLASSEMENTS' },
    { key: 'stats', title: 'STATS CHAMPIONNAT' },
    ...(selectedClub?.name
      ? [{ key: 'club', title: selectedClub.name.toUpperCase() }]
      : []),
  ], [selectedClub?.name]);

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
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
              <MatchsContent />
            </ScrollView>
          </Suspense>
        ),
        calendrier: () => (
          <Suspense fallback={null}>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
              <CalendrierContent />
            </ScrollView>
          </Suspense>
        ),
        classements: () => (
          <Suspense fallback={null}>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
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
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
              <StatsContent />
            </ScrollView>
          </Suspense>
        ),
        club: () => (
          <Suspense fallback={<ActivityIndicator size="large" color="#00A0E9" />}>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
              <ClubContent />
            </ScrollView>
          </Suspense>
        ),
      }),
    [refreshing]
  );

  const tabScrollRef = useRef(null);
  const tabLayouts = useRef({});

  // Auto-scroll la tab bar vers l'onglet actif lors du swipe
  useEffect(() => {
    if (tabScrollRef.current && tabLayouts.current[index] !== undefined) {
      const x = tabLayouts.current[index];
      tabScrollRef.current.scrollTo({ x: Math.max(0, x - width / 3), animated: true });
    }
  }, [index]);

  const renderTabBar = useCallback(
    (props) =>
      hasContent && (
        <ScrollView
          ref={tabScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.nav}
          style={styles.navScroll}
        >
          {props.navigationState.routes.map((route, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.button, index === i && styles.activeButton]}
              onPress={() => setIndex(i)}
              onLayout={(e) => {
                tabLayouts.current[i] = e.nativeEvent.layout.x;
              }}
            >
              <Text
                style={[styles.buttonText, index === i && styles.activeButtonText]}
                numberOfLines={1}
              >
                {route.title}
              </Text>
              {index === i && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      ),
    [index, hasContent, width]
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
          <Text style={styles.noContentText}>Aucun club sélectionné</Text>
          <Text style={styles.noContentSub}>
            Recherche un club dans l'onglet Explorer pour afficher ses résultats
          </Text>
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
  navScroll: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    flexGrow: 1,
    paddingHorizontal: 4,
  },
  button: {
    paddingVertical: s(10),
    paddingHorizontal: s(12),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeButton: {},
  
  buttonText: {
    color: '#666666',
    fontSize: moderateScale(14),
  },
  activeButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    width: '80%',
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#ffffff',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#010914',
  },
  emptyIcon: {
    width: moderateScale(60),
    height: moderateScale(60),
    opacity: 0.3,
    marginBottom: s(16),
  },
  noContentText: {
    color: '#ffffff',
    fontSize: moderateScale(18),
    fontWeight: 'bold',
    textAlign: 'center',
  },
  noContentSub: {
    color: '#aaaaaa',
    fontSize: moderateScale(12),
    textAlign: 'center',
    marginTop: s(8),
    paddingHorizontal: s(40),
    lineHeight: moderateScale(16),
  },
});

export default Resultat;
