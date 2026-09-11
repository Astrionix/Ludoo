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
   * Enqueues player for real-time online matchmaking (2 players per match by default).
   */
  enqueuePlayer(playerId, playerName, ws) {
    // Remove if already in queue
    this.waitingQueue = this.waitingQueue.filter(p => p.id !== playerId);
    this.waitingQueue.push({ id: playerId, name: playerName, ws: ws });

    if (this.waitingQueue.length >= 2) {
      const matchPlayers = this.waitingQueue.splice(0, 2);
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
