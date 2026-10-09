import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { MODES } from '../constants/config';

export function HeaderBar({
  activeMode,
  serverUrl,
  onOpenSettings,
  onReload,
  visible = true
}) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  const isServer = activeMode === MODES.SERVER;
  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 12);

  // Short display label for IP
  const urlDisplay = serverUrl ? serverUrl.replace(/^https?:\/\//i, '') : '';

  return (
    <View style={[styles.headerContainer, { top: topInset + 6 }]}>
      <TouchableOpacity
        style={styles.modePill}
        onPress={onOpenSettings}
        activeOpacity={0.8}
      >
        <View style={[styles.statusDot, isServer ? styles.dotGreen : styles.dotCyan]} />
        <Text style={styles.modeText}>
          {isServer ? `🌐 LAN (${urlDisplay})` : '📱 Solo Offline'}
        </Text>
      </TouchableOpacity>

      <View style={styles.actionGroup}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onReload}
          activeOpacity={0.7}
          title="Reload Game Screen"
        >
          <Text style={styles.iconText}>🔄</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onOpenSettings}
          activeOpacity={0.7}
          title="App & Network Settings"
        >
          <Text style={styles.iconText}>⚙️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    pointerEvents: 'box-none'
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderNeon,
    borderRadius: theme.radii.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
    ...theme.shadows.neonCyan
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  dotGreen: {
    backgroundColor: theme.colors.emerald,
    shadowColor: theme.colors.emerald,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6
  },
  dotCyan: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6
  },
  modeText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    maxWidth: 210
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.neonCyan
  },
  iconText: {
    fontSize: 14
  }
});
