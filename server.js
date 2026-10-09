const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Serve static frontend files with explicit UTF-8 SVG headers
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    }
  }
}));
app.use(express.json());

// Helper: Get all non-internal IPv4 network interfaces
function getNetworkIps() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ name, address: iface.address });
      }
    }
  }

  // Sort to prioritize Wi-Fi / WLAN / Hotspot / 192.168.x.x addresses
  addresses.sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const aIsWifi = aName.includes('wi-fi') || aName.includes('wifi') || aName.includes('wireless') || aName.includes('wlan') || aName.includes('hotspot');
    const bIsWifi = bName.includes('wi-fi') || bName.includes('wifi') || bName.includes('wireless') || bName.includes('wlan') || bName.includes('hotspot');
    if (aIsWifi && !bIsWifi) return -1;
    if (!aIsWifi && bIsWifi) return 1;
    const aIs192 = a.address.startsWith('192.168.');
    const bIs192 = b.address.startsWith('192.168.');
    if (aIs192 && !bIs192) return -1;
    if (!aIs192 && bIs192) return 1;
    return 0;
  });

  if (addresses.length === 0) {
    addresses.push({ name: 'localhost', address: '127.0.0.1' });
  }
  return addresses;
}

// API: Provide network connection info and pre-generated QR code
app.get('/api/network-info', async (req, res) => {
  try {
    const ips = getNetworkIps();
    const primaryIp = ips[0].address;
    const room = req.query.room ? req.query.room.toUpperCase().trim() : '';
    const url = `http://${primaryIp}:${PORT}${room ? `?room=${room}` : ''}`;
    const qrDataUrl = await QRCode.toDataURL(url, {
      margin: 2,
      width: 280,
      color: {
        dark: '#00f2fe',
        light: '#0b0f19'
      }
    });

    res.json({
      port: PORT,
      primaryIp,
      ips,
      url,
      room,
      qrDataUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rooms state in memory
// roomId -> { id, name, game, hostId, maxPlayers, players: [{ id, name, avatar, ready, isBot, score }], status: 'lobby'|'playing', gameState }
const rooms = new Map();
const playerSockets = new Map(); // socket -> { playerId, roomId }

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function broadcastToRoom(roomId, message, excludeSocket = null) {
  const payload = JSON.stringify(message);
  for (const [ws, info] of playerSockets.entries()) {
    if (info.roomId === roomId && ws !== excludeSocket && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function getRoomPublicData(room) {
  return {
    id: room.id,
    name: room.name,
    game: room.game,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    players: room.players,
    status: room.status,
    gameConfig: room.gameConfig || {}
  };
}

// WebSocket Connection Management
wss.on('connection', (ws) => {
  const playerId = 'p_' + Math.random().toString(36).substr(2, 9);
  playerSockets.set(ws, { playerId, roomId: null });

  ws.send(JSON.stringify({
    type: 'CONNECTED',
    playerId
  }));

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw);
      handleClientMessage(ws, data);
    } catch (e) {
      console.error('Error handling message:', e);
    }
  });

  ws.on('close', () => {
    handlePlayerDisconnect(ws);
  });
});

function handlePlayerDisconnect(ws) {
  const info = playerSockets.get(ws);
  if (!info || !info.roomId) {
    playerSockets.delete(ws);
    return;
  }

  const { roomId, playerId } = info;
  const room = rooms.get(roomId);
  if (room) {
    const idx = room.players.findIndex(p => p.id === playerId);
    if (idx !== -1) {
      const disconnectedPlayer = room.players[idx];
      room.players.splice(idx, 1);

      if (room.players.length === 0) {
        // Room empty, delete
        rooms.delete(roomId);
      } else {
        // Transfer host if host left
        if (room.hostId === playerId) {
          room.hostId = room.players[0].id;
        }
        broadcastToRoom(roomId, {
          type: 'ROOM_UPDATE',
          room: getRoomPublicData(room),
          notification: `${disconnectedPlayer.name} left the room.`
        });
        broadcastToRoom(roomId, {
          type: 'PLAYER_DISCONNECTED',
          playerId
        });
      }
    }
  }

  playerSockets.delete(ws);
}

function handleClientMessage(ws, data) {
  const clientInfo = playerSockets.get(ws);
  if (!clientInfo) return;

  switch (data.type) {
    case 'CREATE_ROOM': {
      if (clientInfo.roomId) {
        const oldRoom = rooms.get(clientInfo.roomId);
        if (oldRoom) {
          const idx = oldRoom.players.findIndex(p => p.id === clientInfo.playerId);
          if (idx !== -1) oldRoom.players.splice(idx, 1);
          if (oldRoom.players.length === 0) rooms.delete(oldRoom.id);
          else {
            if (oldRoom.hostId === clientInfo.playerId) oldRoom.hostId = oldRoom.players[0].id;
            broadcastToRoom(oldRoom.id, { type: 'ROOM_UPDATE', room: getRoomPublicData(oldRoom) });
          }
        }
        clientInfo.roomId = null;
      }

      let roomId = generateRoomId();
      while (rooms.has(roomId)) {
        roomId = generateRoomId();
      }

      const player = {
        id: clientInfo.playerId,
        name: data.playerName || 'Player 1',
        avatar: data.avatar || '🦊',
        ready: true,
        isBot: false,
        score: 0
      };

      const room = {
        id: roomId,
        name: data.roomName || `Room ${roomId}`,
        game: data.game || 'chess',
        hostId: player.id,
        maxPlayers: getMaxPlayersForGame(data.game || 'chess'),
        players: [player],
        status: 'lobby',
        gameConfig: data.gameConfig || {},
        gameState: null
      };

      rooms.set(roomId, room);
      clientInfo.roomId = roomId;

      ws.send(JSON.stringify({
        type: 'ROOM_JOINED',
        room: getRoomPublicData(room),
        playerId: player.id,
        isHost: true
      }));
      break;
    }

    case 'JOIN_ROOM': {
      if (clientInfo.roomId) {
        const oldRoom = rooms.get(clientInfo.roomId);
        if (oldRoom) {
          const idx = oldRoom.players.findIndex(p => p.id === clientInfo.playerId);
          if (idx !== -1) oldRoom.players.splice(idx, 1);
          if (oldRoom.players.length === 0) rooms.delete(oldRoom.id);
          else {
            if (oldRoom.hostId === clientInfo.playerId) oldRoom.hostId = oldRoom.players[0].id;
            broadcastToRoom(oldRoom.id, { type: 'ROOM_UPDATE', room: getRoomPublicData(oldRoom) });
          }
        }
        clientInfo.roomId = null;
      }

      const roomId = (data.roomId || '').toUpperCase().trim();
      const room = rooms.get(roomId);

      if (!room) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          message: `Room "${roomId}" not found!`
        }));
        return;
      }

      if (room.players.length >= room.maxPlayers) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          message: `Room "${roomId}" is full!`
        }));
        return;
      }

      const player = {
        id: clientInfo.playerId,
        name: data.playerName || `Player ${room.players.length + 1}`,
        avatar: data.avatar || '🐼',
        ready: false,
        isBot: false,
        score: 0
      };

      room.players.push(player);
      clientInfo.roomId = roomId;

      ws.send(JSON.stringify({
        type: 'ROOM_JOINED',
        room: getRoomPublicData(room),
        playerId: player.id,
        isHost: room.hostId === player.id
      }));

      broadcastToRoom(roomId, {
        type: 'ROOM_UPDATE',
        room: getRoomPublicData(room),
        notification: `${player.name} joined!`
      }, ws);
      break;
    }

    case 'LEAVE_ROOM': {
      handlePlayerDisconnect(ws);
      ws.send(JSON.stringify({ type: 'LEFT_ROOM' }));
      break;
    }

    case 'SELECT_GAME': {
      const room = rooms.get(clientInfo.roomId);
      if (room && room.hostId === clientInfo.playerId) {
        room.game = data.game;
        room.maxPlayers = getMaxPlayersForGame(data.game);
        // Trim bots if exceeding max players
        while (room.players.length > room.maxPlayers) {
          const botIdx = room.players.findLastIndex(p => p.isBot);
          if (botIdx !== -1) room.players.splice(botIdx, 1);
          else break;
        }

        broadcastToRoom(room.id, {
          type: 'ROOM_UPDATE',
          room: getRoomPublicData(room),
          notification: `Game changed to ${getGameTitle(data.game)}`
        });
      }
      break;
    }

    case 'ADD_BOT': {
      const room = rooms.get(clientInfo.roomId);
      if (room && room.hostId === clientInfo.playerId) {
        if (room.players.length < room.maxPlayers) {
          const botNames = ['CyberBot', 'RoboPro', 'PixelBot', 'AlphaBot', 'GhostBot', 'Quantum'];
          const botAvatars = ['🤖', '👾', '🦾', '⚡', '🛸', '🎯'];
          const botIndex = room.players.filter(p => p.isBot).length;
          const bot = {
            id: 'bot_' + Math.random().toString(36).substr(2, 6),
            name: botNames[botIndex % botNames.length],
            avatar: botAvatars[botIndex % botAvatars.length],
            ready: true,
            isBot: true,
            score: 0
          };
          room.players.push(bot);
          broadcastToRoom(room.id, {
            type: 'ROOM_UPDATE',
            room: getRoomPublicData(room),
            notification: `Bot ${bot.name} added!`
          });
        }
      }
      break;
    }

    case 'REMOVE_BOT': {
      const room = rooms.get(clientInfo.roomId);
      if (room && room.hostId === clientInfo.playerId) {
        const botIdx = room.players.findLastIndex(p => p.isBot);
        if (botIdx !== -1) {
          const removed = room.players.splice(botIdx, 1)[0];
          broadcastToRoom(room.id, {
            type: 'ROOM_UPDATE',
            room: getRoomPublicData(room),
            notification: `${removed.name} removed.`
          });
        }
      }
      break;
    }

    case 'TOGGLE_READY': {
      const room = rooms.get(clientInfo.roomId);
      if (room) {
        const player = room.players.find(p => p.id === clientInfo.playerId);
        if (player) {
          player.ready = !player.ready;
          broadcastToRoom(room.id, {
            type: 'ROOM_UPDATE',
            room: getRoomPublicData(room)
          });
        }
      }
      break;
    }

    case 'START_GAME': {
      const room = rooms.get(clientInfo.roomId);
      if (room && room.hostId === clientInfo.playerId) {
        if (room.players.length < 1) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Need at least 1 player!' }));
          return;
        }
        room.status = 'playing';
        initializeGameState(room);

        broadcastToRoom(room.id, {
          type: 'GAME_STARTED',
          room: getRoomPublicData(room),
          gameState: room.gameState
        });
      }
      break;
    }

    case 'CHAT_MESSAGE': {
      const room = rooms.get(clientInfo.roomId);
      if (room) {
        const player = room.players.find(p => p.id === clientInfo.playerId);
        broadcastToRoom(room.id, {
          type: 'CHAT_MESSAGE',
          sender: player ? player.name : 'Unknown',
          avatar: player ? player.avatar : '💬',
          text: data.text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }
      break;
    }

    // Direct game actions relayed or validated
    case 'GAME_ACTION': {
      const room = rooms.get(clientInfo.roomId);
      if (room && room.status === 'playing') {
        handleGameAction(room, clientInfo.playerId, data, ws);
      }
      break;
    }

    case 'RETURN_TO_LOBBY': {
      const room = rooms.get(clientInfo.roomId);
      if (room && room.hostId === clientInfo.playerId) {
        room.status = 'lobby';
        room.gameState = null;
        room.players.forEach(p => { if (!p.isBot && p.id !== room.hostId) p.ready = false; });
        broadcastToRoom(room.id, {
          type: 'RETURNED_TO_LOBBY',
          room: getRoomPublicData(room)
        });
      }
      break;
    }
  }
}

function getMaxPlayersForGame(game) {
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

function getGameTitle(game) {
  switch (game) {
    case 'chess': return 'Cyber Chess';
    case 'uno': return 'Neon Uno';
    case 'chain-reaction': return 'Chain Reaction HD';
    case 'mini-militia': return 'Mini Militia 2D Combat';
    case 'ludo': return 'Neon Ludo Royale';
    case 'slither': return 'Slither Battle Royale';
    case 'bomberman': return 'Cyber Bomb Arena';
    case 'carrom': return 'Neon Carrom Clash';
    case 'connect4': return 'Connect 4 Galaxy';
    default: return game;
  }
}

function initializeGameState(room) {
  switch (room.game) {
    case 'chess':
      room.gameState = {
        whitePlayerId: room.players[0].id,
        blackPlayerId: room.players[1] ? room.players[1].id : 'bot_black',
        currentTurn: 'white',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        history: [],
        whiteTime: 300,
        blackTime: 300,
        winner: null
      };
      break;

    case 'uno':
      room.gameState = createUnoGame(room.players);
      break;

    case 'chain-reaction':
      room.gameState = createChainReactionGame(room.players);
      break;

    case 'mini-militia':
      room.gameState = createMiniMilitiaGame(room.players);
      break;

    case 'ludo':
      room.gameState = { status: 'started', currentTurn: 0, sixStreak: 0 };
      break;

    case 'slither':
      room.gameState = { status: 'started' };
      break;

    case 'bomberman':
      room.gameState = { status: 'started' };
      break;

    case 'carrom':
      room.gameState = { status: 'started', currentTurn: 0 };
      break;

    case 'connect4':
      room.gameState = { status: 'started', currentTurn: 0 };
      break;

    default:
      room.gameState = { status: 'started' };
      break;
  }
}

function handleGameAction(room, playerId, data, ws) {
  // Broadcast game actions with player verification
  switch (room.game) {
    case 'chess':
    case 'uno':
    case 'chain-reaction':
    case 'ludo':
    case 'bomberman':
    case 'carrom':
    case 'connect4':
      // Turn-based / state-sync games: broadcast action to room
      broadcastToRoom(room.id, {
        type: 'GAME_SYNC',
        action: data.action,
        payload: data.payload,
        senderId: playerId
      });
      break;

    case 'mini-militia':
      // Real-time arena: broadcast player state updates, bullets, hits, kills
      broadcastToRoom(room.id, {
        type: 'MM_EVENT',
        event: data.event,
        payload: data.payload,
        senderId: playerId
      }, data.event === 'PLAYER_MOVE' ? ws : null);
      break;

    case 'slither':
      // Real-time slither arena
      broadcastToRoom(room.id, {
        type: 'GAME_SYNC',
        action: data.action,
        payload: data.payload,
        senderId: playerId
      }, data.action === 'SLITHER_MOVE' ? ws : null);
      break;
  }
}

// UNO State Factory
function createUnoGame(players) {
  const colors = ['red', 'blue', 'green', 'yellow'];
  const deck = [];

  for (const c of colors) {
    deck.push({ id: Math.random().toString(36).substr(2, 7), color: c, value: '0', type: 'number' });
    for (let i = 1; i <= 9; i++) {
      deck.push({ id: Math.random().toString(36).substr(2, 7), color: c, value: String(i), type: 'number' });
      deck.push({ id: Math.random().toString(36).substr(2, 7), color: c, value: String(i), type: 'number' });
    }
    // Action cards
    for (let i = 0; i < 2; i++) {
      deck.push({ id: Math.random().toString(36).substr(2, 7), color: c, value: 'skip', type: 'action' });
      deck.push({ id: Math.random().toString(36).substr(2, 7), color: c, value: 'reverse', type: 'action' });
      deck.push({ id: Math.random().toString(36).substr(2, 7), color: c, value: '+2', type: 'action' });
    }
  }
  // Wild cards
  for (let i = 0; i < 4; i++) {
    deck.push({ id: Math.random().toString(36).substr(2, 7), color: 'wild', value: 'wild', type: 'wild' });
    deck.push({ id: Math.random().toString(36).substr(2, 7), color: 'wild', value: '+4', type: 'wild' });
  }

  // Shuffle deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  // Deal 7 cards to each player
  const hands = {};
  for (const p of players) {
    hands[p.id] = deck.splice(0, 7);
  }

  // Initial discard card (must not be a wild card)
  let initialCardIdx = deck.findIndex(c => c.type === 'number');
  if (initialCardIdx === -1) initialCardIdx = 0;
  const initialCard = deck.splice(initialCardIdx, 1)[0];

  return {
    hands,
    discardPile: [initialCard],
    drawPileCount: deck.length,
    deck,
    currentColor: initialCard.color,
    currentTurnIndex: 0,
    direction: 1, // 1 for clockwise, -1 for counter-clockwise
    unoCalled: {}
  };
}

// Chain Reaction State Factory
function createChainReactionGame(players) {
  const rows = 9;
  const cols = 6;
  const grid = Array(rows).fill(null).map(() =>
    Array(cols).fill(null).map(() => ({ count: 0, playerId: null }))
  );

  return {
    rows,
    cols,
    grid,
    currentTurnIndex: 0,
    eliminatedPlayers: [],
    moveCount: 0
  };
}

// Mini Militia Arena State Factory
function createMiniMilitiaGame(players) {
  const mapPlatforms = [
    { x: 0, y: 700, w: 1600, h: 100 }, // Floor
    { x: 0, y: 0, w: 50, h: 800 }, // Left Wall
    { x: 1550, y: 0, w: 50, h: 800 }, // Right Wall
    { x: 0, y: 0, w: 1600, h: 50 }, // Ceiling
    // Floating platforms
    { x: 250, y: 550, w: 300, h: 25 },
    { x: 1050, y: 550, w: 300, h: 25 },
    { x: 650, y: 440, w: 300, h: 25 },
    { x: 200, y: 320, w: 320, h: 25 },
    { x: 1080, y: 320, w: 320, h: 25 },
    { x: 600, y: 200, w: 400, h: 25 }
  ];

  const spawnPoints = [
    { x: 300, y: 500 },
    { x: 1200, y: 500 },
    { x: 800, y: 380 },
    { x: 350, y: 260 },
    { x: 1250, y: 260 },
    { x: 750, y: 150 },
    { x: 500, y: 640 },
    { x: 1100, y: 640 }
  ];

  const initialPlayerPositions = {};
  players.forEach((p, idx) => {
    const sp = spawnPoints[idx % spawnPoints.length];
    initialPlayerPositions[p.id] = {
      x: sp.x,
      y: sp.y,
      vx: 0,
      vy: 0,
      hp: 100,
      nitro: 100,
      kills: 0,
      deaths: 0,
      weapon: 'rifle',
      ammo: 30,
      grenades: 3,
      facing: idx % 2 === 0 ? 1 : -1
    };
  });

  return {
    platforms: mapPlatforms,
    playerStates: initialPlayerPositions,
    matchDuration: 300 // 5 minutes
  };
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use by another terminal or process.`);
    console.error(`👉 To fix: Close any other terminal running the server, or run on another port:`);
    console.error(`   $env:PORT="3001"; npm start\n`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

// Start Server and display local connection details
server.listen(PORT, '0.0.0.0', () => {
  const ips = getNetworkIps();
  console.log('=====================================================');
  console.log('🎮 MULTIPLAYER GAME PLATFORM RUNNING OFFLINE');
  console.log('-----------------------------------------------------');
  console.log(`💻 Local Laptop URL: http://localhost:${PORT}`);
  ips.forEach(ip => {
    console.log(`📱 Phone Access URL:  http://${ip.address}:${PORT} (${ip.name})`);
  });
  console.log('-----------------------------------------------------');
  console.log('👉 To connect phones: Connect to same Wi-Fi / Hotspot');
  console.log('👉 Open camera on phone and scan QR code on screen!');
  console.log('=====================================================');
});
