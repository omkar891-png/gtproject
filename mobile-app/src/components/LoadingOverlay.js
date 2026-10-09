import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { theme } from '../constants/theme';
import { MODES } from '../constants/config';

export function LoadingOverlay({
  visible,
  activeMode,
  serverUrl,
  onSwitchToOffline,
  onRetry
}) {
  const [showFallbackAction, setShowFallbackAction] = useState(false);

  useEffect(() => {
    let timer;
    if (visible && activeMode === MODES.SERVER) {
      setShowFallbackAction(false);
      // After 3.5 seconds of loading, show the quick fallback button
      timer = setTimeout(() => {
        setShowFallbackAction(true);
      }, 3500);
    } else {
      setShowFallbackAction(false);
    }
    return () => clearTimeout(timer);
  }, [visible, activeMode]);

  if (!visible) return null;

  const isServer = activeMode === MODES.SERVER;

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      
      <Text style={styles.loadingTitle}>
        {isServer ? 'Connecting to Host Laptop...' : 'Loading Sudarshan Arena...'}
      </Text>

      {isServer && (
        <Text style={styles.urlHint}>
          Target: {serverUrl || 'Detecting server...'}
        </Text>
      )}

      {showFallbackAction && (
        <View style={styles.fallbackBox}>
          <Text style={styles.fallbackPrompt}>Taking longer than usual?</Text>
          <View style={styles.fallbackBtnRow}>
            <TouchableOpacity
              style={styles.offlineBtn}
              onPress={onSwitchToOffline}
              activeOpacity={0.8}
            >
              <Text style={styles.offlineBtnText}>📱 PLAY SOLO OFFLINE</Text>
            </TouchableOpacity>
            {onRetry && (
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={onRetry}
                activeOpacity={0.8}
              >
                <Text style={styles.retryBtnText}>RETRY 🔄</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    inset: 0,
    backgroundColor: theme.colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 99
  },
  loadingTitle: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 16,
    letterSpacing: 0.5,
    textAlign: 'center'
  },
  urlHint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center'
  },
  fallbackBox: {
    marginTop: 28,
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    padding: 16,
    width: '100%',
    maxWidth: 320
  },
  fallbackPrompt: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: 12,
    fontWeight: '600'
  },
  fallbackBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%'
  },
  offlineBtn: {
    flex: 1,
    backgroundColor: theme.colors.emerald,
    borderRadius: theme.radii.sm,
    paddingVertical: 10,
    alignItems: 'center'
  },
  offlineBtnText: {
    color: '#050811',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.5
  },
  retryBtn: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center'
  },
  retryBtnText: {
    color: theme.colors.primary,
    fontWeight: '800',
    fontSize: 11
  }
});
