import React from 'react';
import { useWindowDimensions } from 'react-native';
import MainComponent from './components/Main';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { UserProvider } from './tools/UserContext';
import { UserRoleProvider } from './tools/UserRoleContext';
import { ClubProvider } from './tools/ClubContext';
import { EffectifProvider } from './tools/EffectifContext';
import { DeviceProvider } from './tools/DeviceContext';

const App = () => {
  // useWindowDimensions met à jour width/height automatiquement lors :
  // - des rotations portrait <-> paysage
  // - du multi-window / split-screen Android
  // - des changements de configuration système (font scale, etc.)
  // -> remplace l'ancien Dimensions.addEventListener manuel et gère mieux
  //    les écrans à encoche / barres système (Samsung, Xiaomi, Pixel, ...).
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  return (
    <SafeAreaProvider>
      <UserProvider>
        <UserRoleProvider>
          <ClubProvider>
            <EffectifProvider>
              <DeviceProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <MainComponent
                    windowWidth={windowWidth}
                    windowHeight={windowHeight}
                  />
                </GestureHandlerRootView>
              </DeviceProvider>
            </EffectifProvider>
          </ClubProvider>
        </UserRoleProvider>
      </UserProvider>
    </SafeAreaProvider>
  );
};

export default App;
