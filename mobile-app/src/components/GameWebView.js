import React, { forwardRef } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { STANDALONE_HTML } from '../constants/standaloneBundle';
import { theme } from '../constants/theme';
import { MODES } from '../constants/config';

export const GameWebView = forwardRef(function GameWebView({
  activeMode,
  serverUrl,
  onOrientationChange,
  onViewChange,
  onLoadStart,
  onLoadEnd,
  onError,
  onOpenSettings,
  onSwitchToOffline
}, ref) {
  const isOffline = activeMode === MODES.OFFLINE;

  const handleMessage = async (event) => {
    try {
      const raw = event.nativeEvent.data;
      if (!raw) return;

      if (raw === 'LOCK_LANDSCAPE') {
        onOrientationChange?.(true);
        return;
      }
      if (raw === 'UNLOCK_ORIENTATION') {
        onOrientationChange?.(false);
        return;
      }

      const data = JSON.parse(raw);
      if (data.type === 'LOCK_LANDSCAPE') {
        onOrientationChange?.(true);
      } else if (data.type === 'UNLOCK_ORIENTATION') {
        onOrientationChange?.(false);
      } else if (data.type === 'VIEW_CHANGED') {
        onViewChange?.(data.view, data.game);
        if (data.game === 'mini-militia') {
          onOrientationChange?.(true);
        } else if (data.view !== 'game') {
          onOrientationChange?.(false);
        }
      }
    } catch (e) {
      // Fallback string checks
      if (event.nativeEvent?.data === 'LOCK_LANDSCAPE') {
        onOrientationChange?.(true);
      } else if (event.nativeEvent?.data === 'UNLOCK_ORIENTATION') {
        onOrientationChange?.(false);
      }
    }
  };

  const handleWebViewError = (syntheticEvent) => {
    onError?.();
    if (!isOffline) {
      Alert.alert(
        'Host Laptop Not Found',
        `Could not reach ${serverUrl}.\n\nMake sure 'npm start' is running on your laptop and phones are on the same Wi-Fi or phone hotspot.`,
        [
          { text: 'Configure IP', onPress: onOpenSettings },
          { text: 'Solo Practice', onPress: onSwitchToOffline },
          { text: 'Retry', onPress: () => ref.current?.reload() }
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={ref}
        source={
          isOffline
            ? { html: STANDALONE_HTML, baseUrl: 'http://localhost' }
            : { uri: serverUrl }
        }
        style={styles.webView}
        onMessage={handleMessage}
        onLoadStart={onLoadStart}
        onLoadEnd={onLoadEnd}
        onError={handleWebViewError}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        scalesPageToFit={false}
        originWhitelist={['*']}
        mixedContentMode="always"
        androidHardwareAccelerationDisabled={false}
        bounces={false}
        overScrollMode="never"
        cacheEnabled={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg
  },
  webView: {
    flex: 1,
    backgroundColor: theme.colors.bg
  }
});
