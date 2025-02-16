import React, { useState, useCallback, useMemo, Suspense } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions, ScrollView, RefreshControl } from 'react-native';
import { TabView, SceneMap } from 'react-native-tab-view';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Lazy loading components to optimize initial load time
const MatchsContent = React.lazy(() => import('./Resultat/MatchsContent'));
const ClassementsContent = React.lazy(() => import('./Resultat/ClassementsContent'));
const StatsContent = React.lazy(() => import('./Resultat/StatsContent'));

const scale = 0.85; // Adjust this value as needed
const initialLayout = { width: Dimensions.get('window').width };

const Resultat = () => {
  const [index, setIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [routes] = useState([
    { key: 'matchs', title: 'MATCHS' },
    { key: 'classements', title: 'CLASSEMENTS' },
    { key: 'stats', title: 'STATS' },
  ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simulez une attente ou effectuez une action de rafraîchissement ici
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  }, []);

  const renderScene = useMemo(
    () =>
      SceneMap({
        matchs: () => (
          <Suspense fallback={<ActivityIndicator size="large" color="#00A0E9" />}>
            <ScrollView
              style={{ flex: 1 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              <MatchsContent />
            </ScrollView>
          </Suspense>
        ),
        classements: () => (
          <Suspense fallback={<ActivityIndicator size="large" color="#00A0E9" />}>
            <ScrollView
              style={{ flex: 1 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              <ClassementsContent />
            </ScrollView>
          </Suspense>
        ),
        stats: () => (
          <Suspense fallback={<ActivityIndicator size="large" color="#00A0E9" />}>
            <ScrollView
              style={{ flex: 1 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              <StatsContent />
            </ScrollView>
          </Suspense>
        ),
      }),
    [refreshing]
  );

  const renderTabBar = useCallback(
    (props) => (
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
    [index]
  );

  return (
    <GestureHandlerRootView style={styles.resultatContainer}>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={initialLayout}
        renderTabBar={renderTabBar}
      />
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
  contentContainer: {
    flex: 1,
    padding: 8 * scale,
    borderRadius: 8,
  },
});

export default Resultat;
