// Slither Battle Royale - Real-Time Neon Snake Arena with Boost, Particle Explosions & Bot AI
class SlitherGame {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.arenaWidth = 2200;
    this.arenaHeight = 2200;
    this.camera = { x: 0, y: 0, width: 800, height: 600, zoom: 1.0 };
    this.snakes = new Map();
    this.orbs = [];
    this.particles = [];
    this.myId = null;
    this.isRunning = false;
    this.lastFrameTime = performance.now();
    this.mouse = { x: 0, y: 0, isDown: false };
    this.keys = {};
    this.isBoosting = false;
    this.syncInterval = null;

    this.palette = [
      { hex: '#00f2fe', glow: 'rgba(0, 242, 254, 0.7)' },
      { hex: '#00ff88', glow: 'rgba(0, 255, 136, 0.7)' },
      { hex: '#ff0055', glow: 'rgba(255, 0, 85, 0.7)' },
      { hex: '#ffd600', glow: 'rgba(255, 214, 0, 0.7)' },
      { hex: '#b026ff', glow: 'rgba(176, 38, 255, 0.7)' },
      { hex: '#ff6d00', glow: 'rgba(255, 109, 0, 0.7)' },
      { hex: '#38bdf8', glow: 'rgba(56, 189, 248, 0.7)' }
    ];
  }

  init(myPlayer, otherPlayers = [], isSolo = false) {
    this.canvas = document.getElementById('slither-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.isSolo = isSolo;
    this.myId = myPlayer.id;
    this.snakes.clear();
    this.particles = [];
    this.isRunning = true;

    // Spawn player snake
    const mySnake = this.createSnake(this.myId, myPlayer.name, myPlayer.avatar || '🐍', this.palette[0], 1100, 1100, false);
    this.snakes.set(this.myId, mySnake);

    // Spawn other players / bots
    const botNames = ['CyberViper', 'NeonAnaconda', 'ShadowCobra', 'QuantumBoa', 'PlasmaSnake', 'GhostReptile'];
    const totalNeeded = isSolo ? 6 : Math.max(otherPlayers.length + 1, 4);

    let colorIdx = 1;
    otherPlayers.forEach(p => {
      if (p.id !== this.myId) {
        this.snakes.set(p.id, this.createSnake(p.id, p.name, p.avatar || '🐍', this.palette[colorIdx % this.palette.length], 400 + Math.random() * 1400, 400 + Math.random() * 1400, p.isBot));
        colorIdx++;
      }
    });

    while (this.snakes.size < totalNeeded) {
      const bIdx = this.snakes.size;
      const bId = 'slither_bot_' + bIdx;
      this.snakes.set(bId, this.createSnake(bId, botNames[bIdx % botNames.length], '🤖', this.palette[colorIdx % this.palette.length], 300 + Math.random() * 1600, 300 + Math.random() * 1600, true));
      colorIdx++;
    }

    // Spawn 160 energy orbs
    this.orbs = [];
    for (let i = 0; i < 180; i++) {
      this.orbs.push(this.createOrb());
    }

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.bindControls();
    this.startNetworkSync();

    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  createSnake(id, name, avatar, color, x, y, isBot) {
    const initialLength = 22;
    const body = [];
    for (let i = 0; i < initialLength; i++) {
      body.push({ x: x - i * 6, y: y });
    }
    return {
      id,
      name,
      avatar,
      color,
      x,
      y,
      angle: Math.random() * Math.PI * 2,
      targetAngle: 0,
      speed: 160,
      boostSpeed: 290,
      isBoosting: false,
      length: initialLength,
      score: 100,
      radius: 12,
      body: body,
      history: body.map(p => ({ ...p })),
      dead: false,
      respawnTimer: 0,
      isBot
    };
  }

  createOrb(x, y, value = 1) {
    const orbColors = ['#00f2fe', '#00ff88', '#ffd600', '#ff0055', '#b026ff'];
    return {
      x: x !== undefined ? x : Math.random() * (this.arenaWidth - 100) + 50,
      y: y !== undefined ? y : Math.random() * (this.arenaHeight - 100) + 50,
      color: orbColors[Math.floor(Math.random() * orbColors.length)],
      radius: Math.min(10, 4 + value * 1.5),
      value: value,
      pulse: Math.random() * Math.PI * 2
    };
  }

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.camera.width = window.innerWidth;
    this.camera.height = window.innerHeight;
  }

  bindControls() {
    // Mouse / Touch Aiming
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    const handleCanvasTouch = (e) => {
      if (e.touches && e.touches[0]) {
        this.mouse.x = e.touches[0].clientX;
        this.mouse.y = e.touches[0].clientY;
      }
    };
    window.addEventListener('touchstart', handleCanvasTouch, { passive: true });
    window.addEventListener('touchmove', handleCanvasTouch, { passive: true });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.isBoosting = true;
    });

    window.addEventListener('mouseup', () => {
      this.isBoosting = false;
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ShiftLeft') this.isBoosting = true;
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'ShiftLeft') this.isBoosting = false;
    });

    // Mobile Virtual Joystick / Boost button
    const boostBtn = document.getElementById('slither-boost-btn');
    if (boostBtn) {
      boostBtn.ontouchstart = (e) => { e.preventDefault(); this.isBoosting = true; };
      boostBtn.ontouchend = (e) => { e.preventDefault(); this.isBoosting = false; };
    }
  }

  startNetworkSync() {
    clearInterval(this.syncInterval);
    if (this.isSolo || !window.network || !window.network.roomId) return;

    this.syncInterval = setInterval(() => {
      const my = this.snakes.get(this.myId);
      if (my && !my.dead) {
        window.network.sendGameAction('SLITHER_MOVE', {
          id: my.id,
          x: Math.round(my.x),
          y: Math.round(my.y),
          angle: Number(my.angle.toFixed(2)),
          isBoosting: my.isBoosting,
          length: my.length,
          score: my.score
        });
      }
    }, 50);
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
    // 1. Update Human Player Aim
    const my = this.snakes.get(this.myId);
    if (my && !my.dead) {
      const screenCx = this.camera.width / 2;
      const screenCy = this.camera.height / 2;
      const targetAngle = Math.atan2(this.mouse.y - screenCy, this.mouse.x - screenCx);

      let diff = targetAngle - my.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      my.angle += diff * Math.min(1, dt * 7.5);
      my.isBoosting = this.isBoosting && my.length > 12;
    }

    // 2. Update Bots (Relaxed, fun human pacing)
    for (const snake of this.snakes.values()) {
      if (!snake.isBot || snake.dead) continue;
      this.updateBotAI(snake, dt);
    }

    // 3. Move all snakes & update body
    for (const snake of this.snakes.values()) {
      if (snake.dead) {
        snake.respawnTimer -= dt;
        if (snake.respawnTimer <= 0) {
          this.respawnSnake(snake);
        }
        continue;
      }

      const spd = snake.isBoosting ? snake.boostSpeed : snake.speed;
      snake.x += Math.cos(snake.angle) * spd * dt;
      snake.y += Math.sin(snake.angle) * spd * dt;

      // Keep within arena bounds
      snake.x = Math.max(30, Math.min(this.arenaWidth - 30, snake.x));
      snake.y = Math.max(30, Math.min(this.arenaHeight - 30, snake.y));

      // Boost drains length gradually
      if (snake.isBoosting) {
        snake.score = Math.max(20, snake.score - 5 * dt);
        if (Math.random() < 0.3) {
          const tail = snake.body[snake.body.length - 1];
          if (tail) this.orbs.push(this.createOrb(tail.x + (Math.random() * 10 - 5), tail.y + (Math.random() * 10 - 5), 1));
        }
      }

      // Update trailing body segments
      const head = { x: snake.x, y: snake.y };
      snake.body.unshift(head);
      const targetSegmentCount = Math.floor(snake.length);
      while (snake.body.length > targetSegmentCount) {
        snake.body.pop();
      }

      // Check orb consumption
      for (let i = this.orbs.length - 1; i >= 0; i--) {
        const o = this.orbs[i];
        const dist = Math.hypot(snake.x - o.x, snake.y - o.y);
        if (dist < snake.radius + o.radius + 6) {
          snake.score += o.value * 10;
          snake.length += o.value * 0.4;
          if (snake.id === this.myId) window.soundFx.playCardFlick();
          this.orbs.splice(i, 1);
          if (this.orbs.length < 160) {
            this.orbs.push(this.createOrb());
          }
        }
      }
    }

    // 4. Check Head-to-Body Collisions (Elimination!)
    for (const attacker of this.snakes.values()) {
      if (attacker.dead) continue;

      for (const other of this.snakes.values()) {
        if (other.id === attacker.id || other.dead) continue;

        // Check if attacker's head hit other snake's body segments
        for (let segIdx = 3; segIdx < other.body.length; segIdx += 2) {
          const seg = other.body[segIdx];
          const dist = Math.hypot(attacker.x - seg.x, attacker.y - seg.y);
          if (dist < attacker.radius + 8) {
            // Attacker is eliminated!
            this.eliminateSnake(attacker, other);
            break;
          }
        }
        if (attacker.dead) break;
      }
    }

    // 5. Camera follow player
    if (my && !my.dead) {
      const targetCamX = my.x - this.camera.width / 2;
      const targetCamY = my.y - this.camera.height / 2;
      this.camera.x += (targetCamX - this.camera.x) * Math.min(1, dt * 8);
      this.camera.y += (targetCamY - this.camera.y) * Math.min(1, dt * 8);
    }
  }

  updateBotAI(bot, dt) {
    // 1. Avoid walls
    const margin = 180;
    if (bot.x < margin) bot.targetAngle = 0;
    else if (bot.x > this.arenaWidth - margin) bot.targetAngle = Math.PI;
    else if (bot.y < margin) bot.targetAngle = Math.PI / 2;
    else if (bot.y > this.arenaHeight - margin) bot.targetAngle = -Math.PI / 2;
    else {
      // 2. Hunt nearest orb
      let nearestOrb = null;
      let minDist = 400;
      this.orbs.forEach(o => {
        const d = Math.hypot(o.x - bot.x, o.y - bot.y);
        if (d < minDist) {
          minDist = d;
          nearestOrb = o;
        }
      });

      if (nearestOrb) {
        bot.targetAngle = Math.atan2(nearestOrb.y - bot.y, nearestOrb.x - bot.x);
      } else {
        bot.targetAngle += (Math.random() - 0.5) * 0.4;
      }

      // 3. Dodge other snake bodies
      for (const other of this.snakes.values()) {
        if (other.id === bot.id || other.dead) continue;
        for (let i = 0; i < other.body.length; i += 4) {
          const seg = other.body[i];
          const d = Math.hypot(bot.x - seg.x, bot.y - seg.y);
          if (d < 50) {
            // Turn sharp away from body
            const avoid = Math.atan2(bot.y - seg.y, bot.x - seg.x);
            bot.targetAngle = avoid;
            break;
          }
        }
      }
    }

    // Natural human turn rate
    let diff = bot.targetAngle - bot.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    bot.angle += diff * Math.min(1, dt * 4.5);
    bot.isBoosting = false;
  }

  eliminateSnake(victim, killer) {
    victim.dead = true;
    victim.respawnTimer = 2.5;

    // Disintegrate body into valuable energy orbs
    for (let i = 0; i < victim.body.length; i += 3) {
      const seg = victim.body[i];
      this.orbs.push(this.createOrb(seg.x + (Math.random() * 16 - 8), seg.y + (Math.random() * 16 - 8), 2));
    }

    window.soundFx.playHeadshotKill();
    if (victim.id === this.myId) {
      this.showToast(`Eliminated by ${killer.name}! Respawning... 💥`);
    } else if (killer.id === this.myId) {
      this.showToast(`You eliminated ${victim.name}! +500 🌟`);
    }
  }

  respawnSnake(snake) {
    snake.dead = false;
    snake.length = 22;
    snake.score = 100;
    snake.x = 400 + Math.random() * 1400;
    snake.y = 400 + Math.random() * 1400;
    snake.angle = Math.random() * Math.PI * 2;
    snake.body = [];
    for (let i = 0; i < 22; i++) {
      snake.body.push({ x: snake.x - i * 6, y: snake.y });
    }
  }

  render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);

    // Arena Floor & Cyber Grid
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, this.arenaWidth, this.arenaHeight);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    const gridSize = 80;
    for (let x = 0; x < this.arenaWidth; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.arenaHeight); ctx.stroke();
    }
    for (let y = 0; y < this.arenaHeight; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.arenaWidth, y); ctx.stroke();
    }

    // Arena Perimeter Glowing Border
    ctx.strokeStyle = '#ff0055';
    ctx.lineWidth = 6;
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = 18;
    ctx.strokeRect(10, 10, this.arenaWidth - 20, this.arenaHeight - 20);
    ctx.shadowBlur = 0;

    // Render Energy Orbs
    this.orbs.forEach(o => {
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
      ctx.fillStyle = o.color;
      ctx.shadowColor = o.color;
      ctx.shadowBlur = 8;
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Render Snakes
    for (const snake of this.snakes.values()) {
      if (snake.dead) continue;
      this.drawSnake(snake);
    }

    ctx.restore();

    // Render HUD (Score & Leaderboard)
    this.renderHUD();
  }

  drawSnake(snake) {
    const ctx = this.ctx;

    // Draw Body Segments
    ctx.save();
    ctx.shadowColor = snake.color.glow;
    ctx.shadowBlur = snake.isBoosting ? 16 : 8;

    for (let i = snake.body.length - 1; i >= 0; i -= 2) {
      const seg = snake.body[i];
      const rad = Math.max(7, snake.radius * (1 - (i / snake.body.length) * 0.35));
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, rad, 0, Math.PI * 2);
      ctx.fillStyle = snake.color.hex;
      ctx.fill();
    }

    // Draw Head
    ctx.beginPath();
    ctx.arc(snake.x, snake.y, snake.radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = snake.color.hex;
    ctx.fill();

    // Eyes
    const eyeDist = 6;
    const eyeAngle = 0.55;
    const leftEyeX = snake.x + Math.cos(snake.angle - eyeAngle) * eyeDist;
    const leftEyeY = snake.y + Math.sin(snake.angle - eyeAngle) * eyeDist;
    const rightEyeX = snake.x + Math.cos(snake.angle + eyeAngle) * eyeDist;
    const rightEyeY = snake.y + Math.sin(snake.angle + eyeAngle) * eyeDist;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(leftEyeX, leftEyeY, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rightEyeX, rightEyeY, 3.5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#060a14';
    ctx.beginPath(); ctx.arc(leftEyeX + Math.cos(snake.angle) * 1.5, leftEyeY + Math.sin(snake.angle) * 1.5, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rightEyeX + Math.cos(snake.angle) * 1.5, rightEyeY + Math.sin(snake.angle) * 1.5, 1.8, 0, Math.PI * 2); ctx.fill();

    // Nametag
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${snake.avatar} ${snake.name}`, snake.x, snake.y - 18);

    ctx.restore();
  }

  renderHUD() {
    const scoreEl = document.getElementById('slither-score-val');
    const my = this.snakes.get(this.myId);
    if (scoreEl && my) {
      scoreEl.innerText = Math.round(my.score);
    }

    // Leaderboard
    const lbContainer = document.getElementById('slither-leaderboard');
    if (lbContainer) {
      const sorted = Array.from(this.snakes.values()).sort((a, b) => b.score - a.score).slice(0, 5);
      lbContainer.innerHTML = sorted.map((s, idx) => `
        <div class="lb-row ${s.id === this.myId ? 'me' : ''}">
          <span>#${idx + 1} ${s.avatar} ${s.name}</span>
          <span style="color:${s.color.hex}">${Math.round(s.score)}</span>
        </div>
      `).join('');
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
    this.syncInterval = null;
    this.snakes.clear();
    this.particles = [];
  }
}

window.slitherGame = new SlitherGame();
