import React, { useState, useRef } from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { theme } from './src/constants/theme';
import { useOrientation } from './src/hooks/useOrientation';
import { useHardwareBack } from './src/hooks/useHardwareBack';
import { useNetworkConfig } from './src/hooks/useNetworkConfig';

import { HeaderBar } from './src/components/HeaderBar';
import { ConnectionModal } from './src/components/ConnectionModal';
import { LoadingOverlay } from './src/components/LoadingOverlay';
import { GameWebView } from './src/components/GameWebView';

function MainApp() {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [currentView, setCurrentView] = useState('home');
  const [currentGame, setCurrentGame] = useState(null);

  const webViewRef = useRef(null);

  // Modular Orientation Hook
  const { isLandscape, setOrientation } = useOrientation();

  // Modular Network Config Hook (with automatic Host IP discovery in Expo Go)
  const {
    activeMode,
    serverUrl,
    inputUrl,
    setInputUrl,
    detectedIp,
    connectToServer,
    switchToOffline
  } = useNetworkConfig();

  // Modular Android Hardware Back Hook
  useHardwareBack({
    currentView,
    currentGame,
    webViewRef
  });

  const handleConnect = (target) => {
    connectToServer(target);
    setIsLoading(true);
    setShowConfig(false);
  };

  const handleSwitchToOffline = () => {
    switchToOffline();
    setShowConfig(false);
    setIsLoading(false);
  };

  const handleReload = () => {
    setIsLoading(true);
    webViewRef.current?.reload();
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={theme.colors.bg}
        hidden={isLandscape}
      />

      {/* Top Floating Header with Safe Area Insets */}
      <HeaderBar
        visible={!isLandscape && currentView === 'home'}
        activeMode={activeMode}
        serverUrl={serverUrl}
        onOpenSettings={() => setShowConfig(true)}
        onReload={handleReload}
      />

      {/* Main Game WebView Container */}
      <GameWebView
        ref={webViewRef}
        activeMode={activeMode}
        serverUrl={serverUrl}
        onOrientationChange={setOrientation}
        onViewChange={(view, game) => {
          setCurrentView(view);
          setCurrentGame(game);
        }}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onError={() => setIsLoading(false)}
        onOpenSettings={() => setShowConfig(true)}
        onSwitchToOffline={handleSwitchToOffline}
      />

      {/* Loading Overlay with 1-Tap Offline Fallback */}
      <LoadingOverlay
        visible={isLoading}
        activeMode={activeMode}
        serverUrl={serverUrl}
        onSwitchToOffline={handleSwitchToOffline}
        onRetry={handleReload}
      />

      {/* Network & App Mode Modal */}
      <ConnectionModal
        visible={showConfig}
        onClose={() => setShowConfig(false)}
        activeMode={activeMode}
        inputUrl={inputUrl}
        onChangeInputUrl={setInputUrl}
        detectedIp={detectedIp}
        onConnect={handleConnect}
        onSwitchToOffline={handleSwitchToOffline}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg
  }
});
