package com.ludo.game.network;

import android.util.Log;

import org.json.JSONObject;

import java.util.UUID;

public class LudoNetworkClient implements ConnectionManager.NetworkStateListener {
    private static final String TAG = "LudoNetworkClient";
    public static final String DEFAULT_DEV_SERVER_URL = "ws://192.168.29.16:3000";
    public static final String PRODUCTION_SERVER_URL = "wss://ludoo-d085.onrender.com";

    private static LudoNetworkClient instance;

    private final ConnectionManager connectionManager;
    private final SequenceManager sequenceManager;
    private final ReconnectionManager reconnectionManager;
    private final SyncManager syncManager;

    private String playerId;
    private String playerName;
    private String matchId;

    private LudoNetworkClient() {
        this.connectionManager = new ConnectionManager();
        this.sequenceManager = new SequenceManager();
        this.reconnectionManager = new ReconnectionManager(connectionManager, sequenceManager);
        this.syncManager = new SyncManager(connectionManager, sequenceManager);

        this.connectionManager.setListener(this);
        this.playerId = "PLAYER_" + UUID.randomUUID().toString().substring(0, 8);
    }

    public static synchronized LudoNetworkClient getInstance() {
        if (instance == null) {
            instance = new LudoNetworkClient();
        }
        return instance;
    }

    public void setRenderer(LocalGameRenderer renderer) {
        this.syncManager.setRenderer(renderer);
    }

    public void connectAndJoinMatchmaking(String playerName) {
        connectAndJoinMatchmaking(PRODUCTION_SERVER_URL, playerName);
    }

    public void connectAndJoinMatchmaking(String serverUrl, String playerName) {
        this.playerName = playerName;
        String targetUrl = (serverUrl != null && !serverUrl.isEmpty()) ? serverUrl : PRODUCTION_SERVER_URL;
        this.reconnectionManager.configureSession(targetUrl, matchId, playerId);
        this.connectionManager.connect(targetUrl);
    }

    public void requestRollDice() {
        try {
            JSONObject req = new JSONObject();
            req.put("type", "ROLL_REQUEST");
            req.put("playerId", playerId);
            req.put("actionId", "ACT_ROLL_" + UUID.randomUUID().toString().substring(0, 8));
            connectionManager.send(req.toString());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void requestMoveToken(int tokenIndex) {
        try {
            JSONObject req = new JSONObject();
            req.put("type", "MOVE_REQUEST");
            req.put("playerId", playerId);
            req.put("actionId", "ACT_MOVE_" + UUID.randomUUID().toString().substring(0, 8));

            JSONObject payload = new JSONObject();
            payload.put("tokenIndex", tokenIndex);
            req.put("payload", payload);

            connectionManager.send(req.toString());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onConnectionStateChanged(NetworkState.ConnectionState state, NetworkState.ConnectionQuality quality) {
        Log.d(TAG, "Connection state changed: " + state + " Quality: " + quality);
        if (state == NetworkState.ConnectionState.CONNECTED && matchId == null) {
            // Join matchmaking upon fresh connection
            try {
                JSONObject join = new JSONObject();
                join.put("type", "JOIN_MATCHMAKING");
                join.put("playerId", playerId);
                JSONObject p = new JSONObject();
                p.put("name", playerName != null ? playerName : "Player");
                join.put("payload", p);
                connectionManager.send(join.toString());
            } catch (Exception e) {
                e.printStackTrace();
            }
        } else if (state == NetworkState.ConnectionState.CONNECTED && matchId != null) {
            reconnectionManager.onConnected();
        } else if (state == NetworkState.ConnectionState.DISCONNECTED) {
            reconnectionManager.onDisconnected();
        }
    }

    @Override
    public void onMessageReceived(String text) {
        syncManager.handleIncomingMessage(text);
    }

    public String getPlayerId() {
        return playerId;
    }

    public void setMatchId(String matchId) {
        this.matchId = matchId;
        this.reconnectionManager.configureSession(null, matchId, playerId);
    }

    public NetworkState.ConnectionState getConnectionState() {
        return connectionManager.getConnectionState();
    }

    public NetworkState.ConnectionQuality getConnectionQuality() {
        return connectionManager.getConnectionQuality();
    }
}
