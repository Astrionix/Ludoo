package com.ludo.game.network;

import org.json.JSONArray;
import org.json.JSONObject;

public interface LocalGameRenderer {
    void onGameStarted(String matchId, JSONArray players);
    void onDiceRolled(String playerId, String color, int diceValue, boolean hasValidMove);
    void onMoveConfirmed(String playerId, String color, int tokenIndex, int oldPos, int newPos, boolean isTokenHome);
    void onTokenCaptured(String victimPlayerId, String victimColor, int tokenIndex);
    void onTurnChanged(int turnIndex, String playerId, String color, long turnDeadline);
    void onGameStateSnapshot(JSONObject snapshotData);
    void onPlayerFinished(String playerId, int rank);
    void onGameFinished(String winnerId);
    void onRoomUpdated(JSONObject roomData);
    void onConnectionStatusUpdated(NetworkState.ConnectionState state, NetworkState.ConnectionQuality quality);
}
