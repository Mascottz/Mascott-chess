/* UI layer for Mascott Chess PWA */
(() => {
  "use strict";

  const E = window.ChessEngine;
  const SYMBOLS = {
    w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
    b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
  };
  const ELO_MIN = 400;
  const ELO_MAX = 2400;
  const ELO_STEP = 50;
  const DEFAULT_ELO = 1200;
  const LEGACY_LEVEL_ELO = {
    easy: 600,
    medium: 1100,
    hard: 1600,
    expert: 2100,
  };

  function eloBand(elo) {
    if (elo < 600) return "New learner";
    if (elo < 800) return "Starter";
    if (elo < 1000) return "Beginner";
    if (elo < 1200) return "Casual";
    if (elo < 1400) return "Developing";
    if (elo < 1600) return "Club learner";
    if (elo < 1800) return "Club player";
    if (elo < 2000) return "Advanced";
    if (elo < 2200) return "Expert";
    if (elo < 2350) return "Master";
    return "Mascott boss";
  }

  function normalizeEloLevel(value) {
    if (LEGACY_LEVEL_ELO[value]) return String(LEGACY_LEVEL_ELO[value]);
    const parsed = Number.parseInt(String(value).replace(/[^0-9]/g, ""), 10);
    if (!Number.isFinite(parsed)) return String(DEFAULT_ELO);
    const clamped = Math.max(ELO_MIN, Math.min(ELO_MAX, parsed));
    const rounded = Math.round(clamped / ELO_STEP) * ELO_STEP;
    return String(rounded);
  }

  function formatLevel(value) {
    const elo = Number.parseInt(normalizeEloLevel(value), 10);
    return `${elo} ELO — ${eloBand(elo)}`;
  }

  function populateEloSelect() {
    if (!els.difficultySelect) return;
    const current = normalizeEloLevel(els.difficultySelect.value || difficulty || DEFAULT_ELO);
    els.difficultySelect.innerHTML = "";

    const groups = [
      { label: "Learning range", min: 400, max: 950 },
      { label: "Club-building range", min: 1000, max: 1550 },
      { label: "Competitive range", min: 1600, max: 1950 },
      { label: "Expert and master range", min: 2000, max: 2400 },
    ];

    for (const group of groups) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.label;
      for (let elo = group.min; elo <= group.max; elo += ELO_STEP) {
        const option = document.createElement("option");
        option.value = String(elo);
        option.textContent = formatLevel(elo);
        optgroup.appendChild(option);
      }
      els.difficultySelect.appendChild(optgroup);
    }

    els.difficultySelect.value = current;
    difficulty = els.difficultySelect.value || String(DEFAULT_ELO);
  }

  function thinkTimeForLevel(value) {
    const elo = Number.parseInt(normalizeEloLevel(value), 10);
    if (!Number.isFinite(elo)) return 280;
    return Math.max(220, Math.min(620, 170 + Math.round((elo - ELO_MIN) * 0.18)));
  }

  const els = {
    board: document.getElementById("board"),
    difficultySelect: document.getElementById("difficultySelect"),
    timeControlSelect: document.getElementById("timeControlSelect"),
    sideSelect: document.getElementById("sideSelect"),
    newGameBtn: document.getElementById("newGameBtn"),
    statusText: document.getElementById("statusText"),
    statusSubtext: document.getElementById("statusSubtext"),
    thinkingDot: document.getElementById("thinkingDot"),
    moveList: document.getElementById("moveList"),
    fenText: document.getElementById("fenText"),
    copyFenBtn: document.getElementById("copyFenBtn"),
    clearHistoryBtn: document.getElementById("clearHistoryBtn"),
    promotionModal: document.getElementById("promotionModal"),
    promotionChoices: document.getElementById("promotionChoices"),
    toast: document.getElementById("toast"),
    installBtn: document.getElementById("installBtn"),
    offlineBadge: document.getElementById("offlineBadge"),

    // Player Clock Bars & Board Overlay
    topPlayerName: document.getElementById("topPlayerName"),
    bottomPlayerName: document.getElementById("bottomPlayerName"),
    topClock: document.getElementById("topClock"),
    bottomClock: document.getElementById("bottomClock"),
    boardOverlay: document.getElementById("boardOverlay"),
    boardOverlayIcon: document.getElementById("boardOverlayIcon"),
    boardOverlayTitle: document.getElementById("boardOverlayTitle"),
    boardOverlayMessage: document.getElementById("boardOverlayMessage"),
    closeBoardOverlayBtn: document.getElementById("closeBoardOverlayBtn"),
    overlayNewGameBtn: document.getElementById("overlayNewGameBtn"),
    overlayReviewBtn: document.getElementById("overlayReviewBtn"),
  };

  let state = E.createInitialState();
  let playerColor = "w";
  let difficulty = String(DEFAULT_ELO);
  let selected = null;
  let legalForSelected = [];
  let lastMove = null;
  let moveHistory = [];
  let thinking = false;
  let gameOver = false;
  let pendingPromotionMoves = [];
  let toastTimer = null;
  let deferredInstallPrompt = null;

  // Timer state
  let timeControlSeconds = 300;
  let whiteTimeMs = 300000;
  let blackTimeMs = 300000;
  let timerInterval = null;
  let lastTickTime = null;
  let timerStarted = false;

  function colorText(color) {
    return color === "w" ? "White" : "Black";
  }

  function squareKey(r, c) {
    return `${r},${c}`;
  }

  function isSameSquare(a, b) {
    return !!a && !!b && a.r === b.r && a.c === b.c;
  }

  function cloneSquare(square) {
    return square ? { r: square.r, c: square.c } : null;
  }

  function pieceLabel(piece) {
    if (!piece) return "empty square";
    return `${E.colorName(piece.color)} ${E.pieceName(piece.type)}`;
  }

  function showToast(message, duration = 2200) {
    window.clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.hidden = false;
    els.toast.classList.add("show");
    toastTimer = window.setTimeout(() => {
      els.toast.classList.remove("show");
      window.setTimeout(() => {
        els.toast.hidden = true;
      }, 160);
    }, duration);
  }

  // --- Clock & Timer Functions ---
  function initClocks() {
    timeControlSeconds = els.timeControlSelect ? parseInt(els.timeControlSelect.value, 10) || 0 : 300;
    whiteTimeMs = timeControlSeconds * 1000;
    blackTimeMs = timeControlSeconds * 1000;
    timerStarted = false;
    stopTimer();
    updateClockDisplays();
  }

  function startTimer() {
    stopTimer();
    if (timeControlSeconds <= 0 || gameOver) return;
    lastTickTime = performance.now();
    timerInterval = setInterval(tickTimer, 100);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function tickTimer() {
    if (gameOver || timeControlSeconds <= 0) {
      stopTimer();
      return;
    }

    const now = performance.now();
    const delta = now - lastTickTime;
    lastTickTime = now;

    if (state.turn === "w") {
      whiteTimeMs = Math.max(0, whiteTimeMs - delta);
      if (whiteTimeMs === 0) {
        handleTimeout("w");
        return;
      }
    } else {
      blackTimeMs = Math.max(0, blackTimeMs - delta);
      if (blackTimeMs === 0) {
        handleTimeout("b");
        return;
      }
    }
    updateClockDisplays();
  }

  function handleTimeout(flaggedColor) {
    stopTimer();
    gameOver = true;
    const winner = E.opponent(flaggedColor);
    const flaggedName = flaggedColor === playerColor ? "You" : "Computer";
    const winnerName = winner === playerColor ? "You" : "Computer";
    const winnerColorName = winner === "w" ? "White" : "Black";

    renderBoard();
    renderStatus();

    showBoardOverlay({
      icon: "⏱️",
      title: "TIME OUT",
      message: `${flaggedName} ran out of time! ${winnerColorName} (${winnerName}) wins on time.`,
    });
  }

  function formatTime(ms) {
    if (ms <= 0) return "0:00";
    if (ms < 10000) {
      const sec = Math.floor(ms / 1000);
      const tenth = Math.floor((ms % 1000) / 100);
      return `0:0${sec}.${tenth}`;
    }
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }

  function updateClockDisplays() {
    if (!els.topClock || !els.bottomClock) return;

    const elo = Number.parseInt(normalizeEloLevel(difficulty), 10);

    if (timeControlSeconds <= 0) {
      els.topClock.textContent = "— : —";
      els.bottomClock.textContent = "— : —";
      els.topClock.className = "clock-display untimed";
      els.bottomClock.className = "clock-display untimed";
      if (els.topPlayerName) els.topPlayerName.textContent = `Computer (${elo} ELO)`;
      if (els.bottomPlayerName) els.bottomPlayerName.textContent = "You";
      return;
    }

    let topMs, bottomMs, topActive, bottomActive;
    if (playerColor === "w") {
      topMs = blackTimeMs;
      bottomMs = whiteTimeMs;
      topActive = state.turn === "b" && !gameOver;
      bottomActive = state.turn === "w" && !gameOver;
      if (els.topPlayerName) els.topPlayerName.textContent = `Computer (${elo} ELO)`;
      if (els.bottomPlayerName) els.bottomPlayerName.textContent = "You";
    } else {
      topMs = whiteTimeMs;
      bottomMs = blackTimeMs;
      topActive = state.turn === "w" && !gameOver;
      bottomActive = state.turn === "b" && !gameOver;
      if (els.topPlayerName) els.topPlayerName.textContent = `Computer (${elo} ELO)`;
      if (els.bottomPlayerName) els.bottomPlayerName.textContent = "You";
    }

    els.topClock.textContent = formatTime(topMs);
    els.bottomClock.textContent = formatTime(bottomMs);

    setClockClass(els.topClock, topMs, topActive);
    setClockClass(els.bottomClock, bottomMs, bottomActive);
  }

  function setClockClass(element, ms, isActive) {
    let cls = "clock-display";
    if (isActive) cls += " active";
    if (ms < 10000) cls += " danger";
    else if (ms < 30000) cls += " warning";
    element.className = cls;
  }

  // --- Board Overlay Functions ---
  function showBoardOverlay({ icon, title, message }) {
    if (!els.boardOverlay) return;
    if (els.boardOverlayIcon) els.boardOverlayIcon.textContent = icon || "♚";
    if (els.boardOverlayTitle) els.boardOverlayTitle.textContent = title || "GAME OVER";
    if (els.boardOverlayMessage) els.boardOverlayMessage.textContent = message || "";
    els.boardOverlay.hidden = false;
  }

  function hideBoardOverlay() {
    if (els.boardOverlay) els.boardOverlay.hidden = true;
  }

  function clearSelection() {
    selected = null;
    legalForSelected = [];
  }

  function selectSquare(r, c) {
    const piece = state.board[r][c];
    if (!piece || piece.color !== playerColor || state.turn !== playerColor) return;
    selected = { r, c };
    legalForSelected = E.legalMovesFrom(state, r, c);
    if (!legalForSelected.length) showToast("That piece has no legal move right now.");
    renderAll();
  }

  function getMovesTo(r, c) {
    return legalForSelected.filter((m) => m.to.r === r && m.to.c === c);
  }

  function onSquareClick(event) {
    const square = event.target.closest(".square");
    if (!square) return;
    const r = Number(square.dataset.r);
    const c = Number(square.dataset.c);
    const piece = state.board[r][c];

    if (pendingPromotionMoves.length) return;
    if (thinking) {
      showToast("The computer is thinking. Your turn is next.");
      return;
    }
    if (gameOver) {
      showToast("This game is over. Start a new game to play again.");
      return;
    }
    if (state.turn !== playerColor) {
      showToast("Wait for the computer to move.");
      return;
    }

    if (selected) {
      const moves = getMovesTo(r, c);
      if (moves.length) {
        const promotions = moves.filter((m) => m.promotion);
        if (promotions.length) showPromotionPicker(promotions);
        else executeMove(moves[0], "player");
        return;
      }

      if (piece && piece.color === playerColor) {
        selectSquare(r, c);
      } else {
        clearSelection();
        renderAll();
      }
      return;
    }

    if (piece && piece.color === playerColor) selectSquare(r, c);
  }

  function showPromotionPicker(moves) {
    pendingPromotionMoves = moves;
    els.promotionChoices.innerHTML = "";

    for (const type of E.PROMOTIONS) {
      const move = moves.find((m) => m.promotion === type);
      if (!move) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "promotion-choice";
      button.dataset.promotion = type;
      button.setAttribute("aria-label", `Promote to ${E.pieceName(type)}`);
      button.innerHTML = `<span class="promo-symbol">${SYMBOLS[playerColor][type]}</span><span>${E.pieceName(type)}</span>`;
      els.promotionChoices.appendChild(button);
    }

    els.promotionModal.hidden = false;
    window.requestAnimationFrame(() => els.promotionModal.classList.add("show"));
  }

  function hidePromotionPicker() {
    els.promotionModal.classList.remove("show");
    pendingPromotionMoves = [];
    window.setTimeout(() => {
      if (!pendingPromotionMoves.length) els.promotionModal.hidden = true;
    }, 160);
  }

  function executeMove(move, source) {
    const before = E.cloneState(state);
    E.applyMove(state, move);
    const after = E.cloneState(state);
    const description = E.describeMove(before, move, after);

    moveHistory.push({
      number: before.fullmove,
      color: before.turn,
      text: description,
      from: E.coord(move.from.r, move.from.c),
      to: E.coord(move.to.r, move.to.c),
    });

    lastMove = { from: cloneSquare(move.from), to: cloneSquare(move.to) };
    clearSelection();

    // Start timer on first move if applicable
    if (timeControlSeconds > 0 && !timerStarted && !gameOver) {
      timerStarted = true;
      startTimer();
    }

    const status = E.gameStatus(state);
    if (status.over) {
      stopTimer();
      gameOver = true;
    }

    renderAll();

    if (status.over) {
      if (status.reason === "checkmate") {
        const isUserWinner = status.winner === playerColor;
        showBoardOverlay({
          icon: "♚",
          title: "CHECKMATE",
          message: isUserWinner ? "Victory! You checkmated the computer." : "The computer found checkmate.",
        });
      } else if (status.reason === "stalemate") {
        showBoardOverlay({
          icon: "🤝",
          title: "STALEMATE",
          message: "Game drawn by stalemate.",
        });
      } else {
        showBoardOverlay({
          icon: "🤝",
          title: "DRAW",
          message: "Game drawn by fifty-move rule.",
        });
      }
    } else if (source === "player") {
      window.setTimeout(maybeComputerMove, 180);
    }
  }

  function maybeComputerMove() {
    const status = E.gameStatus(state);
    gameOver = status.over;
    if (gameOver || state.turn === playerColor) {
      renderAll();
      return;
    }

    thinking = true;
    clearSelection();
    renderAll();

    window.setTimeout(() => {
      let move = null;
      const started = performance.now();
      try {
        move = E.chooseComputerMove(state, difficulty, state.turn);
      } catch (error) {
        console.error(error);
        showToast("The computer hit an error while choosing a move.");
      }

      const elapsed = performance.now() - started;
      const wait = Math.max(0, thinkTimeForLevel(difficulty) - elapsed);
      window.setTimeout(() => {
        thinking = false;
        if (move) executeMove(move, "computer");
        else renderAll();
      }, wait);
    }, 80);
  }

  function renderAll() {
    renderBoard();
    renderStatus();
    renderHistory();
    updateClockDisplays();
    if (els.fenText) els.fenText.textContent = E.boardToFen(state);
  }

  function renderBoard() {
    const legalMap = new Map();
    for (const move of legalForSelected) {
      const key = squareKey(move.to.r, move.to.c);
      if (!legalMap.has(key)) legalMap.set(key, []);
      legalMap.get(key).push(move);
    }

    const whiteInCheck = E.isInCheck(state, "w");
    const blackInCheck = E.isInCheck(state, "b");
    const status = E.gameStatus(state);
    const rows = playerColor === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const cols = playerColor === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

    els.board.innerHTML = "";
    els.board.classList.toggle("thinking", thinking);

    for (const r of rows) {
      for (const c of cols) {
        const piece = state.board[r][c];
        const button = document.createElement("button");
        const light = (r + c) % 2 === 0;
        const targetMoves = legalMap.get(squareKey(r, c)) || [];
        const canMoveHere = targetMoves.length > 0;
        const isCapture = targetMoves.some((m) => m.enPassant || m.capture || (piece && piece.color !== playerColor));
        const isSelected = selected && selected.r === r && selected.c === c;
        const isLast = lastMove && (isSameSquare(lastMove.from, { r, c }) || isSameSquare(lastMove.to, { r, c }));
        const checkedKing = piece && piece.type === "k" && ((piece.color === "w" && whiteInCheck) || (piece.color === "b" && blackInCheck));
        const checkmatedKing = checkedKing && status.over && status.reason === "checkmate";

        button.type = "button";
        button.className = `square ${light ? "light" : "dark"}`;
        button.dataset.r = String(r);
        button.dataset.c = String(c);
        button.setAttribute("aria-label", `${pieceLabel(piece)} on ${E.coord(r, c)}`);
        if (isSelected) button.classList.add("selected");
        if (canMoveHere) button.classList.add("legal-target");
        if (isCapture) button.classList.add("capture-target");
        if (isLast) button.classList.add("last-move");
        if (checkedKing) button.classList.add("king-check");
        if (checkmatedKing) button.classList.add("king-checkmate");
        if (piece && piece.color === playerColor && state.turn === playerColor && !thinking && !gameOver) {
          button.classList.add("own-piece");
        }

        if (piece) {
          const span = document.createElement("span");
          span.className = "piece";
          span.textContent = SYMBOLS[piece.color][piece.type];
          button.appendChild(span);
        }

        if (canMoveHere) {
          const marker = document.createElement("span");
          marker.className = isCapture ? "move-ring" : "move-dot";
          button.appendChild(marker);
        }

        const isBottomRank = playerColor === "w" ? r === 7 : r === 0;
        const isLeftFile = playerColor === "w" ? c === 0 : c === 7;
        if (isBottomRank) {
          const file = document.createElement("span");
          file.className = "coord file-coord";
          file.textContent = E.FILES[c];
          button.appendChild(file);
        }
        if (isLeftFile) {
          const rank = document.createElement("span");
          rank.className = "coord rank-coord";
          rank.textContent = String(8 - r);
          button.appendChild(rank);
        }

        els.board.appendChild(button);
      }
    }
  }

  function renderStatus() {
    const status = E.gameStatus(state);
    if (status.over) gameOver = true;

    els.thinkingDot.hidden = !thinking;
    els.newGameBtn.disabled = thinking;
    els.sideSelect.disabled = thinking;
    if (els.timeControlSelect) els.timeControlSelect.disabled = thinking;

    let main = "";
    const levelText = formatLevel(difficulty);
    let sub = `You are ${colorText(playerColor)} • Computer: ${colorText(E.opponent(playerColor))} • Computer level: ${levelText}`;

    if (thinking) {
      main = "Computer is thinking…";
      sub = `${levelText} engine is coordinating a legal reply to your move.`;
    } else if (status.over) {
      if (status.reason === "checkmate") {
        main = `${colorText(status.winner)} wins by checkmate.`;
        sub = status.winner === playerColor ? "Great game — you beat the computer." : "The computer found checkmate. Try another level or start again.";
      } else if (status.reason === "stalemate") {
        main = "Draw by stalemate.";
        sub = "The side to move has no legal move, but is not in check.";
      } else {
        main = "Draw by the fifty-move rule.";
        sub = "No pawn move or capture has happened in fifty moves.";
      }
    } else if (state.turn === playerColor) {
      main = status.check ? "You are in check — make a legal move." : "Your move.";
      sub += " • Tap a piece to highlight its legal squares.";
    } else {
      main = "Computer to move.";
      sub += " • The reply will appear automatically.";
    }

    els.statusText.textContent = main;
    els.statusSubtext.textContent = sub;
  }

  function renderHistory() {
    els.moveList.innerHTML = "";
    if (!moveHistory.length) {
      const empty = document.createElement("li");
      empty.className = "empty-history";
      empty.textContent = "Moves will appear here.";
      els.moveList.appendChild(empty);
      return;
    }

    for (const entry of moveHistory) {
      const item = document.createElement("li");
      item.className = entry.color === playerColor ? "player-move" : "computer-move";
      const moveNumber = document.createElement("span");
      moveNumber.className = "move-number";
      moveNumber.textContent = entry.color === "w" ? `${entry.number}.` : `${entry.number}…`;
      const text = document.createElement("span");
      text.textContent = entry.text;
      item.append(moveNumber, text);
      els.moveList.appendChild(item);
    }
    els.moveList.scrollTop = els.moveList.scrollHeight;
  }

  function newGame() {
    state = E.createInitialState();
    playerColor = els.sideSelect.value;
    difficulty = normalizeEloLevel(els.difficultySelect.value);
    selected = null;
    legalForSelected = [];
    lastMove = null;
    moveHistory = [];
    thinking = false;
    gameOver = false;
    pendingPromotionMoves = [];
    els.promotionModal.hidden = true;
    hideBoardOverlay();
    initClocks();
    renderAll();
    window.setTimeout(maybeComputerMove, 220);
  }

  function copyFen() {
    const fen = E.boardToFen(state);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(fen).then(
        () => showToast("FEN copied to clipboard."),
        () => showToast(fen, 4500),
      );
    } else {
      showToast(fen, 4500);
    }
  }

  function initPwa() {
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      els.installBtn.hidden = false;
    });

    els.installBtn.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      els.installBtn.hidden = true;
    });

    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      els.installBtn.hidden = true;
      showToast("Mascott Chess was installed.");
    });

    const updateOnlineState = () => {
      if ("onLine" in navigator) {
        els.offlineBadge.hidden = navigator.onLine;
        if (!navigator.onLine) els.offlineBadge.textContent = "Offline ready";
      }
    };
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    updateOnlineState();

    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch((error) => {
          console.warn("Service worker registration failed", error);
        });
      });
    }
  }

  function bindEvents() {
    els.board.addEventListener("click", onSquareClick);
    els.board.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        clearSelection();
        renderAll();
      }
    });

    els.difficultySelect.addEventListener("change", () => {
      difficulty = normalizeEloLevel(els.difficultySelect.value);
      els.difficultySelect.value = difficulty;
      renderStatus();
      updateClockDisplays();
      showToast(`Computer level set to ${formatLevel(difficulty)}.`);
    });

    if (els.timeControlSelect) {
      els.timeControlSelect.addEventListener("change", () => {
        newGame();
        showToast("Timer updated.");
      });
    }

    els.sideSelect.addEventListener("change", () => {
      newGame();
      showToast(`New game started. You are ${colorText(playerColor)}.`);
    });

    els.newGameBtn.addEventListener("click", () => {
      newGame();
      showToast("New game started.");
    });

    if (els.copyFenBtn) els.copyFenBtn.addEventListener("click", copyFen);
    els.clearHistoryBtn.addEventListener("click", () => {
      moveHistory = [];
      renderHistory();
      showToast("Move history view cleared for this session.");
    });

    els.promotionChoices.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-promotion]");
      if (!button) return;
      const promotion = button.dataset.promotion;
      const move = pendingPromotionMoves.find((m) => m.promotion === promotion);
      hidePromotionPicker();
      if (move) executeMove(move, "player");
    });

    els.closeBoardOverlayBtn?.addEventListener("click", hideBoardOverlay);
    els.overlayReviewBtn?.addEventListener("click", hideBoardOverlay);
    els.overlayNewGameBtn?.addEventListener("click", () => {
      hideBoardOverlay();
      newGame();
    });
  }

  populateEloSelect();
  bindEvents();
  initPwa();
  initClocks();
  renderAll();
})();
