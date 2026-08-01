/* Chess engine and computer opponent for the PWA chess app.
   Board coordinates: row 0 = rank 8, row 7 = rank 1, col 0 = file a. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ChessEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const WHITE = "w";
  const BLACK = "b";
  const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const PROMOTIONS = ["q", "r", "b", "n"];
  const INF = 1_000_000_000;
  const MATE = 100_000;

  const PIECE_VALUE = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 0,
  };

  // Piece-square tables are written from White's perspective with row 0 = rank 8.
  const PST = {
    p: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [5, 5, 10, 25, 25, 10, 5, 5],
      [0, 0, 0, 20, 20, 0, 0, 0],
      [5, -5, -10, 0, 0, -10, -5, 5],
      [5, 10, 10, -20, -20, 10, 10, 5],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    n: [
      [-50, -40, -30, -30, -30, -30, -40, -50],
      [-40, -20, 0, 5, 5, 0, -20, -40],
      [-30, 5, 10, 15, 15, 10, 5, -30],
      [-30, 0, 15, 20, 20, 15, 0, -30],
      [-30, 5, 15, 20, 20, 15, 5, -30],
      [-30, 0, 10, 15, 15, 10, 0, -30],
      [-40, -20, 0, 0, 0, 0, -20, -40],
      [-50, -40, -30, -30, -30, -30, -40, -50],
    ],
    b: [
      [-20, -10, -10, -10, -10, -10, -10, -20],
      [-10, 5, 0, 0, 0, 0, 5, -10],
      [-10, 10, 10, 10, 10, 10, 10, -10],
      [-10, 0, 10, 10, 10, 10, 0, -10],
      [-10, 5, 5, 10, 10, 5, 5, -10],
      [-10, 0, 5, 10, 10, 5, 0, -10],
      [-10, 0, 0, 0, 0, 0, 0, -10],
      [-20, -10, -10, -10, -10, -10, -10, -20],
    ],
    r: [
      [0, 0, 5, 10, 10, 5, 0, 0],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [5, 10, 10, 10, 10, 10, 10, 5],
      [0, 0, 0, 5, 5, 0, 0, 0],
    ],
    q: [
      [-20, -10, -10, -5, -5, -10, -10, -20],
      [-10, 0, 5, 0, 0, 0, 0, -10],
      [-10, 5, 5, 5, 5, 5, 0, -10],
      [0, 0, 5, 5, 5, 5, 0, -5],
      [-5, 0, 5, 5, 5, 5, 0, -5],
      [-10, 0, 5, 5, 5, 5, 0, -10],
      [-10, 0, 0, 0, 0, 0, 0, -10],
      [-20, -10, -10, -5, -5, -10, -10, -20],
    ],
    k: [
      [20, 30, 10, 0, 0, 10, 30, 20],
      [20, 20, 0, 0, 0, 0, 20, 20],
      [-10, -20, -20, -20, -20, -20, -20, -10],
      [-20, -30, -30, -40, -40, -30, -30, -20],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
    ],
  };

  const KNIGHT_DIRS = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];
  const KING_DIRS = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];
  const BISHOP_DIRS = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  const ROOK_DIRS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  const QUEEN_DIRS = BISHOP_DIRS.concat(ROOK_DIRS);

  function opponent(color) {
    return color === WHITE ? BLACK : WHITE;
  }

  function isOnBoard(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  function coord(r, c) {
    return `${FILES[c]}${8 - r}`;
  }

  function parseCoord(square) {
    const file = square[0].toLowerCase();
    const rank = Number(square[1]);
    return { r: 8 - rank, c: FILES.indexOf(file) };
  }

  function piece(color, type) {
    return { color, type };
  }

  function makeBackRank(color) {
    return ["r", "n", "b", "q", "k", "b", "n", "r"].map((type) => piece(color, type));
  }

  function createInitialState() {
    return {
      board: [
        makeBackRank(BLACK),
        Array.from({ length: 8 }, () => piece(BLACK, "p")),
        Array(8).fill(null),
        Array(8).fill(null),
        Array(8).fill(null),
        Array(8).fill(null),
        Array.from({ length: 8 }, () => piece(WHITE, "p")),
        makeBackRank(WHITE),
      ],
      turn: WHITE,
      castling: { wK: true, wQ: true, bK: true, bQ: true },
      enPassant: null,
      halfmove: 0,
      fullmove: 1,
    };
  }

  function cloneState(state) {
    return {
      board: state.board.map((row) => row.map((p) => (p ? { color: p.color, type: p.type } : null))),
      turn: state.turn,
      castling: { ...state.castling },
      enPassant: state.enPassant ? { ...state.enPassant } : null,
      halfmove: state.halfmove,
      fullmove: state.fullmove,
    };
  }

  function sameSquare(a, b) {
    return !!a && !!b && a.r === b.r && a.c === b.c;
  }

  function findKing(state, color) {
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const p = state.board[r][c];
        if (p && p.color === color && p.type === "k") return { r, c };
      }
    }
    return null;
  }

  function isSquareAttacked(state, r, c, byColor) {
    // Pawns.
    const pawnDir = byColor === WHITE ? -1 : 1;
    const pawnRow = r - pawnDir;
    for (const dc of [-1, 1]) {
      const pc = c - dc;
      if (isOnBoard(pawnRow, pc)) {
        const p = state.board[pawnRow][pc];
        if (p && p.color === byColor && p.type === "p") return true;
      }
    }

    // Knights.
    for (const [dr, dc] of KNIGHT_DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (!isOnBoard(nr, nc)) continue;
      const p = state.board[nr][nc];
      if (p && p.color === byColor && p.type === "n") return true;
    }

    // Bishops / queens.
    for (const [dr, dc] of BISHOP_DIRS) {
      let nr = r + dr;
      let nc = c + dc;
      while (isOnBoard(nr, nc)) {
        const p = state.board[nr][nc];
        if (p) {
          if (p.color === byColor && (p.type === "b" || p.type === "q")) return true;
          break;
        }
        nr += dr;
        nc += dc;
      }
    }

    // Rooks / queens.
    for (const [dr, dc] of ROOK_DIRS) {
      let nr = r + dr;
      let nc = c + dc;
      while (isOnBoard(nr, nc)) {
        const p = state.board[nr][nc];
        if (p) {
          if (p.color === byColor && (p.type === "r" || p.type === "q")) return true;
          break;
        }
        nr += dr;
        nc += dc;
      }
    }

    // King.
    for (const [dr, dc] of KING_DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (!isOnBoard(nr, nc)) continue;
      const p = state.board[nr][nc];
      if (p && p.color === byColor && p.type === "k") return true;
    }

    return false;
  }

  function isInCheck(state, color) {
    const king = findKing(state, color);
    if (!king) return false;
    return isSquareAttacked(state, king.r, king.c, opponent(color));
  }

  function baseMove(r, c, tr, tc, p, extra = {}) {
    return {
      from: { r, c },
      to: { r: tr, c: tc },
      piece: p.type,
      color: p.color,
      capture: null,
      promotion: null,
      castle: null,
      enPassant: false,
      doublePawn: false,
      ...extra,
    };
  }

  function addPromotionMoves(moves, r, c, tr, tc, p, extra = {}) {
    for (const promotion of PROMOTIONS) {
      moves.push(baseMove(r, c, tr, tc, p, { ...extra, promotion }));
    }
  }

  function generatePseudoMoves(state, color) {
    const moves = [];
    const board = state.board;

    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const p = board[r][c];
        if (!p || p.color !== color) continue;

        if (p.type === "p") {
          const dir = color === WHITE ? -1 : 1;
          const startRow = color === WHITE ? 6 : 1;
          const promotionRow = color === WHITE ? 0 : 7;
          const oneR = r + dir;

          if (isOnBoard(oneR, c) && !board[oneR][c]) {
            if (oneR === promotionRow) {
              addPromotionMoves(moves, r, c, oneR, c, p);
            } else {
              moves.push(baseMove(r, c, oneR, c, p));
            }

            const twoR = r + 2 * dir;
            if (r === startRow && isOnBoard(twoR, c) && !board[twoR][c]) {
              moves.push(baseMove(r, c, twoR, c, p, { doublePawn: true }));
            }
          }

          for (const dc of [-1, 1]) {
            const tr = r + dir;
            const tc = c + dc;
            if (!isOnBoard(tr, tc)) continue;
            const target = board[tr][tc];
            if (target && target.color !== color) {
              const extra = { capture: target.type };
              if (tr === promotionRow) addPromotionMoves(moves, r, c, tr, tc, p, extra);
              else moves.push(baseMove(r, c, tr, tc, p, extra));
            }

            if (state.enPassant && state.enPassant.r === tr && state.enPassant.c === tc) {
              moves.push(baseMove(r, c, tr, tc, p, { capture: "p", enPassant: true }));
            }
          }
        } else if (p.type === "n") {
          for (const [dr, dc] of KNIGHT_DIRS) {
            const tr = r + dr;
            const tc = c + dc;
            if (!isOnBoard(tr, tc)) continue;
            const target = board[tr][tc];
            if (!target) moves.push(baseMove(r, c, tr, tc, p));
            else if (target.color !== color) moves.push(baseMove(r, c, tr, tc, p, { capture: target.type }));
          }
        } else if (p.type === "b" || p.type === "r" || p.type === "q") {
          const dirs = p.type === "b" ? BISHOP_DIRS : p.type === "r" ? ROOK_DIRS : QUEEN_DIRS;
          for (const [dr, dc] of dirs) {
            let tr = r + dr;
            let tc = c + dc;
            while (isOnBoard(tr, tc)) {
              const target = board[tr][tc];
              if (!target) {
                moves.push(baseMove(r, c, tr, tc, p));
              } else {
                if (target.color !== color) moves.push(baseMove(r, c, tr, tc, p, { capture: target.type }));
                break;
              }
              tr += dr;
              tc += dc;
            }
          }
        } else if (p.type === "k") {
          for (const [dr, dc] of KING_DIRS) {
            const tr = r + dr;
            const tc = c + dc;
            if (!isOnBoard(tr, tc)) continue;
            const target = board[tr][tc];
            if (!target) moves.push(baseMove(r, c, tr, tc, p));
            else if (target.color !== color) moves.push(baseMove(r, c, tr, tc, p, { capture: target.type }));
          }

          // Castling.
          if (!isInCheck(state, color)) {
            const row = color === WHITE ? 7 : 0;
            const opp = opponent(color);
            const kingsideRight = color === WHITE ? state.castling.wK : state.castling.bK;
            const queensideRight = color === WHITE ? state.castling.wQ : state.castling.bQ;

            if (
              r === row &&
              c === 4 &&
              kingsideRight &&
              board[row][7] &&
              board[row][7].color === color &&
              board[row][7].type === "r" &&
              !board[row][5] &&
              !board[row][6] &&
              !isSquareAttacked(state, row, 5, opp) &&
              !isSquareAttacked(state, row, 6, opp)
            ) {
              moves.push(baseMove(r, c, row, 6, p, { castle: "K" }));
            }

            if (
              r === row &&
              c === 4 &&
              queensideRight &&
              board[row][0] &&
              board[row][0].color === color &&
              board[row][0].type === "r" &&
              !board[row][1] &&
              !board[row][2] &&
              !board[row][3] &&
              !isSquareAttacked(state, row, 3, opp) &&
              !isSquareAttacked(state, row, 2, opp)
            ) {
              moves.push(baseMove(r, c, row, 2, p, { castle: "Q" }));
            }
          }
        }
      }
    }

    return moves;
  }

  function applyMove(state, move) {
    const { from, to } = move;
    const moving = state.board[from.r][from.c];
    if (!moving) throw new Error(`No piece on ${coord(from.r, from.c)}`);

    let captured = null;
    if (move.enPassant) {
      const capR = from.r;
      const capC = to.c;
      captured = state.board[capR][capC];
      state.board[capR][capC] = null;
    } else {
      captured = state.board[to.r][to.c];
    }

    state.board[from.r][from.c] = null;

    // Castling rook move. Use king's two-square move as a fallback even if castle flag is absent.
    const isCastle = moving.type === "k" && Math.abs(to.c - from.c) === 2;
    if (isCastle) {
      const row = from.r;
      if (to.c === 6) {
        state.board[row][5] = state.board[row][7];
        state.board[row][7] = null;
      } else if (to.c === 2) {
        state.board[row][3] = state.board[row][0];
        state.board[row][0] = null;
      }
    }

    state.board[to.r][to.c] = { color: moving.color, type: move.promotion || moving.type };

    // Update castling rights for king and rook moves.
    if (moving.type === "k") {
      if (moving.color === WHITE) {
        state.castling.wK = false;
        state.castling.wQ = false;
      } else {
        state.castling.bK = false;
        state.castling.bQ = false;
      }
    }

    if (moving.type === "r") {
      if (moving.color === WHITE && from.r === 7 && from.c === 0) state.castling.wQ = false;
      if (moving.color === WHITE && from.r === 7 && from.c === 7) state.castling.wK = false;
      if (moving.color === BLACK && from.r === 0 && from.c === 0) state.castling.bQ = false;
      if (moving.color === BLACK && from.r === 0 && from.c === 7) state.castling.bK = false;
    }

    if (captured && captured.type === "r") {
      if (captured.color === WHITE && to.r === 7 && to.c === 0) state.castling.wQ = false;
      if (captured.color === WHITE && to.r === 7 && to.c === 7) state.castling.wK = false;
      if (captured.color === BLACK && to.r === 0 && to.c === 0) state.castling.bQ = false;
      if (captured.color === BLACK && to.r === 0 && to.c === 7) state.castling.bK = false;
    }

    state.enPassant = null;
    if (moving.type === "p" && Math.abs(to.r - from.r) === 2) {
      state.enPassant = { r: (from.r + to.r) / 2, c: from.c };
    }

    state.halfmove = moving.type === "p" || captured ? 0 : state.halfmove + 1;
    if (moving.color === BLACK) state.fullmove += 1;
    state.turn = opponent(state.turn);

    return { captured, moving };
  }

  function generateLegalMoves(state, color = state.turn) {
    const legal = [];
    const pseudo = generatePseudoMoves(state, color);
    for (const move of pseudo) {
      const next = cloneState(state);
      applyMove(next, move);
      if (!isInCheck(next, color)) legal.push(move);
    }
    return legal;
  }

  function legalMovesFrom(state, r, c) {
    return generateLegalMoves(state, state.turn).filter((m) => m.from.r === r && m.from.c === c);
  }

  function gameStatus(state) {
    const legal = generateLegalMoves(state, state.turn);
    const check = isInCheck(state, state.turn);
    if (legal.length === 0) {
      return {
        over: true,
        reason: check ? "checkmate" : "stalemate",
        winner: check ? opponent(state.turn) : null,
        legalMoves: 0,
        check,
      };
    }
    if (state.halfmove >= 100) {
      return { over: true, reason: "fifty-move", winner: null, legalMoves: legal.length, check };
    }
    return { over: false, reason: null, winner: null, legalMoves: legal.length, check };
  }

  function boardToFen(state) {
    const ranks = [];
    for (let r = 0; r < 8; r += 1) {
      let rank = "";
      let empties = 0;
      for (let c = 0; c < 8; c += 1) {
        const p = state.board[r][c];
        if (!p) {
          empties += 1;
          continue;
        }
        if (empties) {
          rank += String(empties);
          empties = 0;
        }
        const char = p.type === "n" ? "n" : p.type;
        rank += p.color === WHITE ? char.toUpperCase() : char;
      }
      if (empties) rank += String(empties);
      ranks.push(rank);
    }
    const castling =
      `${state.castling.wK ? "K" : ""}${state.castling.wQ ? "Q" : ""}${state.castling.bK ? "k" : ""}${state.castling.bQ ? "q" : ""}` || "-";
    const ep = state.enPassant ? coord(state.enPassant.r, state.enPassant.c) : "-";
    return `${ranks.join("/")} ${state.turn} ${castling} ${ep} ${state.halfmove} ${state.fullmove}`;
  }

  function evaluateBoard(state) {
    let score = 0;
    let whiteBishops = 0;
    let blackBishops = 0;
    let whitePawns = 0;
    let blackPawns = 0;

    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const p = state.board[r][c];
        if (!p) continue;
        const sign = p.color === WHITE ? 1 : -1;
        const tableRow = p.color === WHITE ? r : 7 - r;
        const positional = PST[p.type][tableRow][c] || 0;
        score += sign * (PIECE_VALUE[p.type] + positional);
        if (p.type === "b") {
          if (p.color === WHITE) whiteBishops += 1;
          else blackBishops += 1;
        }
        if (p.type === "p") {
          if (p.color === WHITE) whitePawns += 1;
          else blackPawns += 1;
        }
      }
    }

    if (whiteBishops >= 2) score += 30;
    if (blackBishops >= 2) score -= 30;

    // Slightly prefer keeping pawn structure and having room to move.
    score += (whitePawns - blackPawns) * 2;
    return score;
  }

  function evaluateFor(state, color) {
    const score = evaluateBoard(state);
    return color === WHITE ? score : -score;
  }

  function captureTypeForMove(state, move) {
    if (move.enPassant) return "p";
    const target = state.board[move.to.r][move.to.c];
    return target ? target.type : null;
  }

  function moveOrderingScore(state, move) {
    const moving = state.board[move.from.r][move.from.c];
    const victimType = captureTypeForMove(state, move);
    let score = 0;
    if (victimType) score += 10_000 + PIECE_VALUE[victimType] * 10 - PIECE_VALUE[moving.type];
    if (move.promotion) score += 8_000 + PIECE_VALUE[move.promotion];
    if (move.castle) score += 120;
    // Center preference for quieter moves.
    const centerDistance = Math.abs(move.to.r - 3.5) + Math.abs(move.to.c - 3.5);
    score += 12 - centerDistance * 2;
    return score;
  }

  function orderedMoves(state, moves) {
    return moves.slice().sort((a, b) => moveOrderingScore(state, b) - moveOrderingScore(state, a));
  }

  function negamax(state, depth, alpha, beta, colorToMove, info) {
    info.nodes += 1;
    if (info.nodes > info.maxNodes) return evaluateFor(state, colorToMove);

    const legal = generateLegalMoves(state, colorToMove);
    if (legal.length === 0) {
      return isInCheck(state, colorToMove) ? -MATE - depth : 0;
    }
    if (depth === 0) return evaluateFor(state, colorToMove);

    let best = -INF;
    const moves = orderedMoves(state, legal);
    for (const move of moves) {
      const next = cloneState(state);
      applyMove(next, move);
      const score = -negamax(next, depth - 1, -beta, -alpha, opponent(colorToMove), info);
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }

  function heuristicMoveScore(state, move, aiColor) {
    const next = cloneState(state);
    applyMove(next, move);
    const evaluation = evaluateFor(next, aiColor);
    const victimType = captureTypeForMove(state, move);
    let tactical = 0;
    if (victimType) tactical += PIECE_VALUE[victimType] * 1.8;
    if (move.promotion) tactical += PIECE_VALUE[move.promotion] + 500;
    if (isInCheck(next, next.turn)) tactical += 45;
    if (move.castle) tactical += 35;
    return evaluation + tactical;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function parseEloLevel(level) {
    const legacy = { easy: 600, medium: 1100, hard: 1600, expert: 2100 };
    const raw = String(level ?? "1200").toLowerCase();
    if (legacy[raw]) return legacy[raw];
    const match = raw.match(/\d+/);
    const parsed = match ? Number.parseInt(match[0], 10) : 1200;
    return clamp(Number.isFinite(parsed) ? parsed : 1200, 400, 2400);
  }

  function eloProfile(level) {
    const elo = parseEloLevel(level);
    const t = (elo - 400) / 2000; // 0 at 400, 1 at 2400.
    let depth = 0;
    if (elo >= 2300) depth = 4;
    else if (elo >= 1650) depth = 3;
    else if (elo >= 1050) depth = 2;
    else if (elo >= 700) depth = 1;

    return {
      elo,
      depth,
      // The rating ladder changes every 50 Elo through these continuous values.
      randomChance: clamp(0.5 * Math.pow(1 - t, 2.2), 0, 0.55),
      blunderChance: clamp(0.36 * Math.pow(1 - t, 1.55), 0, 0.42),
      noise: 520 * Math.pow(1 - t, 2.05) + 4,
      candidatePool: Math.max(1, Math.round(9 - t * 8)),
      maxNodes: Math.round(5_000 + t * 125_000),
      temperature: Math.max(12, 145 * Math.pow(1 - t, 1.6)),
    };
  }

  function weightedRankedChoice(ranked, count, temperature) {
    const pool = ranked.slice(0, Math.max(1, Math.min(count, ranked.length)));
    const best = pool[0].score;
    let total = 0;
    const weighted = pool.map((entry) => {
      const weight = Math.exp(clamp((entry.score - best) / Math.max(1, temperature), -35, 0));
      total += weight;
      return { entry, weight };
    });
    let pick = Math.random() * total;
    for (const item of weighted) {
      pick -= item.weight;
      if (pick <= 0) return item.entry.move;
    }
    return pool[0].move;
  }

  function chooseComputerMove(state, level = "1200", aiColor = state.turn) {
    const legal = generateLegalMoves(state, state.turn);
    if (!legal.length) return null;

    const profile = eloProfile(level);
    if (Math.random() < profile.randomChance) {
      return legal[Math.floor(Math.random() * legal.length)];
    }

    const moves = orderedMoves(state, legal);
    const sharedInfo = { nodes: 0, maxNodes: profile.maxNodes };
    const ranked = moves
      .map((move) => {
        const next = cloneState(state);
        applyMove(next, move);
        let score;

        if (profile.depth > 0) {
          score = -negamax(next, profile.depth - 1, -INF, INF, opponent(state.turn), sharedInfo);
          // Keep fast searches tactically alert without changing the legal core.
          score += heuristicMoveScore(state, move, aiColor) * 0.08;
        } else {
          score = heuristicMoveScore(state, move, aiColor);
        }

        score += (Math.random() - 0.5) * profile.noise;
        return { move, score };
      })
      .sort((a, b) => b.score - a.score);

    if (Math.random() < profile.blunderChance && ranked.length > 1) {
      const start = Math.min(ranked.length - 1, Math.max(1, Math.floor(profile.candidatePool / 2)));
      const end = Math.min(ranked.length, start + Math.max(2, profile.candidatePool));
      return ranked[start + Math.floor(Math.random() * (end - start))].move;
    }

    return weightedRankedChoice(ranked, profile.candidatePool, profile.temperature);
  }

  function pieceName(type) {
    return { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" }[type] || type;
  }

  function colorName(color) {
    return color === WHITE ? "White" : "Black";
  }

  function describeMove(before, move, after) {
    const moving = before.board[move.from.r][move.from.c];
    if (!moving) return `${coord(move.from.r, move.from.c)} → ${coord(move.to.r, move.to.c)}`;

    const side = colorName(moving.color);
    let text;
    const isCastle = moving.type === "k" && Math.abs(move.to.c - move.from.c) === 2;
    if (isCastle) {
      text = `${side} castles ${move.to.c === 6 ? "kingside" : "queenside"}`;
    } else {
      const capture = move.enPassant || before.board[move.to.r][move.to.c];
      const arrow = capture ? "×" : "→";
      text = `${side} ${pieceName(moving.type)} ${coord(move.from.r, move.from.c)} ${arrow} ${coord(move.to.r, move.to.c)}`;
      if (move.enPassant) text += " e.p.";
      if (move.promotion) text += `=${move.promotion.toUpperCase()}`;
    }

    if (after) {
      const targetColor = after.turn;
      const legal = generateLegalMoves(after, targetColor);
      if (legal.length === 0 && isInCheck(after, targetColor)) text += "#";
      else if (isInCheck(after, targetColor)) text += "+";
    }
    return text;
  }

  return {
    WHITE,
    BLACK,
    FILES,
    PROMOTIONS,
    PIECE_VALUE,
    createInitialState,
    cloneState,
    opponent,
    coord,
    parseCoord,
    isOnBoard,
    sameSquare,
    findKing,
    isSquareAttacked,
    isInCheck,
    generatePseudoMoves,
    generateLegalMoves,
    legalMovesFrom,
    applyMove,
    gameStatus,
    boardToFen,
    evaluateBoard,
    evaluateFor,
    chooseComputerMove,
    describeMove,
    pieceName,
    colorName,
  };
});
