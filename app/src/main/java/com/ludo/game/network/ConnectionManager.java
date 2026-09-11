package com.ludo.game.network;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONObject;

import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class ConnectionManager {
    private static final String TAG = "ConnectionManager";

    private final OkHttpClient client;
    private WebSocket webSocket;
    private NetworkState.ConnectionState connectionState = NetworkState.ConnectionState.DISCONNECTED;
    private NetworkState.ConnectionQuality connectionQuality = NetworkState.ConnectionQuality.OFFLINE;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private NetworkStateListener listener;

    private long lastPingTime = 0;
    private long rttLatencyMs = 0;
    private int consecutiveFailedHeartbeats = 0;
    private final Handler heartbeatHandler = new Handler(Looper.getMainLooper());
    private Runnable heartbeatRunnable;

    public interface NetworkStateListener {
        void onConnectionStateChanged(NetworkState.ConnectionState state, NetworkState.ConnectionQuality quality);
        void onMessageReceived(String text);
    }

    public ConnectionManager() {
        this.client = new OkHttpClient.Builder()
                .readTimeout(10, TimeUnit.SECONDS)
                .writeTimeout(10, TimeUnit.SECONDS)
                .pingInterval(8, TimeUnit.SECONDS)
                .build();
    }

    public void setListener(NetworkStateListener listener) {
        this.listener = listener;
    }

    public void connect(String serverUrl) {
        updateState(NetworkState.ConnectionState.RECONNECTING, NetworkState.ConnectionQuality.WEAK);
        Request request = new Request.Builder().url(serverUrl).build();

        webSocket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket ws, Response response) {
                Log.d(TAG, "WebSocket Connection Opened");
                consecutiveFailedHeartbeats = 0;
                updateState(NetworkState.ConnectionState.CONNECTED, NetworkState.ConnectionQuality.EXCELLENT);
                startHeartbeat();
            }

            @Override
            public void onMessage(WebSocket ws, String text) {
                try {
                    JSONObject obj = new JSONObject(text);
                    if ("PONG".equals(obj.optString("type"))) {
                        long now = System.currentTimeMillis();
                        rttLatencyMs = now - lastPingTime;
                        consecutiveFailedHeartbeats = 0;
                        evaluateQuality();
                        return;
                    }
                } catch (Exception ignored) {}

                if (listener != null) {
                    mainHandler.post(() -> listener.onMessageReceived(text));
                }
            }

            @Override
            public void onClosed(WebSocket ws, int code, String reason) {
                Log.d(TAG, "WebSocket Closed: " + reason);
                stopHeartbeat();
                updateState(NetworkState.ConnectionState.DISCONNECTED, NetworkState.ConnectionQuality.OFFLINE);
            }

            @Override
            public void onFailure(WebSocket ws, Throwable t, Response response) {
                Log.e(TAG, "WebSocket Failure: " + t.getMessage());
                stopHeartbeat();
                consecutiveFailedHeartbeats++;
                evaluateQuality();
                updateState(NetworkState.ConnectionState.DISCONNECTED, NetworkState.ConnectionQuality.OFFLINE);
            }
        });
    }

    public void send(String payload) {
        if (webSocket != null && connectionState != NetworkState.ConnectionState.DISCONNECTED) {
            webSocket.send(payload);
        }
    }

    public void disconnect() {
        stopHeartbeat();
        if (webSocket != null) {
            webSocket.close(1000, "User disconnected");
            webSocket = null;
        }
        updateState(NetworkState.ConnectionState.DISCONNECTED, NetworkState.ConnectionQuality.OFFLINE);
    }

    private void startHeartbeat() {
        stopHeartbeat();
        heartbeatRunnable = new Runnable() {
            @Override
            public void run() {
                if (webSocket != null && connectionState != NetworkState.ConnectionState.DISCONNECTED) {
                    lastPingTime = System.currentTimeMillis();
                    try {
                        JSONObject ping = new JSONObject();
                        ping.put("type", "PING");
                        webSocket.send(ping.toString());
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                    heartbeatHandler.postDelayed(this, 5000);
                }
            }
        };
        heartbeatHandler.postDelayed(heartbeatRunnable, 5000);
    }

    private void stopHeartbeat() {
        if (heartbeatRunnable != null) {
            heartbeatHandler.removeCallbacks(heartbeatRunnable);
            heartbeatRunnable = null;
        }
    }

    private void evaluateQuality() {
        if (consecutiveFailedHeartbeats > 2) {
            connectionQuality = NetworkState.ConnectionQuality.CRITICAL;
        } else if (rttLatencyMs > 400) {
            connectionQuality = NetworkState.ConnectionQuality.WEAK;
        } else if (rttLatencyMs > 150) {
            connectionQuality = NetworkState.ConnectionQuality.GOOD;
        } else {
            connectionQuality = NetworkState.ConnectionQuality.EXCELLENT;
        }

        if (listener != null) {
            mainHandler.post(() -> listener.onConnectionStateChanged(connectionState, connectionQuality));
        }
    }

    public void updateState(NetworkState.ConnectionState state, NetworkState.ConnectionQuality quality) {
        this.connectionState = state;
        this.connectionQuality = quality;
        if (listener != null) {
            mainHandler.post(() -> listener.onConnectionStateChanged(connectionState, connectionQuality));
        }
    }

    public NetworkState.ConnectionState getConnectionState() {
        return connectionState;
    }

    public NetworkState.ConnectionQuality getConnectionQuality() {
        return connectionQuality;
    }
}
