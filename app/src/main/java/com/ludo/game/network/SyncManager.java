package com.ludo.game.network;

import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

public class SyncManager {
    private static final String TAG = "SyncManager";

    private final ConnectionManager connectionManager;
    private final SequenceManager sequenceManager;
    private LocalGameRenderer renderer;

    public SyncManager(ConnectionManager connectionManager, SequenceManager sequenceManager) {
        this.connectionManager = connectionManager;
        this.sequenceManager = sequenceManager;
    }

    public void setRenderer(LocalGameRenderer renderer) {
        this.renderer = renderer;
    }

    public void handleIncomingMessage(String jsonText) {
        try {
            JSONObject obj = new JSONObject(jsonText);
            String type = obj.optString("type");

            if ("ROOM_UPDATED".equals(type) || "ROOM_CREATED".equals(type)) {
                if (renderer != null) {
                    renderer.onRoomUpdated(obj);
                }
                return;
            }

            if ("DELTA_SYNC".equals(type)) {
                JSONArray events = obj.optJSONArray("events");
                if (events != null) {
                    for (int i = 0; i < events.length(); i++) {
                        JSONObject evt = events.getJSONObject(i);
                        processSingleEvent(evt);
                    }
                }
                connectionManager.updateState(NetworkState.ConnectionState.PLAYING, NetworkState.ConnectionQuality.GOOD);
                return;
            }

            if ("GAME_STATE_SNAPSHOT".equals(type)) {
                long seq = obj.optLong("seq", sequenceManager.getLastReceivedSequence());
                sequenceManager.reset(seq);

                JSONObject payload = obj.optJSONObject("payload");
                if (renderer != null && payload != null) {
                    renderer.onGameStateSnapshot(payload);
                }
                connectionManager.updateState(NetworkState.ConnectionState.PLAYING, NetworkState.ConnectionQuality.GOOD);
                return;
            }

            // Normal sequenced event handling
            sequenceManager.processIncomingEvent(obj, this::processSingleEvent);

        } catch (Exception e) {
            Log.e(TAG, "Error handling message: " + e.getMessage());
        }
    }

    private void processSingleEvent(JSONObject obj) {
        long seq = obj.optLong("seq", -1);
        if (seq > 0) {
            // Acknowledge event sequence to server
            JSONObject ack = sequenceManager.createAckPayload(seq);
            connectionManager.send(ack.toString());
        }

        String type = obj.optString("type");
        JSONObject payload = obj.optJSONObject("payload");
        if (payload == null) payload = new JSONObject();

        if (renderer == null) return;

        switch (type) {
            case "GAME_STARTED":
                renderer.onGameStarted(
                        payload.optString("matchId"),
                        payload.optJSONArray("players")
                );
                connectionManager.updateState(NetworkState.ConnectionState.PLAYING, NetworkState.ConnectionQuality.EXCELLENT);
                break;

            case "DICE_ROLLED":
                renderer.onDiceRolled(
                        payload.optString("playerId"),
                        payload.optString("color"),
                        payload.optInt("diceValue"),
                        payload.optBoolean("hasValidMove")
                );
                break;

            case "MOVE_CONFIRMED":
                renderer.onMoveConfirmed(
                        payload.optString("playerId"),
                        payload.optString("color"),
                        payload.optInt("tokenIndex"),
                        payload.optInt("oldPos"),
                        payload.optInt("newPos"),
                        payload.optBoolean("isTokenHome")
                );
                break;

            case "TOKEN_CAPTURED":
                renderer.onTokenCaptured(
                        payload.optString("victimPlayerId"),
                        payload.optString("victimColor"),
                        payload.optInt("tokenIndex")
                );
                break;

            case "TURN_CHANGED":
                renderer.onTurnChanged(
                        payload.optInt("turnIndex"),
                        payload.optString("playerId"),
                        payload.optString("color"),
                        payload.optLong("turnDeadline")
                );
                break;

            case "PLAYER_FINISHED":
                renderer.onPlayerFinished(
                        payload.optString("playerId"),
                        payload.optInt("rank")
                );
                break;

            case "GAME_FINISHED":
                renderer.onGameFinished(payload.optString("winnerId"));
                break;

            default:
                Log.d(TAG, "Unhandled event type: " + type);
                break;
        }
    }
}
