// Chain Reaction HD Engine & UI - Authentic App Physics, Cascading Waves & Elimination Logic
class ChainReactionGame {
  constructor() {
    this.rows = 9;
    this.cols = 6;
    this.grid = [];
    this.players = [];
    this.myId = null;
    this.currentTurnIndex = 0;
    this.moveCount = 0;
    this.isGameOver = false;
    this.isCascading = false;
    this.winner = null;
    this.isSolo = false;
    this.history = []; // For Undo in solo mode
    this.waveCount = 0;

    // Authentic vibrant player colors with glowing auras
    this.playerPalette = [
      { name: 'Red', hex: '#ff0055', glow: 'rgba(255, 0, 85, 0.75)' },
      { name: 'Green', hex: '#00ff88', glow: 'rgba(0, 255, 136, 0.75)' },
      { name: 'Blue', hex: '#00d2ff', glow: 'rgba(0, 210, 255, 0.75)' },
      { name: 'Yellow', hex: '#ffd600', glow: 'rgba(255, 214, 0, 0.75)' },
      { name: 'Purple', hex: '#b026ff', glow: 'rgba(176, 38, 255, 0.75)' },
      { name: 'Orange', hex: '#ff6d00', glow: 'rgba(255, 109, 0, 0.75)' },
      { name: 'Cyan', hex: '#00f2fe', glow: 'rgba(0, 242, 254, 0.75)' },
      { name: 'White', hex: '#ffffff', glow: 'rgba(255, 255, 255, 0.75)' }
    ];
    this.botTurnTimeout = null;
  }

  initLocalGame(humanPlayer, botCount = 2, rows = 9, cols = 6) {
    this.isSolo = true;
    this.rows = rows;
    this.cols = cols;
    this.myId = humanPlayer.id;
    this.players = [
      { ...humanPlayer, color: this.playerPalette[0], isEliminated: false, hasMoved: false, isBot: false, orbs: 0 }
    ];

    const botNames = ['NexusBot', 'CyberPulse', 'VoltBot', 'HyperBot', 'Vortex', 'Atomic', 'Quantum'];
    const botAvatars = ['🤖', '👾', '⚡', '🦾', '🛸', '🎯', '🔥'];

    for (let i = 0; i < botCount; i++) {
      this.players.push({
        id: 'cr_bot_' + i,
        name: botNames[i % botNames.length],
        avatar: botAvatars[i % botAvatars.length],
        color: this.playerPalette[(i + 1) % this.playerPalette.length],
        isEliminated: false,
        hasMoved: false,
        isBot: true,
        orbs: 0
      });
    }

    this.resetGrid();
    this.render();
  }

  initFromSync(players, myId, rows = 9, cols = 6) {
    this.isSolo = false;
    this.rows = rows;
    this.cols = cols;
    this.myId = myId;
    this.players = players.map((p, idx) => ({
      ...p,
      color: this.playerPalette[idx % this.playerPalette.length],
      isEliminated: false,
      hasMoved: false,
      orbs: 0
    }));
    this.resetGrid();
    this.render();
  }

  resetGrid() {
    clearTimeout(this.botTurnTimeout);
    this.botTurnTimeout = null;
    this.grid = Array(this.rows).fill(null).map(() =>
      Array(this.cols).fill(null).map(() => ({ count: 0, playerId: null }))
    );
    this.currentTurnIndex = 0;
    this.moveCount = 0;
    this.isGameOver = false;
    this.isCascading = false;
    this.winner = null;
    this.history = [];
    this.waveCount = 0;

    const banner = document.getElementById('cr-result-banner');
    if (banner) banner.classList.add('hidden');
    const turnEl = document.getElementById('cr-turn-indicator');
    if (turnEl) turnEl.classList.remove('thinking');
    this.updatePlayerStats();
  }

  // Critical mass is 2 at corners, 3 at edges, 4 in inner grid
  getCriticalMass(r, c) {
    let neighbors = 4;
    if (r === 0 || r === this.rows - 1) neighbors--;
    if (c === 0 || c === this.cols - 1) neighbors--;
    return neighbors;
  }

  getNeighbors(r, c) {
    const list = [];
    if (r > 0) list.push({ r: r - 1, c, dir: 'up' });
    if (r < this.rows - 1) list.push({ r: r + 1, c, dir: 'down' });
    if (c > 0) list.push({ r, c: c - 1, dir: 'left' });
    if (c < this.cols - 1) list.push({ r, c: c + 1, dir: 'right' });
    return list;
  }

  getCurrentPlayer() {
    return this.players[this.currentTurnIndex] || this.players[0];
  }

  isMyTurn() {
    const cur = this.getCurrentPlayer();
    return cur && cur.id === this.myId;
  }

  canPlaceOrb(r, c, playerId) {
    if (this.isGameOver || this.isCascading) return false;
    const cell = this.grid[r][c];
    return cell.count === 0 || cell.playerId === playerId;
  }

  onCellClick(r, c) {
    if (!this.isMyTurn() || this.isCascading || this.isGameOver) return;
    const player = this.getCurrentPlayer();
    if (!this.canPlaceOrb(r, c, player.id)) {
      if (navigator.vibrate) navigator.vibrate(40);
      return;
    }
    this.placeOrb(r, c, player.id, true);
  }

  async placeOrb(r, c, playerId, syncRemote = true) {
    if (this.isCascading || this.isGameOver) return;
    const player = this.getPlayerById(playerId);
    if (!player) return;

    this.isCascading = true;
    this.moveCount++;
    player.hasMoved = true;

    // Save grid state for Undo in solo mode
    if (this.isSolo) {
      this.saveHistoryState();
    }

    const cell = this.grid[r][c];
    cell.count++;
    cell.playerId = playerId;

    window.soundFx.playOrbPlace();
    if (navigator.vibrate) navigator.vibrate(15);

    if (syncRemote && window.network && window.network.roomId) {
      window.network.sendGameAction('CR_PLACE_ORB', { r, c, playerId });
    }

    this.updatePlayerStats();
    this.render();

    // Check if this move triggers a chain reaction
    if (cell.count >= this.getCriticalMass(r, c)) {
      await this.processChainReactionWaves(playerId);
      // Wait for complete board stabilization after all explosive waves and rotations settle
      await new Promise(res => setTimeout(res, 450));
    } else {
      // Clear visual pause so move is registered
      await new Promise(res => setTimeout(res, 250));
    }

    this.updatePlayerStats();
    this.checkEliminations();

    // Check Win Condition (Only 1 active player remaining who has orbs, after all played round 1)
    const allMovedAtLeastOnce = this.players.every(p => p.hasMoved);
    if (allMovedAtLeastOnce) {
      const alivePlayers = this.players.filter(p => !p.isEliminated);
      if (alivePlayers.length === 1) {
        this.endGame(alivePlayers[0]);
        this.isCascading = false;
        return;
      }
    }

    this.advanceTurn();
    this.isCascading = false;
    this.render();

    this.checkBotTurn();
  }

  // Real Chain Reaction Wave-by-Wave Physics & Visual Travelling Orbs
  async processChainReactionWaves(playerId) {
    let waveIndex = 0;
    const maxWaves = 100; // Protection against infinite edge loops

    while (waveIndex < maxWaves) {
      // Find all cells that currently have critical mass
      const explodingCells = [];
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.grid[r][c].count >= this.getCriticalMass(r, c)) {
            explodingCells.push({ r, c, count: this.grid[r][c].count });
          }
        }
      }

      if (explodingCells.length === 0) {
        break; // Board has stabilized!
      }

      // Audio: Ascending pitch cascade crescendo!
      window.soundFx.playCascade(waveIndex);
      this.triggerScreenShake(explodingCells.length);
      if (navigator.vibrate) {
        navigator.vibrate(Math.min(60, 20 + explodingCells.length * 5));
      }

      // 1. First: Remove critical mass from exploding cells and prepare traveling orbs
      const travelingOrbs = [];
      for (const exp of explodingCells) {
        const crit = this.getCriticalMass(exp.r, exp.c);
        this.grid[exp.r][exp.c].count -= crit;
        if (this.grid[exp.r][exp.c].count === 0) {
          this.grid[exp.r][exp.c].playerId = null;
        }

        const neighbors = this.getNeighbors(exp.r, exp.c);
        for (const n of neighbors) {
          travelingOrbs.push({
            fromR: exp.r,
            fromC: exp.c,
            toR: n.r,
            toC: n.c,
            dir: n.dir,
            playerId: playerId
          });
        }
      }

      // Render traveling orbs over the board
      await this.animateTravelingOrbs(travelingOrbs, playerId);

      // 2. Second: Distribute orbs to neighbor cells & convert their ownership
      for (const orb of travelingOrbs) {
        const targetCell = this.grid[orb.toR][orb.toC];
        targetCell.count++;
        targetCell.playerId = playerId;
      }

      this.updatePlayerStats();
      this.render();
      waveIndex++;
      await new Promise(res => setTimeout(res, 160));
    }
  }

  // Smooth visual orb flight animation between cells
  animateTravelingOrbs(orbs, playerId) {
    return new Promise(resolve => {
      const container = document.getElementById('cr-grid-container');
      if (!container || orbs.length === 0) {
        resolve();
        return;
      }

      const player = this.getPlayerById(playerId);
      const color = player ? player.color.hex : '#00f2fe';
      const glow = player ? player.color.glow : 'rgba(0,242,254,0.6)';

      const rect = container.getBoundingClientRect();
      const cellWidth = rect.width / this.cols;
      const cellHeight = rect.height / this.rows;

      const overlay = document.createElement('div');
      overlay.className = 'cr-anim-overlay';
      overlay.style.position = 'absolute';
      overlay.style.inset = '0';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '20';
      container.appendChild(overlay);

      orbs.forEach(orb => {
        const el = document.createElement('div');
        el.className = 'cr-flying-orb';
        el.style.position = 'absolute';
        el.style.width = `${Math.max(14, cellWidth * 0.32)}px`;
        el.style.height = `${Math.max(14, cellWidth * 0.32)}px`;
        el.style.borderRadius = '50%';
        el.style.background = color;
        el.style.boxShadow = `0 0 12px ${glow}`;
        el.style.transform = 'translate(-50%, -50%)';

        const startX = orb.fromC * cellWidth + cellWidth / 2;
        const startY = orb.fromR * cellHeight + cellHeight / 2;
        const endX = orb.toC * cellWidth + cellWidth / 2;
        const endY = orb.toR * cellHeight + cellHeight / 2;

        el.style.left = `${startX}px`;
        el.style.top = `${startY}px`;
        el.style.transition = 'all 160ms cubic-bezier(0.25, 0.8, 0.35, 1)';

        overlay.appendChild(el);

        requestAnimationFrame(() => {
          el.style.left = `${endX}px`;
          el.style.top = `${endY}px`;
        });
      });

      setTimeout(() => {
        if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
        resolve();
      }, 170);
    });
  }

  triggerScreenShake(intensity = 1) {
    const board = document.getElementById('cr-board');
    if (!board) return;
    board.classList.remove('shake', 'shake-heavy');
    const cls = intensity > 3 ? 'shake-heavy' : 'shake';
    board.classList.add(cls);
    setTimeout(() => board.classList.remove(cls), 200);
  }

  // Official elimination: Only checks players after all players have completed Round 1
  checkEliminations() {
    const allMovedAtLeastOnce = this.players.every(p => p.hasMoved);
    if (!allMovedAtLeastOnce) return;

    this.players.forEach(p => {
      if (p.isEliminated) return;
      if (p.orbs === 0) {
        p.isEliminated = true;
        this.showToast(`${p.name} eliminated! 💀`);
        window.soundFx.playCheckAlert();
      }
    });
  }

  updatePlayerStats() {
    // Reset orb counts
    this.players.forEach(p => { p.orbs = 0; });

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell.count > 0 && cell.playerId) {
          const owner = this.getPlayerById(cell.playerId);
          if (owner) {
            owner.orbs += cell.count;
          }
        }
      }
    }
  }

  advanceTurn() {
    let nextIdx = (this.currentTurnIndex + 1) % this.players.length;
    let attempts = 0;
    while (this.players[nextIdx].isEliminated && attempts < this.players.length) {
      nextIdx = (nextIdx + 1) % this.players.length;
      attempts++;
    }
    this.currentTurnIndex = nextIdx;
  }

  checkBotTurn() {
    if (this.isGameOver || this.isCascading) return;
    if (!this.isSolo && window.network && window.network.roomId && !window.network.isHost) {
      return;
    }

    const current = this.getCurrentPlayer();
    if (current && current.isBot && !current.isEliminated) {
      clearTimeout(this.botTurnTimeout);

      // Indicate to the human player that the bot is thinking/calculating
      const turnEl = document.getElementById('cr-turn-indicator');
      if (turnEl) {
        turnEl.classList.add('thinking');
        turnEl.innerText = `${current.name.toUpperCase()} IS THINKING...`;
        turnEl.style.borderColor = current.color.hex;
        turnEl.style.boxShadow = `0 0 20px ${current.color.glow}`;
        turnEl.style.color = current.color.hex;
      }

      // Ensure bot waits a relaxed, natural human delay (1400ms) so human players can clearly follow the board
      this.botTurnTimeout = setTimeout(() => {
        if (!this.isCascading && !this.isGameOver && this.getCurrentPlayer().id === current.id) {
          if (turnEl) turnEl.classList.remove('thinking');
          this.playSmartBotMove(current);
        }
      }, 1400);
    }
  }

  // High-IQ Chain Reaction Bot AI with Observable Human Pacing
  playSmartBotMove(bot) {
    if (this.isCascading || this.isGameOver) return;
    const current = this.getCurrentPlayer();
    if (!current || current.id !== bot.id) return;

    const candidates = [];

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.canPlaceOrb(r, c, bot.id)) {
          const crit = this.getCriticalMass(r, c);
          const currentCount = this.grid[r][c].count;
          let score = 0;

          // 1. Positional preference: Corners (crit=2) > Edges (crit=3) > Center (crit=4)
          if (crit === 2) score += 40;
          else if (crit === 3) score += 20;
          else score += 5;

          // 2. High explosive advantage: If this move explodes the cell
          if (currentCount + 1 >= crit) {
            score += 50;
            const neighbors = this.getNeighbors(r, c);
            neighbors.forEach(n => {
              const nCell = this.grid[n.r][n.c];
              if (nCell.playerId && nCell.playerId !== bot.id) {
                // Capturing enemy orbs!
                score += nCell.count * 30;
                // If neighbor is also near critical, massive chain reaction bonus!
                if (nCell.count + 1 >= this.getCriticalMass(n.r, n.c)) {
                  score += 65;
                }
              }
            });
          }

          // 3. Risk analysis: Don't place next to an enemy cell that is ready to explode!
          const neighbors = this.getNeighbors(r, c);
          let isVulnerable = false;
          neighbors.forEach(n => {
            const nCell = this.grid[n.r][n.c];
            if (nCell.playerId && nCell.playerId !== bot.id) {
              const nCrit = this.getCriticalMass(n.r, n.c);
              if (nCell.count === nCrit - 1) {
                // Enemy could detonate on their next turn and steal this!
                score -= 35;
                isVulnerable = true;
              }
            }
          });

          // 4. Safe buildup
          if (!isVulnerable && currentCount + 1 < crit) {
            score += 15;
          }

          candidates.push({ r, c, score: score + Math.random() * 4 });
        }
      }
    }

    if (candidates.length === 0) return;
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    // Highlight target cell for 350ms before placing orb (human hand movement imitation)
    const targetEl = document.querySelector(`.cr-cell[data-r="${best.r}"][data-c="${best.c}"]`);
    if (targetEl) {
      targetEl.style.boxShadow = `inset 0 0 16px ${bot.color.glow}, 0 0 12px ${bot.color.hex}`;
      targetEl.style.borderColor = bot.color.hex;
    }

    setTimeout(() => {
      if (targetEl) {
        targetEl.style.boxShadow = '';
        targetEl.style.borderColor = '';
      }
      if (!this.isCascading && !this.isGameOver && this.getCurrentPlayer().id === bot.id) {
        this.placeOrb(best.r, best.c, bot.id, !this.isSolo);
      }
    }, 350);
  }

  saveHistoryState() {
    if (this.history.length > 20) this.history.shift();
    const gridCopy = this.grid.map(row => row.map(cell => ({ ...cell })));
    const playersCopy = this.players.map(p => ({ ...p }));
    this.history.push({
      grid: gridCopy,
      players: playersCopy,
      currentTurnIndex: this.currentTurnIndex,
      moveCount: this.moveCount
    });
  }

  undo() {
    if (!this.isSolo || this.history.length === 0 || this.isCascading) return;
    const prev = this.history.pop();
    this.grid = prev.grid;
    this.players = prev.players;
    this.currentTurnIndex = prev.currentTurnIndex;
    this.moveCount = prev.moveCount;
    this.isGameOver = false;
    this.updatePlayerStats();
    this.render();
    this.showToast('Move Undone');
  }

  endGame(winner) {
    clearTimeout(this.botTurnTimeout);
    this.botTurnTimeout = null;
    const turnEl = document.getElementById('cr-turn-indicator');
    if (turnEl) turnEl.classList.remove('thinking');

    this.isGameOver = true;
    this.winner = winner;
    window.soundFx.playVictory();

    const banner = document.getElementById('cr-result-banner');
    if (banner) {
      banner.classList.remove('hidden');
      banner.innerHTML = `
        <div class="result-title" style="color:${winner.color.hex}; text-shadow: 0 0 25px ${winner.color.glow}">
          ${winner.name.toUpperCase()} WINS!
        </div>
        <div class="result-reason">Dominated the entire chain reaction board!</div>
        <div class="result-actions" style="margin-top:16px; display:flex; gap:10px; justify-content:center;">
          <button class="btn btn-primary" onclick="window.chainReactionGame.resetGrid(); window.chainReactionGame.render();">Play Again 🔄</button>
          <button class="btn btn-secondary" onclick="window.lobby.returnToLobbyAction()">Back to Lobby</button>
        </div>
      `;
    }
  }

  showToast(msg) {
    const toast = document.getElementById('cr-toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.add('hidden'), 2500);
  }

  getPlayerById(id) {
    return this.players.find(p => p.id === id);
  }

  render() {
    const container = document.getElementById('cr-grid-container');
    if (!container) return;
    container.innerHTML = '';
    container.style.gridTemplateRows = `repeat(${this.rows}, 1fr)`;
    container.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        const crit = this.getCriticalMass(r, c);
        const cellEl = document.createElement('div');
        cellEl.className = 'cr-cell';
        cellEl.dataset.r = r;
        cellEl.dataset.c = c;

        // Is cell critical/unstable? (count === crit - 1)
        const isUnstable = cell.count === crit - 1 && cell.count > 0;
        if (isUnstable) {
          cellEl.classList.add('cell-unstable');
        }

        if (cell.count > 0 && cell.playerId) {
          const owner = this.getPlayerById(cell.playerId);
          const colorHex = owner ? owner.color.hex : '#fff';
          const glowHex = owner ? owner.color.glow : 'rgba(255,255,255,0.4)';

          cellEl.innerHTML = this.renderOrbs(cell.count, colorHex, glowHex, isUnstable);
        }

        cellEl.addEventListener('click', () => this.onCellClick(r, c));
        container.appendChild(cellEl);
      }
    }

    // Top Turn & Player HUD
    const current = this.getCurrentPlayer();
    const turnEl = document.getElementById('cr-turn-indicator');
    if (turnEl && current) {
      const isMe = current.id === this.myId;
      if (isMe) {
        turnEl.classList.remove('thinking');
        turnEl.innerText = "YOUR TURN";
      } else if (current.isBot) {
        if (!turnEl.classList.contains('thinking')) {
          turnEl.innerText = `${current.name.toUpperCase()}'S TURN`;
        }
      } else {
        turnEl.classList.remove('thinking');
        turnEl.innerText = `${current.name.toUpperCase()}'S TURN`;
      }
      turnEl.style.borderColor = current.color.hex;
      turnEl.style.boxShadow = `0 0 16px ${current.color.glow}`;
      turnEl.style.color = current.color.hex;
    }

    // Players list badges with live orb counter
    const badgesContainer = document.getElementById('cr-players-list');
    if (badgesContainer) {
      badgesContainer.innerHTML = '';
      this.players.forEach((p, idx) => {
        const isCurrent = idx === this.currentTurnIndex;
        const b = document.createElement('div');
        b.className = `cr-player-badge ${isCurrent ? 'active' : ''} ${p.isEliminated ? 'eliminated' : ''}`;
        b.style.borderColor = isCurrent ? p.color.hex : 'transparent';
        if (isCurrent) b.style.boxShadow = `0 0 10px ${p.color.glow}`;
        b.innerHTML = `
          <span class="badge-dot" style="background:${p.color.hex}; box-shadow: 0 0 8px ${p.color.glow}"></span>
          <span class="badge-name">${p.name}</span>
          <span class="badge-orbs">(${p.orbs})</span>
          ${p.isEliminated ? '<span class="skull">💀</span>' : ''}
        `;
        badgesContainer.appendChild(b);
      });
    }
  }

  // Pseudo-3D Glowing Atoms with Orbit & Excited Vibration States
  renderOrbs(count, hex, glow, isUnstable) {
    const unstableCls = isUnstable ? 'orb-unstable' : '';
    if (count === 1) {
      return `
        <div class="orb-wrapper single ${unstableCls}">
          <div class="cr-orb atom-1" style="background: radial-gradient(circle at 35% 35%, #fff 0%, ${hex} 55%, #000 100%); box-shadow: 0 0 14px ${glow};"></div>
        </div>
      `;
    } else if (count === 2) {
      return `
        <div class="orb-wrapper double ${unstableCls}">
          <div class="cr-orb atom-1" style="background: radial-gradient(circle at 35% 35%, #fff 0%, ${hex} 55%, #000 100%); box-shadow: 0 0 14px ${glow};"></div>
          <div class="cr-orb atom-2" style="background: radial-gradient(circle at 35% 35%, #fff 0%, ${hex} 55%, #000 100%); box-shadow: 0 0 14px ${glow};"></div>
        </div>
      `;
    } else if (count >= 3) {
      return `
        <div class="orb-wrapper triple ${unstableCls}">
          <div class="cr-orb atom-1" style="background: radial-gradient(circle at 35% 35%, #fff 0%, ${hex} 55%, #000 100%); box-shadow: 0 0 14px ${glow};"></div>
          <div class="cr-orb atom-2" style="background: radial-gradient(circle at 35% 35%, #fff 0%, ${hex} 55%, #000 100%); box-shadow: 0 0 14px ${glow};"></div>
          <div class="cr-orb atom-3" style="background: radial-gradient(circle at 35% 35%, #fff 0%, ${hex} 55%, #000 100%); box-shadow: 0 0 14px ${glow};"></div>
        </div>
      `;
    }
    return '';
  }

  stop() {
    clearTimeout(this.botTurnTimeout);
    this.botTurnTimeout = null;
    this.isCascading = false;
    this.isGameOver = true;
  }
}

window.chainReactionGame = new ChainReactionGame();
