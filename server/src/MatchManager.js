/**
 * MatchManager.js
 * Manages active Ludo match rooms, player session tracking, matchmaking, and reconnection token mapping.
 */

const LudoGameEngine = require('./LudoGameEngine');
const SequenceManager = require('./SequenceManager');

class MatchManager {
  constructor() {
    this.matches = new Map(); // matchId -> { engine, sequenceManager, clients: Map(playerId -> ws) }
    this.playerMatchMap = new Map(); // playerId -> matchId
    this.waitingQueue = [];
  }

  /**
   * Enqueues player for real-time online matchmaking with requested player count.
   */
  enqueuePlayer(playerId, playerName, ws, requestedCount = 4) {
    this.waitingQueue = this.waitingQueue.filter(p => p.id !== playerId);
    this.waitingQueue.push({
      id: playerId,
      name: playerName,
      ws: ws,
      requestedCount: requestedCount,
      joinTime: Date.now()
    });

    const matchPlayers = this.tryFormMatch(requestedCount);
    if (matchPlayers) {
      const matchId = `MATCH_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const engine = new LudoGameEngine(matchId, matchPlayers);
      const sequenceManager = new SequenceManager(100);

      const clientsMap = new Map();
      matchPlayers.forEach(p => {
        clientsMap.set(p.id, p.ws);
        this.playerMatchMap.set(p.id, matchId);
      });

      const matchData = {
        matchId: matchId,
        engine: engine,
        sequenceManager: sequenceManager,
        clients: clientsMap
      };

      this.matches.set(matchId, matchData);
      return matchData;
    }

    return null;
  }

  tryFormMatch(requestedCount) {
    if (this.waitingQueue.length >= requestedCount) {
      return this.waitingQueue.splice(0, requestedCount);
    }
    // Expand matchmaking pool after 10 seconds to start with available 2+ players
    const now = Date.now();
    const waitingLong = this.waitingQueue.filter(p => now - p.joinTime > 10000);
    if (waitingLong.length >= 2) {
      return this.waitingQueue.splice(0, Math.min(4, waitingLong.length));
    }
    return null;
  }

  // --- Private Friend Room Management ---

  createRoom(hostId, hostName, ws, options = {}) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let roomCode = '';
    for (let i = 0; i < 6; i++) {
      roomCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const room = {
      code: roomCode,
      hostId: hostId,
      options: {
        mode: options.mode || 'CLASSIC',
        maxPlayers: options.maxPlayers || 4,
        turnTimer: options.turnTimer || 15
      },
      players: [
        { id: hostId, name: hostName, ws: ws, isHost: true, isReady: true }
      ],
      started: false,
      matchId: null
    };

    if (!this.rooms) this.rooms = new Map();
    this.rooms.set(roomCode, room);
    return room;
  }

  joinRoom(roomCode, playerId, playerName, ws) {
    if (!this.rooms) this.rooms = new Map();
    const room = this.rooms.get(roomCode.toUpperCase());

    if (!room) return { error: 'ROOM_NOT_FOUND' };
    if (room.started) return { error: 'GAME_ALREADY_STARTED' };
    if (room.players.length >= room.options.maxPlayers) return { error: 'ROOM_FULL' };

    let player = room.players.find(p => p.id === playerId);
    if (!player) {
      player = { id: playerId, name: playerName, ws: ws, isHost: false, isReady: false };
      room.players.push(player);
    } else {
      player.ws = ws;
      player.name = playerName;
    }

    return { room };
  }

  toggleReady(roomCode, playerId) {
    if (!this.rooms) return null;
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return null;

    const player = room.players.find(p => p.id === playerId);
    if (player && !player.isHost) {
      player.isReady = !player.isReady;
    }
    return room;
  }

  startRoomMatch(roomCode, hostId) {
    if (!this.rooms) return null;
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { error: 'ROOM_NOT_FOUND' };
    if (room.hostId !== hostId) return { error: 'NOT_HOST' };
    if (room.players.length < 2) return { error: 'NOT_ENOUGH_PLAYERS' };

    const matchId = `MATCH_ROOM_${roomCode}_${Date.now()}`;
    const engine = new LudoGameEngine(matchId, room.players);
    const sequenceManager = new SequenceManager(100);

    const clientsMap = new Map();
    room.players.forEach(p => {
      clientsMap.set(p.id, p.ws);
      this.playerMatchMap.set(p.id, matchId);
    });

    const matchData = {
      matchId: matchId,
      roomCode: roomCode,
      engine: engine,
      sequenceManager: sequenceManager,
      clients: clientsMap
    };

    room.started = true;
    room.matchId = matchId;
    this.matches.set(matchId, matchData);
    return { matchData, room };
  }

  getRoom(roomCode) {
    if (!this.rooms) return null;
    return this.rooms.get(roomCode.toUpperCase());
  }

  getMatchByPlayerId(playerId) {
    const matchId = this.playerMatchMap.get(playerId);
    if (!matchId) return null;
    return this.matches.get(matchId);
  }

  getMatch(matchId) {
    return this.matches.get(matchId);
  }

  reconnectPlayer(matchId, playerId, newWs) {
    const match = this.matches.get(matchId);
    if (!match) return null;

    const player = match.engine.players.find(p => p.id === playerId);
    if (!player) return null;

    player.connected = true;
    match.clients.set(playerId, newWs);
    this.playerMatchMap.set(playerId, matchId);

    return match;
  }

  handleDisconnect(playerId) {
    const match = this.getMatchByPlayerId(playerId);
    if (!match) {
      this.waitingQueue = this.waitingQueue.filter(p => p.id !== playerId);
      return null;
    }

    const player = match.engine.players.find(p => p.id === playerId);
    if (player) {
      player.connected = false;
    }

    match.clients.delete(playerId);
    return match;
  }
}

module.exports = MatchManager;
