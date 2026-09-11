/**
 * WebSocketGateway.js
 * Handles WebSocket communication, protocol parsing, event broadcasting, anti-cheat, duplicate protection, and heartbeat management.
 */

const MatchManager = require('./MatchManager');
const db = require('./DatabaseService');

class WebSocketGateway {
  constructor(wss) {
    this.wss = wss;
    this.matchManager = new MatchManager();

    this.wss.on('connection', (ws) => {
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleClientMessage(ws, data);
        } catch (err) {
          console.error('Invalid JSON message:', err.message);
        }
      });

      ws.on('close', () => {
        if (ws.playerId) {
          this.handlePlayerDisconnect(ws.playerId);
        }
      });
    });

    // Heartbeat ping interval (10 seconds)
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      });
    }, 10000);
  }

  async handleClientMessage(ws, data) {
    const { type, playerId, actionId, payload } = data;

    if (type === 'PING') {
      return this.send(ws, { type: 'PONG', timestamp: Date.now() });
    }

    if (type === 'ACK') {
      // Client confirmed receipt of seq
      return;
    }

    if (type === 'JOIN_MATCHMAKING') {
      ws.playerId = playerId;
      ws.playerName = payload?.name || `Player_${playerId.substring(0, 4)}`;

      // Fetch or persist profile in Supabase asynchronously
      db.getOrCreateProfile(playerId, ws.playerName).then(profile => {
        ws.profile = profile;
      });

      const matchData = this.matchManager.enqueuePlayer(playerId, ws.playerName, ws, payload?.nop || 4);
      if (matchData) {
        this.startMatchSession(matchData);
      } else {
        this.send(ws, { type: 'MATCHMAKING_SEARCHING', status: 'Searching for players...' });
      }
      return;
    }

    if (type === 'CREATE_ROOM') {
      ws.playerId = playerId;
      ws.playerName = payload?.name || `Player_${playerId.substring(0, 4)}`;

      const room = this.matchManager.createRoom(playerId, ws.playerName, ws, payload?.options || {});
      this.send(ws, {
        type: 'ROOM_CREATED',
        roomCode: room.code,
        players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, isReady: p.isReady })),
        options: room.options
      });
      return;
    }

    if (type === 'JOIN_ROOM') {
      ws.playerId = playerId;
      ws.playerName = payload?.name || `Player_${playerId.substring(0, 4)}`;
      const { roomCode } = payload || {};

      const result = this.matchManager.joinRoom(roomCode, playerId, ws.playerName, ws);
      if (result.error) {
        return this.send(ws, { type: 'JOIN_ROOM_FAILED', error: result.error });
      }

      this.broadcastRoomUpdate(result.room);
      return;
    }

    if (type === 'TOGGLE_READY') {
      const { roomCode } = payload || {};
      const room = this.matchManager.toggleReady(roomCode, playerId);
      if (room) {
        this.broadcastRoomUpdate(room);
      }
      return;
    }

    if (type === 'START_ROOM_MATCH') {
      const { roomCode } = payload || {};
      const result = this.matchManager.startRoomMatch(roomCode, playerId);
      if (result.error) {
        return this.send(ws, { type: 'START_ROOM_MATCH_FAILED', error: result.error });
      }
      this.startMatchSession(result.matchData);
      return;
    }

    if (type === 'RECONNECT_REQUEST') {
      const { matchId, lastReceivedSequence } = payload;
      ws.playerId = playerId;

      const matchData = this.matchManager.reconnectPlayer(matchId, playerId, ws);
      if (!matchData) {
        return this.send(ws, { type: 'RECONNECT_FAILED', reason: 'MATCH_NOT_FOUND' });
      }

      this.handlePlayerReconnect(matchData, playerId, lastReceivedSequence, ws);
      return;
    }

    // Game Action Requests (Server Authoritative & Duplicate Protected)
    const matchData = this.matchManager.getMatchByPlayerId(playerId);
    if (!matchData) {
      return this.send(ws, { type: 'ERROR', message: 'NOT_IN_MATCH' });
    }

    const { engine, sequenceManager } = matchData;

    // Check duplicate actionId
    if (actionId && engine.isDuplicateAction(actionId)) {
      console.log(`Duplicate actionId ignored: ${actionId}`);
      return;
    }

    if (type === 'ROLL_REQUEST') {
      const result = engine.rollDice(playerId, actionId);
      if (!result.success) {
        return this.send(ws, { type: 'ACTION_FAILED', reason: result.error });
      }

      const diceEvent = sequenceManager.recordEvent('DICE_ROLLED', {
        playerId: playerId,
        color: result.player.color,
        diceValue: result.diceValue,
        hasValidMove: result.hasValidMove
      });
      this.broadcast(matchData, diceEvent);

      // If player rolled dice but has no valid moves, auto-advance turn after 1 sec delay
      if (!result.hasValidMove) {
        setTimeout(() => {
          const nextPlayer = engine.nextTurn();
          const turnEvent = sequenceManager.recordEvent('TURN_CHANGED', {
            turnIndex: engine.turnIndex,
            playerId: nextPlayer.id,
            color: nextPlayer.color,
            turnDeadline: engine.turnDeadline
          });
          this.broadcast(matchData, turnEvent);
        }, 1000);
      }
      return;
    }

    if (type === 'MOVE_REQUEST') {
      const { tokenIndex } = payload;
      const result = engine.moveToken(playerId, tokenIndex, actionId);
      if (!result.success) {
        return this.send(ws, { type: 'ACTION_FAILED', reason: result.error });
      }

      const moveEvent = sequenceManager.recordEvent('MOVE_CONFIRMED', {
        playerId: playerId,
        color: result.player.color,
        tokenIndex: result.tokenIndex,
        oldPos: result.oldPos,
        newPos: result.newPos,
        isTokenHome: result.isTokenHome
      });
      this.broadcast(matchData, moveEvent);

      if (result.capturedToken) {
        const captureEvent = sequenceManager.recordEvent('TOKEN_CAPTURED', result.capturedToken);
        this.broadcast(matchData, captureEvent);
      }

      if (result.playerFinished) {
        const finishedEvent = sequenceManager.recordEvent('PLAYER_FINISHED', {
          playerId: playerId,
          rank: result.player.rank
        });
        this.broadcast(matchData, finishedEvent);
      }

      if (result.matchFinished) {
        const gameFinishedEvent = sequenceManager.recordEvent('GAME_FINISHED', {
          winnerId: playerId,
          matchId: engine.matchId
        });
        this.broadcast(matchData, gameFinishedEvent);

        // Record match results in Supabase
        db.recordMatchFinished(engine.matchId, playerId, 120);
        return;
      }

      // Check turn advancement or extra turn
      if (!result.extraTurn) {
        const nextPlayer = engine.nextTurn();
        const turnEvent = sequenceManager.recordEvent('TURN_CHANGED', {
          turnIndex: engine.turnIndex,
          playerId: nextPlayer.id,
          color: nextPlayer.color,
          turnDeadline: engine.turnDeadline
        });
        this.broadcast(matchData, turnEvent);
      } else {
        // Reset turn deadline for extra turn
        engine.resetTurnState();
        const turnEvent = sequenceManager.recordEvent('TURN_CHANGED', {
          turnIndex: engine.turnIndex,
          playerId: result.player.id,
          color: result.player.color,
          turnDeadline: engine.turnDeadline,
          extraTurnReason: result.isTokenHome ? 'TOKEN_HOME' : (result.capturedToken ? 'CAPTURED' : 'ROLLED_SIX')
        });
        this.broadcast(matchData, turnEvent);
      }
    }
  }

  startMatchSession(matchData) {
    const { engine, sequenceManager } = matchData;
    engine.startMatch();

    const startEvent = sequenceManager.recordEvent('GAME_STARTED', {
      matchId: engine.matchId,
      players: engine.players.map(p => ({ id: p.id, name: p.name, color: p.color }))
    });
    this.broadcast(matchData, startEvent);

    const turnEvent = sequenceManager.recordEvent('TURN_CHANGED', {
      turnIndex: engine.turnIndex,
      playerId: engine.getCurrentPlayer().id,
      color: engine.getCurrentPlayer().color,
      turnDeadline: engine.turnDeadline
    });
    this.broadcast(matchData, turnEvent);
  }

  handlePlayerReconnect(matchData, playerId, lastReceivedSequence, ws) {
    const { engine, sequenceManager } = matchData;

    // Broadcast reconnection event to match
    const reconnectedEvent = sequenceManager.recordEvent('PLAYER_RECONNECTED', { playerId: playerId });
    this.broadcast(matchData, reconnectedEvent);

    // Retrieve missing delta events since client's last received sequence
    const missedEvents = sequenceManager.getEventsSince(lastReceivedSequence);

    if (missedEvents !== null) {
      // Replay missed delta events sequentially
      this.send(ws, {
        type: 'DELTA_SYNC',
        events: missedEvents
      });
    } else {
      // Delta buffer window exceeded -> Fallback to authoritative GAME_STATE_SNAPSHOT
      const snapshot = sequenceManager.createSnapshot(engine);
      this.send(ws, snapshot);
    }
  }

  handlePlayerDisconnect(playerId) {
    const matchData = this.matchManager.handleDisconnect(playerId);
    if (matchData) {
      const disconnectEvent = matchData.sequenceManager.recordEvent('PLAYER_DISCONNECTED', { playerId: playerId });
      this.broadcast(matchData, disconnectEvent);
    }
  }

  broadcastRoomUpdate(room) {
    const payload = JSON.stringify({
      type: 'ROOM_UPDATED',
      roomCode: room.code,
      players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, isReady: p.isReady })),
      options: room.options,
      started: room.started
    });
    room.players.forEach(p => {
      if (p.ws && p.ws.readyState === 1) {
        p.ws.send(payload);
      }
    });
  }

  broadcast(matchData, event) {
    const payloadStr = JSON.stringify(event);
    matchData.clients.forEach((ws) => {
      if (ws.readyState === 1) { // OPEN
        ws.send(payloadStr);
      }
    });
  }

  send(ws, data) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(data));
    }
  }
}

module.exports = WebSocketGateway;
