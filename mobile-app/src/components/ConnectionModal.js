import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { theme } from '../constants/theme';
import { MODES, DEFAULT_PORT } from '../constants/config';

export function ConnectionModal({
  visible,
  onClose,
  activeMode,
  inputUrl,
  onChangeInputUrl,
  detectedIp,
  onConnect,
  onSwitchToOffline
}) {
  const isServer = activeMode === MODES.SERVER;
  const isOffline = activeMode === MODES.OFFLINE;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>⚡ WI-FI HOTSPOT & APP MODE</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <Text style={styles.modalSubtitle}>
              Connect phones & laptops over local Wi-Fi or phone hotspot with zero mobile data!
            </Text>

            {/* Mode 1: Wi-Fi Hotspot Multiplayer */}
            <View style={[styles.sectionCard, isServer && styles.sectionCardActive]}>
              <Text style={styles.sectionTitle}>🌐 Wi-Fi Hotspot Multiplayer (Recommended)</Text>
              <Text style={styles.sectionDesc}>
                Play together on multiple phones and laptops in real-time over the same Wi-Fi router or phone mobile hotspot.
              </Text>

              {detectedIp ? (
                <View style={styles.detectedIpBanner}>
                  <View style={styles.detectedIpTextWrap}>
                    <Text style={styles.detectedLabel}>AUTO-DETECTED LAPTOP IP:</Text>
                    <Text style={styles.detectedValue}>{detectedIp}:{DEFAULT_PORT}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.useDetectedBtn}
                    onPress={() => onConnect(`${detectedIp}:${DEFAULT_PORT}`)}
                  >
                    <Text style={styles.useDetectedText}>USE IP ⚡</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <Text style={styles.inputLabel}>Host Laptop / Server IP & Port:</Text>
              <TextInput
                style={styles.textInput}
                value={inputUrl}
                onChangeText={onChangeInputUrl}
                placeholder={`${detectedIp || '192.168.1.102'}:${DEFAULT_PORT}`}
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={styles.connectBtn}
                onPress={() => onConnect(inputUrl)}
                activeOpacity={0.85}
              >
                <Text style={styles.connectBtnText}>CONNECT TO WI-FI / HOTSPOT</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Mode 2: Solo Offline Mode */}
            <TouchableOpacity
              style={[styles.sectionCard, isOffline && styles.sectionCardActive]}
              onPress={onSwitchToOffline}
              activeOpacity={0.8}
            >
              <Text style={styles.sectionTitle}>📱 Solo Practice Offline Mode</Text>
              <Text style={styles.sectionDesc}>
                Single-phone offline practice against AI bots (Mini Militia, Ludo King, Cyber Chess, Neon Uno, Carrom, Connect 4) with zero server needed.
              </Text>
              <View style={[styles.offlineBadge, isOffline && styles.offlineBadgeActive]}>
                <Text style={styles.offlineBadgeText}>
                  {isOffline ? 'ACTIVE MODE ✓' : 'TAP TO SWITCH TO SOLO OFFLINE'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Connection Tips */}
            <View style={styles.tipsBox}>
              <Text style={styles.tipsTitle}>💡 QUICK CONNECTION TIPS:</Text>
              <Text style={styles.tipsItem}>1. Run `npm start` in your project folder on your laptop.</Text>
              <Text style={styles.tipsItem}>2. Connect both phone and laptop to same Wi-Fi or phone hotspot.</Text>
              <Text style={styles.tipsItem}>3. Scan the QR code or tap the auto-detected IP above!</Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContent: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.radii.lg,
    padding: 20,
    ...theme.shadows.neonCyan
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.primary,
    letterSpacing: 1
  },
  modalCloseText: {
    fontSize: 20,
    color: theme.colors.textSecondary,
    padding: 4
  },
  modalSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18
  },
  sectionCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    padding: 14,
    marginBottom: 10
  },
  sectionCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(0, 242, 254, 0.08)'
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4
  },
  sectionDesc: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 16,
    marginBottom: 10
  },
  detectedIpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.radii.sm,
    padding: 8,
    marginBottom: 10
  },
  detectedIpTextWrap: {
    flex: 1
  },
  detectedLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 0.5
  },
  detectedValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff'
  },
  useDetectedBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.sm,
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  useDetectedText: {
    color: '#050811',
    fontWeight: '900',
    fontSize: 11
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 4
  },
  textInput: {
    backgroundColor: theme.colors.surfaceInput,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
    marginBottom: 10
  },
  connectBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.sm,
    paddingVertical: 12,
    alignItems: 'center',
    ...theme.shadows.neonCyan
  },
  connectBtnText: {
    color: '#050811',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 6
  },
  offlineBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: theme.radii.sm,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 4
  },
  offlineBadgeActive: {
    backgroundColor: theme.colors.emerald,
  },
  offlineBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5
  },
  tipsBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: theme.radii.sm,
    padding: 10,
    marginTop: 10
  },
  tipsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.gold,
    marginBottom: 4
  },
  tipsItem: {
    fontSize: 10,
    color: theme.colors.textMuted,
    lineHeight: 14
  }
});
