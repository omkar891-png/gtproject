import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';
import { DEFAULT_PORT, DEFAULT_FALLBACK_IP } from '../constants/config';

/**
 * Automatically discovers development machine / laptop IP address
 * when running via Expo Go.
 */
export function getAutoDetectedHostIp() {
  try {
    // 1. Try Expo Constants hostUri (e.g. "192.168.1.15:8081")
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return ip;
      }
    }

    // 2. Try manifest2 expoGo debuggerHost
    const debuggerHost = Constants.manifest2?.extra?.expoGo?.debuggerHost;
    if (debuggerHost) {
      const ip = debuggerHost.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return ip;
      }
    }

    // 3. Try NativeModules scriptURL
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return match[1];
      }
    }
  } catch (err) {
    console.warn('Auto host IP detection notice:', err);
  }

  return DEFAULT_FALLBACK_IP;
}

/**
 * Formats user input into a clean HTTP URL
 */
export function formatServerUrl(input, port = DEFAULT_PORT) {
  if (!input) return `http://${DEFAULT_FALLBACK_IP}:${port}`;
  let clean = input.trim();
  
  // Remove protocol prefixes if present
  clean = clean.replace(/^https?:\/\//i, '').replace(/^wss?:\/\//i, '').replace(/\/.*$/, '');
  
  // Add port if missing
  if (!clean.includes(':')) {
    clean = `${clean}:${port}`;
  }

  return `http://${clean}`;
}

/**
 * Quickly tests whether a Sudarshan game server is reachable
 */
export async function testServerConnection(url, timeoutMs = 3500) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const checkUrl = `${url.replace(/\/$/, '')}/api/network-info`;
    const response = await fetch(checkUrl, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timer);
    return response.ok;
  } catch (e) {
    return false;
  }
}
