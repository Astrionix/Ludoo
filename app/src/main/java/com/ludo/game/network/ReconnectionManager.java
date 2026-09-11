package com.ludo.game.network;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONObject;

public class ReconnectionManager {
    private static final String TAG = "ReconnectionManager";
    private static final int INITIAL_BACKOFF_MS = 1000;
    private static final int MAX_BACKOFF_MS = 16000;

    private final ConnectionManager connectionManager;
    private final SequenceManager sequenceManager;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private String serverUrl;
    private String matchId;
    private String playerId;
    private boolean isReconnecting = false;
    private int currentBackoff = INITIAL_BACKOFF_MS;

    public ReconnectionManager(ConnectionManager connectionManager, SequenceManager sequenceManager) {
        this.connectionManager = connectionManager;
        this.sequenceManager = sequenceManager;
    }

    public void configureSession(String serverUrl, String matchId, String playerId) {
        this.serverUrl = serverUrl;
        this.matchId = matchId;
        this.playerId = playerId;
    }

    public void onDisconnected() {
        if (matchId == null || playerId == null || isReconnecting) return;
        isReconnecting = true;
        currentBackoff = INITIAL_BACKOFF_MS;
        scheduleReconnect();
    }

    private void scheduleReconnect() {
        connectionManager.updateState(NetworkState.ConnectionState.RECONNECTING, NetworkState.ConnectionQuality.WEAK);
        handler.postDelayed(() -> {
            Log.d(TAG, "Attempting automatic reconnection (Backoff: " + currentBackoff + "ms)");
            connectionManager.connect(serverUrl);
        }, currentBackoff);

        currentBackoff = Math.min(currentBackoff * 2, MAX_BACKOFF_MS);
    }

    public void onConnected() {
        if (isReconnecting) {
            isReconnecting = false;
            currentBackoff = INITIAL_BACKOFF_MS;
            connectionManager.updateState(NetworkState.ConnectionState.SYNCING, NetworkState.ConnectionQuality.GOOD);
            sendReconnectPayload();
        }
    }

    public void sendReconnectPayload() {
        try {
            JSONObject payload = new JSONObject();
            payload.put("type", "RECONNECT_REQUEST");
            payload.put("playerId", playerId);

            JSONObject data = new JSONObject();
            data.put("matchId", matchId);
            data.put("lastReceivedSequence", sequenceManager.getLastReceivedSequence());

            payload.put("payload", data);
            connectionManager.send(payload.toString());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
