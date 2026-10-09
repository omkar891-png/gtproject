// Connect 4 Galaxy - 7x6 Holographic Grid with Gravity Bounce, 4-in-a-row Win Beam & Smart Minimax Bot AI
class Connect4Game {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.cols = 7;
    this.rows = 6;
    this.grid = []; // 0: empty, 1: player 1 (Cyan), 2: player 2 (Magenta/Yellow)
    this.players = [];
    this.currentTurnIdx = 0; // 0 or 1
    this.myId = null;
    this.isSolo = false;
    this.isAnimating = false;
    this.winner = null;
    this.winningCells = [];
    this.hoverCol = 3;
    this.botTimeout = null;

    this.palette = [
      { name: 'Cyan', hex: '#00f2fe', glow: 'rgba(0, 242, 254, 0.8)' },
      { name: 'Magenta', hex: '#ff0055', glow: 'rgba(255, 0, 85, 0.8)' }
    ];
  }

  init(myPlayer, otherPlayers = [], isSolo = false) {
    this.canvas = document.getElementById('connect4-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.isSolo = isSolo;
    this.myId = myPlayer.id;
    this.winner = null;
    this.winningCells = [];
    this.isAnimating = false;
    this.hoverCol = 3;

    // 2 Players: Player 1 is always Room Host (or local player), Player 2 is opponent or bot
    const allPlayers = otherPlayers && otherPlayers.length > 0 ? otherPlayers : [myPlayer];
    const p1 = allPlayers[0] || myPlayer;
    const p2 = allPlayers.find(p => p && p.id !== p1.id) || { id: 'c4_bot', name: 'GalaxyMind', avatar: '🤖', isBot: true };

    this.players = [
      { id: p1.id, name: p1.name, avatar: p1.avatar || '⭐', color: this.palette[0], isBot: p1.isBot || false },
      { id: p2.id, name: p2.name, avatar: p2.avatar || '🤖', color: this.palette[1], isBot: p2.isBot !== false }
    ];

    this.currentTurnIdx = 0;
    this.resetGrid();

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.bindControls();
    this.render();
    this.checkBotTurn();
  }

  resetGrid() {
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      this.grid.push(new Array(this.cols).fill(0));
    }
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const maxW = Math.min(window.innerWidth - 32, 560);
    const maxH = Math.min(window.innerHeight - 200, 480);
    this.cellSize = Math.floor(Math.min(maxW / this.cols, maxH / (this.rows + 1)));
    this.canvas.width = this.cellSize * this.cols;
    this.canvas.height = this.cellSize * (this.rows + 1);
    this.render();
  }

  bindControls() {
    if (!this.canvas) return;

    this.canvas.onmousemove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const col = Math.floor(clickX / (rect.width / this.cols));
      if (col >= 0 && col < this.cols && col !== this.hoverCol) {
        this.hoverCol = col;
        this.render();
      }
    };

    const handleColSelect = (clientX) => {
      if (!this.isMyTurn() || this.isAnimating || this.winner) return;
      const rect = this.canvas.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const col = Math.floor(clickX / (rect.width / this.cols));
      if (col >= 0 && col < this.cols) {
        this.hoverCol = col;
        this.dropDisc(col, true);
      }
    };

    this.canvas.onclick = (e) => {
      handleColSelect(e.clientX);
    };

    // Mobile touch interaction
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        if (e.cancelable) e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.touches[0].clientX - rect.left;
        const col = Math.floor(clickX / (rect.width / this.cols));
        if (col >= 0 && col < this.cols) {
          this.hoverCol = col;
          this.render();
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) {
        if (e.cancelable) e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.touches[0].clientX - rect.left;
        const col = Math.floor(clickX / (rect.width / this.cols));
        if (col >= 0 && col < this.cols && col !== this.hoverCol) {
          this.hoverCol = col;
          this.render();
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      if (this.hoverCol >= 0 && this.hoverCol < this.cols) {
        if (e.cancelable) e.preventDefault();
        if (this.isMyTurn() && !this.isAnimating && !this.winner) {
          this.dropDisc(this.hoverCol, true);
        }
      }
    }, { passive: false });
  }

  isMyTurn() {
    const cur = this.players[this.currentTurnIdx];
    return cur && cur.id === this.myId;
  }

  getLowestEmptyRow(col) {
    for (let r = this.rows - 1; r >= 0; r--) {
      if (this.grid[r][col] === 0) return r;
    }
    return -1;
  }

  dropDisc(col, syncRemote = true) {
    const targetRow = this.getLowestEmptyRow(col);
    if (targetRow === -1 || this.isAnimating || this.winner) return;

    this.isAnimating = true;
    const playerNum = this.currentTurnIdx + 1; // 1 or 2
    window.soundFx.playCardFlick();

    if (syncRemote && window.network && window.network.roomId) {
      window.network.sendGameAction('C4_DROP_DISC', { col });
    }

    // Animate falling disc
    let curY = 0;
    const targetY = (targetRow + 1) * this.cellSize;
    const speed = 18;

    const anim = () => {
      curY += speed;
      if (curY >= targetY) {
        this.grid[targetRow][col] = playerNum;
        this.isAnimating = false;
        window.soundFx.playCheckAlert();

        this.checkWinCondition(targetRow, col, playerNum);
        return;
      }
      this.render(curY, col);
      requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  }

  checkWinCondition(lastR, lastC, playerNum) {
    const win = this.checkConnect4(playerNum);
    if (win) {
      this.winner = this.players[this.currentTurnIdx];
      this.winningCells = win;
      window.soundFx.playVictory();
      this.showToast(`🏆 ${this.winner.name.toUpperCase()} CONNECTS 4!`);
      this.render();
      return;
    }

    // Check Draw (Board full)
    const isFull = this.grid.every(row => row.every(cell => cell !== 0));
    if (isFull) {
      this.showToast("It's a Stalemate Draw! 🤝");
      return;
    }

    // Advance Turn
    this.currentTurnIdx = (this.currentTurnIdx + 1) % 2;
    this.render();
    this.checkBotTurn();
  }

  checkConnect4(playerNum) {
    // Horizontal, Vertical, Diagonal checks
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] !== playerNum) continue;

        // Right
        if (c + 3 < this.cols &&
            this.grid[r][c+1] === playerNum &&
            this.grid[r][c+2] === playerNum &&
            this.grid[r][c+3] === playerNum) {
          return [{r, c}, {r, c: c+1}, {r, c: c+2}, {r, c: c+3}];
        }
        // Down
        if (r + 3 < this.rows &&
            this.grid[r+1][c] === playerNum &&
            this.grid[r+2][c] === playerNum &&
            this.grid[r+3][c] === playerNum) {
          return [{r, c}, {r: r+1, c}, {r: r+2, c}, {r: r+3, c}];
        }
        // Diagonal Down-Right
        if (r + 3 < this.rows && c + 3 < this.cols &&
            this.grid[r+1][c+1] === playerNum &&
            this.grid[r+2][c+2] === playerNum &&
            this.grid[r+3][c+3] === playerNum) {
          return [{r, c}, {r: r+1, c: c+1}, {r: r+2, c: c+2}, {r: r+3, c: c+3}];
        }
        // Diagonal Up-Right
        if (r - 3 >= 0 && c + 3 < this.cols &&
            this.grid[r-1][c+1] === playerNum &&
            this.grid[r-2][c+2] === playerNum &&
            this.grid[r-3][c+3] === playerNum) {
          return [{r, c}, {r: r-1, c: c+1}, {r: r-2, c: c+2}, {r: r-3, c: c+3}];
        }
      }
    }
    return null;
  }

  checkBotTurn() {
    if (this.winner) return;
    clearTimeout(this.botTimeout);
    const cur = this.players[this.currentTurnIdx];
    if (cur && cur.isBot) {
      // Natural human thinking delay (900ms)
      this.botTimeout = setTimeout(() => {
        if (!this.isAnimating && !this.winner) {
          this.executeBotMove();
        }
      }, 900);
    }
  }

  executeBotMove() {
    const validCols = [];
    for (let c = 0; c < this.cols; c++) {
      if (this.getLowestEmptyRow(c) !== -1) validCols.push(c);
    }
    if (validCols.length === 0) return;

    // 1. Can Bot win this turn?
    for (const c of validCols) {
      const r = this.getLowestEmptyRow(c);
      this.grid[r][c] = 2;
      const win = this.checkConnect4(2);
      this.grid[r][c] = 0;
      if (win) {
        this.dropDisc(c);
        return;
      }
    }

    // 2. Can Human win next turn? Block them!
    for (const c of validCols) {
      const r = this.getLowestEmptyRow(c);
      this.grid[r][c] = 1;
      const win = this.checkConnect4(1);
      this.grid[r][c] = 0;
      if (win) {
        this.dropDisc(c);
        return;
      }
    }

    // 3. Center preference (col 3 > 2,4 > 1,5 > 0,6)
    validCols.sort((a, b) => Math.abs(3 - a) - Math.abs(3 - b));
    this.dropDisc(validCols[0]);
  }

  render(fallingY = null, fallingCol = null) {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const cs = this.cellSize;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Dark Cosmic Backdrop
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Hover Indicator at top row
    if (this.isMyTurn() && !this.winner && !this.isAnimating && this.hoverCol !== null) {
      const curP = this.players[this.currentTurnIdx];
      ctx.save();
      ctx.shadowColor = curP.color.glow;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc((this.hoverCol + 0.5) * cs, cs * 0.5, cs * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = curP.color.hex;
      ctx.fill();
      ctx.restore();
    }

    // Falling Disc animation
    if (fallingY !== null && fallingCol !== null) {
      const curP = this.players[this.currentTurnIdx];
      ctx.save();
      ctx.shadowColor = curP.color.glow;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc((fallingCol + 0.5) * cs, fallingY, cs * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = curP.color.hex;
      ctx.fill();
      ctx.restore();
    }

    // Holographic Grid Board
    ctx.fillStyle = '#0e172a';
    ctx.fillRect(0, cs, this.canvas.width, this.rows * cs);

    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, cs + 2, this.canvas.width - 4, this.rows * cs - 4);

    // Disc Holes
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const val = this.grid[r][c];
        const cx = (c + 0.5) * cs;
        const cy = (r + 1.5) * cs;
        const rad = cs * 0.38;

        ctx.save();
        if (val === 0) {
          // Empty hole (dark cutout)
          ctx.beginPath();
          ctx.arc(cx, cy, rad, 0, Math.PI * 2);
          ctx.fillStyle = '#04060c';
          ctx.fill();
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          // Placed Disc (1: Cyan, 2: Magenta)
          const p = this.players[val - 1];
          ctx.shadowColor = p.color.glow;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(cx, cy, rad, 0, Math.PI * 2);
          ctx.fillStyle = p.color.hex;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(cx, cy, rad * 0.55, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Connect 4 Laser Beam over winning cells
    if (this.winningCells.length === 4) {
      ctx.save();
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 24;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      const first = this.winningCells[0];
      const last = this.winningCells[3];
      ctx.moveTo((first.c + 0.5) * cs, (first.r + 1.5) * cs);
      ctx.lineTo((last.c + 0.5) * cs, (last.r + 1.5) * cs);
      ctx.stroke();
      ctx.restore();
    }

    this.updateHUD();
  }

  updateHUD() {
    const turnEl = document.getElementById('connect4-turn-indicator');
    const cur = this.players[this.currentTurnIdx];
    if (turnEl && cur) {
      turnEl.innerText = `${cur.avatar} ${cur.name}'s Drop`;
      turnEl.style.color = cur.color.hex;
    }
  }

  showToast(msg) {
    if (window.lobby && window.lobby.showGlobalToast) {
      window.lobby.showGlobalToast(msg);
    }
  }

  stop() {
    clearTimeout(this.botTimeout);
    this.botTimeout = null;
    this.isAnimating = false;
  }
}

window.connect4Game = new Connect4Game();
