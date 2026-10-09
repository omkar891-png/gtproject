// Cyber Bomb Arena - Grid-Based Real-Time Blast Duels with Power-ups & Tactical Bot AI
class CyberBombermanGame {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.cols = 13;
    this.rows = 11;
    this.grid = []; // 0: empty, 1: solid pillar, 2: destructible crate
    this.players = new Map();
    this.bombs = [];
    this.explosions = [];
    this.powerups = [];
    this.myId = null;
    this.isRunning = false;
    this.lastFrameTime = performance.now();
    this.isSolo = false;
    this.winner = null;
    this.keys = {};
    this.syncInterval = null;

    this.palette = [
      { name: 'Cyan', hex: '#00f2fe', glow: 'rgba(0, 242, 254, 0.8)' },
      { name: 'Crimson', hex: '#ff0055', glow: 'rgba(255, 0, 85, 0.8)' },
      { name: 'Emerald', hex: '#00ff88', glow: 'rgba(0, 255, 136, 0.8)' },
      { name: 'Amber', hex: '#ffd600', glow: 'rgba(255, 214, 0, 0.8)' }
    ];
  }

  init(myPlayer, otherPlayers = [], isSolo = false) {
    this.canvas = document.getElementById('bomberman-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.isSolo = isSolo;
    this.myId = myPlayer.id;
    this.winner = null;
    this.isRunning = true;
    this.bombs = [];
    this.explosions = [];
    this.powerups = [];
    this.players.clear();

    this.initGrid();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Spawn 4 corners
    const spawnCorners = [
      { c: 1, r: 1 },
      { c: 11, r: 1 },
      { c: 1, r: 9 },
      { c: 11, r: 9 }
    ];

    const myCorner = spawnCorners[0];
    const myP = this.createPlayer(this.myId, myPlayer.name, myPlayer.avatar || '🤖', this.palette[0], myCorner.c, myCorner.r, false);
    this.players.set(this.myId, myP);

    // Filter out myPlayer so opponents don't duplicate or overwrite player 0
    const opponents = (otherPlayers || []).filter(p => p && p.id !== this.myId);
    const botNames = ['BlasterBot', 'Dynamo', 'Nitro', 'Sapper'];

    for (let i = 1; i < 4; i++) {
      const corner = spawnCorners[i];
      if (i - 1 < opponents.length) {
        const op = opponents[i - 1];
        this.players.set(op.id, this.createPlayer(op.id, op.name, op.avatar || '🤖', this.palette[i], corner.c, corner.r, op.isBot));
      } else {
        const bId = 'bomb_bot_' + i;
        this.players.set(bId, this.createPlayer(bId, botNames[i], '👾', this.palette[i], corner.c, corner.r, true));
      }
    }

    this.bindControls();
    this.startNetworkSync();
    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  initGrid() {
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        // Border walls
        if (r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1) {
          row.push(1); // Solid
        } else if (r % 2 === 0 && c % 2 === 0) {
          row.push(1); // Fixed pillar
        } else {
          // Clear 3-cell safety pockets around 4 corners
          const isCornerPocket =
            (c <= 2 && r <= 2) ||
            (c >= this.cols - 3 && r <= 2) ||
            (c <= 2 && r >= this.rows - 3) ||
            (c >= this.cols - 3 && r >= this.rows - 3);

          if (isCornerPocket) {
            row.push(0); // Empty
          } else {
            // 70% chance of destructible crate
            row.push(Math.random() < 0.70 ? 2 : 0);
          }
        }
      }
      this.grid.push(row);
    }
  }

  createPlayer(id, name, avatar, color, c, r, isBot) {
    const cs = this.cellSize || 48;
    return {
      id,
      name,
      avatar,
      color,
      x: (c + 0.5) * cs,
      y: (r + 0.5) * cs,
      vx: 0,
      vy: 0,
      speed: 155, // Human pace (155 px/s)
      bombCapacity: 1,
      activeBombs: 0,
      bombRange: 2,
      shield: false,
      dead: false,
      isBot,
      botActionTimer: 0
    };
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const maxW = Math.min(window.innerWidth - 32, 680);
    const maxH = Math.min(window.innerHeight - 180, 560);
    this.cellSize = Math.floor(Math.min(maxW / this.cols, maxH / this.rows));
    this.canvas.width = this.cellSize * this.cols;
    this.canvas.height = this.cellSize * this.rows;
  }

  bindControls() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space' || e.code === 'KeyE') {
        this.dropBomb(this.myId);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    const dropBtn = document.getElementById('bomb-drop-btn');
    if (dropBtn) {
      dropBtn.onclick = (e) => {
        e.preventDefault();
        this.dropBomb(this.myId);
      };
    }

    // Mobile Virtual D-Pad Bindings
    const bindDpadBtn = (id, keyCode) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const start = (e) => {
        if (e.cancelable) e.preventDefault();
        this.keys[keyCode] = true;
        btn.classList.add('pressed');
      };
      const end = (e) => {
        if (e.cancelable) e.preventDefault();
        this.keys[keyCode] = false;
        btn.classList.remove('pressed');
      };
      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', end, { passive: false });
      btn.addEventListener('touchcancel', end, { passive: false });
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', end);
      btn.addEventListener('mouseleave', end);
    };

    bindDpadBtn('btn-bomb-up', 'ArrowUp');
    bindDpadBtn('btn-bomb-down', 'ArrowDown');
    bindDpadBtn('btn-bomb-left', 'ArrowLeft');
    bindDpadBtn('btn-bomb-right', 'ArrowRight');

    const mobileActionBtn = document.getElementById('btn-bomb-action-mobile');
    if (mobileActionBtn) {
      const dropMobile = (e) => {
        if (e.cancelable) e.preventDefault();
        this.dropBomb(this.myId);
        mobileActionBtn.classList.add('pressed');
        setTimeout(() => mobileActionBtn.classList.remove('pressed'), 120);
      };
      mobileActionBtn.addEventListener('touchstart', dropMobile, { passive: false });
      mobileActionBtn.addEventListener('click', dropMobile);
    }
  }

  startNetworkSync() {
    clearInterval(this.syncInterval);
    if (this.isSolo || !window.network || !window.network.roomId) return;

    this.syncInterval = setInterval(() => {
      const my = this.players.get(this.myId);
      if (my && !my.dead) {
        window.network.sendGameAction('BOMB_MOVE', {
          id: my.id,
          x: Math.round(my.x),
          y: Math.round(my.y)
        });
      }
    }, 50);
  }

  dropBomb(playerId, syncRemote = true) {
    const p = this.players.get(playerId);
    if (!p || p.dead || p.activeBombs >= p.bombCapacity) return;

    const c = Math.floor(p.x / this.cellSize);
    const r = Math.floor(p.y / this.cellSize);

    // Don't drop on existing bomb
    if (this.bombs.some(b => b.c === c && b.r === r)) return;

    p.activeBombs++;
    this.bombs.push({
      c, r,
      x: (c + 0.5) * this.cellSize,
      y: (r + 0.5) * this.cellSize,
      timer: 2.4, // 2.4s fuse
      range: p.bombRange,
      ownerId: playerId,
      pulse: 0
    });

    if (syncRemote && window.network && window.network.roomId) {
      window.network.sendGameAction('BOMB_DROP', { playerId });
    }

    window.soundFx.playCardFlick();
  }

  gameLoop(currentTime) {
    if (!this.isRunning) return;
    const dt = Math.min(0.05, (currentTime - this.lastFrameTime) / 1000);
    this.lastFrameTime = currentTime;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  update(dt) {
    const cs = this.cellSize;

    // 1. Update Human Player Movement
    const my = this.players.get(this.myId);
    if (my && !my.dead) {
      let dx = 0;
      let dy = 0;
      if (this.keys['ArrowLeft'] || this.keys['KeyA']) dx = -1;
      else if (this.keys['ArrowRight'] || this.keys['KeyD']) dx = 1;
      if (this.keys['ArrowUp'] || this.keys['KeyW']) dy = -1;
      else if (this.keys['ArrowDown'] || this.keys['KeyS']) dy = 1;

      if (dx !== 0 && dy !== 0) {
        dx *= 0.707; dy *= 0.707;
      }

      this.movePlayerWithCollision(my, dx * my.speed * dt, dy * my.speed * dt);
    }

    // 2. Update Bots (Relaxed, fun human pacing)
    for (const bot of this.players.values()) {
      if (!bot.isBot || bot.dead) continue;
      this.updateBotAI(bot, dt);
    }

    // 3. Update Bombs
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.timer -= dt;
      b.pulse += dt * 6;

      if (b.timer <= 0) {
        this.detonateBomb(b);
        const owner = this.players.get(b.ownerId);
        if (owner) owner.activeBombs = Math.max(0, owner.activeBombs - 1);
        this.bombs.splice(i, 1);
      }
    }

    // 4. Update Explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      exp.life -= dt;
      if (exp.life <= 0) {
        this.explosions.splice(i, 1);
      }
    }

    // 5. Check Player-Powerup Collisions
    for (const p of this.players.values()) {
      if (p.dead) continue;
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const pw = this.powerups[i];
        const dist = Math.hypot(p.x - pw.x, p.y - pw.y);
        if (dist < cs * 0.5) {
          if (pw.type === 'bomb') p.bombCapacity++;
          else if (pw.type === 'range') p.bombRange++;
          else if (pw.type === 'speed') p.speed += 25;
          else if (pw.type === 'shield') p.shield = true;

          window.soundFx.playWeaponPickup();
          if (p.id === this.myId) {
            this.showToast(`Power-up: ${pw.type.toUpperCase()}! ⭐`);
          }
          this.powerups.splice(i, 1);
        }
      }
    }
  }

  movePlayerWithCollision(p, mx, my) {
    const cs = this.cellSize;
    const rad = cs * 0.35;

    // Horizontal check
    const newX = p.x + mx;
    if (!this.checkPlayerTileCollision(newX, p.y, rad)) {
      p.x = newX;
    }

    // Vertical check
    const newY = p.y + my;
    if (!this.checkPlayerTileCollision(p.x, newY, rad)) {
      p.y = newY;
    }
  }

  checkPlayerTileCollision(px, py, rad) {
    const cs = this.cellSize;
    const minC = Math.floor((px - rad) / cs);
    const maxC = Math.floor((px + rad) / cs);
    const minR = Math.floor((py - rad) / cs);
    const maxR = Math.floor((py + rad) / cs);

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return true;
        if (this.grid[r][c] !== 0) return true;
      }
    }
    return false;
  }

  detonateBomb(bomb) {
    const cs = this.cellSize;
    window.soundFx.playExplosion();

    // Create central blast cell
    this.createBlastCell(bomb.c, bomb.r);

    // 4 Directional Laser Blasts
    const dirs = [
      { dc: 1, dr: 0 },
      { dc: -1, dr: 0 },
      { dc: 0, dr: 1 },
      { dc: 0, dr: -1 }
    ];

    dirs.forEach(d => {
      for (let step = 1; step <= bomb.range; step++) {
        const tc = bomb.c + d.dc * step;
        const tr = bomb.r + d.dr * step;

        if (tc < 0 || tc >= this.cols || tr < 0 || tr >= this.rows) break;

        // Solid pillar blocks blast completely
        if (this.grid[tr][tc] === 1) break;

        // Destructible crate breaks and stops blast
        if (this.grid[tr][tc] === 2) {
          this.grid[tr][tc] = 0;
          this.createBlastCell(tc, tr);

          // 40% chance to drop power-up
          if (Math.random() < 0.40) {
            const types = ['bomb', 'range', 'speed', 'shield'];
            this.powerups.push({
              c: tc, r: tr,
              x: (tc + 0.5) * cs,
              y: (tr + 0.5) * cs,
              type: types[Math.floor(Math.random() * types.length)]
            });
          }
          break;
        }

        // Empty tile: spread blast
        this.createBlastCell(tc, tr);

        // Chain-detonate other bombs
        const chainBomb = this.bombs.find(b => b.c === tc && b.r === tr);
        if (chainBomb) chainBomb.timer = 0.05;
      }
    });

    // Check Player Eliminations
    for (const p of this.players.values()) {
      if (p.dead) continue;
      const pc = Math.floor(p.x / cs);
      const pr = Math.floor(p.y / cs);

      const inBlast = this.explosions.some(e => e.c === pc && e.r === pr);
      if (inBlast) {
        if (p.shield) {
          p.shield = false;
          this.showToast(`${p.name}'s shield absorbed the blast! 🛡️`);
        } else {
          p.dead = true;
          window.soundFx.playHeadshotKill();
          this.showToast(`${p.name} eliminated! 💥`);
          this.checkWinCondition();
        }
      }
    }
  }

  createBlastCell(c, r) {
    const cs = this.cellSize;
    this.explosions.push({
      c, r,
      x: (c + 0.5) * cs,
      y: (r + 0.5) * cs,
      life: 0.45
    });
  }

  updateBotAI(bot, dt) {
    const cs = this.cellSize;
    const curC = Math.floor(bot.x / cs);
    const curR = Math.floor(bot.y / cs);

    bot.botActionTimer = (bot.botActionTimer || 0) + dt;

    // Check if bot is currently standing in an active bomb's cross-fire
    let inDanger = false;
    let escapeC = curC;
    let escapeR = curR;

    for (const b of this.bombs) {
      if ((b.c === curC && Math.abs(b.r - curR) <= b.range) ||
          (b.r === curR && Math.abs(b.c - curC) <= b.range)) {
        inDanger = true;
        // Escape perpendicularly
        if (b.c === curC) {
          if (this.grid[curR][curC + 1] === 0) escapeC = curC + 1;
          else if (this.grid[curR][curC - 1] === 0) escapeC = curC - 1;
        } else {
          if (this.grid[curR + 1][curC] === 0) escapeR = curR + 1;
          else if (this.grid[curR - 1][curC] === 0) escapeR = curR - 1;
        }
        break;
      }
    }

    if (inDanger) {
      // Move to safety
      const targetX = (escapeC + 0.5) * cs;
      const targetY = (escapeR + 0.5) * cs;
      const dirX = Math.sign(targetX - bot.x);
      const dirY = Math.sign(targetY - bot.y);
      this.movePlayerWithCollision(bot, dirX * bot.speed * dt, dirY * bot.speed * dt);
      return;
    }

    // If safe, drop bomb near destructible crate
    const neighbors = [
      { c: curC + 1, r: curR },
      { c: curC - 1, r: curR },
      { c: curC, r: curR + 1 },
      { c: curC, r: curR - 1 }
    ];

    const nearCrate = neighbors.some(n =>
      n.c >= 0 && n.c < this.cols && n.r >= 0 && n.r < this.rows && this.grid[n.r][n.c] === 2
    );

    if (nearCrate && bot.botActionTimer > 1.8 && bot.activeBombs === 0) {
      this.dropBomb(bot.id);
      bot.botActionTimer = 0;
      return;
    }

    // Wander casually towards center
    const wanderDirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 }
    ];
    const w = wanderDirs[Math.floor(Math.random() * wanderDirs.length)];
    this.movePlayerWithCollision(bot, w.dx * bot.speed * dt * 0.7, w.dy * bot.speed * dt * 0.7);
  }

  checkWinCondition() {
    const alive = Array.from(this.players.values()).filter(p => !p.dead);
    if (alive.length <= 1) {
      this.winner = alive[0] || null;
      if (this.winner) {
        window.soundFx.playVictory();
        this.showToast(`🏆 ${this.winner.name.toUpperCase()} WINS BOMB ARENA!`);
      }
    }
  }

  render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const cs = this.cellSize;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Floor
    ctx.fillStyle = '#070b16';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Grid Tiles (Pillars & Crates)
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        const x = c * cs;
        const y = r * cs;

        if (cell === 1) {
          // Indestructible Pillar
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.5;
          ctx.fillRect(x + 2, y + 2, cs - 4, cs - 4);
          ctx.strokeRect(x + 2, y + 2, cs - 4, cs - 4);
        } else if (cell === 2) {
          // Destructible Crate
          ctx.fillStyle = '#1e1b4b';
          ctx.strokeStyle = '#ff9100';
          ctx.lineWidth = 1.5;
          ctx.fillRect(x + 3, y + 3, cs - 6, cs - 6);
          ctx.strokeRect(x + 3, y + 3, cs - 6, cs - 6);
          ctx.fillStyle = '#ff9100';
          ctx.font = `${Math.floor(cs * 0.45)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('📦', x + cs / 2, y + cs * 0.68);
        } else {
          // Empty grid lines
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x, y, cs, cs);
        }
      }
    }

    // Power-ups
    this.powerups.forEach(pw => {
      ctx.beginPath();
      ctx.arc(pw.x, pw.y, cs * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = pw.type === 'bomb' ? '#00f2fe' : (pw.type === 'range' ? '#ff0055' : (pw.type === 'speed' ? '#ffd600' : '#00ff88'));
      ctx.fill();
      ctx.font = `${Math.floor(cs * 0.38)}px sans-serif`;
      ctx.textAlign = 'center';
      const icon = pw.type === 'bomb' ? '💣' : (pw.type === 'range' ? '🔥' : (pw.type === 'speed' ? '⚡' : '🛡️'));
      ctx.fillText(icon, pw.x, pw.y + cs * 0.12);
    });

    // Bombs
    this.bombs.forEach(b => {
      const pulseSize = (Math.sin(b.pulse) * 0.1 + 1.0) * (cs * 0.35);
      ctx.save();
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(b.x, b.y, pulseSize, 0, Math.PI * 2);
      ctx.fillStyle = '#ff0055';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x, b.y, pulseSize * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    });

    // Explosions
    this.explosions.forEach(exp => {
      ctx.save();
      ctx.shadowColor = '#ffd600';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#ff0055';
      ctx.fillRect(exp.x - cs / 2, exp.y - cs / 2, cs, cs);
      ctx.fillStyle = '#ffd600';
      ctx.fillRect(exp.x - cs * 0.35, exp.y - cs * 0.35, cs * 0.7, cs * 0.7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(exp.x - cs * 0.18, exp.y - cs * 0.18, cs * 0.36, cs * 0.36);
      ctx.restore();
    });

    // Players
    for (const p of this.players.values()) {
      if (p.dead) continue;
      ctx.save();
      ctx.shadowColor = p.color.glow;
      ctx.shadowBlur = 10;

      // Character circle
      ctx.beginPath();
      ctx.arc(p.x, p.y, cs * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = p.color.hex;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Avatar
      ctx.font = `${Math.floor(cs * 0.38)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(p.avatar, p.x, p.y + cs * 0.12);

      // Shield ring
      if (p.shield) {
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, cs * 0.45, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  showToast(msg) {
    if (window.lobby && window.lobby.showGlobalToast) {
      window.lobby.showGlobalToast(msg);
    }
  }

  stop() {
    this.isRunning = false;
    clearInterval(this.syncInterval);
    this.keys = {};
    this.bombs = [];
    this.explosions = [];
    this.players.clear();
  }
}

window.cyberBombermanGame = new CyberBombermanGame();
