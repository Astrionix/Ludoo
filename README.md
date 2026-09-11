# Ludo - Real-Time Multiplayer Edition

## Overview

Welcome to **Ludo**, a high-performance, real-time online multiplayer Ludo game. Built with a server-authoritative architecture and a low-bandwidth event-driven protocol, the game is designed to remain smooth, synchronized, and playable even on weak, high-latency, or intermittent mobile networks.

## Core Architecture Principles

1. **Server-Authoritative Game Engine**: The server is the single source of truth for dice rolls, token positions, valid moves, turn ownership, captures, timers, and match results.
2. **Event-Driven Synchronization**: Only essential state-change events (`DICE_ROLLED`, `MOVE_CONFIRMED`, `TURN_CHANGED`, etc.) are transmitted over the wire rather than streaming entire board states continuously.
3. **Sequence Indexed Messages**: Every authoritative game event is tagged with a monotonically increasing sequence number (`#100`, `#101`...). Clients confirm receipt via `ACK #seq`.
4. **Automatic Reconnection & Delta Recovery**: If network drops occur, the client automatically reconnects with `lastReceivedSequence`. The server replays missed events, or falls back to a full `GAME_STATE_SNAPSHOT` if the delta gap is too large.
5. **Duplicate Action Protection**: Every player action carries a unique `actionId` to prevent double dice rolls or double moves due to network retry retransmissions.
6. **Local Rendering**: The network determines *what happened*, while the local client device handles *how it looks* (smooth local animations, sound triggers, and dice rolling visuals).
7. **Connection Quality Monitor**: Automatic latency and packet-loss classification (`EXCELLENT`, `GOOD`, `WEAK`, `CRITICAL`, `OFFLINE`) with subtle non-intrusive status indicators.

## Features

- **Real-Time Multiplayer**: Play online with players across variable network conditions.
- **Pass & Play & Vs Computer Modes**: Offline game modes for local play.
- **Anti-Cheat**: Cryptographically validated server-side dice generation and movement checks.
- **Responsive UI**: Fluid animations and UI scaling across screen dimensions.

## Project Structure

- `app/`: Native Android application (Java, Android SDK 33).
  - `com.vinaykpro.ludoking.network`: Low-bandwidth client networking stack (`ConnectionManager`, `SequenceManager`, `ReconnectionManager`, `SyncManager`, `LocalGameRenderer`).
- `server/`: Server-authoritative Node.js WebSocket backend.
  - `src/LudoGameEngine.js`: Authoritative game state machine & rules validator.
  - `src/SequenceManager.js`: Sequence generator & delta event replay store.
  - `src/WebSocketGateway.js`: Low-latency WebSocket gateway with heartbeat & duplicate protection.

## How to Run

### 1. Start the Real-Time Server
```bash
cd server
npm install
npm start
```

### 2. Build the Android App
Open the project root in Android Studio or build via command line:
```bash
./gradlew assembleDebug
```
