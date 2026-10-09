// WebSocket and Network Manager for Offline Local Multiplayer
class NetworkManager {
  constructor() {
    this.ws = null;
    this.playerId = null;
    this.roomId = null;
    this.isHost = false;
    this.currentRoom = null;
    this.listeners = new Map();
    this.reconnectTimeout = null;
    this.isConnected = false;
    this.pingInterval = null;
    this.customHost = null;
  }

  getServerHost() {
    if (this.customHost) return this.customHost;
    const saved = localStorage.getItem('sudarshan_server_host');
    if (saved) return saved;
    if (typeof window !== 'undefined' && window.location && window.location.host && window.location.host !== '' && window.location.protocol !== 'file:') {
      return window.location.host;
    }
    return '192.168.1.102:3000';
  }

  setServerHost(host) {
    if (!host) return;
    let clean = host.replace(/^https?:\/\//i, '').replace(/^wss?:\/\//i, '').replace(/\/.*$/, '').trim();
    this.customHost = clean;
    localStorage.setItem('sudarshan_server_host', clean);
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.isConnected = false;
  }

  connect() {
    // If already open, resolve immediately
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    // If currently connecting, wait for it or timeout
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      return new Promise((resolve, reject) => {
        let isSettled = false;
        const timeout = setTimeout(() => {
          if (!isSettled) {
            isSettled = true;
            clearInterval(checkOpen);
            reject(new Error('WebSocket connection timed out'));
          }
        }, 5000);

        const checkOpen = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            if (!isSettled) {
              isSettled = true;
              clearInterval(checkOpen);
              clearTimeout(timeout);
              resolve();
            }
          } else if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
            if (!isSettled) {
              isSettled = true;
              clearInterval(checkOpen);
              clearTimeout(timeout);
              reject(new Error('WebSocket closed while connecting'));
            }
          }
        }, 50);
      });
    }

    return new Promise((resolve, reject) => {
      let isSettled = false;
      const host = this.getServerHost();
      const protocol = (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:' && !host.includes('localhost') && !host.startsWith('192.168.')) ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${host}`;

      const timeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          this.isConnected = false;
          this.trigger('CONNECTION_STATUS', { connected: false, error: 'Connection timed out' });
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            try { this.ws.close(); } catch (e) {}
          }
          reject(new Error(`Could not connect to game server at ${wsUrl}. Check if server is running (npm start) and Wi-Fi / Hotspot is connected.`));
        }
      }, 5000);

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timeout);
            this.isConnected = true;
            this.trigger('CONNECTION_STATUS', { connected: true, host: wsUrl });
            this.startHeartbeat();
            resolve();
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleIncoming(data);
          } catch (e) {
            console.error('Failed to parse WebSocket message', e);
          }
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.trigger('CONNECTION_STATUS', { connected: false });
          this.stopHeartbeat();
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timeout);
            reject(new Error(`Connection to game server at ${wsUrl} closed. Make sure 'npm start' is running on laptop.`));
          }
          this.scheduleReconnect();
        };

        this.ws.onerror = (err) => {
          console.warn('WebSocket error on ' + wsUrl, err);
          this.isConnected = false;
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timeout);
            reject(new Error(`Failed to reach game server at ${wsUrl}. Make sure 'npm start' is running on your laptop and phones are on the same Wi-Fi/Hotspot.`));
          }
        };
      } catch (err) {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          reject(err);
        }
      }
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (!this.isConnected && this.roomId) {
        this.connect().then(() => {
          const savedProfile = this.getProfile();
          this.joinRoom(this.roomId, savedProfile.name, savedProfile.avatar);
        }).catch(() => {});
      }
    }, 2000);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'PING' });
      }
    }, 15000);
  }

  stopHeartbeat() {
    if (this.pingInterval) clearInterval(this.pingInterval);
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const list = this.listeners.get(event).filter(cb => cb !== callback);
    this.listeners.set(event, list);
  }

  trigger(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }

  handleIncoming(data) {
    switch (data.type) {
      case 'CONNECTED':
        this.playerId = data.playerId;
        this.trigger('CONNECTED', data);
        break;

      case 'ROOM_JOINED':
        this.currentRoom = data.room;
        this.roomId = data.room.id;
        this.isHost = data.isHost;
        this.trigger('ROOM_JOINED', data);
        break;

      case 'ROOM_UPDATE':
        this.currentRoom = data.room;
        this.isHost = data.room.hostId === this.playerId;
        this.trigger('ROOM_UPDATE', data);
        break;

      case 'GAME_STARTED':
        this.currentRoom = data.room;
        this.trigger('GAME_STARTED', data);
        break;

      case 'GAME_SYNC':
        this.trigger('GAME_SYNC', data);
        break;

      case 'MM_EVENT':
        this.trigger('MM_EVENT', data);
        break;

      case 'CHAT_MESSAGE':
        this.trigger('CHAT_MESSAGE', data);
        break;

      case 'LEFT_ROOM':
        this.currentRoom = null;
        this.roomId = null;
        this.isHost = false;
        this.trigger('LEFT_ROOM');
        break;

      case 'RETURNED_TO_LOBBY':
        this.currentRoom = data.room;
        this.trigger('RETURNED_TO_LOBBY', data);
        break;

      case 'ERROR':
        this.trigger('ERROR', data);
        break;
    }
  }

  getMaxPlayers(game) {
    switch (game) {
      case 'chess': return 2;
      case 'connect4': return 2;
      case 'carrom': return 4;
      case 'ludo': return 4;
      case 'bomberman': return 4;
      case 'uno': return 6;
      case 'chain-reaction': return 8;
      case 'mini-militia': return 8;
      case 'slither': return 8;
      default: return 4;
    }
  }

  createLocalRoom(game = 'chess', playerName = 'Player', avatar = '🦊', roomName = '') {
    this.playerId = 'p_local_1';
    this.roomId = 'LOCAL';
    this.isHost = true;
    const room = {
      id: 'LOCAL',
      name: roomName || `${playerName}'s Room`,
      game,
      hostId: this.playerId,
      maxPlayers: this.getMaxPlayers(game),
      players: [{
        id: this.playerId,
        name: playerName,
        avatar: avatar,
        ready: true,
        isBot: false,
        score: 0
      }],
      status: 'lobby',
      isOffline: true
    };
    this.currentRoom = room;
    this.trigger('ROOM_JOINED', { room, isHost: true, playerId: this.playerId });
    return room;
  }

  // Room Actions
  createRoom(game = 'chess', playerName = 'Player', avatar = '🦊', roomName = '') {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'CREATE_ROOM',
        game,
        playerName,
        avatar,
        roomName
      });
    } else {
      this.createLocalRoom(game, playerName, avatar, roomName);
    }
  }

  joinRoom(roomId, playerName = 'Player', avatar = '🐼') {
    this.send({
      type: 'JOIN_ROOM',
      roomId,
      playerName,
      avatar
    });
  }

  leaveRoom() {
    if (this.currentRoom && this.currentRoom.isOffline) {
      this.currentRoom = null;
      this.roomId = null;
      this.isHost = false;
      this.trigger('LEFT_ROOM');
      return;
    }
    this.send({ type: 'LEAVE_ROOM' });
  }

  selectGame(game) {
    if (this.currentRoom && this.currentRoom.isOffline) {
      this.currentRoom.game = game;
      this.currentRoom.maxPlayers = this.getMaxPlayers(game);
      while (this.currentRoom.players.length > this.currentRoom.maxPlayers) {
        const botIdx = this.currentRoom.players.findLastIndex(p => p.isBot);
        if (botIdx !== -1) this.currentRoom.players.splice(botIdx, 1);
        else break;
      }
      this.trigger('ROOM_UPDATE', {
        room: this.currentRoom,
        notification: `Game changed to ${game}`
      });
      return;
    }
    this.send({ type: 'SELECT_GAME', game });
  }

  addBot() {
    if (this.currentRoom && this.currentRoom.isOffline) {
      if (this.currentRoom.players.length < this.currentRoom.maxPlayers) {
        const botNames = ['CyberBot', 'RoboPro', 'PixelBot', 'AlphaBot', 'GhostBot', 'Quantum'];
        const botAvatars = ['🤖', '👾', '🦾', '⚡', '🛸', '🎯'];
        const botIndex = this.currentRoom.players.filter(p => p.isBot).length;
        const bot = {
          id: 'bot_' + Math.random().toString(36).substr(2, 6),
          name: botNames[botIndex % botNames.length],
          avatar: botAvatars[botIndex % botAvatars.length],
          ready: true,
          isBot: true,
          score: 0
        };
        this.currentRoom.players.push(bot);
        this.trigger('ROOM_UPDATE', {
          room: this.currentRoom,
          notification: `Bot ${bot.name} added!`
        });
      }
      return;
    }
    this.send({ type: 'ADD_BOT' });
  }

  removeBot() {
    if (this.currentRoom && this.currentRoom.isOffline) {
      const botIdx = this.currentRoom.players.findLastIndex(p => p.isBot);
      if (botIdx !== -1) {
        const removed = this.currentRoom.players.splice(botIdx, 1)[0];
        this.trigger('ROOM_UPDATE', {
          room: this.currentRoom,
          notification: `${removed.name} removed.`
        });
      }
      return;
    }
    this.send({ type: 'REMOVE_BOT' });
  }

  toggleReady() {
    if (this.currentRoom && this.currentRoom.isOffline) {
      const p = this.currentRoom.players[0];
      if (p) p.ready = !p.ready;
      this.trigger('ROOM_UPDATE', { room: this.currentRoom });
      return;
    }
    this.send({ type: 'TOGGLE_READY' });
  }

  startGame() {
    if (this.currentRoom && this.currentRoom.isOffline) {
      this.currentRoom.status = 'playing';
      this.trigger('GAME_STARTED', {
        room: this.currentRoom,
        gameState: null
      });
      return;
    }
    this.send({ type: 'START_GAME' });
  }

  returnToLobby() {
    if (this.currentRoom && this.currentRoom.isOffline) {
      this.currentRoom.status = 'lobby';
      this.trigger('RETURNED_TO_LOBBY', { room: this.currentRoom });
      return;
    }
    this.send({ type: 'RETURN_TO_LOBBY' });
  }

  sendChat(text) {
    this.send({ type: 'CHAT_MESSAGE', text });
  }

  sendGameAction(action, payload) {
    this.send({
      type: 'GAME_ACTION',
      action,
      payload
    });
  }

  sendMiniMilitiaEvent(event, payload) {
    this.send({
      type: 'GAME_ACTION',
      event,
      payload
    });
  }

  // Profile persistence
  getProfile() {
    const saved = localStorage.getItem('multiplayer_profile');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    const defaultProfile = {
      name: 'Player ' + Math.floor(Math.random() * 900 + 100),
      avatar: ['🦊', '🐼', '🐯', '🦁', '🐺', '🐉', '🤖', '👾'][Math.floor(Math.random() * 8)]
    };
    this.saveProfile(defaultProfile);
    return defaultProfile;
  }

  saveProfile(profile) {
    localStorage.setItem('multiplayer_profile', JSON.stringify(profile));
  }
}

window.network = new NetworkManager();
