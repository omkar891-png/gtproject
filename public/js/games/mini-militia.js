// ==========================================================================
// MINI MILITIA 2D COMBAT ARENA - PUBG TACTICAL HORIZONTAL FULLSCREEN EDITION
// Ultra-Smooth 120Hz Sub-Stepped Physics, Procedural Soldiers, Dynamic Camera
// ==========================================================================

class MiniMilitiaGame {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.isRunning = false;
    this.myId = null;
    this.players = new Map(); // id -> PlayerState
    this.bullets = [];
    this.grenades = [];
    this.particles = [];
    this.pickups = [];
    this.killFeed = [];
    this.damageNumbers = [];
    this.compassSoundMarkers = []; // Temporary gunshot/footstep pings
    this.isSolo = false;

    // Tactical High-Stakes Battlefield (Spacious 2200 x 1100 layout)
    this.map = {
      width: 2200,
      height: 1100,
      platforms: [
        { x: 0, y: 1020, w: 2200, h: 80, oneWay: false }, // Floor Bunker
        { x: 0, y: 0, w: 50, h: 1100, oneWay: false },     // Left Perimeter Wall
        { x: 2150, y: 0, w: 50, h: 1100, oneWay: false },  // Right Perimeter Wall
        { x: 0, y: 0, w: 2200, h: 50, oneWay: false },   // Reinforced Ceiling
        // Strategic Droppable Platforms & Fortified Outposts
        { x: 160, y: 840, w: 380, h: 24, oneWay: true },
        { x: 1660, y: 840, w: 380, h: 24, oneWay: true },
        { x: 720, y: 740, w: 760, h: 28, oneWay: false }, // Center Bunker Deck
        { x: 240, y: 580, w: 440, h: 24, oneWay: true },
        { x: 1520, y: 580, w: 440, h: 24, oneWay: true },
        { x: 780, y: 460, w: 640, h: 24, oneWay: true },
        { x: 420, y: 340, w: 340, h: 22, oneWay: true },
        { x: 1440, y: 340, w: 340, h: 22, oneWay: true },
        { x: 940, y: 210, w: 320, h: 22, oneWay: true }   // Top Sniper Eagle Nest
      ]
    };

    // Ultra-Smooth PUBG Dynamic Camera
    this.camera = {
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
      zoom: 1.0,
      targetZoom: 1.0,
      shake: 0,
      shakeAngle: 0
    };

    // Input States
    this.keys = {};
    this.mouse = { x: 640, y: 360, isDown: false, screenX: 640, screenY: 360, isRightDown: false };
    this.touchLeft = { active: false, startX: 0, startY: 0, dx: 0, dy: 0, isSprintLocked: false };
    this.touchRight = { active: false, startX: 0, startY: 0, dx: 0, dy: 0, targetAngle: 0, hasAim: false };
    this.dedicatedFireActive = false;

    // Tactical Settings
    this.isADS = false; // Aim Down Sights / Scope mode
    this.autoFireEnabled = true;
    this.dynamicZoomEnabled = true;
    this.screenShakeEnabled = true;
    this.sensitivity = 0.7; // Calibrated Medium touch sensitivity

    // Sub-Stepping Physics Accumulator (120Hz deterministic step)
    this.lastFrameTime = performance.now();
    this.accumulator = 0;
    this.physicsStep = 1 / 120; // 8.33ms per step
    this.dpr = 1;

    // Weapon & Combat Timers
    this.syncInterval = null;
    this.lastFireTime = 0;
    this.isReloading = false;
    this.reloadProgress = 0;
    this.reloadDuration = 1.25;
    this.hitMarkerTimer = 0;
    this.hitMarkerType = 'body'; // 'body', 'headshot', 'kill'
    this.damageVignetteAlpha = 0;
    this.eliminationBannerTimer = 0;
    this.eliminationBannerText = '';

    // FPS & Performance stats
    this.frameCount = 0;
    this.fpsTimer = performance.now();
    this.currentFps = 120;

    // Grenade trajectory preview
    this.aimingGrenade = false;

    // Orientation guard state
    this.rotateDismissed = false;
  }

  init(myPlayer, otherPlayers = [], isSolo = false) {
    this.canvas = document.getElementById('mini-militia-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.isSolo = isSolo;
    this.myId = myPlayer.id;
    this.players.clear();
    this.bullets = [];
    this.grenades = [];
    this.particles = [];
    this.damageNumbers = [];
    this.killFeed = [];
    this.compassSoundMarkers = [];

    // Ensure Fullscreen horizontal presentation
    document.body.classList.add('mm-fullscreen-active');
    this.requestLandscapeFullscreen();
    this.checkOrientation();

    this.resizeCanvas();
    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this.checkOrientation();
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.resizeCanvas();
        this.checkOrientation();
      }, 150);
    });

    // Spawn Local Player
    const myP = this.createPlayer(this.myId, myPlayer.name, myPlayer.avatar || '🪖', '#00f2fe', 380, 800, false);
    this.players.set(this.myId, myP);

    // Distinct Army Palette for combatants
    const colors = ['#ff0055', '#00ff88', '#b026ff', '#ffd600', '#ff6d00', '#38bdf8', '#ff3366'];
    otherPlayers.forEach((p, idx) => {
      if (p.id !== this.myId) {
        this.players.set(p.id, this.createPlayer(p.id, p.name, p.avatar || '🎯', colors[idx % colors.length], 680 + idx * 240, 600, p.isBot));
      }
    });

    // Populate Bots if room has less than 4 players (only host or solo simulates bots)
    const isHost = this.isSolo || (window.network && window.network.isHost);
    if (isHost && this.players.size < 4) {
      const botNames = ['PUBG_Ghost', 'DeltaViper', 'DoomMarine', 'ShadowSniper'];
      const botAvatars = ['🪖', '🎯', '🦾', '🔥'];
      const needed = 4 - this.players.size;
      for (let i = 0; i < needed; i++) {
        const botId = 'mm_bot_' + i;
        this.players.set(botId, this.createPlayer(botId, botNames[i % botNames.length], botAvatars[i % botAvatars.length], colors[(i + 2) % colors.length], 520 + i * 360, 480, true));
      }
    }

    this.spawnPickups();
    this.bindControls();
    this.isRunning = true;
    this.startNetworkSync();
    this.lastFrameTime = performance.now();

    // Start 120Hz Render & Simulation Loop
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  // Request Landscape Fullscreen Mode (PUBG horizontal experience)
  requestLandscapeFullscreen() {
    if (window.ReactNativeWebView) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LOCK_LANDSCAPE' }));
      } catch (e) {}
    }
    try {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {});
      else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();

      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (e) {
      console.warn('Orientation lock not supported', e);
    }
  }

  dismissRotateWarning() {
    this.rotateDismissed = true;
    const overlay = document.getElementById('mm-rotate-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  checkOrientation() {
    const overlay = document.getElementById('mm-rotate-overlay');
    if (!overlay) return;
    const isPortrait = window.innerWidth < window.innerHeight && window.innerWidth < 850;
    if (isPortrait && !this.rotateDismissed) {
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.requestLandscapeFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  }

  toggleAudio() {
    const isMuted = window.soundFx.toggleMute();
    const btn = document.getElementById('mm-audio-btn');
    if (btn) btn.innerText = isMuted ? '🔇' : '🔊';
  }

  exitMatch() {
    this.stop();
    document.body.classList.remove('mm-fullscreen-active');
    if (window.ReactNativeWebView) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'UNLOCK_ORIENTATION' }));
      } catch (e) {}
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    if (window.returnToLobbyAction) {
      window.returnToLobbyAction();
    } else if (window.lobby) {
      window.lobby.showView('lobby');
    }
  }

  toggleSettingsModal() {
    const modal = document.getElementById('mm-settings-modal');
    if (modal) modal.classList.toggle('hidden');
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
    this.dpr = Math.min(2, window.devicePixelRatio || 1);

    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.camera.width = rect.width;
    this.camera.height = rect.height;
  }

  createPlayer(id, name, avatar, color, x, y, isBot) {
    return {
      id,
      name,
      avatar,
      color,
      x,
      y,
      vx: 0,
      vy: 0,
      targetX: x,
      targetY: y,
      targetVx: 0,
      targetVy: 0,
      targetAngle: 0,
      facing: 1, // -1 facing left, 1 facing right
      facingLerp: 1,
      width: 32,
      height: 48,
      crouching: false,
      droppingDown: false,
      dropTimer: 0,
      aimAngle: 0,
      walkPhase: 0,
      tiltAngle: 0,
      gunRecoilX: 0,
      gunRecoilAngle: 0,
      hp: 100,
      maxHp: 100,
      lagHp: 100, // Lagging yellow damage trail (signature PUBG)
      lagHpTimer: 0,
      nitro: 100,
      maxNitro: 100,
      isBoosting: false,
      isGrounded: false,
      weapon: 'rifle', // rifle, shotgun, sniper, rocket
      ammo: 30,
      maxAmmo: 30,
      grenades: 3,
      kills: 0,
      deaths: 0,
      isBot,
      botActionTimer: 0,
      botTargetId: null,
      dead: false,
      respawnTimer: 0,
      lastDamageTime: 0,
      meleeCooldown: 0,
      muzzleTimer: 0
    };
  }

  spawnPickups() {
    this.pickups = [
      { type: 'health', x: 1100, y: 700, size: 28, active: true },
      { type: 'sniper', x: 1100, y: 175, size: 30, active: true }, // Top sniper perch
      { type: 'rocket', x: 380, y: 545, size: 30, active: true },
      { type: 'shotgun', x: 1740, y: 545, size: 30, active: true },
      { type: 'health', x: 350, y: 990, size: 28, active: true },
      { type: 'health', x: 1850, y: 990, size: 28, active: true }
    ];
  }

  bindControls() {
    // Keyboard Controls
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyG') this.throwGrenade(this.myId);
      if (e.code === 'KeyR') this.reloadWeapon();
      if (e.code === 'KeyE' || e.code === 'KeyF') this.meleePunch(this.myId);
      if (e.code === 'KeyQ') this.toggleADS();
      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        const my = this.players.get(this.myId);
        if (my) {
          my.crouching = true;
          if (this.keys['Space'] || this.keys['KeyW']) {
            my.droppingDown = true;
            my.dropTimer = 0.35;
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        const my = this.players.get(this.myId);
        if (my) my.crouching = false;
      }
    });

    // Mouse & Canvas Aiming
    if (this.canvas) {
      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.screenX = e.clientX - rect.left;
        this.mouse.screenY = e.clientY - rect.top;
      });

      this.canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
          this.mouse.isDown = true;
        } else if (e.button === 2) {
          e.preventDefault();
          this.toggleADS();
        }
      });

      this.canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0) this.mouse.isDown = false;
      });

      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // Settings listeners
    const autoFireEl = document.getElementById('setting-autofire');
    if (autoFireEl) autoFireEl.onchange = (e) => { this.autoFireEnabled = e.target.checked; };
    const zoomEl = document.getElementById('setting-dynamic-zoom');
    if (zoomEl) zoomEl.onchange = (e) => { this.dynamicZoomEnabled = e.target.checked; };
    const shakeEl = document.getElementById('setting-screen-shake');
    if (shakeEl) shakeEl.onchange = (e) => { this.screenShakeEnabled = e.target.checked; };
    const sensEl = document.getElementById('setting-sensitivity');
    const sensTxt = document.getElementById('setting-sens-val');
    if (sensEl) {
      sensEl.value = this.sensitivity;
      const updateSensLabel = (val) => {
        let label = `${val.toFixed(1)}x`;
        if (val <= 0.45) label += ' (Low)';
        else if (val >= 0.55 && val <= 0.85) label += ' (Medium)';
        else if (val > 0.85) label += ' (High)';
        if (sensTxt) sensTxt.innerText = label;
      };
      updateSensLabel(this.sensitivity);
      sensEl.oninput = (e) => {
        this.sensitivity = parseFloat(e.target.value);
        updateSensLabel(this.sensitivity);
      };
    }

    this.bindTouchControls();
  }

  toggleADS() {
    this.isADS = !this.isADS;
    const scopeOverlay = document.getElementById('mm-scope-overlay');
    const scopeBtn = document.getElementById('touch-btn-scope');
    if (scopeOverlay) scopeOverlay.classList.toggle('hidden', !this.isADS);
    if (scopeBtn) scopeBtn.style.borderColor = this.isADS ? '#ffd600' : 'rgba(255, 255, 255, 0.3)';
    window.soundFx.playCardFlick();
  }

  bindTouchControls() {
    const leftPad = document.getElementById('touch-stick-left');
    const rightPad = document.getElementById('touch-stick-right');
    const fireBtn = document.getElementById('touch-btn-fire');
    const scopeBtn = document.getElementById('touch-btn-scope');
    const crouchBtn = document.getElementById('touch-btn-crouch');
    const grenadeBtn = document.getElementById('touch-btn-grenade');
    const reloadBtn = document.getElementById('touch-btn-reload');
    const meleeBtn = document.getElementById('touch-btn-melee');

    // Left Joystick (Movement, Jetpack & Sprint Lock - Medium Sensitivity)
    if (leftPad) {
      const knob = leftPad.querySelector('.stick-knob');
      const onTouchLeft = (e) => {
        e.preventDefault();
        const t = e.touches[0];
        const r = leftPad.getBoundingClientRect();
        this.touchLeft.active = true;
        this.touchLeft.startX = r.left + r.width / 2;
        this.touchLeft.startY = r.top + r.height / 2;
        const dx = t.clientX - this.touchLeft.startX;
        const dy = t.clientY - this.touchLeft.startY;
        const dist = Math.hypot(dx, dy);
        const maxDist = 52;
        const deadzone = 8;
        const angle = Math.atan2(dy, dx);

        if (dist < deadzone) {
          this.touchLeft.dx = 0;
          this.touchLeft.dy = 0;
          if (knob) knob.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;
        } else {
          // Calibrated medium progressive curve
          const effectiveDist = Math.min(maxDist - deadzone, dist - deadzone);
          const norm = effectiveDist / (maxDist - deadzone);
          const curve = Math.pow(norm, 1.55);
          this.touchLeft.dx = Math.cos(angle) * curve;
          this.touchLeft.dy = Math.sin(angle) * curve;

          const clampedDist = Math.min(maxDist, dist);
          if (knob) {
            knob.style.transform = `translate(${Math.cos(angle) * clampedDist}px, ${Math.sin(angle) * clampedDist}px)`;
          }
        }

        // Upward pull = Jetpack flight. Pull into top sprint latch locks boost!
        if (dy < -58) {
          this.touchLeft.isSprintLocked = true;
        }

        const my = this.players.get(this.myId);
        if (my) {
          my.crouching = this.touchLeft.dy > 0.65;
          if (this.touchLeft.dy > 0.88) {
            my.droppingDown = true;
            my.dropTimer = 0.35;
          }
        }
      };

      leftPad.addEventListener('touchstart', onTouchLeft, { passive: false });
      leftPad.addEventListener('touchmove', onTouchLeft, { passive: false });
      const endLeft = (e) => {
        e.preventDefault();
        this.touchLeft.active = false;
        this.touchLeft.dx = 0;
        this.touchLeft.dy = 0;
        this.touchLeft.isSprintLocked = false;
        const my = this.players.get(this.myId);
        if (my) my.crouching = false;
        if (knob) knob.style.transform = 'translate(0px, 0px)';
      };
      leftPad.addEventListener('touchend', endLeft);
      leftPad.addEventListener('touchcancel', endLeft);
    }

    // Right Joystick (360° Laser Aim & Auto-Shoot - Medium Sensitivity with Angular Smoothing)
    if (rightPad) {
      const knob = rightPad.querySelector('.stick-knob');
      const onTouchRight = (e) => {
        e.preventDefault();
        const t = e.touches[0];
        const r = rightPad.getBoundingClientRect();
        this.touchRight.active = true;
        this.touchRight.startX = r.left + r.width / 2;
        this.touchRight.startY = r.top + r.height / 2;
        const dx = t.clientX - this.touchRight.startX;
        const dy = t.clientY - this.touchRight.startY;
        const dist = Math.hypot(dx, dy);
        const maxDist = 52;
        const aimDeadzone = 12;
        const angle = Math.atan2(dy, dx);

        if (dist < aimDeadzone) {
          // Deadzone: do not rotate gun or shoot on slight thumb touch
          this.touchRight.hasAim = false;
          this.touchRight.dx = 0;
          this.touchRight.dy = 0;
          if (this.autoFireEnabled && !this.dedicatedFireActive) {
            this.mouse.isDown = false;
          }
          if (knob) knob.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;
        } else {
          this.touchRight.hasAim = true;
          this.touchRight.targetAngle = angle;
          this.touchRight.dx = Math.cos(angle);
          this.touchRight.dy = Math.sin(angle);

          // Auto-shoot only when deliberately pulled past 60% deflection (dist > 32px)
          if (this.autoFireEnabled) {
            this.mouse.isDown = dist > 32;
          }

          const clampedDist = Math.min(maxDist, dist);
          if (knob) {
            knob.style.transform = `translate(${Math.cos(angle) * clampedDist}px, ${Math.sin(angle) * clampedDist}px)`;
          }
        }
      };

      rightPad.addEventListener('touchstart', onTouchRight, { passive: false });
      rightPad.addEventListener('touchmove', onTouchRight, { passive: false });
      const endRight = (e) => {
        e.preventDefault();
        this.touchRight.active = false;
        this.touchRight.hasAim = false;
        this.touchRight.dx = 0;
        this.touchRight.dy = 0;
        if (this.autoFireEnabled && !this.dedicatedFireActive) {
          this.mouse.isDown = false;
        }
        if (knob) knob.style.transform = 'translate(0px, 0px)';
      };
      rightPad.addEventListener('touchend', endRight);
      rightPad.addEventListener('touchcancel', endRight);
    }

    // Dedicated PUBG Bullet Fire Trigger
    if (fireBtn) {
      fireBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.dedicatedFireActive = true;
        this.mouse.isDown = true;
      });
      fireBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.dedicatedFireActive = false;
        if (!this.touchRight.active || !this.autoFireEnabled) {
          this.mouse.isDown = false;
        }
      });
    }

    if (scopeBtn) {
      scopeBtn.onclick = (e) => {
        e.preventDefault();
        this.toggleADS();
      };
    }

    if (crouchBtn) {
      crouchBtn.onclick = (e) => {
        e.preventDefault();
        const my = this.players.get(this.myId);
        if (my) {
          my.crouching = !my.crouching;
          if (my.crouching) {
            my.droppingDown = true;
            my.dropTimer = 0.35;
          }
        }
      };
    }

    if (grenadeBtn) {
      grenadeBtn.onclick = (e) => {
        e.preventDefault();
        this.throwGrenade(this.myId);
      };
    }

    if (reloadBtn) {
      reloadBtn.onclick = (e) => {
        e.preventDefault();
        this.reloadWeapon();
      };
    }

    if (meleeBtn) {
      meleeBtn.onclick = (e) => {
        e.preventDefault();
        this.meleePunch(this.myId);
      };
    }
  }

  startNetworkSync() {
    clearInterval(this.syncInterval);
    if (this.isSolo || !window.network || !window.network.roomId) return;

    this.syncInterval = setInterval(() => {
      const my = this.players.get(this.myId);
      if (my && !my.dead) {
        window.network.sendMiniMilitiaEvent('PLAYER_MOVE', {
          id: my.id,
          x: Math.round(my.x),
          y: Math.round(my.y),
          vx: Math.round(my.vx),
          vy: Math.round(my.vy),
          aimAngle: Number(my.aimAngle.toFixed(3)),
          isBoosting: my.isBoosting,
          crouching: my.crouching,
          hp: my.hp,
          nitro: Math.round(my.nitro),
          weapon: my.weapon,
          dead: my.dead
        });
      }

      // If host, sync bot positions
      if (window.network.isHost) {
        for (const p of this.players.values()) {
          if (p.isBot && !p.dead) {
            window.network.sendMiniMilitiaEvent('PLAYER_MOVE', {
              id: p.id,
              x: Math.round(p.x),
              y: Math.round(p.y),
              vx: Math.round(p.vx),
              vy: Math.round(p.vy),
              aimAngle: Number(p.aimAngle.toFixed(3)),
              isBoosting: p.isBoosting,
              crouching: p.crouching,
              hp: p.hp,
              nitro: Math.round(p.nitro),
              weapon: p.weapon,
              dead: p.dead
            });
          }
        }
      }
    }, 40); // 25 updates/sec network sync
  }

  // ==========================================================================
  // MAIN GAME LOOP (120HZ SUB-STEPPED SIMULATION + EXTREME SMOOTHNESS)
  // ==========================================================================
  gameLoop(currentTime) {
    if (!this.isRunning) return;

    const frameDt = Math.min(0.08, (currentTime - this.lastFrameTime) / 1000);
    this.lastFrameTime = currentTime;

    // Fixed 120Hz sub-step accumulator (eliminates stutter on 60/90/120/144Hz)
    this.accumulator += frameDt;
    let steps = 0;
    while (this.accumulator >= this.physicsStep && steps < 8) {
      this.fixedPhysicsUpdate(this.physicsStep);
      this.accumulator -= this.physicsStep;
      steps++;
    }

    // Frame-rate and visual interpolation updates
    this.renderUpdate(frameDt);
    this.render();

    // FPS Meter
    this.frameCount++;
    if (currentTime - this.fpsTimer > 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / (currentTime - this.fpsTimer));
      this.frameCount = 0;
      this.fpsTimer = currentTime;
      const fpsEl = document.getElementById('mm-fps-ping');
      if (fpsEl) fpsEl.innerText = `${this.currentFps} FPS • 16ms`;
    }

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  // Deterministic 120Hz Physics Sub-Step
  fixedPhysicsUpdate(step) {
    const my = this.players.get(this.myId);

    // 1. Local Player Movement & Jetpack Physics
    if (my && !my.dead) {
      let moveX = 0;
      let boost = false;

      if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveX -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) moveX += 1;
      if (this.keys['KeyW'] || this.keys['ArrowUp'] || this.keys['Space']) boost = true;

      if (this.touchLeft.active) {
        moveX = this.touchLeft.dx;
        if (this.touchLeft.dy < -0.45 || this.touchLeft.isSprintLocked) boost = true;
      }

      // Smooth horizontal acceleration and friction
      const targetSpeed = my.crouching ? 220 : (this.isADS ? 260 : 440);
      const targetVx = moveX * targetSpeed;
      const accelRate = my.isGrounded ? (moveX !== 0 ? 18 : 22) : 9;
      my.vx += (targetVx - my.vx) * (1 - Math.exp(-step * accelRate));

      // Dynamic leaning angle
      const targetTilt = (my.vx / 440) * 0.22;
      my.tiltAngle += (targetTilt - my.tiltAngle) * (1 - Math.exp(-step * 14));

      // Animated leg walk cycle
      if (my.isGrounded && Math.abs(my.vx) > 20) {
        my.walkPhase += Math.abs(my.vx) * step * 0.038;
      } else {
        my.walkPhase = 0;
      }

      // Progressive Jetpack Lift & Nitro Consumption
      if (boost && my.nitro > 0) {
        my.vy -= 1180 * step;
        my.nitro = Math.max(0, my.nitro - 32 * step);
        my.isBoosting = true;
        this.spawnJetpackPlumes(my.x + my.width / 2, my.y + my.height, my.vx);
        if (Math.random() < 0.25) window.soundFx.playJetpackThrust();
      } else {
        my.isBoosting = false;
        // Nitro Regeneration (Fast on ground, slow in air)
        const regenRate = my.isGrounded ? 70 : 25;
        my.nitro = Math.min(my.maxNitro, my.nitro + regenRate * step);
      }

      // Auto-Health Regeneration (after 4s without taking damage)
      if (performance.now() - my.lastDamageTime > 4000 && my.hp < my.maxHp) {
        my.hp = Math.min(my.maxHp, my.hp + 18 * step);
      }

      // Weapon Aiming (PUBG-grade angular lerp dampening scaled by medium sensitivity)
      if (this.touchRight.active && this.touchRight.hasAim) {
        let angleDiff = this.touchRight.targetAngle - my.aimAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        // Calibrated medium sensitivity (0.7 default produces smooth 16 rate)
        const smoothSpeed = 16 * (this.sensitivity / 0.7);
        my.aimAngle += angleDiff * (1 - Math.exp(-step * smoothSpeed));
      } else if (!this.touchRight.active) {
        const screenCenterX = (my.x + my.width / 2 - this.camera.x);
        const screenCenterY = (my.y + my.height / 2 - this.camera.y);
        const targetAngle = Math.atan2(this.mouse.screenY - screenCenterY, this.mouse.screenX - screenCenterX);
        let angleDiff = targetAngle - my.aimAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        my.aimAngle += angleDiff * (1 - Math.exp(-step * 25));
      }

      // Facing orientation (smooth flip)
      const targetFacing = Math.cos(my.aimAngle) >= 0 ? 1 : -1;
      my.facingLerp += (targetFacing - my.facingLerp) * (1 - Math.exp(-step * 25));
      my.facing = targetFacing;

      // Firing Weapon
      if (this.mouse.isDown && !this.isReloading && performance.now() - this.lastFireTime > this.getWeaponFireRate(my.weapon)) {
        if (my.ammo > 0) {
          my.ammo--;
          this.fireWeapon(my);
          this.lastFireTime = performance.now();
          if (my.ammo === 0) {
            this.reloadWeapon();
          }
        }
      }

      if (my.meleeCooldown > 0) my.meleeCooldown -= step;
      if (my.dropTimer > 0) {
        my.dropTimer -= step;
        if (my.dropTimer <= 0) my.droppingDown = false;
      }
    }

    // 2. Simulate Bots (Host or Solo only)
    if (this.isSolo || (window.network && window.network.isHost)) {
      this.updateBots(step);
    }

    // 3. Update All Players (Physics & Remote Interpolation)
    for (const player of this.players.values()) {
      if (player.dead) {
        player.respawnTimer -= step;
        if (player.respawnTimer <= 0) {
          this.respawnPlayer(player);
        }
        continue;
      }

      // Gun recoil recovery spring
      player.gunRecoilX *= Math.pow(0.82, step * 60);
      player.gunRecoilAngle *= Math.pow(0.82, step * 60);
      if (player.muzzleTimer > 0) player.muzzleTimer -= step;

      // Dual-Layer Lagging HP drain (PUBG Health Bar)
      if (player.lagHp > player.hp) {
        player.lagHpTimer += step;
        if (player.lagHpTimer > 0.35) {
          player.lagHp = Math.max(player.hp, player.lagHp - 65 * step);
        }
      } else {
        player.lagHp = player.hp;
        player.lagHpTimer = 0;
      }

      // Remote player vs Locally Simulated (myPlayer & Host simulated bots)
      const isLocallySimulated = (player.id === this.myId) || (player.isBot && (this.isSolo || (window.network && window.network.isHost)));

      if (!isLocallySimulated) {
        // Remote human player position smoothing
        player.x += (player.targetX - player.x) * Math.min(1, step * 24);
        player.y += (player.targetY - player.y) * Math.min(1, step * 24);
        player.vx = player.targetVx || 0;
        player.vy = player.targetVy || 0;
        player.aimAngle += (player.targetAngle - player.aimAngle) * Math.min(1, step * 20);
        player.facing = Math.cos(player.aimAngle) >= 0 ? 1 : -1;
        if (player.isBoosting) {
          this.spawnJetpackPlumes(player.x + player.width / 2, player.y + player.height, player.vx);
        }
      } else {
        // Local player & Host-simulated Bots: Full deterministic physics!
        player.vy += 720 * step; // Gravity
        player.vy = Math.max(-580, Math.min(820, player.vy));

        player.x += player.vx * step;
        this.resolveHorizontalCollisions(player);

        player.y += player.vy * step;
        player.isGrounded = false;
        this.resolveVerticalCollisions(player);

        // Bots procedural walk cycle, tilt & auto-heal
        if (player.isBot) {
          const targetTilt = (player.vx / 440) * 0.22;
          player.tiltAngle += (targetTilt - player.tiltAngle) * (1 - Math.exp(-step * 14));
          if (player.isGrounded && Math.abs(player.vx) > 20) {
            player.walkPhase += Math.abs(player.vx) * step * 0.038;
          } else {
            player.walkPhase = 0;
          }
          if (performance.now() - player.lastDamageTime > 4000 && player.hp < player.maxHp) {
            player.hp = Math.min(player.maxHp, player.hp + 18 * step);
          }
        }
      }

      this.checkPlayerPickups(player);
    }

    // 4. Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * step;
      b.y += b.vy * step;
      b.life -= step;

      // Rocket spiral smoke trail
      if (b.isExplosive) {
        this.spawnRocketSmoke(b.x, b.y);
      }

      // Collision with platforms
      let hitPlatform = false;
      for (const p of this.map.platforms) {
        if (!p.oneWay && b.x >= p.x && b.x <= p.x + p.w && b.y >= p.y && b.y <= p.y + p.h) {
          hitPlatform = true;
          break;
        }
      }

      // Collision with players
      let hitPlayer = null;
      let isHeadshot = false;
      for (const target of this.players.values()) {
        if (target.id !== b.ownerId && !target.dead) {
          const hitHeight = target.crouching ? target.height * 0.65 : target.height;
          const hitY = target.crouching ? target.y + target.height * 0.35 : target.y;

          if (b.x >= target.x && b.x <= target.x + target.width &&
              b.y >= hitY && b.y <= hitY + hitHeight) {
            hitPlayer = target;
            // Headshot detection: Top 25% of character height
            isHeadshot = (b.y < hitY + hitHeight * 0.28);
            break;
          }
        }
      }

      if (hitPlatform || hitPlayer || b.life <= 0) {
        if (b.isExplosive) {
          this.triggerExplosion(b.x, b.y, 145, b.damage, b.ownerId);
        } else if (hitPlayer) {
          const finalDamage = isHeadshot ? Math.round(b.damage * 1.5) : b.damage;
          this.damagePlayer(hitPlayer, finalDamage, b.ownerId, isHeadshot);
          this.spawnBloodParticles(b.x, b.y, isHeadshot ? 20 : 12);

          if (b.ownerId === this.myId) {
            this.hitMarkerTimer = 0.24;
            this.hitMarkerType = isHeadshot ? 'headshot' : 'body';
            window.soundFx.playHitmarker(isHeadshot);
          }
        } else if (hitPlatform) {
          this.spawnImpactSparks(b.x, b.y);
        }
        this.bullets.splice(i, 1);
      }
    }

    // 5. Update Grenades
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.vy += 540 * step;
      g.x += g.vx * step;
      g.y += g.vy * step;
      g.timer -= step;

      for (const p of this.map.platforms) {
        if (g.x >= p.x && g.x <= p.x + p.w && g.y >= p.y && g.y <= p.y + p.h) {
          g.vy = -g.vy * 0.55;
          g.vx *= 0.78;
          g.y = p.y - 4;
        }
      }

      if (g.timer <= 0) {
        this.triggerExplosion(g.x, g.y, 160, 100, g.ownerId);
        this.grenades.splice(i, 1);
      }
    }

    // 6. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.life -= step;
      p.size = Math.max(0, p.size - p.shrink * step);
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // 7. Update Floating Combat Damage Numbers
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const d = this.damageNumbers[i];
      d.y -= 42 * step;
      d.life -= step;
      if (d.life <= 0) this.damageNumbers.splice(i, 1);
    }

    // 8. Compass Sound Markers Decay
    for (let i = this.compassSoundMarkers.length - 1; i >= 0; i--) {
      this.compassSoundMarkers[i].life -= step;
      if (this.compassSoundMarkers[i].life <= 0) {
        this.compassSoundMarkers.splice(i, 1);
      }
    }

    // Reload progress
    if (this.isReloading) {
      this.reloadProgress += step / this.reloadDuration;
      if (this.reloadProgress >= 1) {
        const myP = this.players.get(this.myId);
        if (myP) myP.ammo = myP.maxAmmo;
        this.isReloading = false;
        this.reloadProgress = 0;
        const bar = document.getElementById('mm-reload-track');
        if (bar) bar.classList.add('hidden');
        window.soundFx.playWeaponPickup();
      } else {
        const fill = document.getElementById('mm-reload-bar');
        if (fill) fill.style.width = `${Math.round(this.reloadProgress * 100)}%`;
      }
    }
  }

  // Visual Smoothing, Camera Interpolation & HUD Update
  renderUpdate(frameDt) {
    const my = this.players.get(this.myId);

    // Smooth Screen Trauma & Shake
    if (this.camera.shake > 0) {
      this.camera.shake = Math.max(0, this.camera.shake - frameDt * 22);
    }

    // Damage Vignette fade
    if (this.damageVignetteAlpha > 0) {
      this.damageVignetteAlpha = Math.max(0, this.damageVignetteAlpha - frameDt * 2.8);
      const vig = document.getElementById('mm-damage-vignette');
      if (vig) vig.style.opacity = this.damageVignetteAlpha;
    }

    if (this.hitMarkerTimer > 0) this.hitMarkerTimer -= frameDt;

    // Elimination banner fade
    if (this.eliminationBannerTimer > 0) {
      this.eliminationBannerTimer -= frameDt;
      if (this.eliminationBannerTimer <= 0) {
        const el = document.getElementById('mm-elim-banner');
        if (el) el.classList.add('hidden');
      }
    }

    // PUBG Spring Camera with Dynamic Look-Ahead & Zooming
    if (my) {
      // Dynamic look ahead
      const leadDist = this.isADS ? 240 : 110;
      const lookAheadX = Math.cos(my.aimAngle) * leadDist + my.vx * 0.22;
      const lookAheadY = Math.sin(my.aimAngle) * (leadDist * 0.65);

      const targetCamX = (my.x + my.width / 2 + lookAheadX) - (this.camera.width / 2);
      const targetCamY = (my.y + my.height / 2 + lookAheadY) - (this.camera.height / 2);

      // Smooth exponential spring damping
      this.camera.x += (targetCamX - this.camera.x) * (1 - Math.exp(-frameDt * 12));
      this.camera.y += (targetCamY - this.camera.y) * (1 - Math.exp(-frameDt * 12));

      // Dynamic FOV Zooming
      let desiredZoom = 1.0;
      if (this.dynamicZoomEnabled) {
        if (this.isADS) desiredZoom = 1.15;
        else if (my.isBoosting || Math.abs(my.vx) > 350) desiredZoom = 0.90;
      }
      this.camera.zoom += (desiredZoom - this.camera.zoom) * (1 - Math.exp(-frameDt * 6));

      // Camera shake displacement
      let shakeX = 0;
      let shakeY = 0;
      if (this.screenShakeEnabled && this.camera.shake > 0) {
        shakeX = (Math.random() - 0.5) * this.camera.shake;
        shakeY = (Math.random() - 0.5) * this.camera.shake;
      }

      this.camera.renderX = Math.max(0, Math.min(this.map.width - this.camera.width, this.camera.x)) + shakeX;
      this.camera.renderY = Math.max(0, Math.min(this.map.height - this.camera.height, this.camera.y)) + shakeY;
    }

    this.renderHUD();
  }

  resolveHorizontalCollisions(p) {
    for (const plat of this.map.platforms) {
      if (plat.oneWay) continue;
      if (p.x < plat.x + plat.w && p.x + p.width > plat.x &&
          p.y < plat.y + plat.h && p.y + p.height > plat.y) {
        if (p.vx > 0) p.x = plat.x - p.width;
        else if (p.vx < 0) p.x = plat.x + plat.w;
        p.vx = 0;
      }
    }
  }

  resolveVerticalCollisions(p) {
    for (const plat of this.map.platforms) {
      if (plat.oneWay) {
        // Can drop down through oneWay platforms by pulling down
        if (p.droppingDown) continue;
        const prevBottom = p.y + p.height - p.vy * 0.02;
        if (p.vy > 0 && prevBottom <= plat.y + 6 && p.y + p.height >= plat.y &&
            p.x + p.width > plat.x && p.x < plat.x + plat.w) {
          p.y = plat.y - p.height;
          p.vy = 0;
          p.isGrounded = true;
        }
      } else {
        if (p.x < plat.x + plat.w && p.x + p.width > plat.x &&
            p.y < plat.y + plat.h && p.y + p.height > plat.y) {
          if (p.vy > 0) {
            p.y = plat.y - p.height;
            p.vy = 0;
            p.isGrounded = true;
          } else if (p.vy < 0) {
            p.y = plat.y + plat.h;
            p.vy = 0;
          }
        }
      }
    }
  }

  fireWeapon(p) {
    const angle = p.aimAngle;
    const speed = p.weapon === 'sniper' ? 2200 : p.weapon === 'rocket' ? 580 : 1350;
    const gunLen = p.weapon === 'sniper' ? 36 : (p.weapon === 'rocket' ? 32 : 24);
    const gunX = p.x + p.width / 2 + Math.cos(angle) * gunLen;
    const gunY = p.y + p.height / 2 + Math.sin(angle) * gunLen;

    window.soundFx.playGunshot(p.weapon);

    // Muzzle flash timer & recoil impulse
    p.muzzleTimer = 0.08;
    p.gunRecoilX = -8;
    p.gunRecoilAngle = -0.12;

    // Camera recoil kick
    if (p.id === this.myId && this.screenShakeEnabled) {
      this.camera.shake = Math.min(18, this.camera.shake + (p.weapon === 'sniper' ? 9 : (p.weapon === 'rocket' ? 14 : 3.5)));
    }

    // Add sound marker to PUBG Compass
    this.addCompassSoundMarker(p.x, p.y, p.id === this.myId);

    // Muzzle flash bloom particles
    this.particles.push({
      x: gunX, y: gunY,
      vx: Math.cos(angle) * 50, vy: Math.sin(angle) * 50,
      size: 16,
      color: '#ffd600',
      life: 0.08,
      shrink: 45
    });

    if (p.weapon === 'shotgun') {
      for (let i = -2; i <= 2; i++) {
        const spread = angle + (i * 0.065);
        this.bullets.push({
          x: gunX, y: gunY,
          vx: Math.cos(spread) * speed,
          vy: Math.sin(spread) * speed,
          life: 0.65,
          damage: 18,
          ownerId: p.id,
          color: '#ffd600',
          isExplosive: false
        });
      }
      p.vx -= Math.cos(angle) * 180;
      p.vy -= Math.sin(angle) * 120;
    } else if (p.weapon === 'rocket') {
      this.bullets.push({
        x: gunX, y: gunY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 3.2,
        damage: 120,
        ownerId: p.id,
        color: '#ff0055',
        isExplosive: true
      });
      p.vx -= Math.cos(angle) * 150;
      p.vy -= Math.sin(angle) * 100;
    } else if (p.weapon === 'sniper') {
      this.bullets.push({
        x: gunX, y: gunY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.8,
        damage: 90,
        ownerId: p.id,
        color: '#00f2fe',
        isExplosive: false
      });
      p.vx -= Math.cos(angle) * 110;
    } else {
      // M416 Assault Rifle
      this.bullets.push({
        x: gunX, y: gunY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.5,
        damage: 22,
        ownerId: p.id,
        color: '#ffffff',
        isExplosive: false
      });
      p.vx -= Math.cos(angle) * 45;
    }

    const shouldBroadcast = (p.id === this.myId) || (p.isBot && window.network && window.network.isHost);
    if (shouldBroadcast && window.network && window.network.roomId) {
      window.network.sendMiniMilitiaEvent('PLAYER_FIRE', {
        ownerId: p.id,
        gunX: Math.round(gunX),
        gunY: Math.round(gunY),
        angle: Number(angle.toFixed(3)),
        weapon: p.weapon
      });
    }
  }

  meleePunch(playerId) {
    const p = this.players.get(playerId);
    if (!p || p.dead || p.meleeCooldown > 0) return;
    p.meleeCooldown = 0.42;
    window.soundFx.playMeleePunch();

    // Lunging punch
    p.vx += Math.cos(p.aimAngle) * 220;
    const punchX = p.x + p.width / 2 + Math.cos(p.aimAngle) * 36;
    const punchY = p.y + p.height / 2 + Math.sin(p.aimAngle) * 36;

    this.particles.push({
      x: punchX, y: punchY,
      vx: 0, vy: 0,
      size: 26,
      color: '#ffd600',
      life: 0.12,
      shrink: 35
    });

    for (const target of this.players.values()) {
      if (target.id !== playerId && !target.dead) {
        const d = Math.hypot((target.x + target.width / 2) - punchX, (target.y + target.height / 2) - punchY);
        if (d < 48) {
          this.damagePlayer(target, 45, playerId, false);
          target.vx += Math.cos(p.aimAngle) * 440;
          target.vy -= 190;
          if (playerId === this.myId) {
            this.hitMarkerTimer = 0.25;
            this.hitMarkerType = 'body';
            window.soundFx.playHitmarker(false);
          }
        }
      }
    }
  }

  reloadWeapon() {
    if (this.isReloading) return;
    const my = this.players.get(this.myId);
    if (!my || my.ammo === my.maxAmmo) return;
    this.isReloading = true;
    this.reloadProgress = 0;

    const track = document.getElementById('mm-reload-track');
    if (track) track.classList.remove('hidden');
    window.soundFx.playCardSlide();
  }

  throwGrenade(playerId) {
    const p = this.players.get(playerId);
    if (!p || p.dead || p.grenades <= 0) return;
    p.grenades--;
    const angle = p.aimAngle;
    this.grenades.push({
      x: p.x + p.width / 2,
      y: p.y + p.height / 2,
      vx: Math.cos(angle) * 520 + p.vx * 0.4,
      vy: Math.sin(angle) * 520 - 180,
      timer: 2.2,
      ownerId: playerId
    });
    window.soundFx.playCardFlick();
  }

  triggerExplosion(x, y, radius, maxDamage, attackerId) {
    window.soundFx.playExplosion();
    if (navigator.vibrate) navigator.vibrate([45, 60, 45]);

    // Camera explosion trauma
    if (this.screenShakeEnabled) {
      const my = this.players.get(this.myId);
      if (my) {
        const dist = Math.hypot(my.x - x, my.y - y);
        if (dist < 800) {
          const trauma = (1 - dist / 800) * 25;
          this.camera.shake = Math.min(30, this.camera.shake + trauma);
        }
      }
    }

    // Fiery smoke explosion particles
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 280 + 60;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        size: Math.random() * 14 + 6,
        color: ['#ffd600', '#ff6d00', '#ff0055', '#334155'][Math.floor(Math.random() * 4)],
        life: 0.65,
        shrink: 16
      });
    }

    for (const player of this.players.values()) {
      if (player.dead) continue;
      const cx = player.x + player.width / 2;
      const cy = player.y + player.height / 2;
      const dist = Math.hypot(cx - x, cy - y);
      if (dist < radius) {
        const falloff = 1 - (dist / radius);
        const dmg = Math.round(maxDamage * falloff);
        this.damagePlayer(player, dmg, attackerId, false);
        const a = Math.atan2(cy - y, cx - x);
        player.vx += Math.cos(a) * 440 * falloff;
        player.vy += Math.sin(a) * 440 * falloff - 90;
      }
    }
  }

  damagePlayer(victim, damage, attackerId, isHeadshot = false) {
    if (victim.dead) return;
    victim.hp = Math.max(0, victim.hp - damage);
    victim.lastDamageTime = performance.now();

    // Directional damage hit vignette on local player
    if (victim.id === this.myId) {
      this.damageVignetteAlpha = 0.95;
    }

    // Spawn floating damage text
    this.damageNumbers.push({
      x: victim.x + victim.width / 2 + (Math.random() * 18 - 9),
      y: victim.y - 14,
      text: isHeadshot ? `💥${damage}` : `-${damage}`,
      color: isHeadshot ? '#ffd600' : (damage >= 60 ? '#ff0055' : '#ffffff'),
      life: 0.85
    });

    if (victim.hp <= 0) {
      victim.dead = true;
      victim.deaths++;
      victim.respawnTimer = 3.0;

      const attacker = this.players.get(attackerId);
      if (attacker && attacker.id !== victim.id) {
        attacker.kills++;
        this.addKillFeedMessage(`🎯 ${attacker.name} eliminated ${victim.name} with ${attacker.weapon.toUpperCase()}`);

        if (attacker.id === this.myId) {
          this.showEliminationBanner(`YOU ELIMINATED ${victim.name.toUpperCase()}! 🔥`);
          this.hitMarkerTimer = 0.45;
          this.hitMarkerType = 'kill';
          window.soundFx.playHeadshotKill();

          // Check Win Condition (First to 10 kills or last alive)
          if (attacker.kills >= 10 && this.isSolo) {
            this.showVictoryBanner();
          }
        }
      } else {
        this.addKillFeedMessage(`💥 ${victim.name} self-destructed`);
      }
      this.spawnBloodParticles(victim.x + victim.width / 2, victim.y + victim.height / 2, 30);
    }
  }

  showEliminationBanner(text) {
    this.eliminationBannerTimer = 2.4;
    this.eliminationBannerText = text;
    const banner = document.getElementById('mm-elim-banner');
    const txt = document.getElementById('mm-elim-text');
    if (banner && txt) {
      txt.innerText = text;
      banner.classList.remove('hidden');
    }
  }

  showVictoryBanner() {
    const banner = document.getElementById('mm-victory-banner');
    const stats = document.getElementById('mm-victory-stats');
    const my = this.players.get(this.myId);
    if (banner) {
      if (stats && my) stats.innerText = `TOTAL KILLS: ${my.kills} | ARENA ACCURACY: 89%`;
      banner.classList.remove('hidden');
      window.soundFx.playVictory();
    }
  }

  respawnPlayer(player) {
    player.dead = false;
    player.hp = player.maxHp;
    player.lagHp = player.maxHp;
    player.nitro = player.maxNitro;
    player.ammo = player.maxAmmo;
    player.weapon = 'rifle';
    player.x = 350 + Math.random() * 1500;
    player.y = 250;
    player.vx = 0;
    player.vy = 0;
    player.lastDamageTime = performance.now();

    if (player.id === this.myId && window.network && window.network.roomId) {
      window.network.sendMiniMilitiaEvent('PLAYER_RESPAWN', { id: player.id, x: player.x, y: player.y });
    }
  }

  checkPlayerPickups(p) {
    this.pickups.forEach(pk => {
      if (!pk.active) return;
      const dist = Math.hypot((p.x + p.width / 2) - pk.x, (p.y + p.height / 2) - pk.y);
      if (dist < 34) {
        pk.active = false;
        if (pk.type === 'health') {
          p.hp = Math.min(p.maxHp, p.hp + 50);
          p.lagHp = p.hp;
          this.damageNumbers.push({
            x: pk.x, y: pk.y - 12,
            text: '+50 HP',
            color: '#00ff88',
            life: 0.95
          });
          window.soundFx.playCardFlick();
        } else {
          p.weapon = pk.type;
          p.ammo = p.weapon === 'shotgun' ? 8 : p.weapon === 'sniper' ? 5 : p.weapon === 'rocket' ? 3 : 30;
          p.maxAmmo = p.ammo;
          this.damageNumbers.push({
            x: pk.x, y: pk.y - 12,
            text: pk.type.toUpperCase(),
            color: '#ffd600',
            life: 0.95
          });
          if (p.id === this.myId) window.soundFx.playWeaponPickup();
        }
        setTimeout(() => { pk.active = true; }, 12000);
      }
    });
  }

  // Tactical Human-Grade Bot AI (Fights human and other bots, retreats when low HP, uses jetpack & weapons)
  updateBots(step) {
    for (const bot of this.players.values()) {
      if (!bot.isBot || bot.dead) continue;

      // 1. Find Nearest Active Combatant (Human or any other Bot!)
      let nearest = null;
      let minDist = 99999;
      for (const opp of this.players.values()) {
        if (opp.id !== bot.id && !opp.dead) {
          const d = Math.hypot(opp.x - bot.x, opp.y - bot.y);
          if (d < minDist) {
            minDist = d;
            nearest = opp;
          }
        }
      }

      let targetVx = 0;
      bot.botActionTimer = (bot.botActionTimer || 0) + step;
      bot.retreatTimer = (bot.retreatTimer || 0) - step;

      // 2. Tactical Mode: Low Health Survival & Retreat (Human-paced evasion)
      if (bot.hp < 45 && nearest) {
        // Run away from the nearest attacker at human speed
        let escapeDir = bot.x >= nearest.x ? 1 : -1;
        if (bot.x < 220) escapeDir = 1;
        else if (bot.x > this.map.width - 260) escapeDir = -1;

        // Human sprint speed (230 px/s instead of superhuman 380)
        targetVx = escapeDir * 230;

        // Hunt for nearest active Health Pack (+50 HP)
        let nearestHealth = null;
        let minHealthDist = 9999;
        this.pickups.forEach(pk => {
          if (pk.active && pk.type === 'health') {
            const hd = Math.hypot(pk.x - bot.x, pk.y - bot.y);
            if (hd < minHealthDist) {
              minHealthDist = hd;
              nearestHealth = pk;
            }
          }
        });

        if (nearestHealth && minHealthDist < 800) {
          const hDir = nearestHealth.x > bot.x + 25 ? 1 : (nearestHealth.x < bot.x - 25 ? -1 : 0);
          targetVx = hDir * 230;
          if (nearestHealth.y < bot.y - 40 && bot.nitro > 20) {
            // Gentle jetpack boost
            bot.vy -= 720 * step;
            bot.nitro = Math.max(0, bot.nitro - 22 * step);
            bot.isBoosting = true;
            this.spawnJetpackPlumes(bot.x + bot.width / 2, bot.y + bot.height, bot.vx);
          }
        } else if (bot.nitro > 25 && (minDist < 300 || bot.y > 880)) {
          // Tactical jump onto higher platform
          bot.vy -= 700 * step;
          bot.nitro = Math.max(0, bot.nitro - 20 * step);
          bot.isBoosting = true;
          this.spawnJetpackPlumes(bot.x + bot.width / 2, bot.y + bot.height, bot.vx);
        } else {
          bot.isBoosting = false;
        }

        // Aim backwards at realistic human turn speed (4.5 instead of 14)
        const enemyAim = Math.atan2(
          (nearest.y + nearest.height / 2) - (bot.y + bot.height / 2),
          (nearest.x + nearest.width / 2) - (bot.x + bot.width / 2)
        );
        let aimDiff = enemyAim - bot.aimAngle;
        while (aimDiff > Math.PI) aimDiff -= Math.PI * 2;
        while (aimDiff < -Math.PI) aimDiff += Math.PI * 2;
        bot.aimAngle += aimDiff * (1 - Math.exp(-step * 4.5));
        bot.facing = Math.cos(bot.aimAngle) >= 0 ? 1 : -1;

        // Occasional suppression burst while retreating (0.65s interval)
        if (bot.botActionTimer > 0.65 && minDist < 500 && Math.abs(aimDiff) < 0.35) {
          this.fireWeapon(bot);
          bot.botActionTimer = 0;
        }
      } else if (nearest) {
        // 3. Combat Engagement Mode (Relaxed, fun human pacing)
        const leadDist = minDist / 1800; // gentle lead
        const aimJitter = Math.sin(performance.now() * 0.003 + bot.id.length) * 0.10; // human aiming jitter
        const targetAimX = nearest.x + nearest.width / 2 + (nearest.vx || 0) * leadDist;
        const targetAimY = nearest.y + nearest.height / 2 + (nearest.vy || 0) * leadDist;
        const targetAim = Math.atan2(targetAimY - (bot.y + bot.height / 2), targetAimX - (bot.x + bot.width / 2)) + aimJitter;

        let diff = targetAim - bot.aimAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        // Human turning rate (4.2 instead of robotic 16)
        bot.aimAngle += diff * (1 - Math.exp(-step * 4.2));
        bot.facing = Math.cos(bot.aimAngle) >= 0 ? 1 : -1;

        if (minDist > 320) {
          // Human-like advance (200 px/s)
          const dir = nearest.x > bot.x + 35 ? 1 : (nearest.x < bot.x - 35 ? -1 : 0);
          targetVx = dir * 200;

          // Gentle jetpack lift
          if ((nearest.y < bot.y - 80 || bot.y > 900) && bot.nitro > 22) {
            bot.vy -= 740 * step;
            bot.nitro = Math.max(0, bot.nitro - 22 * step);
            bot.isBoosting = true;
            this.spawnJetpackPlumes(bot.x + bot.width / 2, bot.y + bot.height, bot.vx);
          } else {
            bot.isBoosting = false;
          }

          if (nearest.y > bot.y + 70 && Math.abs(nearest.x - bot.x) < 80) {
            bot.droppingDown = true;
            bot.dropTimer = 0.35;
          }
        } else if (minDist > 110) {
          // Mid-range tactical strafe at human pace
          const strafeSeed = ((bot.id.charCodeAt(bot.id.length - 1) * 37) % 7) - 3;
          const strafeDir = Math.sin(performance.now() * 0.0025 + strafeSeed) > 0 ? 1 : -1;
          targetVx = strafeDir * 150;

          // Occasional small hop
          if (Math.random() < 0.015 && bot.nitro > 30) {
            bot.vy -= 650 * step;
            bot.nitro = Math.max(0, bot.nitro - 18 * step);
            bot.isBoosting = true;
            this.spawnJetpackPlumes(bot.x + bot.width / 2, bot.y + bot.height, bot.vx);
          } else {
            bot.isBoosting = false;
          }
        } else {
          // Close quarters
          targetVx = (nearest.x > bot.x ? 1 : -1) * 140;
          bot.isBoosting = false;
          if (minDist < 52 && bot.meleeCooldown <= 0) {
            this.meleePunch(bot.id);
          }
        }

        // Fire Weapon: Natural human burst intervals with pauses
        const fireInterval = bot.weapon === 'sniper' ? 1.75 : (bot.weapon === 'rocket' ? 2.10 : (bot.weapon === 'shotgun' ? 0.85 : 0.48));
        if (bot.botActionTimer > fireInterval && minDist < 680 && Math.abs(diff) < 0.30) {
          if (bot.ammo <= 0) bot.ammo = bot.maxAmmo;
          this.fireWeapon(bot);
          bot.botActionTimer = 0;
        }

        // Grenades at safe distances
        if (bot.grenades > 0 && Math.random() < 0.004 && minDist > 240 && minDist < 480) {
          this.throwGrenade(bot.id);
        }
      } else {
        // 4. Patrol Mode: Relaxed arena stroll
        targetVx = Math.sin(performance.now() * 0.0012 + bot.id.length) * 150;
        bot.isBoosting = false;
      }

      // Smooth horizontal acceleration and friction
      const accel = bot.isGrounded ? 14 : 7;
      bot.vx += (targetVx - bot.vx) * (1 - Math.exp(-step * accel));

      // Nitro regeneration when grounded and not boosting
      if (!bot.isBoosting && bot.isGrounded) {
        bot.nitro = Math.min(bot.maxNitro, bot.nitro + 60 * step);
      }
    }
  }

  getWeaponFireRate(w) {
    switch (w) {
      case 'shotgun': return 520;
      case 'sniper': return 950;
      case 'rocket': return 1250;
      default: return 125; // Rapid M416
    }
  }

  addCompassSoundMarker(x, y, isSelf) {
    if (isSelf) return;
    this.compassSoundMarkers.push({
      x, y,
      life: 2.2,
      maxLife: 2.2
    });
  }

  spawnJetpackPlumes(x, y, vx) {
    for (let i = 0; i < 2; i++) {
      this.particles.push({
        x: x + (Math.random() * 8 - 4),
        y: y - 2,
        vx: (Math.random() * 20 - 10) - vx * 0.2,
        vy: Math.random() * 140 + 90,
        size: Math.random() * 6 + 3,
        color: ['#00f2fe', '#ffd600', '#ff6d00', '#ffffff'][Math.floor(Math.random() * 4)],
        life: 0.24,
        shrink: 16
      });
    }
  }

  spawnRocketSmoke(x, y) {
    this.particles.push({
      x: x + (Math.random() * 6 - 3),
      y: y + (Math.random() * 6 - 3),
      vx: (Math.random() * 20 - 10),
      vy: (Math.random() * 20 - 10),
      size: Math.random() * 8 + 4,
      color: 'rgba(220, 220, 220, 0.65)',
      life: 0.35,
      shrink: 10
    });
  }

  spawnBloodParticles(x, y, count = 12) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 140 + 40;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        size: Math.random() * 5 + 2,
        color: '#ff0055',
        life: 0.42,
        shrink: 9
      });
    }
  }

  spawnImpactSparks(x, y) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 90 + 30;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        size: Math.random() * 3 + 1,
        color: '#ffd600',
        life: 0.16,
        shrink: 12
      });
    }
  }

  addKillFeedMessage(msg) {
    this.killFeed.unshift({ text: msg, time: performance.now() });
    if (this.killFeed.length > 5) this.killFeed.pop();
  }

  // ==========================================================================
  // HIGH-DPI CANVAS RENDERING (BUTTERY SMOOTH PROCEDURAL GRAPHICS)
  // ==========================================================================
  render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;

    // Reset transform to identity and scale to high-DPI
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.camera.width, this.camera.height);

    ctx.save();
    // Dynamic Camera Zoom & Position
    const zoom = this.camera.zoom;
    const cx = this.camera.width / 2;
    const cy = this.camera.height / 2;
    ctx.translate(cx, cy);
    ctx.scale(zoom, zoom);
    ctx.translate(-cx - this.camera.renderX, -cy - this.camera.renderY);

    // 1. Sci-Fi Tactical Grid Background
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.035)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.map.width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.map.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.map.height; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.map.width, y);
      ctx.stroke();
    }

    // 2. Battle Platforms & One-Way Droppable Bridges
    this.map.platforms.forEach(p => {
      ctx.save();
      if (p.oneWay) {
        // High-tech translucent glowing beam platform
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        // Energy top runner line
        ctx.fillStyle = '#00f2fe';
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 8;
        ctx.fillRect(p.x, p.y, p.w, 3);
      } else {
        // Solid reinforced bunker wall/floor
        ctx.fillStyle = '#090d16';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#00f2fe';
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 10;
        ctx.fillRect(p.x, p.y, p.w, 4);
      }
      ctx.restore();
    });

    // 3. Power Supply Crate Pickups (Glowing 3D Cubes)
    this.pickups.forEach(pk => {
      if (!pk.active) return;
      ctx.save();
      ctx.fillStyle = pk.type === 'health' ? '#00ff88' : '#ffd600';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.roundRect(pk.x - pk.size / 2, pk.y - pk.size / 2, pk.size, pk.size, 6);
      ctx.fill();

      ctx.fillStyle = '#050811';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const icon = pk.type === 'health' ? '✚' : pk.type === 'sniper' ? '🎯' : pk.type === 'rocket' ? '🚀' : '⚡';
      ctx.fillText(icon, pk.x, pk.y);
      ctx.restore();
    });

    // 4. Bullets & Hyper-Velocity Laser Tracers
    this.bullets.forEach(b => {
      ctx.save();
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.isExplosive ? 6.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 5. Grenades (Flashing Beacon)
    this.grenades.forEach(g => {
      ctx.save();
      ctx.fillStyle = '#00ff88';
      ctx.beginPath();
      ctx.arc(g.x, g.y, 6.5, 0, Math.PI * 2);
      ctx.fill();
      // Flashing timer dot
      ctx.fillStyle = Math.sin(performance.now() * 0.025) > 0 ? '#ff0055' : '#ffd600';
      ctx.beginPath();
      ctx.arc(g.x, g.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 6. Particles (Blood, Plumes, Smoke)
    this.particles.forEach(pt => {
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // 7. Procedural Animated Soldiers (Limb Strides, Helmet Visor, Recoil Kick)
    for (const p of this.players.values()) {
      if (p.dead) continue;
      this.renderSoldier(ctx, p);
    }

    // 8. Floating Combat Damage Numbers
    this.damageNumbers.forEach(d => {
      ctx.save();
      ctx.fillStyle = d.color;
      ctx.shadowColor = d.color;
      ctx.shadowBlur = 8;
      ctx.font = 'bold 15px var(--font-heading, sans-serif)';
      ctx.textAlign = 'center';
      ctx.fillText(d.text, d.x, d.y);
      ctx.restore();
    });

    ctx.restore();

    // 9. Off-screen Threat Radar Arrows
    this.renderThreatRadar();

    // 10. PUBG Custom Reticle & Hitmarker
    this.renderPUBGReticle();
  }

  // Procedural PUBG Soldier Rendering
  renderSoldier(ctx, p) {
    ctx.save();
    const pHeight = p.crouching ? p.height * 0.68 : p.height;
    const centerY = p.y + (p.crouching ? p.height * 0.66 : p.height / 2);

    ctx.translate(p.x + p.width / 2, centerY);
    ctx.rotate(p.tiltAngle);

    const facing = p.facing;
    ctx.scale(facing, 1);

    // Jetpack Body & Dual Metallic Thrusters
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-p.width / 2 - 8, -12, 9, 24);
    // Glowing exhaust cones
    ctx.fillStyle = p.isBoosting ? '#00f2fe' : '#0f172a';
    ctx.fillRect(-p.width / 2 - 7, 12, 7, 4);

    // Procedural Animated Legs / Combat Boots
    const legPhase = p.walkPhase;
    const legOffset1 = Math.sin(legPhase) * 6;
    const legOffset2 = -Math.sin(legPhase) * 6;
    ctx.fillStyle = '#0f172a';
    // Back leg
    ctx.fillRect(-6 + legOffset2, pHeight / 2 - 10, 6, 12);
    // Front leg
    ctx.fillRect(1 + legOffset1, pHeight / 2 - 10, 6, 12);

    // Soldier Torso & Tactical Armor Plate
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(-p.width / 2, -pHeight / 2, p.width, pHeight, 7);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Tactical Kevlar Vest Straps
    ctx.fillStyle = '#090d16';
    ctx.fillRect(-p.width / 4, -pHeight / 6, p.width / 2, 8);

    // Military Combat Helmet & Reflective Visor
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, -pHeight / 2 - 2, 10, Math.PI, 0);
    ctx.fill();
    // Glowing Visor
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 6;
    ctx.fillRect(0, -pHeight / 2 - 1, 8, 4);
    ctx.shadowBlur = 0;

    // Sniper Laser Sight Indicator
    if (p.weapon === 'sniper') {
      ctx.save();
      const localAim = p.aimAngle * facing;
      ctx.rotate(localAim);
      ctx.strokeStyle = 'rgba(255, 0, 85, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(1200, 0);
      ctx.stroke();
      ctx.restore();
    }

    // Dynamic Weapon with Recoil Slide & Hands
    ctx.save();
    const localAim = p.aimAngle * facing;
    ctx.rotate(localAim + p.gunRecoilAngle);
    ctx.translate(p.gunRecoilX, 0);

    // Gun Barrel & Body
    ctx.fillStyle = '#cbd5e1';
    const gunLen = p.weapon === 'sniper' ? 34 : (p.weapon === 'rocket' ? 30 : 22);
    ctx.fillRect(4, -3.5, gunLen, 7);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(6, -2, 5, 4);

    // Hands gripping the weapon
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(6, 2, 4, 0, Math.PI * 2);
    ctx.arc(14, 2, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Muzzle Flash Starburst on fire
    if (p.muzzleTimer > 0) {
      ctx.fillStyle = '#ffd600';
      ctx.shadowColor = '#ffd600';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(gunLen + 8, 0, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();

    // Nametag & Health Bar over Head
    const barW = 44;
    const barH = 5;
    const barX = p.x + p.width / 2 - barW / 2;
    const barY = p.y - 18;

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = p.hp > 35 ? '#00ff88' : '#ff0055';
    ctx.fillRect(barX, barY, barW * (p.hp / p.maxHp), barH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.avatar} ${p.name}`, p.x + p.width / 2, barY - 4);
  }

  // PUBG Dynamic Crosshair Reticle & Hitmarker
  renderPUBGReticle() {
    const my = this.players.get(this.myId);
    if (!my || my.dead || !this.ctx) return;
    const ctx = this.ctx;

    // Center screen reticle
    const cx = this.camera.width / 2;
    const cy = this.camera.height / 2;

    // Crosshair spread dynamics (widens when moving or boosting, contracts when crouching)
    let spread = 12;
    if (Math.abs(my.vx) > 30 || my.isBoosting) spread = 20;
    if (my.crouching) spread = 8;
    if (this.isADS) spread = 5;

    ctx.save();
    ctx.strokeStyle = this.hitMarkerTimer > 0 ? '#ff0055' : 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;

    // 4 crosshair ticks
    ctx.beginPath();
    ctx.moveTo(cx - spread - 8, cy); ctx.lineTo(cx - spread, cy);
    ctx.moveTo(cx + spread + 8, cy); ctx.lineTo(cx + spread, cy);
    ctx.moveTo(cx, cy - spread - 8); ctx.lineTo(cx, cy - spread);
    ctx.moveTo(cx, cy + spread + 8); ctx.lineTo(cx, cy + spread);
    ctx.stroke();

    // Center precision dot
    ctx.fillStyle = 'rgba(0, 242, 254, 0.8)';
    ctx.beginPath();
    ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Hitmarker X on hit
    if (this.hitMarkerTimer > 0) {
      ctx.strokeStyle = this.hitMarkerType === 'kill' ? '#ffd600' : (this.hitMarkerType === 'headshot' ? '#ff0055' : '#ffffff');
      ctx.lineWidth = 2.5;
      const size = this.hitMarkerType === 'kill' ? 12 : 8;
      ctx.beginPath();
      ctx.moveTo(cx - size, cy - size); ctx.lineTo(cx - 3, cy - 3);
      ctx.moveTo(cx + size, cy - size); ctx.lineTo(cx + 3, cy - 3);
      ctx.moveTo(cx - size, cy + size); ctx.lineTo(cx - 3, cy + 3);
      ctx.moveTo(cx + size, cy + size); ctx.lineTo(cx + 3, cy + 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Off-screen Threat Radar Arrows
  renderThreatRadar() {
    const my = this.players.get(this.myId);
    if (!my || my.dead || !this.ctx) return;
    const ctx = this.ctx;

    for (const opp of this.players.values()) {
      if (opp.id === this.myId || opp.dead) continue;

      const screenX = opp.x + opp.width / 2 - this.camera.renderX;
      const screenY = opp.y + opp.height / 2 - this.camera.renderY;

      const isOffScreen = screenX < 24 || screenX > this.camera.width - 24 ||
                          screenY < 24 || screenY > this.camera.height - 24;

      if (isOffScreen) {
        const margin = 28;
        const clampX = Math.max(margin, Math.min(this.camera.width - margin, screenX));
        const clampY = Math.max(margin, Math.min(this.camera.height - margin, screenY));
        const angle = Math.atan2(screenY - (my.y - this.camera.renderY), screenX - (my.x - this.camera.renderX));

        ctx.save();
        ctx.translate(clampX, clampY);
        ctx.rotate(angle);
        ctx.fillStyle = opp.color;
        ctx.shadowColor = opp.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-8, -7);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, 7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // ==========================================================================
  // PUBG TACTICAL HUD (COMPASS TAPE, DUAL-LAYER HP, BOOST, WEAPON TRAY)
  // ==========================================================================
  renderHUD() {
    const my = this.players.get(this.myId);
    if (!my) return;

    // 1. Dual-Layer Health Bar (Lagging Damage Trail)
    const hpFill = document.getElementById('mm-hud-hp-fill');
    const hpLag = document.getElementById('mm-hud-hp-lag');
    const hpTxt = document.getElementById('mm-hud-hp-txt');

    if (hpFill) hpFill.style.width = `${Math.max(0, my.hp)}%`;
    if (hpLag) hpLag.style.width = `${Math.max(0, my.lagHp)}%`;
    if (hpTxt) hpTxt.innerText = `${Math.round(my.hp)} HP`;

    // 2. Real Mini Militia Nitro Flight Bar
    const nitroFill = document.getElementById('mm-hud-nitro-fill');
    const nitroTxt = document.getElementById('mm-hud-nitro-txt');
    if (nitroFill) nitroFill.style.width = `${Math.max(0, my.nitro)}%`;
    if (nitroTxt) nitroTxt.innerText = `FLY ${Math.round(my.nitro)}%`;

    const nitroSegments = [
      document.getElementById('boost-seg-1'),
      document.getElementById('boost-seg-2'),
      document.getElementById('boost-seg-3'),
      document.getElementById('boost-seg-4')
    ];
    const segRatio = my.nitro / 25;
    nitroSegments.forEach((seg, idx) => {
      if (seg) {
        const segVal = Math.max(0, Math.min(1, segRatio - idx));
        seg.style.width = `${segVal * 100}%`;
      }
    });

    // 3. PUBG Weapon Tray
    const wName = document.getElementById('mm-hud-weapon-name');
    const wMode = document.getElementById('mm-hud-fire-mode');
    const ammoCur = document.getElementById('mm-hud-ammo-cur');
    const ammoMax = document.getElementById('mm-hud-ammo-max');

    if (wName) wName.innerText = my.weapon === 'rifle' ? 'M416 RIFLE' : (my.weapon === 'sniper' ? 'AWM SNIPER' : (my.weapon === 'rocket' ? 'RPG-7 ROCKET' : 'S12K SHOTGUN'));
    if (wMode) wMode.innerText = my.weapon === 'sniper' ? 'SINGLE' : (my.weapon === 'rocket' ? 'SINGLE' : 'AUTO');
    if (ammoCur) ammoCur.innerText = my.ammo;
    if (ammoMax) ammoMax.innerText = my.maxAmmo;

    // 4. Alive & Kills Count
    let aliveCount = 0;
    for (const p of this.players.values()) {
      if (!p.dead) aliveCount++;
    }
    const aliveEl = document.getElementById('mm-hud-alive');
    const killsEl = document.getElementById('mm-hud-kills-top');
    const grenadesEl = document.getElementById('mm-hud-grenade-count');

    if (aliveEl) aliveEl.innerText = aliveCount;
    if (killsEl) killsEl.innerText = my.kills;
    if (grenadesEl) grenadesEl.innerText = my.grenades;

    // 5. PUBG Compass Heading Tape
    this.updateCompassTape(my);

    // 6. Kill Feed
    const feedContainer = document.getElementById('mm-kill-feed');
    if (feedContainer) {
      feedContainer.innerHTML = '';
      const now = performance.now();
      this.killFeed.forEach(kf => {
        if (now - kf.time < 3800) {
          const div = document.createElement('div');
          div.className = 'kill-feed-item';
          div.innerText = kf.text;
          feedContainer.appendChild(div);
        }
      });
    }

    // 7. Respawn Banner
    const respawnEl = document.getElementById('mm-respawn-overlay');
    if (respawnEl) {
      if (my.dead) {
        respawnEl.classList.remove('hidden');
        respawnEl.innerText = `Respawning in ${Math.ceil(my.respawnTimer)}s...`;
      } else {
        respawnEl.classList.add('hidden');
      }
    }
  }

  // Update PUBG Scrolling Compass Strip
  updateCompassTape(my) {
    const compassInner = document.getElementById('mm-compass-inner');
    if (!compassInner) return;

    // Calculate heading angle in degrees (0 - 360)
    let deg = Math.round((my.aimAngle * 180 / Math.PI) + 360) % 360;

    // Shift compass strip horizontally
    // 360 degrees mapped across strip width
    const shift = -((deg / 360) * 720) % 360;
    compassInner.style.transform = `translateX(${shift}px)`;

    if (!compassInner.hasChildNodes()) {
      let str = '';
      const cardinals = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
      for (let cycle = 0; cycle < 3; cycle++) {
        for (let d = 0; d < 360; d += 15) {
          const label = cardinals[d] || d;
          str += `<span style="display: inline-block; width: 30px; text-align: center;">${label}</span>`;
        }
      }
      compassInner.innerHTML = str;
    }
  }

  stop() {
    this.isRunning = false;
    clearInterval(this.syncInterval);
    document.body.classList.remove('mm-fullscreen-active');
  }
}

window.miniMilitiaGame = new MiniMilitiaGame();
