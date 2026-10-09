import { useState, useEffect, useCallback } from 'react';
import { MODES, DEFAULT_PORT } from '../constants/config';
import { getAutoDetectedHostIp, formatServerUrl } from '../utils/networkUtils';

export function useNetworkConfig() {
  const [activeMode, setActiveMode] = useState(MODES.SERVER);
  const [serverUrl, setServerUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [detectedIp, setDetectedIp] = useState('');

  // Discover development laptop IP automatically
  useEffect(() => {
    const ip = getAutoDetectedHostIp();
    setDetectedIp(ip);
    const initialUrl = `http://${ip}:${DEFAULT_PORT}`;
    setServerUrl(initialUrl);
    setInputUrl(`${ip}:${DEFAULT_PORT}`);
  }, []);

  const connectToServer = useCallback((customInput) => {
    const target = customInput || inputUrl;
    const formatted = formatServerUrl(target);
    setServerUrl(formatted);
    setActiveMode(MODES.SERVER);
  }, [inputUrl]);

  const switchToOffline = useCallback(() => {
    setActiveMode(MODES.OFFLINE);
  }, []);

  return {
    activeMode,
    serverUrl,
    inputUrl,
    setInputUrl,
    detectedIp,
    connectToServer,
    switchToOffline,
    isOffline: activeMode === MODES.OFFLINE
  };
}
