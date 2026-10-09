// UI Controller & Lobby Management for Offline Multiplayer Suite
class LobbyController {
  constructor() {
    this.currentView = 'home';
    this.activeGame = null;
    this.networkInfo = null;
    this.profile = window.network.getProfile();
    this.selectedOnboardingAvatar = this.profile.avatar || '🦊';
    this.selectedSettingsAvatar = this.profile.avatar || '🦊';
  }

  init() {
    this.bindDOM();
    this.fetchNetworkInfo();
    this.setupNetworkEvents();
    this.updateHeaderProfileUI();
    this.showView('home');
    this.checkFirstTimeUser();
    this.checkAutoJoinRoom();
  }

  checkAutoJoinRoom() {
    try {
      const params = new URLSearchParams(window.location.search);
      const room = params.get('room');
      if (room && room.trim()) {
        const cleanRoom = room.trim().toUpperCase();
        const input = document.getElementById('join-room-code-input');
        if (input) input.value = cleanRoom;
        this.showGlobalToast(`📲 Auto-joining room ${cleanRoom} from link/QR...`);
        setTimeout(() => {
          this.joinRoomByCode(cleanRoom);
        }, 600);
      }
    } catch (e) {
      console.warn('Auto-join check error:', e);
    }
  }

  checkFirstTimeUser() {
    const onboarded = localStorage.getItem('sudarshan_onboarded');
    if (!onboarded) {
      setTimeout(() => {
        this.openOnboardingModal();
      }, 250);
    }
  }

  openOnboardingModal() {
    const modal = document.getElementById('onboarding-modal');
    if (!modal) return;
    const tagInput = document.getElementById('onboarding-tag-input');
    if (tagInput) {
      const coolTags = ['Shadow', 'Phoenix', 'Viper', 'Thunder', 'Titan', 'Ghost', 'Blaze', 'Falcon', 'Raptor', 'Vortex', 'Cyber'];
      const defaultTag = coolTags[Math.floor(Math.random() * coolTags.length)] + Math.floor(Math.random() * 89 + 10);
      tagInput.value = (this.profile.name && !this.profile.name.startsWith('Player ')) ? this.profile.name : defaultTag;
    }
    this.selectedOnboardingAvatar = this.profile.avatar || '🦊';
    const onbAvatars = document.querySelectorAll('#onboarding-avatar-grid .avatar-cell');
    onbAvatars.forEach(c => {
      c.classList.toggle('selected', (c.dataset.avatar || c.innerText) === this.selectedOnboardingAvatar);
    });
    modal.classList.remove('hidden');
    if (tagInput) tagInput.focus();
  }

  submitOnboarding() {
    const tagInput = document.getElementById('onboarding-tag-input');
    const tag = (tagInput ? tagInput.value.trim() : '') || ('Player' + Math.floor(Math.random() * 899 + 100));
    const avatar = this.selectedOnboardingAvatar || '🦊';

    this.profile = { name: tag, avatar };
    window.network.saveProfile(this.profile);
    localStorage.setItem('sudarshan_onboarded', 'true');

    this.updateHeaderProfileUI();
    const modal = document.getElementById('onboarding-modal');
    if (modal) modal.classList.add('hidden');

    if (window.soundFx && window.soundFx.playVictory) {
      window.soundFx.playVictory();
    }
    this.showGlobalToast(`⚔️ Welcome ${tag}! Choose your battle arena!`);
  }

  openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    this.profile = window.network.getProfile();
    this.selectedSettingsAvatar = this.profile.avatar || '🦊';

    const tagInput = document.getElementById('settings-tag-input');
    if (tagInput) tagInput.value = this.profile.name;

    const prevAv = document.getElementById('settings-preview-avatar');
    if (prevAv) prevAv.innerText = this.selectedSettingsAvatar;

    const prevName = document.getElementById('settings-preview-name');
    if (prevName) prevName.innerText = this.profile.name;

    const setAvatars = document.querySelectorAll('#settings-avatar-grid .avatar-cell');
    setAvatars.forEach(c => {
      c.classList.toggle('selected', (c.dataset.avatar || c.innerText) === this.selectedSettingsAvatar);
    });

    this.syncSettingsAudioState();
    modal.classList.remove('hidden');
  }

  closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.add('hidden');
  }

  saveSettings() {
    const tagInput = document.getElementById('settings-tag-input');
    const tag = (tagInput ? tagInput.value.trim() : '') || this.profile.name || 'Player';
    const avatar = this.selectedSettingsAvatar || this.profile.avatar || '🦊';

    this.profile = { name: tag, avatar };
    window.network.saveProfile(this.profile);

    this.updateHeaderProfileUI();
    this.closeSettingsModal();

    if (window.soundFx && window.soundFx.playLudoSafeStar) {
      window.soundFx.playLudoSafeStar();
    }
    this.showGlobalToast(`✅ Profile updated! Gamer Tag: #${tag}`);
  }

  syncSettingsAudioState() {
    const btn = document.getElementById('settings-sound-btn');
    if (btn && window.soundFx) {
      btn.innerText = window.soundFx.muted ? 'MUTED 🔇' : 'ON 🔊';
      btn.classList.toggle('btn-primary', !window.soundFx.muted);
      btn.classList.toggle('btn-secondary', window.soundFx.muted);
    }
  }

  updateHeaderProfileUI() {
    const avEl = document.getElementById('header-user-avatar');
    const nameEl = document.getElementById('header-user-name');
    if (avEl) avEl.innerText = this.profile.avatar || '🦊';
    if (nameEl) nameEl.innerText = this.profile.name || 'Player';
  }

  async fetchNetworkInfo(room = null) {
    try {
      const serverHost = window.network.getServerHost();
      const protocol = (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:') ? 'https:' : 'http:';
      const apiUrl = `${protocol}//${serverHost}/api/network-info${room ? `?room=${room}` : ''}`;

      const res = await fetch(apiUrl);
      this.networkInfo = await res.json();
      this.updateNetworkModal(room);
      this.updateHomeHotspotCard();
    } catch (e) {
      console.warn('Network info unavailable offline', e);
      this.updateHomeHotspotCardOffline();
    }
  }

  updateHomeHotspotCard() {
    if (!this.networkInfo) return;
    const badge = document.getElementById('home-hotspot-badge');
    const urlEl = document.getElementById('home-hotspot-url-text');
    const headerBadge = document.getElementById('net-status-badge');
    if (badge) {
      badge.className = 'hotspot-status-pill online';
      badge.innerHTML = `<span class="status-dot"></span> LOCAL HOTSPOT ACTIVE`;
    }
    if (headerBadge) {
      headerBadge.className = 'status-badge online';
      headerBadge.innerHTML = `<span class="status-dot"></span> <span class="status-text">LOCAL HOTSPOT</span>`;
    }
    if (urlEl) {
      urlEl.innerText = this.networkInfo.url;
    }
  }

  updateHomeHotspotCardOffline() {
    const badge = document.getElementById('home-hotspot-badge');
    const urlEl = document.getElementById('home-hotspot-url-text');
    const headerBadge = document.getElementById('net-status-badge');
    const currentHost = window.network.getServerHost();
    if (badge) {
      badge.className = 'hotspot-status-pill offline';
      badge.innerHTML = `<span class="status-dot offline-dot"></span> SERVER NOT DETECTED`;
    }
    if (headerBadge) {
      headerBadge.className = 'status-badge offline';
      headerBadge.innerHTML = `<span class="status-dot offline-dot"></span> <span class="status-text">OFFLINE</span>`;
    }
    if (urlEl) {
      urlEl.innerText = `Run 'npm start' on laptop (Target: http://${currentHost})`;
    }
  }

  updateNetworkModal(room = null) {
    if (!this.networkInfo) return;
    const titleEl = document.getElementById('qr-modal-title');
    const urlEl = document.getElementById('network-url-text');
    const qrImg = document.getElementById('network-qr-img');
    const ipListEl = document.getElementById('network-ips-list');

    if (titleEl) {
      titleEl.innerText = room ? `CONNECT PHONES TO ROOM [${room}]` : 'CONNECT YOUR PHONES (OFFLINE)';
    }
    if (urlEl) urlEl.innerText = this.networkInfo.url;
    if (qrImg) qrImg.src = this.networkInfo.qrDataUrl;
    if (ipListEl && this.networkInfo.ips) {
      ipListEl.innerHTML = this.networkInfo.ips
        .map(i => `<li><b>${i.name}:</b> http://${i.address}:${this.networkInfo.port}${room ? `?room=${room}` : ''}</li>`)
        .join('');
    }
  }

  setupNetworkEvents() {
    window.network.on('ROOM_JOINED', (data) => {
      this.showView('lobby');
      this.renderLobby(data.room, data.isHost);
    });

    window.network.on('ROOM_UPDATE', (data) => {
      if (this.currentView === 'lobby') {
        this.renderLobby(data.room, data.room.hostId === window.network.playerId);
      }
      if (data.notification) {
        this.showGlobalToast(data.notification);
      }
    });

    window.network.on('GAME_STARTED', (data) => {
      this.launchGame(data.room.game, data.room, data.gameState);
    });

    window.network.on('GAME_SYNC', (data) => {
      this.handleRemoteGameSync(data);
    });

    window.network.on('MM_EVENT', (data) => {
      this.handleMiniMilitiaRemoteEvent(data);
    });

    window.network.on('CHAT_MESSAGE', (data) => {
      this.appendChatMessage(data);
    });

    window.network.on('RETURNED_TO_LOBBY', (data) => {
      this.stopCurrentGame();
      this.showView('lobby');
      this.renderLobby(data.room, data.room.hostId === window.network.playerId);
    });

    window.network.on('ERROR', (data) => {
      alert(data.message);
    });
  }

  bindDOM() {
    // Tab / View buttons
    document.querySelectorAll('.game-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const game = e.currentTarget.dataset.game;
        const mode = e.currentTarget.dataset.mode;
        if (mode === 'solo') {
          this.startSoloGame(game);
        } else {
          this.openCreateRoomModal(game);
        }
      });
    });

    // Onboarding avatar picker selection
    const onbAvatars = document.querySelectorAll('#onboarding-avatar-grid .avatar-cell');
    onbAvatars.forEach(cell => {
      cell.addEventListener('click', () => {
        onbAvatars.forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
        this.selectedOnboardingAvatar = cell.dataset.avatar || cell.innerText;
        if (window.soundFx && window.soundFx.playLudoPop) window.soundFx.playLudoPop();
      });
    });

    const onbInput = document.getElementById('onboarding-tag-input');
    if (onbInput) {
      onbInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.submitOnboarding();
      });
    }

    // Settings avatar picker selection
    const setAvatars = document.querySelectorAll('#settings-avatar-grid .avatar-cell');
    setAvatars.forEach(cell => {
      cell.addEventListener('click', () => {
        setAvatars.forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
        this.selectedSettingsAvatar = cell.dataset.avatar || cell.innerText;
        const prevAv = document.getElementById('settings-preview-avatar');
        if (prevAv) prevAv.innerText = this.selectedSettingsAvatar;
        if (window.soundFx && window.soundFx.playLudoPop) window.soundFx.playLudoPop();
      });
    });

    const setInput = document.getElementById('settings-tag-input');
    if (setInput) {
      setInput.addEventListener('input', () => {
        const prevName = document.getElementById('settings-preview-name');
        if (prevName) prevName.innerText = setInput.value.trim() || 'Player';
      });
      setInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.saveSettings();
      });
    }

    // Chat input
    const chatInput = document.getElementById('lobby-chat-input');
    const chatBtn = document.getElementById('lobby-chat-send');
    if (chatBtn && chatInput) {
      const send = () => {
        const text = chatInput.value.trim();
        if (text) {
          window.network.sendChat(text);
          chatInput.value = '';
        }
      };
      chatBtn.addEventListener('click', send);
      chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') send(); });
    }
  }

  showView(viewName) {
    this.currentView = viewName;
    ['home-view', 'lobby-view', 'game-view'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', id !== `${viewName}-view`);
    });
    if (window.ReactNativeWebView) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'VIEW_CHANGED', view: viewName, game: this.activeGame }));
      } catch (e) {}
    }
  }

  openCreateRoomModal(game = 'chess') {
    this.profile = window.network.getProfile();
    this.showGlobalToast(`⚔️ Creating ${this.getGameName(game)} room...`);
    window.network.connect().then(() => {
      window.network.createRoom(game, this.profile.name, this.profile.avatar);
    }).catch(err => {
      console.warn('Network offline or host not reachable, creating local offline room', err);
      window.network.createLocalRoom(game, this.profile.name, this.profile.avatar);
      this.showGlobalToast(`🎮 Offline Mode: Created Local Room with Bots!`);
    });
  }

  joinRoomByCode(codeOverride = null) {
    const input = document.getElementById('join-room-code-input');
    const code = (codeOverride || (input ? input.value.trim() : '')).toUpperCase().trim();
    if (!code) {
      alert('Please enter a 4-character Room Code!');
      return;
    }
    this.profile = window.network.getProfile();
    this.showGlobalToast(`🔑 Joining Room ${code}...`);
    window.network.connect().then(() => {
      window.network.joinRoom(code, this.profile.name, this.profile.avatar);
    }).catch(err => {
      console.warn('Network offline', err);
      this.showConnectionErrorModal(null, err.message);
    });
  }

  startSoloGame(game) {
    this.profile = window.network.getProfile();
    const mockRoom = {
      id: 'SOLO',
      game,
      hostId: 'p_solo',
      players: [{ id: 'p_solo', name: this.profile.name, avatar: this.profile.avatar, isBot: false }]
    };
    this.launchGame(game, mockRoom, null, true);
  }

  launchGame(game, room, gameState = null, isSolo = false) {
    this.activeGame = game;
    this.showView('game');

    const activeTitle = document.getElementById('game-active-title');
    if (activeTitle) activeTitle.innerText = this.getGameName(game).toUpperCase();

    // Hide all 9 game containers first
    ['chess-container', 'uno-container', 'cr-container', 'mm-container', 'ludo-container', 'slither-container', 'bomberman-container', 'carrom-container', 'connect4-container'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });

    const isHost = room.hostId === window.network.playerId || isSolo;
    const myId = isSolo ? 'p_solo' : window.network.playerId;

    switch (game) {
      case 'chess': {
        const el = document.getElementById('chess-container');
        if (el) el.classList.remove('hidden');
        const myColor = isSolo ? 'white' : (room.players[0].id === myId ? 'white' : 'black');

        const topP = isSolo ? { name: 'CyberBot (1500)', avatar: '🤖' } : (room.players[1] || { name: 'Waiting for player...', avatar: '⏳' });
        const bottomP = room.players.find(p => p.id === myId) || room.players[0] || { name: 'You', avatar: '🦊' };

        const topName = document.getElementById('chess-top-name');
        const topAv = document.getElementById('chess-top-avatar');
        const bottomName = document.getElementById('chess-bottom-name');
        const bottomAv = document.getElementById('chess-bottom-avatar');

        if (topName) topName.innerText = topP.name;
        if (topAv) topAv.innerText = topP.avatar;
        if (bottomName) bottomName.innerText = bottomP.name;
        if (bottomAv) bottomAv.innerText = bottomP.avatar;

        window.chessGame.init(myColor, isSolo || room.players.some(p => p.isBot));
        break;
      }

      case 'uno': {
        const el = document.getElementById('uno-container');
        if (el) el.classList.remove('hidden');
        if (isSolo) {
          window.unoGame.initLocalGame(room.players[0], 3);
        } else if (gameState) {
          window.unoGame.initFromSync(gameState, myId, room.players);
        }
        break;
      }

      case 'chain-reaction': {
        const el = document.getElementById('cr-container');
        if (el) el.classList.remove('hidden');
        if (isSolo) {
          window.chainReactionGame.initLocalGame(room.players[0], 3);
        } else {
          window.chainReactionGame.initFromSync(room.players, myId);
        }
        break;
      }

      case 'mini-militia': {
        const el = document.getElementById('mm-container');
        if (el) el.classList.remove('hidden');
        document.body.classList.add('mm-fullscreen-active');
        const myP = room.players.find(p => p.id === myId) || room.players[0];
        window.miniMilitiaGame.init(myP, room.players, isSolo);
        break;
      }

      case 'ludo': {
        const el = document.getElementById('ludo-container');
        if (el) el.classList.remove('hidden');
        const myP = room.players.find(p => p.id === myId) || room.players[0];
        window.ludoGame.init(myP, room.players, isSolo);
        break;
      }

      case 'slither': {
        const el = document.getElementById('slither-container');
        if (el) el.classList.remove('hidden');
        const myP = room.players.find(p => p.id === myId) || room.players[0];
        window.slitherGame.init(myP, room.players, isSolo);
        break;
      }

      case 'bomberman': {
        const el = document.getElementById('bomberman-container');
        if (el) el.classList.remove('hidden');
        const myP = room.players.find(p => p.id === myId) || room.players[0];
        window.cyberBombermanGame.init(myP, room.players, isSolo);
        break;
      }

      case 'carrom': {
        const el = document.getElementById('carrom-container');
        if (el) el.classList.remove('hidden');
        const myP = room.players.find(p => p.id === myId) || room.players[0];
        window.neonCarromGame.init(myP, room.players, isSolo);
        break;
      }

      case 'connect4': {
        const el = document.getElementById('connect4-container');
        if (el) el.classList.remove('hidden');
        const myP = room.players.find(p => p.id === myId) || room.players[0];
        window.connect4Game.init(myP, room.players, isSolo);
        break;
      }
    }
  }

  stopCurrentGame() {
    if (window.chessGame) window.chessGame.stop();
    if (window.unoGame) window.unoGame.stop();
    if (window.chainReactionGame) window.chainReactionGame.stop();
    if (window.miniMilitiaGame) {
      window.miniMilitiaGame.stop();
      document.body.classList.remove('mm-fullscreen-active');
    }
    if (window.ludoGame) window.ludoGame.stop();
    if (window.slitherGame) window.slitherGame.stop();
    if (window.cyberBombermanGame) window.cyberBombermanGame.stop();
    if (window.neonCarromGame) window.neonCarromGame.stop();
    if (window.connect4Game) window.connect4Game.stop();

    ['chess-container', 'uno-container', 'cr-container', 'mm-container', 'ludo-container', 'slither-container', 'bomberman-container', 'carrom-container', 'connect4-container'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    this.activeGame = null;
  }

  renderLobby(room, isHost) {
    const codeEl = document.getElementById('lobby-room-code');
    const titleEl = document.getElementById('lobby-game-title');
    const countEl = document.getElementById('lobby-player-count');
    const listEl = document.getElementById('lobby-players-list');
    const startBtn = document.getElementById('lobby-start-btn');
    const hostControls = document.getElementById('lobby-host-controls');

    if (codeEl) codeEl.innerText = room.id;
    if (titleEl) titleEl.innerText = this.getGameName(room.game);
    if (countEl) countEl.innerText = `${room.players.length} / ${room.maxPlayers} Players`;

    if (hostControls) hostControls.style.display = isHost ? 'flex' : 'none';
    if (startBtn) startBtn.style.display = isHost ? 'block' : 'none';

    if (listEl) {
      listEl.innerHTML = '';
      room.players.forEach(p => {
        const isMe = p.id === window.network.playerId;
        const div = document.createElement('div');
        div.className = `lobby-player-card ${isMe ? 'is-me' : ''}`;
        div.innerHTML = `
          <div class="player-avatar">${p.avatar}</div>
          <div class="player-info">
            <span class="player-name">${p.name} ${isMe ? '(You)' : ''}</span>
            <span class="player-role">${p.id === room.hostId ? '👑 Host' : (p.isBot ? '🤖 Bot' : 'Player')}</span>
          </div>
          <span class="player-ready-badge ${p.ready ? 'ready' : ''}">${p.ready ? 'READY' : 'WAITING'}</span>
        `;
        listEl.appendChild(div);
      });
    }

    // Update Game Selector dropdown
    const gameSelect = document.getElementById('lobby-game-select');
    if (gameSelect) {
      gameSelect.value = room.game;
      gameSelect.disabled = !isHost;
      gameSelect.onchange = () => {
        window.network.selectGame(gameSelect.value);
      };
    }
  }

  getGameName(g) {
    switch (g) {
      case 'chess': return 'Cyber Chess';
      case 'uno': return 'Neon Uno';
      case 'chain-reaction': return 'Chain Reaction HD';
      case 'mini-militia': return 'Mini Militia 2D';
      case 'ludo': return '👑 Ludo King Royale';
      case 'slither': return 'Slither Battle Royale';
      case 'bomberman': return 'Cyber Bomb Arena';
      case 'carrom': return '👑 Carrom King';
      case 'connect4': return 'Connect 4 Galaxy';
      default: return g;
    }
  }

  handleRemoteGameSync(data) {
    if (this.activeGame === 'chess') {
      if (data.action === 'CHESS_MOVE') {
        const { fromR, fromC, toR, toC } = data.payload;
        window.chessGame.makeMove(fromR, fromC, toR, toC, false);
      }
    } else if (this.activeGame === 'uno') {
      if (data.action === 'UNO_PLAY_CARD') {
        const { playerId, card, chosenColor } = data.payload;
        window.unoGame.playCardAction(playerId, null, card, chosenColor, false);
      } else if (data.action === 'UNO_DRAW_CARD') {
        window.unoGame.drawCard(data.payload.playerId, false);
      }
    } else if (this.activeGame === 'chain-reaction') {
      if (data.action === 'CR_PLACE_ORB') {
        const { r, c, playerId } = data.payload;
        window.chainReactionGame.placeOrb(r, c, playerId, false);
      }
    } else if (this.activeGame === 'ludo') {
      if (data.action === 'LUDO_DICE_ROLLED') {
        window.ludoGame.diceValue = data.payload.diceValue;
        window.ludoGame.onDiceRollFinished();
      } else if (data.action === 'LUDO_MOVE_TOKEN') {
        const { playerIdx, tokenIdx, dice } = data.payload;
        const token = window.ludoGame.tokens[playerIdx] && window.ludoGame.tokens[playerIdx][tokenIdx];
        if (token) window.ludoGame.moveToken(token, dice, false);
      } else if (data.action === 'LUDO_CHAT') {
        if (window.ludoGame) {
          window.ludoGame.showSpeechBubble(data.payload.playerIdx, data.payload.text, false);
        }
      }
    } else if (this.activeGame === 'slither') {
      if (data.action === 'SLITHER_MOVE' && window.slitherGame) {
        const s = window.slitherGame.snakes.get(data.payload.id);
        if (s && data.payload.id !== window.slitherGame.myId) {
          s.x = data.payload.x;
          s.y = data.payload.y;
          s.angle = data.payload.angle;
          s.isBoosting = data.payload.isBoosting;
          s.length = data.payload.length;
          s.score = data.payload.score;
        }
      }
    } else if (this.activeGame === 'bomberman') {
      if (data.action === 'BOMB_MOVE' && window.cyberBombermanGame) {
        const p = window.cyberBombermanGame.players.get(data.payload.id);
        if (p && data.payload.id !== window.cyberBombermanGame.myId) {
          p.x = data.payload.x;
          p.y = data.payload.y;
        }
      } else if (data.action === 'BOMB_DROP' && window.cyberBombermanGame) {
        if (data.payload.playerId !== window.cyberBombermanGame.myId) {
          window.cyberBombermanGame.dropBomb(data.payload.playerId, false);
        }
      }
    } else if (this.activeGame === 'carrom') {
      if (data.action === 'CARROM_FLICK') {
        const { angle, power, baseX } = data.payload;
        if (window.neonCarromGame.striker) {
          window.neonCarromGame.striker.x = baseX;
        }
        window.neonCarromGame.flickStriker(angle, power, false);
      }
    } else if (this.activeGame === 'connect4') {
      if (data.action === 'C4_DROP_DISC') {
        window.connect4Game.dropDisc(data.payload.col, false);
      }
    }
  }

  handleMiniMilitiaRemoteEvent(data) {
    if (this.activeGame !== 'mini-militia') return;
    const game = window.miniMilitiaGame;
    if (data.event === 'PLAYER_MOVE') {
      const p = game.players.get(data.payload.id);
      if (p && p.id !== game.myId) {
        if (p.targetX === undefined) {
          p.x = data.payload.x;
          p.y = data.payload.y;
        }
        p.targetX = data.payload.x;
        p.targetY = data.payload.y;
        p.targetVx = data.payload.vx;
        p.targetVy = data.payload.vy;
        p.targetAngle = data.payload.aimAngle;
        p.isBoosting = data.payload.isBoosting;
        p.crouching = !!data.payload.crouching;
        p.hp = data.payload.hp;
        p.nitro = data.payload.nitro;
        p.weapon = data.payload.weapon;
        p.dead = data.payload.dead;
      }
    } else if (data.event === 'PLAYER_FIRE') {
      const ownerId = data.payload.ownerId || data.senderId;
      if (ownerId === game.myId) return;
      const { gunX, gunY, angle, weapon } = data.payload;
      window.soundFx.playGunshot(weapon);
      const speed = weapon === 'sniper' ? 1650 : weapon === 'rocket' ? 520 : 920;
      game.bullets.push({
        x: gunX, y: gunY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: weapon === 'rocket' ? 3.2 : 1.4,
        damage: weapon === 'rocket' ? 115 : (weapon === 'sniper' ? 85 : 24),
        ownerId: ownerId,
        color: weapon === 'rocket' ? '#ff0055' : (weapon === 'sniper' ? '#00f2fe' : '#ffffff'),
        isExplosive: weapon === 'rocket'
      });
    } else if (data.event === 'PLAYER_RESPAWN') {
      if (data.payload.id === game.myId) return;
      const p = game.players.get(data.payload.id);
      if (p) {
        p.dead = false;
        p.hp = p.maxHp;
        p.nitro = p.maxNitro;
        p.x = data.payload.x;
        p.y = data.payload.y;
        p.targetX = data.payload.x;
        p.targetY = data.payload.y;
        p.vx = 0;
        p.vy = 0;
      }
    }
  }

  appendChatMessage(data) {
    const container = document.getElementById('lobby-chat-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'chat-message-row';
    div.innerHTML = `
      <span class="chat-time">${data.time}</span>
      <span class="chat-sender">${data.avatar} ${data.sender}:</span>
      <span class="chat-text">${data.text}</span>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  showGlobalToast(msg) {
    const toast = document.getElementById('global-toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
  }

  showQRModal(roomCode = null) {
    const modal = document.getElementById('qr-modal');
    if (modal) modal.classList.remove('hidden');
    const targetRoom = roomCode || (this.currentView === 'lobby' && window.network.roomId ? window.network.roomId : null);
    this.fetchNetworkInfo(targetRoom);
  }

  closeQRModal() {
    const modal = document.getElementById('qr-modal');
    if (modal) modal.classList.add('hidden');
  }

  showHelpModal() {
    const modal = document.getElementById('offline-help-modal');
    if (modal) modal.classList.remove('hidden');
  }

  closeHelpModal() {
    const modal = document.getElementById('offline-help-modal');
    if (modal) modal.classList.add('hidden');
  }

  copyHotspotUrl() {
    const url = (this.networkInfo && this.networkInfo.url) || `http://${window.network.getServerHost()}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.showGlobalToast(`📋 Copied Phone URL: ${url}`);
      }).catch(() => {
        prompt('Copy this URL to join on phone:', url);
      });
    } else {
      prompt('Copy this URL to join on phone:', url);
    }
  }

  copyRoomCode() {
    const code = window.network.roomId || (document.getElementById('lobby-room-code') ? document.getElementById('lobby-room-code').innerText : '');
    if (!code || code === '----') return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        this.showGlobalToast(`🔑 Copied Room Code #${code}`);
      }).catch(() => {
        prompt('Copy Room Code:', code);
      });
    } else {
      prompt('Copy Room Code:', code);
    }
  }

  copyRoomLink() {
    const code = window.network.roomId;
    if (!code) return;
    const base = (this.networkInfo && this.networkInfo.primaryIp) ? `http://${this.networkInfo.primaryIp}:${this.networkInfo.port}` : `http://${window.network.getServerHost()}`;
    const roomUrl = `${base}?room=${code}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(roomUrl).then(() => {
        this.showGlobalToast(`📲 Copied Direct Room Invite Link!`);
      }).catch(() => {
        prompt('Share this link with friends to auto-join:', roomUrl);
      });
    } else {
      prompt('Share this link with friends to auto-join:', roomUrl);
    }
  }

  showConnectionErrorModal(failedGame, errorMsg) {
    const modal = document.getElementById('connection-error-modal');
    if (!modal) {
      alert(`⚠️ Connection Error: ${errorMsg}\n\n1. Make sure 'npm start' is running on your host laptop.\n2. Ensure your phone and laptop are connected to the same Wi-Fi / Hotspot.`);
      return;
    }
    const msgEl = document.getElementById('conn-error-message');
    const ipInput = document.getElementById('conn-error-ip-input');
    if (msgEl) msgEl.innerText = errorMsg || 'Could not reach the local game server.';
    if (ipInput) ipInput.value = window.network.getServerHost();
    modal.dataset.retryGame = failedGame || '';
    modal.classList.remove('hidden');
  }

  closeConnectionErrorModal() {
    const modal = document.getElementById('connection-error-modal');
    if (modal) modal.classList.add('hidden');
  }

  retryConnection() {
    const modal = document.getElementById('connection-error-modal');
    const ipInput = document.getElementById('conn-error-ip-input');
    if (ipInput && ipInput.value.trim()) {
      window.network.setServerHost(ipInput.value.trim());
    }
    const failedGame = modal ? modal.dataset.retryGame : null;
    this.closeConnectionErrorModal();
    this.showGlobalToast('🔄 Retrying connection to game server...');
    this.fetchNetworkInfo();
    if (failedGame) {
      this.openCreateRoomModal(failedGame);
    } else {
      window.network.connect().then(() => {
        this.showGlobalToast('✅ Connected to local game server!');
      }).catch(err => {
        this.showConnectionErrorModal(null, err.message);
      });
    }
  }

  playSoloFromError() {
    const modal = document.getElementById('connection-error-modal');
    const game = (modal && modal.dataset.retryGame) ? modal.dataset.retryGame : 'chess';
    this.closeConnectionErrorModal();
    this.startSoloGame(game);
  }

  openServerSettingsModal() {
    const modal = document.getElementById('server-settings-modal');
    if (!modal) return;
    const input = document.getElementById('server-settings-ip-input');
    if (input) input.value = window.network.getServerHost();
    modal.classList.remove('hidden');
  }

  closeServerSettingsModal() {
    const modal = document.getElementById('server-settings-modal');
    if (modal) modal.classList.add('hidden');
  }

  saveServerSettings() {
    const input = document.getElementById('server-settings-ip-input');
    if (input && input.value.trim()) {
      window.network.setServerHost(input.value.trim());
      this.showGlobalToast(`💾 Saved Server Host: ${window.network.getServerHost()}`);
      this.fetchNetworkInfo();
      window.network.connect().then(() => {
        this.showGlobalToast('✅ Successfully connected to host server!');
      }).catch(err => {
        this.showGlobalToast(`⚠️ Could not reach server: ${err.message}`);
      });
    }
    this.closeServerSettingsModal();
  }
}

window.lobby = new LobbyController();
document.addEventListener('DOMContentLoaded', () => window.lobby.init());
