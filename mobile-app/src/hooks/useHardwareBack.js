import { useEffect } from 'react';
import { BackHandler, Alert, Platform } from 'react-native';

export function useHardwareBack({ currentView, currentGame, webViewRef }) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onBackPress = () => {
      // 1. If inside Mini Militia game, trigger in-game exit match
      if (currentGame === 'mini-militia') {
        webViewRef.current?.injectJavaScript(`
          if (window.miniMilitiaGame) window.miniMilitiaGame.exitMatch();
          true;
        `);
        return true;
      }

      // 2. If inside any active game container, return to lobby or home
      if (currentView === 'game') {
        webViewRef.current?.injectJavaScript(`
          if (typeof window.returnToLobbyAction === 'function') {
            window.returnToLobbyAction();
          } else if (window.lobby) {
            window.lobby.stopCurrentGame();
            window.lobby.showView('home');
          }
          true;
        `);
        return true;
      }

      // 3. If in lobby view, return to home view
      if (currentView === 'lobby') {
        webViewRef.current?.injectJavaScript(`
          if (window.network && window.network.roomId) {
            window.network.leaveRoom();
          }
          if (window.lobby) {
            window.lobby.showView('home');
          }
          true;
        `);
        return true;
      }

      // 4. If at home view, ask user to confirm exit
      Alert.alert(
        'Exit Sudarshan Arena',
        'Do you want to exit the game suite?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() }
        ]
      );
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [currentView, currentGame, webViewRef]);
}
