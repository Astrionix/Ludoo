/**
 * LudoGameEngine.js
 * Authoritative Server-side Ludo Rules Engine
 * Enforces all game rules, validates player intentions, handles turn logic, captures, and victory conditions.
 */

const crypto = require('crypto');

const PLAYER_COLORS = ['RED', 'GREEN', 'YELLOW', 'BLUE'];
const SAFE_POSITIONS = [0, 8, 13, 21, 26, 34, 39, 47]; // Standard Ludo safe star steps
const TURN_TIMEOUT_MS = 15000; // 15 seconds per turn

class LudoGameEngine {
  constructor(matchId, players) {
    this.matchId = matchId;
    this.matchStatus = 'WAITING'; // WAITING, IN_PROGRESS, PAUSED, FINISHED
    this.turnIndex = 0;
    this.turnDeadline = 0;
    this.diceState = {
      value: 0,
      rolled: false,
      canMove: false
    };

    // Initialize players and 4 tokens per player
    this.players = players.map((p, index) => ({
      id: p.id,
      name: p.name || `Player ${index + 1}`,
      color: PLAYER_COLORS[index],
      connected: true,
      finished: false,
      rank: 0,
      tokens: [-1, -1, -1, -1] // -1 = base, 0..55 = board path, 56 = home goal
    }));

    this.finishedPlayersCount = 0;
    this.processedActionIds = new Set(); // De-duplication table for duplicate protection
  }

  /**
   * De-duplication helper: Returns true if actionId was already processed.
   */
  isDuplicateAction(actionId) {
    if (!actionId) return false;
    if (this.processedActionIds.has(actionId)) {
      return true;
    }
    this.processedActionIds.add(actionId);
    // Limit memory footprint of actionId table
    if (this.processedActionIds.size > 2000) {
      const first = this.processedActionIds.values().next().value;
      this.processedActionIds.delete(first);
    }
    return false;
  }

  startMatch() {
    this.matchStatus = 'IN_PROGRESS';
    this.turnIndex = 0;
    this.resetTurnState();
  }

  resetTurnState() {
    this.diceState = {
      value: 0,
      rolled: false,
      canMove: false
    };
    this.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
  }

  getCurrentPlayer() {
    return this.players[this.turnIndex];
  }

  /**
   * Rolls dice authoritatively using secure random numbers.
   */
  rollDice(playerId, actionId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) {
      return { success: false, error: 'NOT_YOUR_TURN' };
    }
    if (this.diceState.rolled) {
      return { success: false, error: 'DICE_ALREADY_ROLLED' };
    }

    // Cryptographically secure dice roll (1 to 6)
    const diceValue = (crypto.randomBytes(1)[0] % 6) + 1;
    this.diceState.value = diceValue;
    this.diceState.rolled = true;

    // Check if player has any valid moves with this dice value
    const hasValidMove = this.checkValidMoves(player, diceValue);
    this.diceState.canMove = hasValidMove;

    return {
      success: true,
      diceValue: diceValue,
      hasValidMove: hasValidMove,
      player: player
    };
  }

  /**
   * Evaluates if player has at least one movable token given diceValue.
   */
  checkValidMoves(player, diceValue) {
    return player.tokens.some((pos, idx) => this.isValidTokenMove(player, idx, diceValue));
  }

  isValidTokenMove(player, tokenIndex, diceValue) {
    if (tokenIndex < 0 || tokenIndex >= 4) return false;
    const currentPos = player.tokens[tokenIndex];

    // Token in base: requires a 6 to release
    if (currentPos === -1) {
      return diceValue === 6;
    }

    // Token reached goal (56)
    if (currentPos === 56) {
      return false;
    }

    // Must not overshoot goal step 56
    return currentPos + diceValue <= 56;
  }

  /**
   * Authoritatively moves player's token.
   */
  moveToken(playerId, tokenIndex, actionId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) {
      return { success: false, error: 'NOT_YOUR_TURN' };
    }
    if (!this.diceState.rolled) {
      return { success: false, error: 'DICE_NOT_ROLLED' };
    }
    if (!this.isValidTokenMove(player, tokenIndex, this.diceState.value)) {
      return { success: false, error: 'INVALID_MOVE' };
    }

    const currentPos = player.tokens[tokenIndex];
    let newPos;

    if (currentPos === -1) {
      newPos = 0; // Released onto start tile
    } else {
      newPos = currentPos + this.diceState.value;
    }

    player.tokens[tokenIndex] = newPos;

    let capturedToken = null;
    let extraTurn = (this.diceState.value === 6); // Extra turn if rolled 6

    // Check if token reached home goal (56)
    const isTokenHome = (newPos === 56);
    if (isTokenHome) {
      extraTurn = true; // Extra turn for getting a token home
      if (player.tokens.every(pos => pos === 56)) {
        player.finished = true;
        this.finishedPlayersCount++;
        player.rank = this.finishedPlayersCount;
      }
    } else if (newPos > 0 && !SAFE_POSITIONS.includes(newPos)) {
      // Check for opponent capture on non-safe tiles
      capturedToken = this.checkCapture(player, newPos);
      if (capturedToken) {
        extraTurn = true;
      }
    }

    const matchFinished = this.players.filter(p => !p.finished).length <= 1;
    if (matchFinished) {
      this.matchStatus = 'FINISHED';
    }

    return {
      success: true,
      player: player,
      tokenIndex: tokenIndex,
      oldPos: currentPos,
      newPos: newPos,
      capturedToken: capturedToken,
      isTokenHome: isTokenHome,
      extraTurn: extraTurn,
      playerFinished: player.finished,
      matchFinished: matchFinished
    };
  }

  /**
   * Checks and executes opponent token capture on specified board step.
   */
  checkCapture(currentPlayer, pos) {
    for (let p of this.players) {
      if (p.id === currentPlayer.id) continue;
      for (let i = 0; i < 4; i++) {
        if (p.tokens[i] === pos) {
          p.tokens[i] = -1; // Reset captured token back to home base
          return {
            victimPlayerId: p.id,
            victimColor: p.color,
            tokenIndex: i
          };
        }
      }
    }
    return null;
  }

  /**
   * Passes turn to next active player.
   */
  nextTurn() {
    let attempts = 0;
    do {
      this.turnIndex = (this.turnIndex + 1) % this.players.length;
      attempts++;
    } while (this.players[this.turnIndex].finished && attempts < this.players.length);

    this.resetTurnState();
    return this.getCurrentPlayer();
  }
}

module.exports = LudoGameEngine;
