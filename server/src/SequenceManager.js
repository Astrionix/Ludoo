/**
 * SequenceManager.js
 * Manages monotonically increasing sequence numbers and event history buffers per match.
 * Facilitates delta event recovery for client reconnection or fallback to snapshot synchronization.
 */

class SequenceManager {
  constructor(initialSequence = 100, maxBufferSize = 500) {
    this.currentSeq = initialSequence;
    this.maxBufferSize = maxBufferSize;
    this.eventBuffer = []; // { seq, type, payload, timestamp }
  }

  /**
   * Assigns next monotonically increasing sequence number to event and records it in history buffer.
   */
  recordEvent(type, payload) {
    this.currentSeq++;
    const event = {
      seq: this.currentSeq,
      type: type,
      payload: payload,
      timestamp: Date.now()
    };

    this.eventBuffer.push(event);

    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer.shift(); // Evict oldest event when buffer exceeds max limit
    }

    return event;
  }

  /**
   * Retrieves events missed by client since lastReceivedSequence.
   * Returns:
   *  - Array of missed events if lastReceivedSequence is within buffer range.
   *  - null if lastReceivedSequence is too far behind (requires GAME_STATE_SNAPSHOT fallback).
   */
  getEventsSince(lastReceivedSeq) {
    if (lastReceivedSeq >= this.currentSeq) {
      return []; // Client is fully up to date
    }

    if (this.eventBuffer.length === 0) {
      return null;
    }

    const oldestAvailableSeq = this.eventBuffer[0].seq;
    if (lastReceivedSeq < oldestAvailableSeq - 1) {
      // Delta buffer exceeded; client must rely on SNAPSHOT fallback
      return null;
    }

    return this.eventBuffer.filter(event => event.seq > lastReceivedSeq);
  }

  /**
   * Builds an authoritative state snapshot message when delta buffer cannot bridge client gap.
   */
  createSnapshot(gameState) {
    return {
      type: 'GAME_STATE_SNAPSHOT',
      seq: this.currentSeq,
      timestamp: Date.now(),
      payload: {
        currentSeq: this.currentSeq,
        turnIndex: gameState.turnIndex,
        currentPlayerId: gameState.players[gameState.turnIndex].id,
        currentColor: gameState.players[gameState.turnIndex].color,
        diceState: gameState.diceState,
        turnDeadline: gameState.turnDeadline,
        matchStatus: gameState.matchStatus,
        players: gameState.players.map(p => ({
          id: p.id,
          name: p.name,
          color: p.color,
          connected: p.connected,
          finished: p.finished,
          tokens: p.tokens // positions [0..57]
        }))
      }
    };
  }
}

module.exports = SequenceManager;
