package com.ludo.game.network;

public class NetworkState {
    public enum ConnectionState {
        CONNECTED,
        WEAK,
        DISCONNECTED,
        RECONNECTING,
        SYNCING,
        PLAYING
    }

    public enum ConnectionQuality {
        EXCELLENT,
        GOOD,
        WEAK,
        CRITICAL,
        OFFLINE
    }
}
