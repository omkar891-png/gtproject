// ==========================================================================
// CARROM KING ROYALE - 300 FPS SUB-STEPPED PHYSICS & HUMANIZED BOT PACING
// Authentic Sheesham & Birchwood Board, 3D Ivory/Ebony/Queen Coins, Slider
// ==========================================================================

class CarromKingGame {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.boardSize = 600;
    this.scale = 1;
    this.dpr = 1;

    // 300 FPS Physics Simulation Parameters
    this.subSteps = 5; // 5 sub-steps per 60Hz frame = 300 FPS physics speed
    this.dtStep = (1 / 60) / this.subSteps; // dt = 1/300 s
    this.frictionPerStep = Math.pow(0.984, 1 / this.subSteps);
    this.restitution = 0.91;
    this.railRestitution = 0.88;

    this.players = [];
    this.currentTurnIdx = 0;
    this.myId = null;
    this.isSolo = false;
    this.isRunning = false;
    this.winner = null;

    // Pieces
    this.pieces = [];
    this.striker = null;

    // Aiming & Input State
    this.isAiming = false;
    this.aimAngle = -Math.PI / 2;
    this.aimPower = 0;
    this.maxPower = 27;
    this.pocketRadius = 27;
    this.pocketFallRadius = 18;

    // Turn resolution & Queen rules
    this.pocketedThisTurn = false;
    this.queenPocketed = false;
    this.queenCoverPending = false;
    this.queenCoverPlayer = null;

    // Bot Animation Sequence State
    this.botPhase = 'IDLE'; // 'IDLE', 'THINKING', 'SLIDING', 'AIMING', 'CHARGING'
    this.botAnim = {
      startTime: 0,
      duration: 0,
      startX: 300,
      targetX: 300,
      startAngle: -Math.PI / 2,
      targetAngle: -Math.PI / 2,
      targetPower: 18
    };

    // 4 Corner Pockets (Offset for authentic net geometry)
    this.pockets = [
      { x: 42, y: 42, name: 'TL' },
      { x: 558, y: 42, name: 'TR' },
      { x: 42, y: 558, name: 'BL' },
      { x: 558, y: 558, name: 'BR' }
    ];

    // Sound toggle
    this.soundEnabled = true;

    // Slider ref
    this.sliderEl = null;
  }

  init(myPlayer, roomPlayers = [], isSolo = false) {
    this.canvas = document.getElementById('carrom-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.isSolo = isSolo;
    this.myId = myPlayer.id;
    this.winner = null;
    this.isRunning = true;
    this.isAiming = false;
    this.pocketedThisTurn = false;
    this.queenPocketed = false;
    this.queenCoverPending = false;
    this.queenCoverPlayer = null;
    this.botPhase = 'IDLE';

    this.sliderEl = document.getElementById('carrom-striker-slider');

    // 2 Players: Player 1 (Bottom, White/Gold), Player 2 / Bot (Top, Black/Crimson)
    const p1Data = (roomPlayers && roomPlayers.length > 0) ? roomPlayers[0] : myPlayer;
    const p2Data = (roomPlayers && roomPlayers.length > 1) ? roomPlayers.find(p => p && p.id !== p1Data.id) : null;
    this.players = [
      {
        id: p1Data.id,
        name: p1Data.name || 'Player 1',
        avatar: p1Data.avatar || '🎯',
        score: 0,
        color: '#ffd700',
        isBot: p1Data.isBot || false,
        baselineY: 486,
        aimDefaultAngle: -Math.PI / 2
      },
      {
        id: (p2Data && p2Data.id) || 'carrom_bot',
        name: (p2Data && p2Data.name) || 'CarromMaster (BOT)',
        avatar: (p2Data && p2Data.avatar) || '🤖',
        score: 0,
        color: '#00f2fe',
        isBot: !p2Data || p2Data.isBot !== false,
        baselineY: 114,
        aimDefaultAngle: Math.PI / 2
      }
    ];

    this.currentTurnIdx = 0;
    this.initBoardPieces();

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.bindControls();
    this.updateHUD();

    requestAnimationFrame(() => this.gameLoop());

    this.checkBotTurn();
  }

  initBoardPieces() {
    this.pieces = [];
    const cx = 300;
    const cy = 300;
    const coinRad = 13.5;

    // Center Red Queen (25 pts)
    this.pieces.push({
      id: 'queen',
      type: 'queen',
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      radius: coinRad,
      color: '#d90429',
      points: 25,
      active: true,
      scale: 1
    });

    // Ring 1: 6 alternating coins (White & Black)
    const ring1Dist = 28;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const isWhite = i % 2 === 0;
      this.pieces.push({
        id: `c1_${i}`,
        type: isWhite ? 'white' : 'black',
        x: cx + Math.cos(a) * ring1Dist,
        y: cy + Math.sin(a) * ring1Dist,
        vx: 0,
        vy: 0,
        radius: coinRad,
        points: isWhite ? 10 : 5,
        active: true,
        scale: 1
      });
    }

    // Ring 2: 12 alternating coins
    const ring2Dist = 56;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const isWhite = i % 2 === 1;
      this.pieces.push({
        id: `c2_${i}`,
        type: isWhite ? 'white' : 'black',
        x: cx + Math.cos(a) * ring2Dist,
        y: cy + Math.sin(a) * ring2Dist,
        vx: 0,
        vy: 0,
        radius: coinRad,
        points: isWhite ? 10 : 5,
        active: true,
        scale: 1
      });
    }

    this.resetStriker();
  }

  resetStriker() {
    const curPlayer = this.players[this.currentTurnIdx];
    const baseY = curPlayer.baselineY;
    const defaultX = 300;

    this.aimAngle = curPlayer.aimDefaultAngle;
    this.aimPower = 0;
    this.isAiming = false;
    this.botPhase = 'IDLE';

    this.striker = {
      x: defaultX,
      y: baseY,
      vx: 0,
      vy: 0,
      radius: 21.5,
      active: true,
      inHand: true,
      scale: 1
    };

    if (this.sliderEl) {
      this.sliderEl.value = defaultX;
      // Disable slider if it's not local human player's turn
      this.sliderEl.disabled = !this.isMyTurn();
    }
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const isMobile = window.innerWidth < 640;
    const availH = window.innerHeight - (isMobile ? 180 : 160);
    const availW = Math.min(window.innerWidth - 32, 580);
    const size = Math.floor(Math.max(290, Math.min(availW, availH)));

    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = size * this.dpr;
    this.canvas.height = size * this.dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;

    this.scale = size / this.boardSize;
  }

  bindControls() {
    let isDraggingStriker = false;
    let dragOriginX = 0;
    let dragOriginY = 0;

    const getBoardPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
      const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY);
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
      return { x: cx / this.scale, y: cy / this.scale };
    };

    // Baseline slider event
    if (this.sliderEl) {
      this.sliderEl.oninput = () => {
        if (!this.isMyTurn() || !this.isBoardStationary() || !this.striker.inHand) return;
        this.setStrikerX(Number(this.sliderEl.value));
      };
    }

    const onStart = (e) => {
      if (!this.isMyTurn() || !this.isBoardStationary() || !this.striker.inHand) return;
      const pos = getBoardPos(e);
      const curPlayer = this.players[this.currentTurnIdx];

      // Check click on striker to initiate aim pull-back
      const d = Math.hypot(pos.x - this.striker.x, pos.y - this.striker.y);
      if (d < this.striker.radius * 1.8) {
        if (e.cancelable) e.preventDefault();
        isDraggingStriker = true;
        dragOriginX = pos.x;
        dragOriginY = pos.y;
        this.isAiming = true;
        return;
      }

      // Check click near baseline to slide striker
      if (Math.abs(pos.y - curPlayer.baselineY) < 32 && pos.x >= 130 && pos.x <= 470) {
        if (e.cancelable) e.preventDefault();
        this.setStrikerX(pos.x);
        if (this.sliderEl) this.sliderEl.value = this.striker.x;
      }
    };

    const onMove = (e) => {
      if (!isDraggingStriker) return;
      if (e.cancelable) e.preventDefault();
      const pos = getBoardPos(e);

      // Slingshot / pull-back aiming
      const pullX = dragOriginX - pos.x;
      const pullY = dragOriginY - pos.y;
      const pullDist = Math.hypot(pullX, pullY);

      this.aimAngle = Math.atan2(pullY, pullX);
      this.aimPower = Math.min(this.maxPower, pullDist * 0.24);
    };

    const onEnd = () => {
      if (!isDraggingStriker) return;
      isDraggingStriker = false;
      this.isAiming = false;

      if (this.aimPower > 2.8) {
        this.flickStriker(this.aimAngle, this.aimPower, true);
      }
      this.aimPower = 0;
    };

    this.canvas.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    this.canvas.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  }

  setStrikerX(x) {
    if (!this.striker) return;
    const clampedX = Math.max(136, Math.min(464, x));
    this.striker.x = clampedX;
    if (this.sliderEl && Math.abs(this.sliderEl.value - clampedX) > 2) {
      this.sliderEl.value = clampedX;
    }
  }

  isMyTurn() {
    const cur = this.players[this.currentTurnIdx];
    return cur && cur.id === this.myId;
  }

  isBoardStationary() {
    if (this.striker && (Math.abs(this.striker.vx) > 0.08 || Math.abs(this.striker.vy) > 0.08)) return false;
    return this.pieces.every(p => !p.active || (Math.abs(p.vx) < 0.08 && Math.abs(p.vy) < 0.08));
  }

  flickStriker(angle, power, syncRemote = true) {
    if (!this.striker) return;
    this.striker.inHand = false;
    const speed = power * 24;
    this.striker.vx = Math.cos(angle) * speed;
    this.striker.vy = Math.sin(angle) * speed;
    this.pocketedThisTurn = false;

    if (window.soundFx && window.soundFx.playCarromFlick) {
      window.soundFx.playCarromFlick();
    }

    if (syncRemote && window.network && window.network.roomId) {
      window.network.sendGameAction('CARROM_FLICK', {
        angle: Number(angle.toFixed(3)),
        power: Number(power.toFixed(2)),
        baseX: Number(this.striker.x.toFixed(1))
      });
    }

    this.updateHUD();
  }

  // ==========================================================================
  // 300 FPS DETERMINISTIC SUB-STEPPED PHYSICS SIMULATION
  // ==========================================================================
  gameLoop() {
    if (!this.isRunning) return;

    // 1. Process 300 FPS Physics Sub-Steps
    for (let s = 0; s < this.subSteps; s++) {
      this.physicsSubStep(this.dtStep);
    }

    // 2. Process Bot Humanized Animation Sequence if in progress
    this.updateBotAnimation();

    // 3. Render High-DPI Board
    this.render();

    requestAnimationFrame(() => this.gameLoop());
  }

  physicsSubStep(dt) {
    const activePieces = this.pieces.filter(p => p.active);
    const allObjs = [...activePieces];
    if (this.striker && this.striker.active && !this.striker.inHand) {
      allObjs.push(this.striker);
    }

    // Position integration, friction & corner pocket gravity suction
    allObjs.forEach(o => {
      o.x += o.vx * dt;
      o.y += o.vy * dt;

      // Realistic surface friction
      o.vx *= this.frictionPerStep;
      o.vy *= this.frictionPerStep;

      if (Math.hypot(o.vx, o.vy) < 1.2) {
        o.vx = 0;
        o.vy = 0;
      }

      // Wooden Rail Bounces (Sheesham beveled cushions)
      const railMargin = 31 + o.radius;
      if (o.x < railMargin) {
        o.x = railMargin;
        o.vx = -o.vx * this.railRestitution;
        if (Math.abs(o.vx) > 30 && window.soundFx && window.soundFx.playCarromClack) {
          window.soundFx.playCarromClack(Math.abs(o.vx));
        }
      } else if (o.x > this.boardSize - railMargin) {
        o.x = this.boardSize - railMargin;
        o.vx = -o.vx * this.railRestitution;
        if (Math.abs(o.vx) > 30 && window.soundFx && window.soundFx.playCarromClack) {
          window.soundFx.playCarromClack(Math.abs(o.vx));
        }
      }

      if (o.y < railMargin) {
        o.y = railMargin;
        o.vy = -o.vy * this.railRestitution;
        if (Math.abs(o.vy) > 30 && window.soundFx && window.soundFx.playCarromClack) {
          window.soundFx.playCarromClack(Math.abs(o.vy));
        }
      } else if (o.y > this.boardSize - railMargin) {
        o.y = this.boardSize - railMargin;
        o.vy = -o.vy * this.railRestitution;
        if (Math.abs(o.vy) > 30 && window.soundFx && window.soundFx.playCarromClack) {
          window.soundFx.playCarromClack(Math.abs(o.vy));
        }
      }

      // Pocket Suction & Sinking
      this.pockets.forEach(pkt => {
        const d = Math.hypot(o.x - pkt.x, o.y - pkt.y);
        if (d < this.pocketRadius) {
          // Centripetal gravitational pull into pocket net
          const pull = (1 - d / this.pocketRadius) * 220;
          o.vx += ((pkt.x - o.x) / (d || 1)) * pull * dt;
          o.vy += ((pkt.y - o.y) / (d || 1)) * pull * dt;

          if (d < this.pocketFallRadius) {
            this.handlePocket(o);
          }
        }
      });
    });

    // Pairwise Circle-to-Circle Elastic Collisions
    for (let i = 0; i < allObjs.length; i++) {
      for (let j = i + 1; j < allObjs.length; j++) {
        const a = allObjs[i];
        const b = allObjs[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.radius + b.radius;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Non-penetrating positional separation
          const overlap = minDist - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          // Relative velocity along normal vector
          const kx = a.vx - b.vx;
          const ky = a.vy - b.vy;
          const velAlongNorm = nx * kx + ny * ky;

          if (velAlongNorm > 0) {
            // Mass: striker is heavier (mass ratio 1.5 : 1.0)
            const massA = a === this.striker ? 1.5 : 1.0;
            const massB = b === this.striker ? 1.5 : 1.0;
            const impulse = (1 + this.restitution) * velAlongNorm / (1 / massA + 1 / massB);

            a.vx -= (impulse / massA) * nx;
            a.vy -= (impulse / massA) * ny;
            b.vx += (impulse / massB) * nx;
            b.vy += (impulse / massB) * ny;

            if (velAlongNorm > 40 && window.soundFx && window.soundFx.playCarromClack) {
              window.soundFx.playCarromClack(velAlongNorm);
            }
          }
        }
      }
    }

    // Check Turn Settle when all movement ceases
    if (this.striker && !this.striker.inHand && this.isBoardStationary()) {
      this.onTurnSettled();
    }
  }

  handlePocket(obj) {
    obj.active = false;
    obj.vx = 0;
    obj.vy = 0;

    const cur = this.players[this.currentTurnIdx];

    if (obj === this.striker) {
      // Striker Foul! -5 points deduction
      if (window.soundFx && window.soundFx.playCarromFoul) {
        window.soundFx.playCarromFoul();
      }
      this.showToast(`⚠️ FOUL! Striker Pocketed by ${cur.name}! (-5 pts)`);
      cur.score = Math.max(0, cur.score - 5);
      this.pocketedThisTurn = false;
    } else {
      // Legitimate coin pocketed!
      this.pocketedThisTurn = true;
      cur.score += obj.points;

      if (window.soundFx && window.soundFx.playCarromPocket) {
        window.soundFx.playCarromPocket();
      }

      if (obj.type === 'queen') {
        this.queenPocketed = true;
        this.queenCoverPending = true;
        this.queenCoverPlayer = cur;
        if (window.soundFx && window.soundFx.playCarromQueenCover) {
          window.soundFx.playCarromQueenCover();
        }
        this.showToast(`👑 QUEEN Pocketed by ${cur.name}! Must Cover Queen with another piece!`);
      } else {
        if (this.queenCoverPending && this.queenCoverPlayer === cur) {
          this.queenCoverPending = false;
          this.showToast(`👑 QUEEN COVERED by ${cur.name}! +25 Bonus Points!`);
        } else {
          this.showToast(`🎯 ${cur.name} pocketed ${obj.type.toUpperCase()}! (+${obj.points} pts)`);
        }
      }
    }

    this.updateHUD();
  }

  onTurnSettled() {
    const cur = this.players[this.currentTurnIdx];

    // Queen Cover failed check
    if (this.queenCoverPending && this.queenCoverPlayer === cur && !this.pocketedThisTurn) {
      // Return queen to center
      const queen = this.pieces.find(p => p.id === 'queen');
      if (queen) {
        queen.active = true;
        queen.x = 300;
        queen.y = 300;
        queen.vx = 0;
        queen.vy = 0;
        cur.score = Math.max(0, cur.score - 25);
        this.showToast(`❌ Queen not covered! Queen returns to center!`);
      }
      this.queenCoverPending = false;
      this.queenCoverPlayer = null;
    }

    // Switch turns unless player scored
    if (!this.pocketedThisTurn) {
      this.currentTurnIdx = (this.currentTurnIdx + 1) % this.players.length;
    }

    this.resetStriker();
    this.updateHUD();

    // Check Victory condition (no active coins remain)
    const remainingCoins = this.pieces.filter(p => p.active);
    if (remainingCoins.length === 0) {
      this.handleVictory();
      return;
    }

    this.checkBotTurn();
  }

  handleVictory() {
    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    this.winner = sorted[0];

    const modal = document.getElementById('carrom-victory-modal');
    const title = document.getElementById('carrom-victory-title');
    const sub = document.getElementById('carrom-victory-sub');
    const p1Name = document.getElementById('carrom-final-p1-name');
    const p1Pts = document.getElementById('carrom-final-p1-pts');
    const p2Name = document.getElementById('carrom-final-p2-name');
    const p2Pts = document.getElementById('carrom-final-p2-pts');

    if (title) title.innerText = `👑 ${this.winner.name.toUpperCase()} WINS!`;
    if (sub) sub.innerText = `Champion of the Carrom King Arena! Final Score: ${this.winner.score} pts`;
    if (p1Name) p1Name.innerText = this.players[0].name;
    if (p1Pts) p1Pts.innerText = this.players[0].score;
    if (p2Name) p2Name.innerText = this.players[1].name;
    if (p2Pts) p2Pts.innerText = this.players[1].score;

    if (modal) modal.classList.remove('hidden');

    if (window.soundFx && window.soundFx.playVictory) {
      window.soundFx.playVictory();
    }
  }

  // ==========================================================================
  // HUMANIZED BOT TURN & PACING SEQUENCE (NO MORE INSTANT SHOTS)
  // ==========================================================================
  checkBotTurn() {
    if (!this.isRunning || this.winner) return;
    const cur = this.players[this.currentTurnIdx];
    if (cur && cur.isBot) {
      this.botPhase = 'THINKING';
      this.updateHUD('🤖 Calculating shot...');

      // Phase 1: Thinking delay (600ms)
      setTimeout(() => {
        if (!this.isRunning || this.currentTurnIdx !== 1) return;
        this.startBotSlidingPhase();
      }, 600);
    }
  }

  startBotSlidingPhase() {
    const activeCoins = this.pieces.filter(p => p.active);
    if (activeCoins.length === 0) return;

    // Strategic coin selection: prioritize queen if available, or closest coin to top/bottom pocket
    let targetCoin = activeCoins.find(p => p.type === 'queen') || activeCoins[0];
    let bestPocket = this.pockets[0];
    let minScore = 99999;

    activeCoins.forEach(coin => {
      this.pockets.forEach(pkt => {
        const dCoinToPocket = Math.hypot(coin.x - pkt.x, coin.y - pkt.y);
        // Preference for pieces closer to opponent's pockets
        const score = dCoinToPocket + (coin.type === 'queen' ? -60 : 0);
        if (score < minScore) {
          minScore = score;
          targetCoin = coin;
          bestPocket = pkt;
        }
      });
    });

    // Best baseline X position to strike
    const coinToPocketAngle = Math.atan2(bestPocket.y - targetCoin.y, bestPocket.x - targetCoin.x);
    // Strike point on back of coin
    const targetPointX = targetCoin.x - Math.cos(coinToPocketAngle) * (targetCoin.radius + 10);
    const targetPointY = targetCoin.y - Math.sin(coinToPocketAngle) * (targetCoin.radius + 10);

    const calculatedX = Math.max(136, Math.min(464, targetPointX));
    const finalAngle = Math.atan2(targetPointY - this.striker.y, targetPointX - calculatedX);
    const finalPower = 14 + Math.random() * 8;

    this.botAnim = {
      startTime: performance.now(),
      startX: this.striker.x,
      targetX: calculatedX,
      targetAngle: finalAngle,
      targetPower: finalPower
    };

    // Phase 2: Smooth Striker Sliding along baseline over 600ms
    this.botPhase = 'SLIDING';
    this.updateHUD('🤖 Sliding striker to angle...');
  }

  updateBotAnimation() {
    if (this.botPhase === 'IDLE' || this.botPhase === 'THINKING') return;

    const now = performance.now();
    const elapsed = now - this.botAnim.startTime;

    if (this.botPhase === 'SLIDING') {
      const duration = 600; // 600ms slide
      const t = Math.min(1, elapsed / duration);
      // Ease out cubic
      const easeT = 1 - Math.pow(1 - t, 3);
      this.striker.x = this.botAnim.startX + (this.botAnim.targetX - this.botAnim.startX) * easeT;

      if (this.sliderEl) {
        this.sliderEl.value = this.striker.x;
      }

      if (t >= 1) {
        // Move to Phase 3: Aim Line Rotation
        this.botPhase = 'AIMING';
        this.isAiming = true;
        this.botAnim.startTime = performance.now();
        this.botAnim.startAngle = this.aimAngle;
        this.updateHUD('🤖 Aiming at target...');
      }
    } else if (this.botPhase === 'AIMING') {
      const duration = 500; // 500ms rotation
      const t = Math.min(1, elapsed / duration);
      const easeT = 1 - Math.pow(1 - t, 2);
      this.aimAngle = this.botAnim.startAngle + (this.botAnim.targetAngle - this.botAnim.startAngle) * easeT;

      if (t >= 1) {
        // Move to Phase 4: Power Charge Pull-back
        this.botPhase = 'CHARGING';
        this.botAnim.startTime = performance.now();
        this.updateHUD('🤖 Charging shot...');
      }
    } else if (this.botPhase === 'CHARGING') {
      const duration = 350; // 350ms charge
      const t = Math.min(1, elapsed / duration);
      this.aimPower = this.botAnim.targetPower * t;

      if (t >= 1) {
        // Phase 5: Release & Flick!
        this.botPhase = 'IDLE';
        this.isAiming = false;
        this.flickStriker(this.botAnim.targetAngle, this.botAnim.targetPower, true);
      }
    }
  }

  // ==========================================================================
  // AUTHENTIC CARROM KING BOARD & PIECES RENDERING
  // ==========================================================================
  render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;

    ctx.save();
    ctx.scale(this.dpr * this.scale, this.dpr * this.scale);

    // 1. Sheesham / Rosewood Outer Border Frame
    ctx.fillStyle = '#2d1408';
    ctx.fillRect(0, 0, this.boardSize, this.boardSize);

    // 2. Birchwood Board Surface
    const birchGrad = ctx.createRadialGradient(300, 300, 40, 300, 300, 290);
    birchGrad.addColorStop(0, '#f5deb3'); // Warm golden birchwood center
    birchGrad.addColorStop(0.7, '#edd0a4');
    birchGrad.addColorStop(1, '#deb887'); // Rich outer patina
    ctx.fillStyle = birchGrad;
    ctx.fillRect(32, 32, this.boardSize - 64, this.boardSize - 64);

    // Subtle wooden grain lines
    ctx.strokeStyle = 'rgba(180, 130, 80, 0.12)';
    ctx.lineWidth = 1;
    for (let r = 80; r < 280; r += 35) {
      ctx.beginPath();
      ctx.arc(300, 300, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3. Four Corner Pockets (Hollow Net Depth with Brass Rims)
    this.pockets.forEach(pkt => {
      // Outer brass ring
      ctx.beginPath();
      ctx.arc(pkt.x, pkt.y, this.pocketRadius + 3, 0, Math.PI * 2);
      ctx.fillStyle = '#b8860b';
      ctx.fill();

      // Deep dark pocket cavity
      ctx.beginPath();
      ctx.arc(pkt.x, pkt.y, this.pocketRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0c';
      ctx.fill();

      // Pocket net woven pattern
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(pkt.x - 12, pkt.y - 12);
      ctx.lineTo(pkt.x + 12, pkt.y + 12);
      ctx.moveTo(pkt.x + 12, pkt.y - 12);
      ctx.lineTo(pkt.x - 12, pkt.y + 12);
      ctx.stroke();
    });

    // 4. Center Rosette / Floral Mandala
    this.renderCenterMandala(ctx);

    // 5. Official Baselines (Top, Bottom, Left, Right)
    this.renderBaselines(ctx);

    // 6. Corner Foul/Aiming Lines with Arrows
    this.renderCornerArrows(ctx);

    // 7. Render Active Coins (3D Ivory, Ebony, Queen)
    this.pieces.forEach(p => {
      if (p.active) this.renderCoin(ctx, p);
    });

    // 8. Render Striker (Acrylic Crystal with Bevel & Grip Ridges)
    if (this.striker && this.striker.active) {
      this.renderStriker(ctx);
    }

    ctx.restore();
  }

  renderCenterMandala(ctx) {
    const cx = 300;
    const cy = 300;

    // Outer circle
    ctx.strokeStyle = '#8b1e0f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, Math.PI * 2);
    ctx.stroke();

    // 12 Mandala Radial Petals
    ctx.strokeStyle = 'rgba(139, 30, 15, 0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * 48, cy + Math.sin(a) * 48);
      ctx.stroke();
    }

    // Inner Red Queen Placement Ring
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#8b1e0f';
    ctx.fill();

    // Golden Queen Centerpiece Star
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
  }

  renderBaselines(ctx) {
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#8b1e0f';

    const drawRail = (x1, y1, x2, y2, offY, isHoriz) => {
      // Double parallel lines
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      if (isHoriz) {
        ctx.moveTo(x1, y1 + offY);
        ctx.lineTo(x2, y2 + offY);
      } else {
        ctx.moveTo(x1 + offY, y1);
        ctx.lineTo(x2 + offY, y2);
      }
      ctx.stroke();

      // Red Circle End Zones
      const drawEndCircle = (cx, cy) => {
        ctx.beginPath();
        ctx.arc(cx, cy, 13, 0, Math.PI * 2);
        ctx.strokeStyle = '#8b1e0f';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, 7.5, 0, Math.PI * 2);
        ctx.fillStyle = '#8b1e0f';
        ctx.fill();
      };

      if (isHoriz) {
        drawEndCircle(x1, y1 + offY / 2);
        drawEndCircle(x2, y2 + offY / 2);
      } else {
        drawEndCircle(x1 + offY / 2, y1);
        drawEndCircle(x2 + offY / 2, y2);
      }
    };

    // Bottom Baseline (y=477 to 495)
    drawRail(136, 477, 464, 477, 18, true);
    // Top Baseline (y=105 to 123)
    drawRail(136, 105, 464, 105, 18, true);
    // Left Baseline (x=105 to 123)
    drawRail(105, 136, 105, 464, 18, false);
    // Right Baseline (x=477 to 495)
    drawRail(477, 136, 477, 464, 18, false);
  }

  renderCornerArrows(ctx) {
    ctx.strokeStyle = '#8b1e0f';
    ctx.lineWidth = 1.5;

    const corners = [
      { sx: 60, sy: 60, ex: 140, ey: 140 },
      { sx: 540, sy: 60, ex: 460, ey: 140 },
      { sx: 60, sy: 540, ex: 140, ey: 460 },
      { sx: 540, sy: 540, ex: 460, ey: 460 }
    ];

    corners.forEach(c => {
      ctx.beginPath();
      ctx.moveTo(c.sx, c.sy);
      ctx.lineTo(c.ex, c.ey);
      ctx.stroke();

      // Semi-circle arrowhead
      ctx.beginPath();
      ctx.arc(c.ex, c.ey, 7, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  renderCoin(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Drop Shadow
    ctx.beginPath();
    ctx.arc(1.5, 2.5, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    if (p.type === 'queen') {
      // 3D Ruby Red Queen with Golden Star
      const rubyGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, p.radius);
      rubyGrad.addColorStop(0, '#ff3366');
      rubyGrad.addColorStop(0.6, '#d90429');
      rubyGrad.addColorStop(1, '#660012');
      ctx.fillStyle = rubyGrad;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Golden Beveled Inner Ring
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius - 4, 0, Math.PI * 2);
      ctx.stroke();

      // 8-Point Golden Star Emblem
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const r1 = 6;
        const r2 = 2.5;
        ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.lineTo(Math.cos(a + Math.PI / 8) * r2, Math.sin(a + Math.PI / 8) * r2);
      }
      ctx.closePath();
      ctx.fill();
    } else if (p.type === 'white') {
      // 3D Ivory White Coin
      const ivoryGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, p.radius);
      ivoryGrad.addColorStop(0, '#ffffff');
      ivoryGrad.addColorStop(0.6, '#f4ecd8');
      ivoryGrad.addColorStop(1, '#d3c2a3');
      ctx.fillStyle = ivoryGrad;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Concentric Engraved Ring
      ctx.strokeStyle = '#bda785';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius - 4, 0, Math.PI * 2);
      ctx.stroke();

      // Center Ivory Dot
      ctx.fillStyle = '#bda785';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 3D Polished Ebony Black Coin
      const ebonyGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, p.radius);
      ebonyGrad.addColorStop(0, '#3a3f47');
      ebonyGrad.addColorStop(0.6, '#1a1d22');
      ebonyGrad.addColorStop(1, '#08090a');
      ctx.fillStyle = ebonyGrad;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Dark Metallic Engraved Ring
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius - 4, 0, Math.PI * 2);
      ctx.stroke();

      // Center Silver Dot
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  renderStriker(ctx) {
    const s = this.striker;
    ctx.save();
    ctx.translate(s.x, s.y);

    // Drop Shadow
    ctx.beginPath();
    ctx.arc(2, 4, s.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

    // Acrylic Crystal Base with Cyan / Golden Royal Sheen
    const strikerGrad = ctx.createRadialGradient(-6, -6, 3, 0, 0, s.radius);
    const isP1 = this.currentTurnIdx === 0;
    if (isP1) {
      strikerGrad.addColorStop(0, '#ffffff');
      strikerGrad.addColorStop(0.4, '#e0f7fa');
      strikerGrad.addColorStop(0.7, '#00e5ff');
      strikerGrad.addColorStop(1, '#0077b6');
    } else {
      strikerGrad.addColorStop(0, '#ffffff');
      strikerGrad.addColorStop(0.4, '#fff9db');
      strikerGrad.addColorStop(0.7, '#ffd166');
      strikerGrad.addColorStop(1, '#f77f00');
    }
    ctx.fillStyle = strikerGrad;
    ctx.beginPath();
    ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
    ctx.fill();

    // Outer Metallic Chrome Bevel Ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // 8 Radial Grip Ridges
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (s.radius - 6), Math.sin(a) * (s.radius - 6));
      ctx.lineTo(Math.cos(a) * (s.radius - 1), Math.sin(a) * (s.radius - 1));
      ctx.stroke();
    }

    // Inner Glowing Core Jewel
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = isP1 ? '#00f2fe' : '#ffd700';
    ctx.shadowColor = isP1 ? 'rgba(0, 242, 254, 0.9)' : 'rgba(255, 215, 0, 0.9)';
    ctx.shadowBlur = 10;
    ctx.fill();

    // Aim Line / Trajectory Arrow when aiming
    if (this.isAiming && this.aimPower > 0.8) {
      ctx.restore(); // Exit striker transform to draw absolute board trajectory
      ctx.save();

      const arrowLen = Math.min(180, this.aimPower * 7.5);
      const endX = s.x + Math.cos(this.aimAngle) * arrowLen;
      const endY = s.y + Math.sin(this.aimAngle) * arrowLen;

      // Dashed Aim Trajectory
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2.8;
      ctx.setLineDash([7, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead
      const headAngle = Math.atan2(endY - s.y, endX - s.x);
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - Math.cos(headAngle - 0.45) * 14, endY - Math.sin(headAngle - 0.45) * 14);
      ctx.lineTo(endX - Math.cos(headAngle + 0.45) * 14, endY - Math.sin(headAngle + 0.45) * 14);
      ctx.closePath();
      ctx.fillStyle = '#ffd700';
      ctx.fill();

      // Power Gauge arc behind striker
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius + 6, this.aimAngle - Math.PI / 2, this.aimAngle + Math.PI / 2);
      ctx.strokeStyle = `rgba(255, 215, 0, ${Math.min(1, this.aimPower / this.maxPower)})`;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      ctx.restore();
      return;
    }

    ctx.restore();
  }

  updateHUD(customStatus = null) {
    const cur = this.players[this.currentTurnIdx];
    const isP1Turn = this.currentTurnIdx === 0;

    const p1Score = document.getElementById('carrom-p1-score');
    const p2Score = document.getElementById('carrom-p2-score');
    const p1Capsule = document.getElementById('carrom-p1-capsule');
    const p2Capsule = document.getElementById('carrom-p2-capsule');
    const p1Ring = document.getElementById('carrom-p1-ring');
    const p2Ring = document.getElementById('carrom-p2-ring');
    const p1Status = document.getElementById('carrom-p1-status');
    const p2Status = document.getElementById('carrom-p2-status');
    const p1Name = document.getElementById('carrom-p1-name');
    const p2Name = document.getElementById('carrom-p2-name');

    if (p1Score) p1Score.innerText = this.players[0].score;
    if (p2Score) p2Score.innerText = this.players[1].score;
    if (p1Name) p1Name.innerText = this.players[0].name;
    if (p2Name) p2Name.innerText = this.players[1].name;

    if (p1Capsule) p1Capsule.classList.toggle('active-turn', isP1Turn);
    if (p2Capsule) p2Capsule.classList.toggle('active-turn', !isP1Turn);
    if (p1Ring) p1Ring.classList.toggle('active', isP1Turn);
    if (p2Ring) p2Ring.classList.toggle('active', !isP1Turn);

    if (isP1Turn) {
      if (p1Status) p1Status.innerText = customStatus || (this.isMyTurn() ? 'Your Turn - Drag Striker to Aim & Flick!' : `${cur.name}'s Shot`);
      if (p2Status) p2Status.innerText = 'Waiting...';
    } else {
      if (p1Status) p1Status.innerText = 'Waiting...';
      if (p2Status) p2Status.innerText = customStatus || (cur.isBot ? '🤖 Thinking...' : `${cur.name}'s Shot`);
    }

    if (this.sliderEl) {
      this.sliderEl.disabled = !this.isMyTurn() || !this.isBoardStationary();
    }
  }

  showToast(msg) {
    if (window.lobby && window.lobby.showGlobalToast) {
      window.lobby.showGlobalToast(msg);
    }
  }

  toggleAudio() {
    this.soundEnabled = !this.soundEnabled;
    const btn = document.getElementById('carrom-audio-toggle');
    if (btn) btn.innerText = this.soundEnabled ? '🔊' : '🔇';
    if (window.soundFx) window.soundFx.toggleMute();
  }

  resetGame() {
    const modal = document.getElementById('carrom-victory-modal');
    if (modal) modal.classList.add('hidden');
    this.players[0].score = 0;
    this.players[1].score = 0;
    this.currentTurnIdx = 0;
    this.winner = null;
    this.initBoardPieces();
    this.updateHUD();
    this.checkBotTurn();
  }

  stop() {
    this.isRunning = false;
  }
}

// Bind both names for 100% backward compatibility with lobby.js
window.neonCarromGame = window.carromGame = new CarromKingGame();
