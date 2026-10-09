// Professional Tournament Chess Engine & UI (Chess.com / Lichess Style)
class ChessGame {
  constructor() {
    this.board = Array(8).fill(null).map(() => Array(8).fill(null));
    this.turn = 'white';
    this.selectedSquare = null;
    this.validMoves = [];
    this.history = [];
    this.algebraicMoves = [];
    this.capturedWhite = [];
    this.capturedBlack = [];
    this.lastMove = null; // { fromR, fromC, toR, toC }
    this.castling = { white: { k: true, q: true }, black: { k: true, q: true } };
    this.enPassant = null;
    this.isCheck = false;
    this.isGameOver = false;
    this.gameResult = null;
    this.myColor = 'white';
    this.isFlipped = false;
    this.isBotGame = false;
    this.botThinking = false;
    this.timers = { white: 300, black: 300 };
    this.timerInterval = null;

    // Piece values for material advantage calculation
    this.pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

    // High-Resolution Professional Vector SVG Chess Pieces
    this.svgPieces = {
      wP: `<svg viewBox="0 0 45 45"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linecap="round"/></svg>`,
      bP: `<svg viewBox="0 0 45 45"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#222" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/></svg>`,
      wN: `<svg viewBox="0 0 45 45"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#fff" stroke="#111" stroke-width="1.5"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" fill="#fff" stroke="#111" stroke-width="1.5"/><circle cx="9.5" cy="25.5" r="1" fill="#111"/></svg>`,
      bN: `<svg viewBox="0 0 45 45"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#222" stroke="#fff" stroke-width="1.2"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" fill="#222" stroke="#fff" stroke-width="1.2"/><circle cx="9.5" cy="25.5" r="1" fill="#fff"/></svg>`,
      wB: `<svg viewBox="0 0 45 45"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linecap="round"/></svg>`,
      bB: `<svg viewBox="0 0 45 45"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" fill="#222" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/><path d="M17.5 26h10M15 30h15" stroke="#fff" stroke-width="1.2"/></svg>`,
      wR: `<svg viewBox="0 0 45 45"><path d="M9 39h27v-3H9v3zm3-3v-4.5h21V36H12zm2-4.5l1-15h15l1 15H14zM12 12V9h4v3h4V9h5v3h4V9h4v3H12z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linecap="round"/></svg>`,
      bR: `<svg viewBox="0 0 45 45"><path d="M9 39h27v-3H9v3zm3-3v-4.5h21V36H12zm2-4.5l1-15h15l1 15H14zM12 12V9h4v3h4V9h5v3h4V9h4v3H12z" fill="#222" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/></svg>`,
      wQ: `<svg viewBox="0 0 45 45"><path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11-4-14-4.5 14-4.5-14-4 14-7-11 2 12zM9 31c9-1.5 18-1.5 27 0v4H9v-4zM9 37h27v2H9v-2z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linecap="round"/><circle cx="6" cy="12" r="2" fill="#fff" stroke="#111" stroke-width="1.5"/><circle cx="14" cy="9" r="2" fill="#fff" stroke="#111" stroke-width="1.5"/><circle cx="22.5" cy="8" r="2" fill="#fff" stroke="#111" stroke-width="1.5"/><circle cx="31" cy="9" r="2" fill="#fff" stroke="#111" stroke-width="1.5"/><circle cx="39" cy="12" r="2" fill="#fff" stroke="#111" stroke-width="1.5"/></svg>`,
      bQ: `<svg viewBox="0 0 45 45"><path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11-4-14-4.5 14-4.5-14-4 14-7-11 2 12zM9 31c9-1.5 18-1.5 27 0v4H9v-4zM9 37h27v2H9v-2z" fill="#222" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/><circle cx="6" cy="12" r="2" fill="#222" stroke="#fff" stroke-width="1.2"/><circle cx="14" cy="9" r="2" fill="#222" stroke="#fff" stroke-width="1.2"/><circle cx="22.5" cy="8" r="2" fill="#222" stroke="#fff" stroke-width="1.2"/><circle cx="31" cy="9" r="2" fill="#222" stroke="#fff" stroke-width="1.2"/><circle cx="39" cy="12" r="2" fill="#222" stroke="#fff" stroke-width="1.2"/></svg>`,
      wK: `<svg viewBox="0 0 45 45"><path d="M22.5 11.63V6M20 8h5M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5z" stroke="#111" stroke-width="1.5" stroke-linecap="round"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-4s-.5-6-3-9c-2.5-3-7-3-7-3s-4.5 0-7 3c-2.5 3-3 9-3 9v4z" fill="#fff" stroke="#111" stroke-width="1.5"/><path d="M11.5 30c5.5-3 15.5-3 21 0M11.5 33.5c5.5-3 15.5-3 21 0M11.5 37c5.5-3 15.5-3 21 0" stroke="#111" stroke-width="1.5"/></svg>`,
      bK: `<svg viewBox="0 0 45 45"><path d="M22.5 11.63V6M20 8h5M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5z" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-4s-.5-6-3-9c-2.5-3-7-3-7-3s-4.5 0-7 3c-2.5 3-3 9-3 9v4z" fill="#222" stroke="#fff" stroke-width="1.2"/><path d="M11.5 30c5.5-3 15.5-3 21 0M11.5 33.5c5.5-3 15.5-3 21 0M11.5 37c5.5-3 15.5-3 21 0" stroke="#fff" stroke-width="1.2"/></svg>`
    };
  }

  init(myColor = 'white', isBot = false) {
    this.myColor = myColor;
    this.isFlipped = myColor === 'black';
    this.isBotGame = isBot;
    this.resetBoard();
    this.startTimer();
    this.render();
  }

  resetBoard() {
    const initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
    this.loadFromFen(initialFen);
    this.turn = 'white';
    this.selectedSquare = null;
    this.validMoves = [];
    this.history = [];
    this.algebraicMoves = [];
    this.capturedWhite = [];
    this.capturedBlack = [];
    this.lastMove = null;
    this.castling = { white: { k: true, q: true }, black: { k: true, q: true } };
    this.enPassant = null;
    this.isCheck = false;
    this.isGameOver = false;
    this.gameResult = null;
    this.timers = { white: 300, black: 300 };
  }

  loadFromFen(fen) {
    this.board = Array(8).fill(null).map(() => Array(8).fill(null));
    const rows = fen.split('/');
    for (let r = 0; r < 8; r++) {
      let c = 0;
      for (const char of rows[r]) {
        if (!isNaN(char)) {
          c += parseInt(char);
        } else {
          const color = char === char.toUpperCase() ? 'white' : 'black';
          const type = char.toLowerCase();
          this.board[r][c] = { type, color };
          c++;
        }
      }
    }
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.isGameOver) return;
      if (this.timers[this.turn] > 0) {
        this.timers[this.turn]--;
        this.updateTimerDisplay();
        if (this.timers[this.turn] <= 0) {
          this.endGame(this.turn === 'white' ? 'black' : 'white', 'Timeout');
        }
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const formatTime = (sec) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const isTopWhite = this.isFlipped ? true : false;
    const topSec = isTopWhite ? this.timers.white : this.timers.black;
    const bottomSec = isTopWhite ? this.timers.black : this.timers.white;

    const elTop = document.getElementById('chess-timer-top');
    const elBottom = document.getElementById('chess-timer-bottom');

    if (elTop) {
      elTop.innerText = formatTime(topSec);
      const isTopTurn = (isTopWhite && this.turn === 'white') || (!isTopWhite && this.turn === 'black');
      elTop.className = `pro-timer-pill ${isTopTurn ? 'active-clock' : ''} ${topSec <= 30 ? 'low-time' : ''}`;
    }

    if (elBottom) {
      elBottom.innerText = formatTime(bottomSec);
      const isBottomTurn = (!isTopWhite && this.turn === 'white') || (isTopWhite && this.turn === 'black');
      elBottom.className = `pro-timer-pill ${isBottomTurn ? 'active-clock' : ''} ${bottomSec <= 30 ? 'low-time' : ''}`;
    }
  }

  toggleFlip() {
    this.isFlipped = !this.isFlipped;
    this.render();
  }

  resign() {
    if (this.isGameOver) return;
    const opponent = this.myColor === 'white' ? 'black' : 'white';
    this.endGame(opponent, 'Resignation');
    if (window.network && window.network.roomId) {
      window.network.sendGameAction('CHESS_RESIGN', { winner: opponent });
    }
  }

  offerDraw() {
    if (this.isGameOver) return;
    if (confirm("Offer a draw to your opponent?")) {
      this.endGame(null, 'Agreement (Draw)');
    }
  }

  onSquareClick(r, c) {
    if (this.isGameOver || this.botThinking) return;

    if (window.network && window.network.roomId && !this.isBotGame && this.turn !== this.myColor) {
      return; // Not your turn in online match
    }

    const clickedPiece = this.board[r][c];

    // If already selected, check if destination is valid move
    if (this.selectedSquare) {
      const isMove = this.validMoves.some(m => m.r === r && m.c === c);
      if (isMove) {
        this.makeMove(this.selectedSquare.r, this.selectedSquare.c, r, c);
        return;
      }
    }

    // Select piece
    if (clickedPiece && clickedPiece.color === this.turn) {
      if (window.network && window.network.roomId && !this.isBotGame && clickedPiece.color !== this.myColor) {
        return;
      }
      this.selectedSquare = { r, c };
      this.validMoves = this.getLegalMoves(r, c);
      this.render();
      if (navigator.vibrate) navigator.vibrate(10);
    } else {
      this.selectedSquare = null;
      this.validMoves = [];
      this.render();
    }
  }

  getLegalMoves(r, c) {
    const pseudoMoves = this.getPseudoLegalMoves(r, c);
    return pseudoMoves.filter(m => {
      const testBoard = this.cloneBoard(this.board);
      const piece = testBoard[r][c];
      testBoard[m.r][m.c] = piece;
      testBoard[r][c] = null;
      return !this.isKingInCheckOnBoard(testBoard, piece.color);
    });
  }

  getPseudoLegalMoves(r, c) {
    const piece = this.board[r][c];
    if (!piece) return [];
    const moves = [];
    const color = piece.color;
    const opponent = color === 'white' ? 'black' : 'white';

    switch (piece.type) {
      case 'p': {
        const dir = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;

        if (this.isInBounds(r + dir, c) && !this.board[r + dir][c]) {
          moves.push({ r: r + dir, c });
          if (r === startRow && !this.board[r + 2 * dir][c]) {
            moves.push({ r: r + 2 * dir, c, isDoublePawn: true });
          }
        }
        for (const dc of [-1, 1]) {
          const nr = r + dir, nc = c + dc;
          if (this.isInBounds(nr, nc)) {
            if (this.board[nr][nc] && this.board[nr][nc].color === opponent) {
              moves.push({ r: nr, c: nc });
            } else if (this.enPassant && this.enPassant.r === nr && this.enPassant.c === nc) {
              moves.push({ r: nr, c: nc, isEnPassant: true });
            }
          }
        }
        break;
      }

      case 'n': {
        const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (const [dr, dc] of offsets) {
          const nr = r + dr, nc = c + dc;
          if (this.isInBounds(nr, nc)) {
            if (!this.board[nr][nc] || this.board[nr][nc].color === opponent) {
              moves.push({ r: nr, c: nc });
            }
          }
        }
        break;
      }

      case 'b':
        this.addRayMoves(r, c, [[-1,-1],[-1,1],[1,-1],[1,1]], moves, opponent);
        break;

      case 'r':
        this.addRayMoves(r, c, [[-1,0],[1,0],[0,-1],[0,1]], moves, opponent);
        break;

      case 'q':
        this.addRayMoves(r, c, [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]], moves, opponent);
        break;

      case 'k': {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (this.isInBounds(nr, nc)) {
              if (!this.board[nr][nc] || this.board[nr][nc].color === opponent) {
                moves.push({ r: nr, c: nc });
              }
            }
          }
        }
        // Castling
        const row = color === 'white' ? 7 : 0;
        if (r === row && c === 4 && !this.isKingInCheck(color)) {
          if (this.castling[color].k && !this.board[row][5] && !this.board[row][6] && this.board[row][7] && this.board[row][7].type === 'r') {
            if (!this.isSquareAttacked(row, 5, opponent) && !this.isSquareAttacked(row, 6, opponent)) {
              moves.push({ r: row, c: 6, isCastling: 'k' });
            }
          }
          if (this.castling[color].q && !this.board[row][3] && !this.board[row][2] && !this.board[row][1] && this.board[row][0] && this.board[row][0].type === 'r') {
            if (!this.isSquareAttacked(row, 3, opponent) && !this.isSquareAttacked(row, 2, opponent)) {
              moves.push({ r: row, c: 2, isCastling: 'q' });
            }
          }
        }
        break;
      }
    }
    return moves;
  }

  addRayMoves(r, c, directions, moves, opponent) {
    for (const [dr, dc] of directions) {
      let nr = r + dr, nc = c + dc;
      while (this.isInBounds(nr, nc)) {
        if (!this.board[nr][nc]) {
          moves.push({ r: nr, c: nc });
        } else {
          if (this.board[nr][nc].color === opponent) {
            moves.push({ r: nr, c: nc });
          }
          break;
        }
        nr += dr; nc += dc;
      }
    }
  }

  makeMove(fromR, fromC, toR, toC, syncRemote = true) {
    const piece = this.board[fromR][fromC];
    const target = this.board[toR][toC];
    let isCapture = !!target;

    // Algebraic notation logging
    const files = ['a','b','c','d','e','f','g','h'];
    const fromNotation = `${files[fromC]}${8 - fromR}`;
    const toNotation = `${files[toC]}${8 - toR}`;
    const pieceChar = piece.type === 'p' ? '' : piece.type.toUpperCase();
    const notation = `${pieceChar}${isCapture ? (piece.type === 'p' ? files[fromC] + 'x' : 'x') : ''}${toNotation}`;
    this.algebraicMoves.push(notation);

    // En Passant capture
    if (piece.type === 'p' && this.enPassant && toR === this.enPassant.r && toC === this.enPassant.c) {
      const epVictimRow = piece.color === 'white' ? toR + 1 : toR - 1;
      const victim = this.board[epVictimRow][toC];
      this.board[epVictimRow][toC] = null;
      if (victim) {
        if (victim.color === 'white') this.capturedWhite.push(victim);
        else this.capturedBlack.push(victim);
      }
      isCapture = true;
    }

    if (target) {
      if (target.color === 'white') this.capturedWhite.push(target);
      else this.capturedBlack.push(target);
    }

    // Move Piece
    this.board[toR][toC] = piece;
    this.board[fromR][fromC] = null;
    this.lastMove = { fromR, fromC, toR, toC };

    // Castling rook movement
    if (piece.type === 'k' && Math.abs(toC - fromC) === 2) {
      const row = piece.color === 'white' ? 7 : 0;
      if (toC === 6) {
        this.board[row][5] = this.board[row][7];
        this.board[row][7] = null;
      } else if (toC === 2) {
        this.board[row][3] = this.board[row][0];
        this.board[row][0] = null;
      }
    }

    if (piece.type === 'k') {
      this.castling[piece.color].k = false;
      this.castling[piece.color].q = false;
    }
    if (piece.type === 'r') {
      if (fromR === 7 && fromC === 7) this.castling.white.k = false;
      if (fromR === 7 && fromC === 0) this.castling.white.q = false;
      if (fromR === 0 && fromC === 7) this.castling.black.k = false;
      if (fromR === 0 && fromC === 0) this.castling.black.q = false;
    }

    // Pawn Promotion
    if (piece.type === 'p' && (toR === 0 || toR === 7)) {
      this.board[toR][toC] = { type: 'q', color: piece.color };
    }

    // En Passant target
    if (piece.type === 'p' && Math.abs(toR - fromR) === 2) {
      this.enPassant = { r: (fromR + toR) / 2, c: fromC };
    } else {
      this.enPassant = null;
    }

    this.turn = this.turn === 'white' ? 'black' : 'white';
    this.selectedSquare = null;
    this.validMoves = [];

    // Audio SFX & Haptics
    if (isCapture) {
      window.soundFx.playChessCapture();
      if (navigator.vibrate) navigator.vibrate([20, 25, 20]);
    } else {
      window.soundFx.playChessMove();
    }

    this.isCheck = this.isKingInCheck(this.turn);
    if (this.isCheck) {
      window.soundFx.playCheckAlert();
    }

    const hasLegal = this.hasAnyLegalMoves(this.turn);
    if (!hasLegal) {
      if (this.isCheck) {
        this.endGame(this.turn === 'white' ? 'black' : 'white', 'Checkmate');
      } else {
        this.endGame(null, 'Stalemate (Draw)');
      }
    }

    this.render();

    if (syncRemote && window.network && window.network.roomId) {
      window.network.sendGameAction('CHESS_MOVE', {
        fromR, fromC, toR, toC
      });
    }

    // Solo AI Bot turn
    if (!this.isGameOver && this.isBotGame && this.turn === 'black') {
      this.botThinking = true;
      setTimeout(() => {
        this.playBotMove();
      }, 500);
    }
  }

  playBotMove() {
    const allMoves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] && this.board[r][c].color === 'black') {
          const legals = this.getLegalMoves(r, c);
          for (const m of legals) {
            allMoves.push({ fromR: r, fromC: c, toR: m.r, toC: m.c });
          }
        }
      }
    }

    if (allMoves.length === 0) return;

    let bestMove = allMoves[0];
    let bestScore = -9999;

    for (const move of allMoves) {
      const target = this.board[move.toR][move.toC];
      let score = 0;
      if (target) {
        score += (this.pieceValues[target.type] || 0) * 10;
      }
      if ((move.toR === 3 || move.toR === 4) && (move.toC === 3 || move.toC === 4)) {
        score += 4;
      }
      score += Math.random() * 3;

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    this.botThinking = false;
    this.makeMove(bestMove.fromR, bestMove.fromC, bestMove.toR, bestMove.toC, false);
  }

  isKingInCheck(color) {
    return this.isKingInCheckOnBoard(this.board, color);
  }

  isKingInCheckOnBoard(board, color) {
    let kingPos = null;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c] && board[r][c].type === 'k' && board[r][c].color === color) {
          kingPos = { r, c };
          break;
        }
      }
      if (kingPos) break;
    }
    if (!kingPos) return false;
    const opponent = color === 'white' ? 'black' : 'white';
    return this.isSquareAttacked(kingPos.r, kingPos.c, opponent, board);
  }

  isSquareAttacked(r, c, attackerColor, board = this.board) {
    const pawnDir = attackerColor === 'white' ? 1 : -1;
    for (const dc of [-1, 1]) {
      const pr = r + pawnDir, pc = c + dc;
      if (this.isInBounds(pr, pc)) {
        const p = board[pr][pc];
        if (p && p.type === 'p' && p.color === attackerColor) return true;
      }
    }
    const knightOffsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr, dc] of knightOffsets) {
      const nr = r + dr, nc = c + dc;
      if (this.isInBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p && p.type === 'n' && p.color === attackerColor) return true;
      }
    }
    const straights = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dr, dc] of straights) {
      let nr = r + dr, nc = c + dc;
      while (this.isInBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p) {
          if (p.color === attackerColor && (p.type === 'r' || p.type === 'q')) return true;
          break;
        }
        nr += dr; nc += dc;
      }
    }
    const diagonals = [[-1,-1],[-1,1],[1,-1],[1,1]];
    for (const [dr, dc] of diagonals) {
      let nr = r + dr, nc = c + dc;
      while (this.isInBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p) {
          if (p.color === attackerColor && (p.type === 'b' || p.type === 'q')) return true;
          break;
        }
        nr += dr; nc += dc;
      }
    }
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (this.isInBounds(nr, nc)) {
          const p = board[nr][nc];
          if (p && p.type === 'k' && p.color === attackerColor) return true;
        }
      }
    }
    return false;
  }

  hasAnyLegalMoves(color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] && this.board[r][c].color === color) {
          if (this.getLegalMoves(r, c).length > 0) return true;
        }
      }
    }
    return false;
  }

  cloneBoard(board) {
    return board.map(row => row.map(cell => cell ? { ...cell } : null));
  }

  isInBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  endGame(winner, reason) {
    this.isGameOver = true;
    this.gameResult = { winner, reason };
    clearInterval(this.timerInterval);
    window.soundFx.playVictory();

    const banner = document.getElementById('chess-result-banner');
    if (banner) {
      banner.classList.remove('hidden');
      banner.innerHTML = `
        <div class="result-title">${winner ? `${winner.toUpperCase()} WINS!` : 'DRAW!'}</div>
        <div class="result-reason">${reason}</div>
        <button class="btn btn-primary" onclick="window.chessGame.init(window.chessGame.myColor, window.chessGame.isBotGame)">Play Again</button>
      `;
    }
  }

  render() {
    const container = document.getElementById('chess-board-grid');
    if (!container) return;
    container.innerHTML = '';

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    for (let displayR = 0; displayR < 8; displayR++) {
      for (let displayC = 0; displayC < 8; displayC++) {
        const r = this.isFlipped ? 7 - displayR : displayR;
        const c = this.isFlipped ? 7 - displayC : displayC;
        const piece = this.board[r][c];
        const isLight = (r + c) % 2 === 0;

        const sq = document.createElement('div');
        sq.className = `chess-square ${isLight ? 'light' : 'dark'}`;
        sq.dataset.row = r;
        sq.dataset.col = c;

        // Selected square highlight
        if (this.selectedSquare && this.selectedSquare.r === r && this.selectedSquare.c === c) {
          sq.classList.add('selected');
        }

        // Last move highlight
        if (this.lastMove &&
            ((this.lastMove.fromR === r && this.lastMove.fromC === c) ||
             (this.lastMove.toR === r && this.lastMove.toC === c))) {
          sq.classList.add('last-move');
        }

        // Legal move indicators
        const isMove = this.validMoves.some(m => m.r === r && m.c === c);
        if (isMove) {
          sq.classList.add(piece ? 'valid-capture' : 'valid-move');
        }

        // King check warning
        if (this.isCheck && piece && piece.type === 'k' && piece.color === this.turn) {
          sq.classList.add('in-check');
        }

        // Coordinates: Rank numbers on left edge
        if (displayC === 0) {
          const rankEl = document.createElement('span');
          rankEl.className = 'sq-coord-rank';
          rankEl.innerText = `${8 - r}`;
          sq.appendChild(rankEl);
        }

        // Coordinates: File letters on bottom edge
        if (displayR === 7) {
          const fileEl = document.createElement('span');
          fileEl.className = 'sq-coord-file';
          fileEl.innerText = files[c];
          sq.appendChild(fileEl);
        }

        // Render Vector SVG Piece
        if (piece) {
          const key = (piece.color === 'white' ? 'w' : 'b') + piece.type.toUpperCase();
          const svgCode = this.svgPieces[key];
          if (svgCode) {
            const pieceContainer = document.createElement('div');
            pieceContainer.className = 'chess-piece-svg';
            pieceContainer.innerHTML = svgCode;
            sq.appendChild(pieceContainer);
          }
        }

        sq.addEventListener('click', () => this.onSquareClick(r, c));
        container.appendChild(sq);
      }
    }

    // Status bar update
    const turnEl = document.getElementById('chess-turn-indicator');
    if (turnEl) {
      const isMyTurn = !window.network.roomId || this.isBotGame || this.turn === this.myColor;
      turnEl.innerText = isMyTurn ? `YOUR TURN (${this.turn.toUpperCase()})` : `${this.turn.toUpperCase()} TO MOVE`;
      turnEl.className = `turn-badge ${this.turn === 'white' ? 'turn-white' : 'turn-cyan'}`;
    }

    // Update Player Bars & Advantage
    this.updatePlayerHUD();
    this.updateMoveLog();
  }

  updatePlayerHUD() {
    const isTopWhite = this.isFlipped;
    const topCaptured = isTopWhite ? this.capturedWhite : this.capturedBlack;
    const bottomCaptured = isTopWhite ? this.capturedBlack : this.capturedWhite;

    // Calculate material advantage
    let wScore = 0;
    let bScore = 0;
    this.capturedBlack.forEach(p => wScore += (this.pieceValues[p.type] || 0));
    this.capturedWhite.forEach(p => bScore += (this.pieceValues[p.type] || 0));

    const topTray = document.getElementById('chess-captured-top');
    const bottomTray = document.getElementById('chess-captured-bottom');
    const topAdvantage = document.getElementById('chess-advantage-top');
    const bottomAdvantage = document.getElementById('chess-advantage-bottom');

    const renderTray = (tray, pieces) => {
      if (!tray) return;
      tray.innerHTML = pieces.map(p => {
        const key = (p.color === 'white' ? 'w' : 'b') + p.type.toUpperCase();
        return `<div style="width:18px;height:18px;">${this.svgPieces[key] || ''}</div>`;
      }).join('');
    };

    renderTray(topTray, topCaptured);
    renderTray(bottomTray, bottomCaptured);

    // Advantage badges
    const diff = wScore - bScore;
    if (topAdvantage && bottomAdvantage) {
      if (diff > 0) { // White leads
        if (isTopWhite) {
          topAdvantage.innerText = `+${diff}`;
          topAdvantage.classList.remove('hidden');
          bottomAdvantage.classList.add('hidden');
        } else {
          bottomAdvantage.innerText = `+${diff}`;
          bottomAdvantage.classList.remove('hidden');
          topAdvantage.classList.add('hidden');
        }
      } else if (diff < 0) { // Black leads
        const bDiff = Math.abs(diff);
        if (isTopWhite) {
          bottomAdvantage.innerText = `+${bDiff}`;
          bottomAdvantage.classList.remove('hidden');
          topAdvantage.classList.add('hidden');
        } else {
          topAdvantage.innerText = `+${bDiff}`;
          topAdvantage.classList.remove('hidden');
          bottomAdvantage.classList.add('hidden');
        }
      } else {
        topAdvantage.classList.add('hidden');
        bottomAdvantage.classList.add('hidden');
      }
    }

    this.updateTimerDisplay();
  }

  updateMoveLog() {
    const list = document.getElementById('chess-moves-list');
    const countEl = document.getElementById('chess-move-count');
    if (!list) return;

    if (countEl) countEl.innerText = `${this.algebraicMoves.length} moves`;

    list.innerHTML = '';
    for (let i = 0; i < this.algebraicMoves.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const whiteMove = this.algebraicMoves[i];
      const blackMove = this.algebraicMoves[i + 1] || '';
      const div = document.createElement('div');
      div.className = 'move-pair';
      div.innerHTML = `<span class="move-num">${moveNum}.</span> <span>${whiteMove}</span> <span>${blackMove}</span>`;
      list.appendChild(div);
    }
    list.scrollTop = list.scrollHeight;
  }

  stop() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.botThinking = false;
    this.selectedSquare = null;
    this.validMoves = [];
  }
}

window.chessGame = new ChessGame();
