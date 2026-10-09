// Neon Uno - Royal Teen Patti Casino Club Table Edition
class UnoGame {
  constructor() {
    this.players = []; // [{ id, name, avatar, isBot, hand, seatIndex }]
    this.myId = null;
    this.myHand = [];
    this.opponentHandCounts = {}; // id -> count
    this.discardPile = [];
    this.drawPileCount = 0;
    this.currentColor = 'red';
    this.currentTurnIndex = 0;
    this.direction = 1; // 1 for clockwise, -1 for counter-clockwise
    this.unoCalled = new Set();
    this.isGameOver = false;
    this.winner = null;
    this.selectedWildCard = null;
    this.deck = [];
    this.isSolo = false;

    // Turn countdown timer
    this.turnDuration = 18;
    this.turnTimeRemaining = 18;
    this.timerInterval = null;
  }

  initLocalGame(humanPlayer, botCount = 3) {
    this.isSolo = true;
    this.myId = humanPlayer.id;
    this.players = [{ ...humanPlayer, isBot: false, hand: [] }];
    this.opponentHandCounts = {};

    const botNames = ['VIP_Raja', 'CasinoQueen', 'GoldMaster', 'LuckyAce', 'HighRoller'];
    const botAvatars = ['👑', '💎', '🎩', '🦁', '🐅'];

    for (let i = 0; i < botCount; i++) {
      const bId = 'bot_' + i;
      this.players.push({
        id: bId,
        name: botNames[i % botNames.length],
        avatar: botAvatars[i % botAvatars.length],
        isBot: true,
        hand: []
      });
      this.opponentHandCounts[bId] = 7;
    }

    this.createDeck();
    this.dealCards();
    this.startTurnTimer();
    this.render();
  }

  initFromSync(gameState, myId, players) {
    this.isSolo = false;
    this.myId = myId;
    this.players = players.map(p => ({ ...p, hand: [] }));
    this.opponentHandCounts = {};
    players.forEach(p => {
      if (p.id !== myId) {
        this.opponentHandCounts[p.id] = (gameState.hands && gameState.hands[p.id]) ? gameState.hands[p.id].length : 7;
      }
    });

    this.discardPile = (gameState.discardPile || []).map(c => ({
      ...c,
      rotation: c.rotation || (Math.random() * 16 - 8)
    }));
    this.currentColor = gameState.currentColor || 'red';
    this.currentTurnIndex = gameState.currentTurnIndex || 0;
    this.direction = gameState.direction || 1;
    this.myHand = (gameState.hands && gameState.hands[myId]) ? [...gameState.hands[myId]] : [];
    this.deck = gameState.deck || [];
    this.isGameOver = false;
    this.winner = null;

    this.startTurnTimer();
    this.render();
  }

  createDeck() {
    const colors = ['red', 'blue', 'green', 'yellow'];
    this.deck = [];
    for (const c of colors) {
      this.deck.push({ id: Math.random().toString(36).substr(2, 7), color: c, value: '0', type: 'number' });
      for (let i = 1; i <= 9; i++) {
        this.deck.push({ id: Math.random().toString(36).substr(2, 7), color: c, value: String(i), type: 'number' });
        this.deck.push({ id: Math.random().toString(36).substr(2, 7), color: c, value: String(i), type: 'number' });
      }
      for (let i = 0; i < 2; i++) {
        this.deck.push({ id: Math.random().toString(36).substr(2, 7), color: c, value: 'skip', type: 'action' });
        this.deck.push({ id: Math.random().toString(36).substr(2, 7), color: c, value: 'reverse', type: 'action' });
        this.deck.push({ id: Math.random().toString(36).substr(2, 7), color: c, value: '+2', type: 'action' });
      }
    }
    for (let i = 0; i < 4; i++) {
      this.deck.push({ id: Math.random().toString(36).substr(2, 7), color: 'wild', value: 'wild', type: 'wild' });
      this.deck.push({ id: Math.random().toString(36).substr(2, 7), color: 'wild', value: '+4', type: 'wild' });
    }

    // Shuffle
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  dealCards() {
    this.players.forEach(p => {
      const hand = this.deck.splice(0, 7);
      if (p.id === this.myId) {
        this.myHand = hand;
      } else {
        p.hand = hand;
        this.opponentHandCounts[p.id] = 7;
      }
    });

    let firstCard = this.deck.pop();
    while (firstCard && firstCard.type === 'wild') {
      this.deck.unshift(firstCard);
      firstCard = this.deck.pop();
    }
    if (!firstCard) firstCard = { id: 'c1', color: 'red', value: '7', type: 'number' };
    firstCard.rotation = Math.random() * 12 - 6;

    this.discardPile = [firstCard];
    this.currentColor = firstCard.color;
    this.currentTurnIndex = 0;
    this.direction = 1;
    this.isGameOver = false;
    this.unoCalled.clear();
  }

  startTurnTimer() {
    clearInterval(this.timerInterval);
    this.turnTimeRemaining = this.turnDuration;
    this.timerInterval = setInterval(() => {
      if (this.isGameOver) {
        clearInterval(this.timerInterval);
        return;
      }
      this.turnTimeRemaining -= 1;
      this.updateTimerUI();

      if (this.turnTimeRemaining <= 0) {
        // Auto draw card if human timed out, or auto bot move
        const current = this.players[this.currentTurnIndex];
        if (current) {
          if (current.id === this.myId) {
            this.showToast('Time Out! Auto-drawing card...');
            this.drawCard(this.myId);
          } else if (current.isBot && (this.isSolo || (window.network && window.network.isHost))) {
            this.playBotTurn(current);
          }
        }
      }
    }, 1000);
  }

  updateTimerUI() {
    const fraction = Math.max(0, this.turnTimeRemaining / this.turnDuration);
    const circle = document.querySelector('.tp-timer-circle');
    if (circle) {
      const circumference = 2 * Math.PI * 34; // r=34
      circle.style.strokeDasharray = `${circumference}`;
      circle.style.strokeDashoffset = `${circumference * (1 - fraction)}`;
      if (fraction < 0.25) {
        circle.style.stroke = '#ff0055';
      } else if (fraction < 0.5) {
        circle.style.stroke = '#ffd600';
      } else {
        circle.style.stroke = '#00ff88';
      }
    }
  }

  getTopCard() {
    return this.discardPile[this.discardPile.length - 1] || { color: 'red', value: '0', type: 'number' };
  }

  isMyTurn() {
    const p = this.players[this.currentTurnIndex];
    return p && p.id === this.myId;
  }

  canPlayCard(card) {
    if (!card) return false;
    const top = this.getTopCard();
    if (!top) return true;
    if (card.type === 'wild') return true;
    if (card.color === this.currentColor) return true;
    if (card.value === top.value) return true;
    return false;
  }

  onCardClick(cardIndex) {
    if (!this.isMyTurn() || this.isGameOver) return;
    const card = this.myHand[cardIndex];
    if (!card) return;

    if (!this.canPlayCard(card)) {
      if (navigator.vibrate) navigator.vibrate(40);
      this.showToast("Cannot play this card! Match color or number/action.");
      return;
    }

    if (card.type === 'wild') {
      this.selectedWildCard = { card, cardIndex };
      this.showColorModal();
      return;
    }

    this.playCardAction(this.myId, cardIndex, card, card.color);
  }

  showColorModal() {
    const modal = document.getElementById('uno-color-modal');
    if (modal) modal.classList.remove('hidden');
  }

  chooseColor(color) {
    const modal = document.getElementById('uno-color-modal');
    if (modal) modal.classList.add('hidden');
    if (this.selectedWildCard) {
      this.playCardAction(this.myId, this.selectedWildCard.cardIndex, this.selectedWildCard.card, color);
      this.selectedWildCard = null;
    }
  }

  playCardAction(playerId, cardIndex, cardObj, chosenColor, syncRemote = true) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;

    let playedCard = cardObj;

    if (playerId === this.myId) {
      if (typeof cardIndex === 'number' && cardIndex >= 0 && cardIndex < this.myHand.length) {
        playedCard = this.myHand.splice(cardIndex, 1)[0];
      }
    } else {
      if (player.hand && player.hand.length > 0 && typeof cardIndex === 'number') {
        playedCard = player.hand.splice(cardIndex, 1)[0] || playedCard;
      }
      this.opponentHandCounts[playerId] = Math.max(0, (this.opponentHandCounts[playerId] || 1) - 1);
    }

    if (!playedCard) playedCard = { color: chosenColor || 'red', value: '1', type: 'number' };
    playedCard.rotation = Math.random() * 16 - 8;

    this.discardPile.push(playedCard);
    this.currentColor = chosenColor || playedCard.color;

    window.soundFx.playCardSlide();
    window.soundFx.playChipClink();
    if (navigator.vibrate) navigator.vibrate(15);

    const remaining = playerId === this.myId ? this.myHand.length : (this.opponentHandCounts[playerId] || 0);

    if (remaining === 1 && !this.unoCalled.has(playerId)) {
      window.soundFx.playUnoCall();
      this.showToast(`🚨 ${player.name} has ONE CARD left!`);
    }

    if (remaining === 0) {
      this.endGame(player);
      return;
    }

    // Special card actions
    let nextStep = 1;
    if (playedCard.value === 'reverse') {
      if (this.players.length === 2) {
        nextStep = 2;
      } else {
        this.direction *= -1;
        this.showToast(`⟲ Direction Reversed!`);
      }
    } else if (playedCard.value === 'skip') {
      nextStep = 2;
      const skippedIdx = this.getNextPlayerIndex(1);
      const skipped = this.players[skippedIdx];
      this.showToast(`🚫 ${skipped ? skipped.name : 'Player'} was skipped!`);
    } else if (playedCard.value === '+2') {
      const victimIdx = this.getNextPlayerIndex(1);
      this.giveCardsToPlayer(victimIdx, 2);
      nextStep = 2;
    } else if (playedCard.value === '+4') {
      const victimIdx = this.getNextPlayerIndex(1);
      this.giveCardsToPlayer(victimIdx, 4);
      nextStep = 2;
    }

    this.currentTurnIndex = this.getNextPlayerIndex(nextStep);
    this.startTurnTimer();
    this.render();

    if (syncRemote && window.network && window.network.roomId) {
      window.network.sendGameAction('UNO_PLAY_CARD', {
        playerId,
        card: playedCard,
        chosenColor
      });
    }

    this.checkBotTurn();
  }

  drawCard(playerId = this.myId, syncRemote = true) {
    if (this.isGameOver) return;
    const current = this.players[this.currentTurnIndex];
    if (!current || current.id !== playerId) return;
    if (playerId === this.myId && !this.isMyTurn()) return;
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;

    if (this.deck.length === 0) {
      this.reshuffleDiscardIntoDeck();
    }

    let card = null;
    if (this.deck.length > 0) {
      card = this.deck.pop();
    } else {
      card = { id: Math.random().toString(), color: this.currentColor, value: '5', type: 'number' };
    }

    if (playerId === this.myId) {
      this.myHand.push(card);
    } else {
      if (player.hand) player.hand.push(card);
      this.opponentHandCounts[playerId] = (this.opponentHandCounts[playerId] || 0) + 1;
    }

    window.soundFx.playCardSlide();

    this.currentTurnIndex = this.getNextPlayerIndex(1);
    this.startTurnTimer();
    this.render();

    if (syncRemote && window.network && window.network.roomId) {
      window.network.sendGameAction('UNO_DRAW_CARD', { playerId });
    }

    this.checkBotTurn();
  }

  giveCardsToPlayer(playerIndex, count) {
    const player = this.players[playerIndex];
    if (!player) return;

    for (let i = 0; i < count; i++) {
      if (this.deck.length === 0) this.reshuffleDiscardIntoDeck();
      let c = this.deck.pop() || { id: Math.random().toString(), color: 'red', value: '3', type: 'number' };
      if (player.id === this.myId) {
        this.myHand.push(c);
      } else {
        if (player.hand) player.hand.push(c);
        this.opponentHandCounts[player.id] = (this.opponentHandCounts[player.id] || 0) + 1;
      }
    }
    this.showToast(`💥 ${player.name} drew +${count} penalty cards!`);
  }

  reshuffleDiscardIntoDeck() {
    if (this.discardPile.length <= 1) return;
    const top = this.discardPile.pop();
    this.deck = this.discardPile;
    this.discardPile = [top];
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  getNextPlayerIndex(steps = 1) {
    const n = this.players.length;
    return (this.currentTurnIndex + this.direction * steps + n * 100) % n;
  }

  callUno() {
    this.unoCalled.add(this.myId);
    window.soundFx.playUnoCall();
    if (navigator.vibrate) navigator.vibrate([40, 50, 40]);
    this.showToast(`🚨 YOU SHOUTED UNO! 🎉`);
    this.triggerSpeechBubble(this.myId, 'UNO! 🚨');
    this.render();
  }

  sendTaunt(emoji) {
    this.triggerSpeechBubble(this.myId, emoji);
    window.soundFx.playChipClink();
    if (window.network && window.network.roomId) {
      window.network.sendChat(emoji);
    }
  }

  triggerSpeechBubble(playerId, text) {
    const seatEl = document.querySelector(`.tp-seat[data-player-id="${playerId}"]`);
    if (seatEl) {
      let bubble = seatEl.querySelector('.tp-bubble');
      if (!bubble) {
        bubble = document.createElement('div');
        bubble.className = 'tp-bubble';
        seatEl.appendChild(bubble);
      }
      bubble.innerText = text;
      bubble.classList.add('show');
      setTimeout(() => bubble.classList.remove('show'), 2400);
    }
  }

  checkBotTurn() {
    if (this.isGameOver) return;
    if (!this.isSolo && window.network && window.network.roomId && !window.network.isHost) {
      return;
    }

    const current = this.players[this.currentTurnIndex];
    if (current && current.isBot) {
      setTimeout(() => {
        this.playBotTurn(current);
      }, 750);
    }
  }

  playBotTurn(bot) {
    if (!bot.hand || bot.hand.length === 0) {
      bot.hand = [
        { id: 'b1', color: this.currentColor, value: '2', type: 'number' },
        { id: 'b2', color: 'blue', value: '7', type: 'number' }
      ];
    }

    const playableIndices = [];
    bot.hand.forEach((c, idx) => {
      if (this.canPlayCard(c)) playableIndices.push(idx);
    });

    if (playableIndices.length > 0) {
      // Prioritize action cards or color matching
      let chosenIdx = playableIndices[0];
      const card = bot.hand[chosenIdx];
      let chosenColor = card.color;
      if (card.type === 'wild') {
        const colors = ['red', 'blue', 'green', 'yellow'];
        chosenColor = colors[Math.floor(Math.random() * colors.length)];
      }

      if (bot.hand.length === 2) {
        this.unoCalled.add(bot.id);
        this.showToast(`🚨 ${bot.name} called UNO!`);
        this.triggerSpeechBubble(bot.id, 'UNO! 🚨');
      }

      this.playCardAction(bot.id, chosenIdx, card, chosenColor, !this.isSolo);
    } else {
      this.drawCard(bot.id, !this.isSolo);
    }
  }

  endGame(winner) {
    this.isGameOver = true;
    this.winner = winner;
    clearInterval(this.timerInterval);
    window.soundFx.playVictory();

    const banner = document.getElementById('uno-result-banner');
    if (banner) {
      banner.classList.remove('hidden');
      banner.innerHTML = `
        <div class="result-title" style="color: #ffd600; text-shadow: 0 0 25px rgba(255, 214, 0, 0.8)">
          🏆 ${winner.name.toUpperCase()} WINS!
        </div>
        <div class="result-reason">Royal Champion of Teen Patti Uno! Cleared all cards!</div>
        <div class="result-actions" style="margin-top:16px; display:flex; gap:10px; justify-content:center;">
          <button class="btn btn-primary" onclick="window.unoGame.dealCards(); window.unoGame.render();">Deal Next Hand 🃏</button>
          <button class="btn btn-secondary" onclick="window.lobby.returnToLobbyAction()">Back to Lobby</button>
        </div>
      `;
    }
  }

  showToast(msg) {
    const toast = document.getElementById('uno-toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.classList.remove('hidden');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2500);
  }

  // Render Teen Patti Oval Felt Table, Circular Seats, 3D Hand Fan
  render() {
    // 1. Table Direction Indicator
    const dirIndicator = document.getElementById('tp-direction-indicator');
    if (dirIndicator) {
      dirIndicator.className = `tp-direction-indicator ${this.direction === 1 ? 'clockwise' : 'counter-clockwise'}`;
    }

    // 2. Active Color Chip
    const colorChip = document.getElementById('uno-color-chip');
    const colorLabel = document.getElementById('uno-color-label');
    if (colorChip) {
      colorChip.className = `tp-color-chip chip-${this.currentColor}`;
      if (colorLabel) colorLabel.innerText = this.currentColor.toUpperCase();
    }

    // 3. Top Card in Discard Area
    const topCardEl = document.getElementById('uno-top-card');
    const top = this.getTopCard();
    if (topCardEl && top) {
      topCardEl.className = `uno-card card-${top.color} card-discarded`;
      topCardEl.style.transform = `rotate(${top.rotation || 0}deg)`;
      topCardEl.innerHTML = `
        <div class="card-inner">
          <span class="card-corner top-left">${top.value}</span>
          <span class="card-center">${top.value}</span>
          <span class="card-corner bottom-right">${top.value}</span>
        </div>
      `;
    }

    // 4. Teen Patti Table Seats Grid
    const seatsGrid = document.getElementById('tp-seats-grid');
    if (seatsGrid) {
      seatsGrid.innerHTML = '';
      
      // Calculate seat positions around the oval table
      // Player 0 is always bottom center (the local player)
      // Other players are distributed around the oval perimeter
      const totalPlayers = this.players.length;
      const myIndex = this.players.findIndex(p => p.id === this.myId);
      const activePlayer = this.players[this.currentTurnIndex];

      this.players.forEach((p, idx) => {
        // Seat offset relative to user
        const relIdx = (idx - myIndex + totalPlayers) % totalPlayers;
        const seatEl = document.createElement('div');
        seatEl.className = `tp-seat seat-pos-${relIdx}`;
        seatEl.dataset.playerId = p.id;

        const isCurrent = idx === this.currentTurnIndex;
        const count = p.id === this.myId ? this.myHand.length : (this.opponentHandCounts[p.id] || (p.hand ? p.hand.length : 7));
        const hasUno = this.unoCalled.has(p.id) || count === 1;

        seatEl.innerHTML = `
          <div class="tp-seat-inner ${isCurrent ? 'active-turn' : ''}">
            <!-- SVG Turn Timer Ring around Avatar -->
            <div class="tp-avatar-ring">
              ${isCurrent ? `
                <svg class="tp-timer-svg" viewBox="0 0 80 80">
                  <circle class="tp-timer-bg" cx="40" cy="40" r="34" />
                  <circle class="tp-timer-circle" cx="40" cy="40" r="34" />
                </svg>
              ` : ''}
              <div class="tp-avatar-frame">
                <span class="tp-avatar-emoji">${p.avatar}</span>
                ${hasUno ? '<span class="tp-uno-alert-badge">UNO!</span>' : ''}
              </div>
            </div>

            <!-- Player Nameplate & Chips -->
            <div class="tp-seat-nameplate">
              <span class="tp-seat-name">${p.name} ${p.id === this.myId ? '(You)' : ''}</span>
              <span class="tp-seat-chip-count">🪙 ${count} Cards</span>
            </div>
          </div>
        `;
        seatsGrid.appendChild(seatEl);
      });
      this.updateTimerUI();
    }

    // 5. 3D Fanned Cards for Player's Hand
    const handContainer = document.getElementById('uno-player-hand');
    if (handContainer) {
      handContainer.innerHTML = '';
      const total = this.myHand.length;
      const mid = (total - 1) / 2;

      this.myHand.forEach((card, idx) => {
        const canPlay = this.isMyTurn() && this.canPlayCard(card);
        const cardEl = document.createElement('div');
        cardEl.className = `uno-card card-${card.color} ${canPlay ? 'playable' : 'disabled'}`;
        
        // 3D realistic card fan angle & vertical curve
        const angle = (idx - mid) * 4.2;
        const offsetY = Math.abs(idx - mid) * 3.5;
        cardEl.style.setProperty('--fan-rotate', `${angle}deg`);
        cardEl.style.setProperty('--fan-translate-y', `${offsetY}px`);

        cardEl.innerHTML = `
          <div class="card-inner">
            <span class="card-corner top-left">${card.value}</span>
            <span class="card-center">${card.value}</span>
            <span class="card-corner bottom-right">${card.value}</span>
          </div>
        `;
        cardEl.addEventListener('click', () => this.onCardClick(idx));
        handContainer.appendChild(cardEl);
      });
    }

    // 6. Turn Status Banner
    const turnEl = document.getElementById('uno-turn-badge');
    if (turnEl) {
      const activePlayer = this.players[this.currentTurnIndex];
      const isMe = activePlayer && activePlayer.id === this.myId;
      turnEl.innerText = isMe ? "YOUR TURN TO PLAY" : `${activePlayer ? activePlayer.name.toUpperCase() : 'WAITING'}'S TURN`;
      turnEl.className = `turn-badge ${isMe ? 'turn-green' : 'turn-cyan'}`;
    }

    // 7. UNO Shout Button Visibility
    const unoBtn = document.getElementById('uno-call-btn');
    if (unoBtn) {
      unoBtn.style.display = this.myHand.length <= 2 ? 'inline-flex' : 'none';
    }
  }

  stop() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.isGameOver = true;
  }
}

window.unoGame = new UnoGame();
