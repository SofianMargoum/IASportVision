import React, { useState, useCallback, useMemo, Suspense } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
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
  const [routes] = useState([
    { key: 'matchs', title: 'MATCHS' },
    { key: 'classements', title: 'CLASSEMENTS' },
    { key: 'stats', title: 'STATS' },
  ]);

  const renderScene = useMemo(() => 
    SceneMap({
      matchs: () => (
        <Suspense fallback={<ActivityIndicator size="large" color="#00BFFF" />}>
          <MatchsContent />
        </Suspense>
      ),
      classements: () => (
        <Suspense fallback={<ActivityIndicator size="large" color="#00BFFF" />}>
          <ClassementsContent />
        </Suspense>
      ),
      stats: () => (
        <Suspense fallback={<ActivityIndicator size="large" color="#00BFFF" />}>
          <StatsContent />
        </Suspense>
      ),
    })
  , []);

  const renderTabBar = useCallback((props) => (
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
  ), [index]);

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
    borderBottomColor: '#00BFFF',
  },
  button: {
    paddingVertical: 12 * scale,
    paddingHorizontal: 16 * scale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButton: {
    color: '#00BFFF',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16 * scale,
  },
  activeButtonText: {
    color: '#00BFFF',
    fontWeight: 'bold',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -2,
    width: '100%',
    height: 3,
    backgroundColor: '#00BFFF',
  },
  contentContainer: {
    flex: 1,
    padding: 8 * scale,
    borderRadius: 8,
  },
});

export default Resultat;