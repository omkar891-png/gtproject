// ==========================================================================
// 👑 LUDO KING ROYALE - AUTHENTIC MOBILE APP UI & GAME ENGINE
// High-DPI Canvas • 3D Pawns & Dice • Hopping Physics • Quick Chat • Bot AI
// ==========================================================================

class LudoKingGame {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.players = [];
    this.myId = null;
    this.currentTurnIdx = 0;
    this.diceValue = 1;
    this.isRolling = false;
    this.hasRolled = false;
    this.sixStreak = 0;
    this.isSolo = false;
    this.winner = null;
    this.isRunning = false;
    this.botTimeout = null;
    this.turnTimerInterval = null;
    this.turnSecondsLeft = 15;
    this.animFrameId = null;
    this.animTime = 0;

    // Movement Animation Queue
    this.activeMovement = null; // { token, path: [], currentStepIdx, stepProgress: 0, onComplete }

    // Classic Ludo King Colors: 0: Red, 1: Green, 2: Yellow, 3: Blue
    this.colors = [
      { name: 'Red', hex: '#e52521', dark: '#a8110e', light: '#ff4d4d', glow: 'rgba(229, 37, 33, 0.8)', startPos: 0, homeEntry: 50 },
      { name: 'Green', hex: '#00a651', dark: '#006d33', light: '#33cc77', glow: 'rgba(0, 166, 81, 0.8)', startPos: 13, homeEntry: 11 },
      { name: 'Yellow', hex: '#ffc20e', dark: '#c69200', light: '#ffd84d', glow: 'rgba(255, 194, 14, 0.8)', startPos: 26, homeEntry: 24 },
      { name: 'Blue', hex: '#0072ce', dark: '#004785', light: '#3399ff', glow: 'rgba(0, 114, 206, 0.8)', startPos: 39, homeEntry: 37 }
    ];

    // Safe Star positions on 52-cell track (Red Start: 0, Red Safe: 8, Green Start: 13, Green Safe: 21,
    // Yellow Start: 26, Yellow Safe: 34, Blue Start: 39, Blue Safe: 47)
    this.safeStars = [0, 8, 13, 21, 26, 34, 39, 47];

    // 4 Tokens for each of 4 colors: state = 'yard' | 'track' | 'homeRun' | 'finished'
    // stepCount = 0 to 56 (0 = start square, 51 = home entrance, 52-56 = home column, 56 = finished)
    this.tokens = [];

    // Sound mute state
    this.soundMuted = false;
  }

  init(myPlayer, roomPlayers = [], isSolo = false) {
    this.canvas = document.getElementById('ludo-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.isSolo = isSolo;
    this.myId = myPlayer.id;
    this.winner = null;
    this.isRunning = true;
    this.sixStreak = 0;
    this.hasRolled = false;
    this.isRolling = false;
    this.activeMovement = null;

    // Setup 4 players (Fill with realistic AI if < 4)
    this.players = [];
    const botNames = ['CyberLudo', 'PulseBot', 'AlphaRoll', 'Omega'];
    const botAvatars = ['🤖', '⚡', '🎲', '👾'];

    for (let i = 0; i < 4; i++) {
      if (i < roomPlayers.length) {
        this.players.push({
          ...roomPlayers[i],
          colorIdx: i,
          color: this.colors[i],
          isBot: roomPlayers[i].isBot || false,
          avatar: roomPlayers[i].avatar || (i === 0 ? '👑' : botAvatars[i % botAvatars.length])
        });
      } else {
        this.players.push({
          id: 'ludo_bot_' + i,
          name: botNames[i % botNames.length],
          avatar: botAvatars[i % botAvatars.length],
          colorIdx: i,
          color: this.colors[i],
          isBot: true
        });
      }
    }

    // Initialize 4 tokens per player
    this.tokens = [];
    for (let pIdx = 0; pIdx < 4; pIdx++) {
      const pTokens = [];
      for (let t = 0; t < 4; t++) {
        pTokens.push({
          id: `${pIdx}_${t}`,
          playerIdx: pIdx,
          tokenIdx: t,
          state: 'yard', // 'yard', 'track', 'homeRun', 'finished'
          trackPos: -1,
          stepsTaken: -1,
          x: 0,
          y: 0
        });
      }
      this.tokens.push(pTokens);
    }

    this.currentTurnIdx = 0;
    this.diceValue = 6;

    this.resizeCanvas();
    window.removeEventListener('resize', this._onResize);
    this._onResize = () => this.resizeCanvas();
    window.addEventListener('resize', this._onResize);

    this.bindDOM();
    this.updateHUD();
    this.startTurnTimer();
    this.startAnimationLoop();

    this.checkBotTurn();
  }

  resizeCanvas() {
    if (!this.canvas) return;
    // Calculate best fit for mobile / desktop
    const maxW = Math.min(window.innerWidth - 24, 560);
    const maxH = Math.min(window.innerHeight - 260, 560);
    const size = Math.max(300, Math.min(maxW, maxH));

    const dpr = window.devicePixelRatio || 1;
    this.displaySize = size;
    this.canvas.width = Math.floor(size * dpr);
    this.canvas.height = Math.floor(size * dpr);
    this.canvas.style.width = size + 'px';
    this.canvas.style.height = size + 'px';

    this.ctx = this.canvas.getContext('2d');
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.cellSize = size / 15;
  }

  startAnimationLoop() {
    cancelAnimationFrame(this.animFrameId);
    let lastTimestamp = performance.now();

    const loop = (timestamp) => {
      if (!this.isRunning) return;
      const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
      lastTimestamp = timestamp;
      this.animTime += dt;

      this.updateMovement(dt);
      this.render();

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  updateMovement(dt) {
    if (!this.activeMovement) return;
    const mov = this.activeMovement;
    // Hop speed: 8 steps per second (125ms per hop)
    const stepDuration = 0.13;
    mov.stepProgress += dt / stepDuration;

    if (mov.stepProgress >= 1.0) {
      mov.stepProgress = 0;
      mov.currentStepIdx++;

      // Play hop audio on each cell arrival
      if (window.soundFx && window.soundFx.playLudoPawnHop) {
        window.soundFx.playLudoPawnHop();
      }

      if (mov.currentStepIdx >= mov.path.length - 1) {
        // Destination reached!
        const finalCell = mov.path[mov.path.length - 1];
        mov.token.stepsTaken = finalCell.stepsTaken;
        mov.token.state = finalCell.state;
        mov.token.trackPos = finalCell.trackPos;

        const onDone = mov.onComplete;
        this.activeMovement = null;
        if (onDone) onDone();
        return;
      }
    }
  }

  bindDOM() {
    // Exit button in header handled by inline returnToLobbyAction()

    // Sound toggle
    const soundBtn = document.getElementById('ludo-sound-btn');
    if (soundBtn) {
      soundBtn.onclick = () => {
        if (window.soundFx) {
          const isMuted = window.soundFx.toggleMute();
          this.soundMuted = isMuted;
          soundBtn.innerText = isMuted ? '🔇' : '🔊';
        }
      };
    }

    // Quick Chat toggle
    const chatBtn = document.getElementById('ludo-chat-btn');
    const chatModal = document.getElementById('ludo-chat-modal');
    const chatClose = document.getElementById('ludo-chat-close');
    if (chatBtn && chatModal) {
      chatBtn.onclick = () => chatModal.classList.remove('hidden');
    }
    if (chatClose && chatModal) {
      chatClose.onclick = () => chatModal.classList.add('hidden');
    }

    // Emoji reaction buttons
    document.querySelectorAll('.ludo-emoji-btn').forEach(btn => {
      btn.onclick = () => {
        const emoji = btn.getAttribute('data-emoji');
        this.sendQuickReaction(emoji);
        if (chatModal) chatModal.classList.add('hidden');
      };
    });

    // Phrase reaction buttons
    document.querySelectorAll('.ludo-phrase-btn').forEach(btn => {
      btn.onclick = () => {
        const text = btn.getAttribute('data-text');
        this.sendQuickReaction(text);
        if (chatModal) chatModal.classList.add('hidden');
      };
    });

    // Rules modal
    const rulesBtn = document.getElementById('ludo-rules-btn');
    const rulesModal = document.getElementById('ludo-rules-modal');
    const rulesClose = document.getElementById('ludo-rules-close');
    const rulesGotIt = document.getElementById('ludo-rules-gotit');
    if (rulesBtn && rulesModal) {
      rulesBtn.onclick = () => rulesModal.classList.remove('hidden');
    }
    if (rulesClose && rulesModal) {
      rulesClose.onclick = () => rulesModal.classList.add('hidden');
    }
    if (rulesGotIt && rulesModal) {
      rulesGotIt.onclick = () => rulesModal.classList.add('hidden');
    }

    // Play again button
    const playAgainBtn = document.getElementById('ludo-play-again-btn');
    if (playAgainBtn) {
      playAgainBtn.onclick = () => {
        const modal = document.getElementById('ludo-victory-modal');
        if (modal) modal.classList.add('hidden');
        const myP = this.players.find(p => p.id === this.myId) || this.players[0];
        this.init(myP, this.players, this.isSolo);
      };
    }

    // Mobile central roll button
    const rollBtn = document.getElementById('ludo-roll-btn');
    if (rollBtn) {
      rollBtn.onclick = () => {
        if (this.isMyTurn() && !this.hasRolled && !this.isRolling && !this.activeMovement && !this.winner) {
          this.rollDice();
        }
      };
    }

    // 4 Corner Player Dice Boxes
    for (let i = 0; i < 4; i++) {
      const diceBox = document.getElementById(`ludo-dice-box-${i}`);
      if (diceBox) {
        diceBox.onclick = () => {
          if (this.currentTurnIdx === i && this.isMyTurn() && !this.hasRolled && !this.isRolling && !this.activeMovement && !this.winner) {
            this.rollDice();
          }
        };
      }
    }

    // Canvas click & touch interactions
    if (this.canvas) {
      const handlePointer = (clientX, clientY) => {
        if (!this.isMyTurn() || !this.hasRolled || this.isRolling || this.activeMovement || this.winner) return;
        const rect = this.canvas.getBoundingClientRect();
        const scale = this.displaySize / rect.width;
        const clickX = (clientX - rect.left) * scale;
        const clickY = (clientY - rect.top) * scale;
        this.handleCanvasClick(clickX, clickY);
      };

      this.canvas.onclick = (e) => handlePointer(e.clientX, e.clientY);
      this.canvas.ontouchstart = (e) => {
        if (e.touches && e.touches.length > 0) {
          handlePointer(e.touches[0].clientX, e.touches[0].clientY);
          e.preventDefault();
        }
      };
    }
  }

  isMyTurn() {
    const cur = this.players[this.currentTurnIdx];
    return cur && (cur.id === this.myId || (this.isSolo && !cur.isBot));
  }

  startTurnTimer() {
    clearInterval(this.turnTimerInterval);
    this.turnSecondsLeft = 15;
    this.turnTimerInterval = setInterval(() => {
      if (!this.isRunning || this.winner || this.activeMovement) return;
      this.turnSecondsLeft--;
      if (this.turnSecondsLeft <= 0) {
        // Time expired!
        if (this.isMyTurn()) {
          if (!this.hasRolled && !this.isRolling) {
            this.rollDice(); // Auto-roll for player
          } else {
            this.passTurn();
          }
        }
      }
    }, 1000);
  }

  sendQuickReaction(msg) {
    const myIdx = this.players.findIndex(p => p.id === this.myId);
    const pIdx = myIdx >= 0 ? myIdx : 0;
    this.showSpeechBubble(pIdx, msg, true);
  }

  showSpeechBubble(playerIdx, text, syncRemote = true) {
    const bubble = document.getElementById(`ludo-bubble-${playerIdx}`);
    if (bubble) {
      bubble.innerText = text;
      bubble.classList.remove('hidden');
      if (window.soundFx && window.soundFx.playLudoPop) {
        window.soundFx.playLudoPop();
      }
      clearTimeout(bubble._timeout);
      bubble._timeout = setTimeout(() => {
        bubble.classList.add('hidden');
      }, 3500);
    }

    if (syncRemote && window.network && window.network.roomId) {
      window.network.sendGameAction('LUDO_CHAT', { playerIdx, text });
    }
  }

  rollDice(syncRemote = true) {
    if (this.isRolling || this.hasRolled || this.activeMovement) return;
    this.isRolling = true;

    // Trigger authentic dice rattle audio
    if (window.soundFx && window.soundFx.playLudoDiceRoll) {
      window.soundFx.playLudoDiceRoll();
    } else if (window.soundFx && window.soundFx.playCardFlick) {
      window.soundFx.playCardFlick();
    }

    // Animate 3D dice in active player's corner
    const activeDiceFace = document.getElementById(`ludo-dice-face-${this.currentTurnIdx}`);
    if (activeDiceFace) {
      activeDiceFace.classList.add('rolling');
    }

    let rolls = 0;
    const interval = setInterval(() => {
      this.diceValue = Math.floor(Math.random() * 6) + 1;
      this.updateDicePips(this.currentTurnIdx, this.diceValue);
      rolls++;

      if (rolls > 8) {
        clearInterval(interval);
        if (activeDiceFace) {
          activeDiceFace.classList.remove('rolling');
        }
        this.isRolling = false;
        this.hasRolled = true;

        if (syncRemote && window.network && window.network.roomId) {
          window.network.sendGameAction('LUDO_DICE_ROLLED', { diceValue: this.diceValue });
        }

        this.onDiceRollFinished();
      }
    }, 60);
  }

  updateDicePips(playerIdx, value) {
    const diceFace = document.getElementById(`ludo-dice-face-${playerIdx}`);
    if (!diceFace) return;

    let pipsHtml = '';
    for (let i = 0; i < value; i++) {
      pipsHtml += '<span></span>';
    }
    diceFace.innerHTML = `<div class="dice-pip-grid pip-${value}">${pipsHtml}</div>`;

    // Also update legacy text element if present
    const legacyFace = document.getElementById('ludo-dice-face');
    if (legacyFace) {
      legacyFace.innerText = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][value - 1];
    }
  }

  onDiceRollFinished() {
    const pIdx = this.currentTurnIdx;
    const curP = this.players[pIdx];

    // Check 3 consecutive sixes rule
    if (this.diceValue === 6) {
      this.sixStreak++;
      if (this.sixStreak === 3) {
        this.setStatusBanner('🚫 3 Sixes in a row! Turn skipped!');
        if (window.soundFx && window.soundFx.playLudoBuzzer) {
          window.soundFx.playLudoBuzzer();
        }
        setTimeout(() => this.passTurn(), 1200);
        return;
      }
    } else {
      this.sixStreak = 0;
    }

    // Find movable tokens
    const movableTokens = this.getMovableTokens(pIdx, this.diceValue);

    if (movableTokens.length === 0) {
      // No legal moves
      this.setStatusBanner('No valid moves possible 🤷‍♂️');
      setTimeout(() => this.passTurn(), 900);
    } else if (movableTokens.length === 1 && (!curP.isBot || this.isMyTurn())) {
      // Auto move single option for human player ease
      this.setStatusBanner('Auto-moving only available token... 🚀');
      setTimeout(() => this.moveToken(movableTokens[0], this.diceValue), 350);
    } else if (curP.isBot) {
      // Bot decision
      this.setStatusBanner(`${curP.avatar} ${curP.name} is planning a move... 🤔`);
      setTimeout(() => this.makeBotDecision(movableTokens), 750);
    } else {
      this.setStatusBanner('👉 Tap a highlighted pawn to move!');
      this.updateHUD();
    }
  }

  getMovableTokens(pIdx, dice) {
    const list = [];
    const pTokens = this.tokens[pIdx];

    pTokens.forEach(t => {
      if (t.state === 'yard') {
        if (dice === 6) list.push(t);
      } else if (t.state === 'track' || t.state === 'homeRun') {
        if (t.stepsTaken + dice <= 56) {
          list.push(t);
        }
      }
    });

    return list;
  }

  handleCanvasClick(clickX, clickY) {
    const pIdx = this.currentTurnIdx;
    const movable = this.getMovableTokens(pIdx, this.diceValue);
    if (movable.length === 0) return;

    for (const token of movable) {
      const pos = this.getTokenCanvasCoord(token);
      const dist = Math.hypot(clickX - pos.x, clickY - pos.y);
      // Generous hit box for mobile thumbs (1.3x cell size)
      if (dist < this.cellSize * 0.95) {
        this.moveToken(token, this.diceValue);
        break;
      }
    }
  }

  // Calculate step-by-step path coordinates for smooth hop animation
  calculatePath(token, dice) {
    const path = [];
    const pIdx = token.playerIdx;
    const startPos = this.colors[pIdx].startPos;

    if (token.state === 'yard') {
      // Leaving yard directly to start square
      path.push({
        state: 'yard',
        stepsTaken: -1,
        trackPos: -1
      });
      path.push({
        state: 'track',
        stepsTaken: 0,
        trackPos: startPos
      });
      return path;
    }

    const curSteps = token.stepsTaken;
    for (let s = 0; s <= dice; s++) {
      const stepCount = curSteps + s;
      if (stepCount === 56) {
        path.push({ state: 'finished', stepsTaken: 56, trackPos: -1 });
      } else if (stepCount > 50) {
        path.push({ state: 'homeRun', stepsTaken: stepCount, trackPos: -1 });
      } else {
        path.push({
          state: 'track',
          stepsTaken: stepCount,
          trackPos: (startPos + stepCount) % 52
        });
      }
    }

    return path;
  }

  moveToken(token, dice, syncRemote = true) {
    this.hasRolled = false;

    // Build the stepping path
    const path = this.calculatePath(token, dice);

    if (syncRemote && window.network && window.network.roomId) {
      window.network.sendGameAction('LUDO_MOVE_TOKEN', {
        playerIdx: token.playerIdx,
        tokenIdx: token.tokenIdx,
        dice: dice
      });
    }

    // Start animated stepping
    this.activeMovement = {
      token,
      path,
      currentStepIdx: 0,
      stepProgress: 0,
      onComplete: () => {
        this.finalizeTokenMove(token, dice);
      }
    };
  }

  finalizeTokenMove(token, dice) {
    // Check Capture on track (if not safe star)
    let capturedOpponent = false;
    if (token.state === 'track' && !this.safeStars.includes(token.trackPos)) {
      for (let otherP = 0; otherP < 4; otherP++) {
        if (otherP !== token.playerIdx) {
          this.tokens[otherP].forEach(ot => {
            if (ot.state === 'track' && ot.trackPos === token.trackPos) {
              // Capture opponent!
              ot.state = 'yard';
              ot.stepsTaken = -1;
              ot.trackPos = -1;
              capturedOpponent = true;

              if (window.soundFx && window.soundFx.playLudoCapture) {
                window.soundFx.playLudoCapture();
              }

              this.setStatusBanner(`💥 Knockout! ${this.players[token.playerIdx].name} knocked out ${this.players[otherP].name}!`);

              // Hilarious reaction from captured player
              if (this.players[otherP].isBot) {
                setTimeout(() => {
                  const reacts = ['Nooo! 😭', 'Wait! 😡', 'I\'ll get you! 😤', 'Oops! 😱'];
                  this.showSpeechBubble(otherP, reacts[Math.floor(Math.random() * reacts.length)], false);
                }, 400);
              }
            }
          });
        }
      }
    }

    // Check Home Reach
    if (token.state === 'finished') {
      if (window.soundFx && window.soundFx.playLudoHome) {
        window.soundFx.playLudoHome();
      }
      this.setStatusBanner(`🌟 ${this.players[token.playerIdx].name} scored a Home! 🏆`);
    }

    // Check Safe Star landing
    if (token.state === 'track' && this.safeStars.includes(token.trackPos)) {
      if (window.soundFx && window.soundFx.playLudoSafeStar) {
        window.soundFx.playLudoSafeStar();
      }
    }

    this.updateHUD();

    // Check Victory (all 4 tokens finished)
    const finishedCount = this.tokens[token.playerIdx].filter(t => t.state === 'finished').length;
    if (finishedCount === 4) {
      this.winner = this.players[token.playerIdx];
      if (window.soundFx && window.soundFx.playVictory) {
        window.soundFx.playVictory();
      }
      this.showVictoryModal(this.winner);
      return;
    }

    // Bonus turn on 6 or capture!
    if (dice === 6 || capturedOpponent) {
      this.setStatusBanner('🎉 Bonus Roll Awarded! 🎲');
      setTimeout(() => this.checkBotTurn(), 500);
    } else {
      setTimeout(() => this.passTurn(), 400);
    }
  }

  passTurn() {
    this.currentTurnIdx = (this.currentTurnIdx + 1) % 4;
    this.hasRolled = false;
    this.isRolling = false;
    this.sixStreak = 0;
    this.startTurnTimer();
    this.updateHUD();
    this.checkBotTurn();
  }

  checkBotTurn() {
    if (!this.isRunning || this.winner || this.activeMovement) return;
    clearTimeout(this.botTimeout);

    const cur = this.players[this.currentTurnIdx];
    if (cur && cur.isBot) {
      // Natural human-like pause (700-1100ms)
      this.botTimeout = setTimeout(() => {
        if (!this.hasRolled && !this.isRolling && !this.activeMovement) {
          this.rollDice();
        }
      }, 850);
    }
  }

  makeBotDecision(movable) {
    if (movable.length === 0) {
      this.passTurn();
      return;
    }

    // Smart Bot AI: Score candidates
    let bestToken = movable[0];
    let bestScore = -999;

    movable.forEach(t => {
      let score = 0;
      // 1. Prioritize scoring Home
      if (t.stepsTaken + this.diceValue === 56) score += 120;
      // 2. Prioritize capturing opponent
      const targetPos = (this.colors[t.playerIdx].startPos + t.stepsTaken + this.diceValue) % 52;
      if (!this.safeStars.includes(targetPos)) {
        for (let op = 0; op < 4; op++) {
          if (op !== t.playerIdx) {
            this.tokens[op].forEach(ot => {
              if (ot.state === 'track' && ot.trackPos === targetPos) score += 95;
            });
          }
        }
      }
      // 3. Move out of yard on 6
      if (t.state === 'yard' && this.diceValue === 6) score += 75;
      // 4. Move onto safe star
      if (this.safeStars.includes(targetPos)) score += 40;
      // 5. Normal advance
      score += t.stepsTaken * 0.6;

      if (score > bestScore) {
        bestScore = score;
        bestToken = t;
      }
    });

    this.moveToken(bestToken, this.diceValue);
  }

  // ==========================================================================
  // CANVAS RENDERING ENGINE (Ludo King Classic Board & 3D Pawns)
  // ==========================================================================
  render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const cs = this.cellSize;
    const boardSize = 15 * cs;

    ctx.clearRect(0, 0, boardSize, boardSize);

    // 1. Luxurious Wooden Outer Board Frame
    this.drawBoardBackground(boardSize);

    // 2. The 4 Corner Home Bases (Yards) with White Circular Plates
    this.drawHomeBase(0, 0, this.colors[0]); // Red (Top-Left)
    this.drawHomeBase(9 * cs, 0, this.colors[1]); // Green (Top-Right)
    this.drawHomeBase(9 * cs, 9 * cs, this.colors[2]); // Yellow (Bottom-Right)
    this.drawHomeBase(0, 9 * cs, this.colors[3]); // Blue (Bottom-Left)

    // 3. 15x15 Track Cells, Safe Stars & Home Runways
    this.drawTrackGrid();

    // 4. Center Home Triangles with Majestic Golden Crown & HOME Emblem
    this.drawCenterHome();

    // 5. Draw All 16 Pawns with 3D Gradients & Hopping Animations
    this.drawAllTokens();
  }

  drawBoardBackground(boardSize) {
    const ctx = this.ctx;
    // Outer wooden frame gradient
    const woodGrad = ctx.createLinearGradient(0, 0, boardSize, boardSize);
    woodGrad.addColorStop(0, '#3a1f12');
    woodGrad.addColorStop(0.5, '#4a2818');
    woodGrad.addColorStop(1, '#2c160c');
    ctx.fillStyle = woodGrad;
    ctx.fillRect(0, 0, boardSize, boardSize);

    // Golden inner border
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, boardSize - 6, boardSize - 6);

    // Corner golden metallic brackets / studs
    const studR = 5;
    [
      { x: 10, y: 10 },
      { x: boardSize - 10, y: 10 },
      { x: boardSize - 10, y: boardSize - 10 },
      { x: 10, y: boardSize - 10 }
    ].forEach(s => {
      const grad = ctx.createRadialGradient(s.x - 1, s.y - 1, 1, s.x, s.y, studR);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, '#ffd700');
      grad.addColorStop(1, '#b8860b');
      ctx.beginPath();
      ctx.arc(s.x, s.y, studR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });
  }

  drawHomeBase(bx, by, color) {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const baseW = 6 * cs;

    // Colored base background
    ctx.fillStyle = color.hex;
    ctx.fillRect(bx, by, baseW, baseW);

    // Inner shadow for depth
    ctx.strokeStyle = color.dark;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx + 1, by + 1, baseW - 2, baseW - 2);

    // Large crisp white circular/rounded plate (Classic Ludo King look!)
    const plateX = bx + 0.85 * cs;
    const plateY = by + 0.85 * cs;
    const plateW = 4.3 * cs;
    const plateR = 16;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    ctx.beginPath();
    ctx.roundRect(plateX, plateY, plateW, plateW, plateR);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // Plate inner bevel
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 4 Token Holding Pits (Pedestals)
    const cx = bx + 3 * cs;
    const cy = by + 3 * cs;
    const rad = 1.35 * cs;
    const pitPositions = [
      { x: cx - rad, y: cy - rad },
      { x: cx + rad, y: cy - rad },
      { x: cx - rad, y: cy + rad },
      { x: cx + rad, y: cy + rad }
    ];

    pitPositions.forEach(p => {
      // Outer colored metallic ring
      ctx.beginPath();
      ctx.arc(p.x, p.y, cs * 0.72, 0, Math.PI * 2);
      ctx.fillStyle = color.hex;
      ctx.fill();
      ctx.strokeStyle = color.dark;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner white concave slot
      const pitGrad = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, cs * 0.55);
      pitGrad.addColorStop(0, '#ffffff');
      pitGrad.addColorStop(0.8, '#f1f5f9');
      pitGrad.addColorStop(1, '#cbd5e1');

      ctx.beginPath();
      ctx.arc(p.x, p.y, cs * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = pitGrad;
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  drawTrackGrid() {
    const ctx = this.ctx;
    const cs = this.cellSize;

    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        // Skip corner bases and center
        const inCorner = (r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c < 6) || (r > 8 && c > 8);
        const inCenter = (r >= 6 && r <= 8 && c >= 6 && c <= 8);
        if (inCorner || inCenter) continue;

        const cellX = c * cs;
        const cellY = r * cs;

        // Base cell: Crisp white tile
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cellX, cellY, cs, cs);

        // Thin cell divider
        ctx.strokeStyle = '#b0bec5';
        ctx.lineWidth = 1;
        ctx.strokeRect(cellX, cellY, cs, cs);

        // Colored Home Runways (Columns of 5 cells)
        if (r === 7 && c >= 1 && c <= 5) {
          // Red runway
          this.drawRunwayCell(cellX, cellY, cs, this.colors[0], 'right');
        } else if (c === 7 && r >= 1 && r <= 5) {
          // Green runway
          this.drawRunwayCell(cellX, cellY, cs, this.colors[1], 'down');
        } else if (r === 7 && c >= 9 && c <= 13) {
          // Yellow runway
          this.drawRunwayCell(cellX, cellY, cs, this.colors[2], 'left');
        } else if (c === 7 && r >= 9 && r <= 13) {
          // Blue runway
          this.drawRunwayCell(cellX, cellY, cs, this.colors[3], 'up');
        }
      }
    }

    // 4 Starting Cells: Colored background + Arrow + Safe Star
    // Red Start: (1, 6)
    this.drawStartCell(1 * cs, 6 * cs, cs, this.colors[0], 'right');
    // Green Start: (8, 1)
    this.drawStartCell(8 * cs, 1 * cs, cs, this.colors[1], 'down');
    // Yellow Start: (13, 8)
    this.drawStartCell(13 * cs, 8 * cs, cs, this.colors[2], 'left');
    // Blue Start: (6, 13)
    this.drawStartCell(6 * cs, 13 * cs, cs, this.colors[3], 'up');

    // 4 Safe Star Cells:
    // Red quadrant safe: (6, 2)
    this.drawSafeStar(6 * cs + cs / 2, 2 * cs + cs / 2, cs * 0.38);
    // Green quadrant safe: (12, 6)
    this.drawSafeStar(12 * cs + cs / 2, 6 * cs + cs / 2, cs * 0.38);
    // Yellow quadrant safe: (8, 12)
    this.drawSafeStar(8 * cs + cs / 2, 12 * cs + cs / 2, cs * 0.38);
    // Blue quadrant safe: (2, 8)
    this.drawSafeStar(2 * cs + cs / 2, 8 * cs + cs / 2, cs * 0.38);
  }

  drawRunwayCell(x, y, cs, color, arrowDir) {
    const ctx = this.ctx;
    ctx.fillStyle = color.hex;
    ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);

    // Directional chevron arrow
    this.drawArrow(x + cs / 2, y + cs / 2, cs * 0.3, arrowDir, '#ffffff');
  }

  drawStartCell(x, y, cs, color, arrowDir) {
    const ctx = this.ctx;
    ctx.fillStyle = color.hex;
    ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);

    // White directional arrow
    this.drawArrow(x + cs / 2, y + cs / 2, cs * 0.35, arrowDir, '#ffffff');
    // Star indicator
    this.drawSafeStar(x + cs / 2, y + cs / 2, cs * 0.28, '#ffd700');
  }

  drawArrow(cx, cy, size, dir, color = '#ffffff') {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cx, cy);

    let angle = 0;
    if (dir === 'down') angle = Math.PI / 2;
    else if (dir === 'left') angle = Math.PI;
    else if (dir === 'up') angle = -Math.PI / 2;

    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(size * 0.6, 0);
    ctx.lineTo(-size * 0.5, -size * 0.5);
    ctx.lineTo(-size * 0.2, 0);
    ctx.lineTo(-size * 0.5, size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawSafeStar(cx, cy, r, fillStyle) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cx, cy);

    const points = 5;
    const innerR = r * 0.42;

    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? r : innerR;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    // Golden 3D star gradient
    if (!fillStyle) {
      const grad = ctx.createLinearGradient(-r, -r, r, r);
      grad.addColorStop(0, '#fff3b0');
      grad.addColorStop(0.5, '#ffd700');
      grad.addColorStop(1, '#d48800');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = fillStyle;
    }

    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.fill();

    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  drawCenterHome() {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const cx = 7.5 * cs;
    const cy = 7.5 * cs;

    // 4 Triangles meeting in center:
    // Left: Red
    ctx.beginPath();
    ctx.moveTo(6 * cs, 6 * cs);
    ctx.lineTo(cx, cy);
    ctx.lineTo(6 * cs, 9 * cs);
    ctx.fillStyle = this.colors[0].hex;
    ctx.fill();

    // Top: Green
    ctx.beginPath();
    ctx.moveTo(6 * cs, 6 * cs);
    ctx.lineTo(cx, cy);
    ctx.lineTo(9 * cs, 6 * cs);
    ctx.fillStyle = this.colors[1].hex;
    ctx.fill();

    // Right: Yellow
    ctx.beginPath();
    ctx.moveTo(9 * cs, 6 * cs);
    ctx.lineTo(cx, cy);
    ctx.lineTo(9 * cs, 9 * cs);
    ctx.fillStyle = this.colors[2].hex;
    ctx.fill();

    // Bottom: Blue
    ctx.beginPath();
    ctx.moveTo(6 * cs, 9 * cs);
    ctx.lineTo(cx, cy);
    ctx.lineTo(9 * cs, 9 * cs);
    ctx.fillStyle = this.colors[3].hex;
    ctx.fill();

    // Golden Radiant Center Sunburst
    const centerR = cs * 0.95;
    const sunGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, centerR);
    sunGrad.addColorStop(0, '#ffffff');
    sunGrad.addColorStop(0.4, '#ffd700');
    sunGrad.addColorStop(1, '#e6ac00');

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, centerR, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Majestic Golden Crown in exact center!
    ctx.font = `${Math.floor(cs * 0.95)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👑', cx, cy - 2);

    ctx.restore();
  }

  drawAllTokens() {
    const isHumanTurn = this.isMyTurn() && this.hasRolled && !this.activeMovement;
    const movableList = isHumanTurn ? this.getMovableTokens(this.currentTurnIdx, this.diceValue) : [];

    // Group track tokens to handle overlapping cells
    const cellGroups = {};

    for (let p = 0; p < 4; p++) {
      this.tokens[p].forEach(t => {
        // If this token is currently in motion, draw it along the movement arc
        if (this.activeMovement && this.activeMovement.token === t) return;

        if (t.state === 'track') {
          const key = `track_${t.trackPos}`;
          cellGroups[key] = cellGroups[key] || [];
          cellGroups[key].push(t);
        } else if (t.state === 'homeRun') {
          const key = `hr_${t.playerIdx}_${t.stepsTaken}`;
          cellGroups[key] = cellGroups[key] || [];
          cellGroups[key].push(t);
        } else {
          // Yard or Finished: draw individually
          const isMovable = movableList.includes(t);
          this.draw3DPawn(t, isMovable);
        }
      });
    }

    // Draw grouped tokens on track/homeRun with slight offset
    Object.values(cellGroups).forEach(group => {
      if (group.length === 1) {
        const t = group[0];
        const isMovable = movableList.includes(t);
        this.draw3DPawn(t, isMovable);
      } else {
        // Multi-token arrangement on same cell
        const offsets = this.getGroupOffsets(group.length);
        group.forEach((t, i) => {
          const isMovable = movableList.includes(t);
          this.draw3DPawn(t, isMovable, offsets[i], 0.78);
        });
      }
    });

    // Draw the active animated hopping pawn on top of everything
    if (this.activeMovement) {
      this.drawHoppingToken(this.activeMovement);
    }
  }

  getGroupOffsets(count) {
    const cs = this.cellSize;
    const d = cs * 0.22;
    if (count === 2) return [{ dx: -d, dy: 0 }, { dx: d, dy: 0 }];
    if (count === 3) return [{ dx: -d, dy: -d }, { dx: d, dy: -d }, { dx: 0, dy: d }];
    return [{ dx: -d, dy: -d }, { dx: d, dy: -d }, { dx: -d, dy: d }, { dx: d, dy: d }];
  }

  // Draw 3D Pawn Figure with drop shadow, bell base, collar ring, and specular head
  draw3DPawn(token, isMovable = false, offset = { dx: 0, dy: 0 }, scale = 1.0) {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const pos = this.getTokenCanvasCoord(token);
    const color = this.colors[token.playerIdx];

    const x = pos.x + offset.dx;
    let y = pos.y + offset.dy;

    // Idle bouncing hop animation for movable tokens
    if (isMovable) {
      const hopOffset = -Math.abs(Math.sin(this.animTime * 6)) * (cs * 0.25);
      y += hopOffset;

      // Glowing golden ripple on cell floor
      ctx.save();
      const rippleR = cs * (0.45 + Math.sin(this.animTime * 5) * 0.08);
      ctx.beginPath();
      ctx.arc(pos.x + offset.dx, pos.y + offset.dy, rippleR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 215, 0, 0.25)';
      ctx.fill();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    const r = cs * 0.38 * scale;

    ctx.save();

    // 1. Soft Elliptical Ground Shadow
    ctx.beginPath();
    ctx.ellipse(pos.x + offset.dx, pos.y + offset.dy + r * 0.55, r * 0.85, r * 0.38, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.fill();

    // 2. Pawn Fluted Bell-shaped Base
    const baseW = r * 1.5;
    const baseH = r * 0.8;
    const baseY = y + r * 0.25;

    ctx.beginPath();
    ctx.moveTo(x - baseW * 0.5, baseY + baseH * 0.5);
    ctx.bezierCurveTo(x - baseW * 0.45, baseY - baseH * 0.2, x - r * 0.4, y, x - r * 0.35, y);
    ctx.lineTo(x + r * 0.35, y);
    ctx.bezierCurveTo(x + r * 0.4, y, x + baseW * 0.45, baseY - baseH * 0.2, x + baseW * 0.5, baseY + baseH * 0.5);
    ctx.closePath();

    const baseGrad = ctx.createLinearGradient(x - baseW * 0.5, y, x + baseW * 0.5, baseY + baseH * 0.5);
    baseGrad.addColorStop(0, color.dark);
    baseGrad.addColorStop(0.35, color.hex);
    baseGrad.addColorStop(0.7, color.light);
    baseGrad.addColorStop(1, color.dark);

    ctx.fillStyle = baseGrad;
    ctx.fill();
    ctx.strokeStyle = color.dark;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 3. Golden Collar Ring at the neck
    const collarY = y - r * 0.1;
    ctx.beginPath();
    ctx.ellipse(x, collarY, r * 0.42, r * 0.16, 0, 0, Math.PI * 2);
    const collarGrad = ctx.createLinearGradient(x - r * 0.4, collarY, x + r * 0.4, collarY);
    collarGrad.addColorStop(0, '#b8860b');
    collarGrad.addColorStop(0.5, '#fff3b0');
    collarGrad.addColorStop(1, '#b8860b');
    ctx.fillStyle = collarGrad;
    ctx.fill();

    // 4. Spherical Pawn Head with 3D Radial Specular Glint
    const headR = r * 0.65;
    const headY = y - r * 0.55;

    const headGrad = ctx.createRadialGradient(x - headR * 0.35, headY - headR * 0.35, headR * 0.1, x, headY, headR);
    headGrad.addColorStop(0, '#ffffff'); // Specular highlight
    headGrad.addColorStop(0.3, color.light);
    headGrad.addColorStop(0.8, color.hex);
    headGrad.addColorStop(1, color.dark);

    ctx.beginPath();
    ctx.arc(x, headY, headR, 0, Math.PI * 2);
    ctx.fillStyle = headGrad;
    ctx.fill();
    ctx.strokeStyle = color.dark;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 5. Floating Golden Arrow for movable pawn
    if (isMovable) {
      this.drawArrow(x, headY - headR - 12, cs * 0.28, 'down', '#ffd700');
    }

    ctx.restore();
  }

  // Draw active token during parabolic step-by-step hop
  drawHoppingToken(mov) {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const path = mov.path;
    const idx = mov.currentStepIdx;
    const p1 = this.getCellCoordFromStep(path[idx], mov.token.playerIdx, mov.token.tokenIdx);
    const p2 = this.getCellCoordFromStep(path[Math.min(idx + 1, path.length - 1)], mov.token.playerIdx, mov.token.tokenIdx);

    const progress = Math.min(Math.max(mov.stepProgress, 0), 1);
    // Linear horizontal interpolation
    const curX = p1.x + (p2.x - p1.x) * progress;
    // Parabolic vertical hop arc (jump into air)
    const arcHeight = Math.sin(progress * Math.PI) * (cs * 0.55);
    const curY = p1.y + (p2.y - p1.y) * progress - arcHeight;

    const color = this.colors[mov.token.playerIdx];
    const r = cs * 0.42;

    ctx.save();
    // Shadow stays on ground
    const shadowX = p1.x + (p2.x - p1.x) * progress;
    const shadowY = p1.y + (p2.y - p1.y) * progress;
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY + r * 0.5, r * (0.8 - arcHeight * 0.01), r * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fill();

    // Render 3D pawn at airborne coordinate
    this.draw3DPawnAt(curX, curY, color, r);
    ctx.restore();
  }

  draw3DPawnAt(x, y, color, r) {
    const ctx = this.ctx;
    // Base
    const baseW = r * 1.5;
    const baseH = r * 0.8;
    const baseY = y + r * 0.25;

    ctx.beginPath();
    ctx.moveTo(x - baseW * 0.5, baseY + baseH * 0.5);
    ctx.bezierCurveTo(x - baseW * 0.45, baseY - baseH * 0.2, x - r * 0.4, y, x - r * 0.35, y);
    ctx.lineTo(x + r * 0.35, y);
    ctx.bezierCurveTo(x + r * 0.4, y, x + baseW * 0.45, baseY - baseH * 0.2, x + baseW * 0.5, baseY + baseH * 0.5);
    ctx.closePath();

    const baseGrad = ctx.createLinearGradient(x - baseW * 0.5, y, x + baseW * 0.5, baseY + baseH * 0.5);
    baseGrad.addColorStop(0, color.dark);
    baseGrad.addColorStop(0.35, color.hex);
    baseGrad.addColorStop(0.7, color.light);
    baseGrad.addColorStop(1, color.dark);
    ctx.fillStyle = baseGrad;
    ctx.fill();

    // Collar
    const collarY = y - r * 0.1;
    ctx.beginPath();
    ctx.ellipse(x, collarY, r * 0.42, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill();

    // Head
    const headR = r * 0.65;
    const headY = y - r * 0.55;
    const headGrad = ctx.createRadialGradient(x - headR * 0.35, headY - headR * 0.35, headR * 0.1, x, headY, headR);
    headGrad.addColorStop(0, '#ffffff');
    headGrad.addColorStop(0.3, color.light);
    headGrad.addColorStop(0.8, color.hex);
    headGrad.addColorStop(1, color.dark);

    ctx.beginPath();
    ctx.arc(x, headY, headR, 0, Math.PI * 2);
    ctx.fillStyle = headGrad;
    ctx.fill();
    ctx.strokeStyle = color.dark;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  getCellCoordFromStep(stepObj, pIdx, tIdx) {
    if (!stepObj) return { x: 0, y: 0 };
    const mockToken = {
      playerIdx: pIdx,
      tokenIdx: tIdx,
      state: stepObj.state,
      stepsTaken: stepObj.stepsTaken,
      trackPos: stepObj.trackPos
    };
    return this.getTokenCanvasCoord(mockToken);
  }

  getTokenCanvasCoord(token) {
    const cs = this.cellSize;
    const pIdx = token.playerIdx;
    const tIdx = token.tokenIdx;

    if (token.state === 'yard') {
      const bases = [
        { bx: 3 * cs, by: 3 * cs }, // Red
        { bx: 12 * cs, by: 3 * cs }, // Green
        { bx: 12 * cs, by: 12 * cs }, // Yellow
        { bx: 3 * cs, by: 12 * cs }  // Blue
      ];
      const base = bases[pIdx];
      const rad = 1.35 * cs;
      const offsets = [
        { dx: -rad, dy: -rad },
        { dx: rad, dy: -rad },
        { dx: -rad, dy: rad },
        { dx: rad, dy: rad }
      ];
      return { x: base.bx + offsets[tIdx].dx, y: base.by + offsets[tIdx].dy };
    }

    if (token.state === 'finished') {
      // Offset slightly inside center home triangle
      const cx = 7.5 * cs;
      const cy = 7.5 * cs;
      const tOffsets = [
        { dx: -0.6 * cs, dy: 0 },
        { dx: 0, dy: -0.6 * cs },
        { dx: 0.6 * cs, dy: 0 },
        { dx: 0, dy: 0.6 * cs }
      ];
      return { x: cx + tOffsets[pIdx].dx, y: cy + tOffsets[pIdx].dy };
    }

    if (token.state === 'homeRun') {
      const step = token.stepsTaken - 50; // 1 to 5
      if (pIdx === 0) return { x: (step + 0.5) * cs, y: 7.5 * cs };
      if (pIdx === 1) return { x: 7.5 * cs, y: (step + 0.5) * cs };
      if (pIdx === 2) return { x: (14.5 - step) * cs, y: 7.5 * cs };
      if (pIdx === 3) return { x: 7.5 * cs, y: (14.5 - step) * cs };
    }

    // Track coordinates on 52 cell perimeter
    return this.getTrackCellCoord(token.trackPos);
  }

  getTrackCellCoord(pos) {
    const cs = this.cellSize;
    const map = [
      [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], [7, 0], [8, 0], // 0-12
      [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [14, 7], [14, 8], // 13-25
      [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], [7, 14], [6, 14], // 26-38
      [6, 13], [6, 12], [6, 11], [6, 10], [6, 9], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8], [0, 7], [0, 6] // 39-51
    ];
    const cell = map[pos % 52] || [0, 6];
    return { x: (cell[0] + 0.5) * cs, y: (cell[1] + 0.5) * cs };
  }

  // ==========================================================================
  // HUD, PLAYER CARDS & STATUS BANNER SYNC
  // ==========================================================================
  updateHUD() {
    const curP = this.players[this.currentTurnIdx];

    // 1. Update 4 Player Corner Cards
    for (let i = 0; i < 4; i++) {
      const p = this.players[i];
      const card = document.getElementById(`ludo-player-${i}`);
      const nameEl = document.getElementById(`ludo-name-${i}`);
      const avatarEl = document.getElementById(`ludo-avatar-${i}`);
      const dotsEl = document.getElementById(`ludo-dots-${i}`);

      if (nameEl && p) {
        nameEl.innerText = p.name + (p.id === this.myId ? ' (YOU)' : '');
      }
      if (avatarEl && p) {
        avatarEl.innerText = p.avatar || '👤';
      }

      if (card) {
        if (i === this.currentTurnIdx) {
          card.classList.add('active-turn');
          if (!this.hasRolled && !this.isRolling && !this.activeMovement) {
            card.classList.add('can-roll');
          } else {
            card.classList.remove('can-roll');
          }
        } else {
          card.classList.remove('active-turn');
          card.classList.remove('can-roll');
        }
      }

      // Update Finished Home Pawns dots
      if (dotsEl && this.tokens[i]) {
        const finished = this.tokens[i].filter(t => t.state === 'finished').length;
        const dots = dotsEl.querySelectorAll('.p-dot');
        dots.forEach((dot, idx) => {
          if (idx < finished) dot.classList.add('done');
          else dot.classList.remove('done');
        });
      }
    }

    // 2. Update Status Banner
    const turnEl = document.getElementById('ludo-turn-name');
    const subEl = document.getElementById('ludo-turn-subtext');
    const banner = document.getElementById('ludo-status-banner');

    if (banner && curP) {
      banner.className = `ludo-status-banner p-${curP.color.name.toLowerCase()}-turn`;
    }

    if (turnEl && curP) {
      turnEl.innerText = `${curP.avatar} ${curP.name}'s Turn`;
      turnEl.style.color = curP.color.hex;
    }

    if (subEl) {
      if (this.isMyTurn()) {
        subEl.innerText = this.hasRolled ? '👉 Tap a highlighted pawn!' : '🎲 Tap your dice to roll!';
      } else {
        subEl.innerText = this.hasRolled ? 'Moving pawn...' : 'Rolling dice...';
      }
    }

    // 3. Update active dice face
    this.updateDicePips(this.currentTurnIdx, this.diceValue);
  }

  setStatusBanner(text) {
    const subEl = document.getElementById('ludo-turn-subtext');
    if (subEl) subEl.innerText = text;
  }

  showToast(msg) {
    if (window.lobby && window.lobby.showGlobalToast) {
      window.lobby.showGlobalToast(msg);
    }
  }

  showVictoryModal(winner) {
    const modal = document.getElementById('ludo-victory-modal');
    const txt = document.getElementById('ludo-victory-text');
    const table = document.getElementById('ludo-rankings-table');

    if (modal && txt) {
      txt.innerText = `${winner.avatar} ${winner.name.toUpperCase()} WINS LUDO KING! 🏆`;

      // Sort players by finished pawns and steps taken
      const ranked = [...this.players].sort((a, b) => {
        const aFin = this.tokens[a.colorIdx].filter(t => t.state === 'finished').length;
        const bFin = this.tokens[b.colorIdx].filter(t => t.state === 'finished').length;
        if (bFin !== aFin) return bFin - aFin;
        const aSteps = this.tokens[a.colorIdx].reduce((acc, t) => acc + Math.max(0, t.stepsTaken), 0);
        const bSteps = this.tokens[b.colorIdx].reduce((acc, t) => acc + Math.max(0, t.stepsTaken), 0);
        return bSteps - aSteps;
      });

      if (table) {
        const medalIcons = ['🥇', '🥈', '🥉', '4️⃣'];
        table.innerHTML = ranked.map((p, rank) => {
          const finCount = this.tokens[p.colorIdx].filter(t => t.state === 'finished').length;
          return `
            <div class="ludo-rank-row ${rank === 0 ? 'rank-1' : ''}">
              <span>${medalIcons[rank]} ${p.avatar} ${p.name}</span>
              <span class="text-gold">🏠 ${finCount}/4 Reached</span>
            </div>
          `;
        }).join('');
      }

      modal.classList.remove('hidden');
    }
  }

  stop() {
    this.isRunning = false;
    clearTimeout(this.botTimeout);
    clearInterval(this.turnTimerInterval);
    cancelAnimationFrame(this.animFrameId);
  }
}

// Global instance
window.ludoGame = new LudoKingGame();
