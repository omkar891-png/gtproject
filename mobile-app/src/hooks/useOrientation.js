import { useState, useCallback } from 'react';
import { StatusBar } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

export function useOrientation() {
  const [isLandscape, setIsLandscape] = useState(false);

  const setOrientation = useCallback(async (shouldLockLandscape) => {
    try {
      if (shouldLockLandscape) {
        setIsLandscape(true);
        StatusBar.setHidden(true, 'fade');
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } else {
        setIsLandscape(false);
        StatusBar.setHidden(false, 'fade');
        await ScreenOrientation.unlockAsync();
      }
    } catch (e) {
      console.warn('Orientation lock error:', e);
    }
  }, []);

  return { isLandscape, setOrientation };
}
