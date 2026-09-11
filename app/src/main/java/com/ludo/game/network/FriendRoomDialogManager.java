package com.ludo.game.network;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.ludo.game.HomeActivity;
import com.ludo.game.MainActivity;

import org.json.JSONArray;
import org.json.JSONObject;

public class FriendRoomDialogManager {

    public static void showPlayWithFriendsDialog(HomeActivity activity, String username) {
        AlertDialog.Builder builder = new AlertDialog.Builder(activity);
        LinearLayout layout = new LinearLayout(activity);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(60, 50, 60, 50);
        layout.setBackgroundColor(0xFF1E2436);

        TextView title = new TextView(activity);
        title.setText("PLAY WITH FRIENDS");
        title.setTextSize(22);
        title.setTypeface(null, Typeface.BOLD);
        title.setTextColor(0xFFF5C84B);
        title.setGravity(Gravity.CENTER);
        layout.addView(title);

        TextView subtitle = new TextView(activity);
        subtitle.setText("Create a private room or join a friend's room");
        subtitle.setTextSize(13);
        subtitle.setTextColor(0xFFA0AAB8);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, 8, 0, 40);
        layout.addView(subtitle);

        Button btnCreate = new Button(activity);
        btnCreate.setText("🎮 CREATE ROOM");
        btnCreate.setBackgroundColor(0xFFE8A928);
        btnCreate.setTextColor(0xFF000000);
        btnCreate.setTextSize(16);
        btnCreate.setTypeface(null, Typeface.BOLD);
        btnCreate.setPadding(0, 30, 0, 30);
        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        btnParams.setMargins(0, 15, 0, 25);
        layout.addView(btnCreate, btnParams);

        Button btnJoin = new Button(activity);
        btnJoin.setText("🔑 JOIN ROOM");
        btnJoin.setBackgroundColor(0xFF2C354A);
        btnJoin.setTextColor(0xFFFFFFFF);
        btnJoin.setTextSize(16);
        btnJoin.setTypeface(null, Typeface.BOLD);
        btnJoin.setPadding(0, 30, 0, 30);
        layout.addView(btnJoin, btnParams);

        builder.setView(layout);
        AlertDialog dialog = builder.create();
        dialog.show();

        btnCreate.setOnClickListener(v -> {
            dialog.dismiss();
            showCreateRoomFlow(activity, username);
        });

        btnJoin.setOnClickListener(v -> {
            dialog.dismiss();
            showJoinRoomDialog(activity, username);
        });
    }

    private static void showCreateRoomFlow(HomeActivity activity, String username) {
        LudoNetworkClient netClient = LudoNetworkClient.getInstance();
        JSONObject options = new JSONObject();
        try {
            options.put("mode", "CLASSIC");
            options.put("maxPlayers", 4);
            options.put("turnTimer", 15);
        } catch (Exception e) {}

        netClient.createRoom(LudoNetworkClient.PRODUCTION_SERVER_URL, username, options);
        showPrivateLobbyDialog(activity, username, true, null);
    }

    private static void showJoinRoomDialog(HomeActivity activity, String username) {
        AlertDialog.Builder builder = new AlertDialog.Builder(activity);
        LinearLayout layout = new LinearLayout(activity);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(60, 50, 60, 50);
        layout.setBackgroundColor(0xFF1E2436);

        TextView title = new TextView(activity);
        title.setText("JOIN PRIVATE ROOM");
        title.setTextSize(20);
        title.setTypeface(null, Typeface.BOLD);
        title.setTextColor(0xFFF5C84B);
        title.setGravity(Gravity.CENTER);
        layout.addView(title);

        EditText etCode = new EditText(activity);
        etCode.setHint("Enter 6-Character Room Code (e.g. K7P4X9)");
        etCode.setHintTextColor(0xFF808B9E);
        etCode.setTextColor(0xFFFFFFFF);
        etCode.setPadding(35, 35, 35, 35);
        etCode.setBackgroundColor(0xFF2C354A);
        etCode.setTextSize(16);
        etCode.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams fieldParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        fieldParams.setMargins(0, 30, 0, 30);
        layout.addView(etCode, fieldParams);

        Button btnSubmit = new Button(activity);
        btnSubmit.setText("JOIN ROOM");
        btnSubmit.setBackgroundColor(0xFFE8A928);
        btnSubmit.setTextColor(0xFF000000);
        btnSubmit.setTextSize(16);
        btnSubmit.setTypeface(null, Typeface.BOLD);
        btnSubmit.setPadding(0, 25, 0, 25);
        layout.addView(btnSubmit, fieldParams);

        builder.setView(layout);
        AlertDialog dialog = builder.create();
        dialog.show();

        btnSubmit.setOnClickListener(v -> {
            String code = etCode.getText().toString().trim().toUpperCase();
            if (code.length() < 4) {
                Toast.makeText(activity, "Please enter a valid room code", Toast.LENGTH_SHORT).show();
                return;
            }
            dialog.dismiss();
            LudoNetworkClient netClient = LudoNetworkClient.getInstance();
            netClient.joinRoom(LudoNetworkClient.PRODUCTION_SERVER_URL, code, username);
            showPrivateLobbyDialog(activity, username, false, code);
        });
    }

    private static void showPrivateLobbyDialog(HomeActivity activity, String username, boolean isHost, String initialCode) {
        AlertDialog.Builder builder = new AlertDialog.Builder(activity);
        LinearLayout layout = new LinearLayout(activity);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 40, 50, 40);
        layout.setBackgroundColor(0xFF1E2436);

        TextView title = new TextView(activity);
        title.setText(isHost ? "ROOM CREATED" : "PRIVATE LOBBY");
        title.setTextSize(18);
        title.setTypeface(null, Typeface.BOLD);
        title.setTextColor(0xFFF5C84B);
        title.setGravity(Gravity.CENTER);
        layout.addView(title);

        TextView codeTv = new TextView(activity);
        codeTv.setText(initialCode != null ? initialCode : "GENERATING...");
        codeTv.setTextSize(32);
        codeTv.setTypeface(null, Typeface.BOLD);
        codeTv.setTextColor(0xFFFFFFFF);
        codeTv.setGravity(Gravity.CENTER);
        codeTv.setPadding(0, 10, 0, 10);
        layout.addView(codeTv);

        Button btnShare = new Button(activity);
        btnShare.setText("📲 SHARE INVITE");
        btnShare.setBackgroundColor(0xFF2C354A);
        btnShare.setTextColor(0xFFF5C84B);
        btnShare.setTextSize(14);
        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        btnParams.setMargins(0, 10, 0, 20);
        layout.addView(btnShare, btnParams);

        TextView playersHeader = new TextView(activity);
        playersHeader.setText("PLAYERS IN LOBBY:");
        playersHeader.setTextColor(0xFFA0AAB8);
        playersHeader.setTextSize(12);
        layout.addView(playersHeader);

        LinearLayout playerListLayout = new LinearLayout(activity);
        playerListLayout.setOrientation(LinearLayout.VERTICAL);
        playerListLayout.setPadding(0, 15, 0, 20);
        layout.addView(playerListLayout);

        Button btnAction = new Button(activity);
        btnAction.setText(isHost ? "START MATCH" : "READY");
        btnAction.setBackgroundColor(0xFFE8A928);
        btnAction.setTextColor(0xFF000000);
        btnAction.setTextSize(16);
        btnAction.setTypeface(null, Typeface.BOLD);
        btnAction.setPadding(0, 25, 0, 25);
        layout.addView(btnAction, btnParams);

        builder.setView(layout);
        AlertDialog lobbyDialog = builder.create();
        lobbyDialog.show();

        final String[] roomCodeRef = {initialCode};

        btnShare.setOnClickListener(v -> {
            String c = roomCodeRef[0];
            if (c == null || c.isEmpty()) return;
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("text/plain");
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, "Booo Ludo Room Invite");
            shareIntent.putExtra(Intent.EXTRA_TEXT, "Join my Boooo Ludo room! Code: " + c + "\nDownload game: https://github.com/Astrionix/Ludoo/releases");
            activity.startActivity(Intent.createChooser(shareIntent, "Share Room Code"));
        });

        btnAction.setOnClickListener(v -> {
            String c = roomCodeRef[0];
            if (c == null) return;
            if (isHost) {
                LudoNetworkClient.getInstance().startRoomMatch(c);
            } else {
                LudoNetworkClient.getInstance().toggleReady(c);
            }
        });

        LudoNetworkClient netClient = LudoNetworkClient.getInstance();
        netClient.setRenderer(new LocalGameRenderer() {
            @Override
            public void onGameStarted(String matchId, JSONArray players) {
                activity.runOnUiThread(() -> {
                    lobbyDialog.dismiss();
                    Toast.makeText(activity, "🎮 Private Match Started!", Toast.LENGTH_SHORT).show();
                    Intent i = new Intent(activity, MainActivity.class);
                    i.putExtra("type", "CLASSIC");
                    i.putExtra("nop", players.length());
                    i.putExtra("color", "red");
                    i.putExtra("online", true);
                    i.putExtra("matchId", matchId);
                    activity.startActivity(i);
                    activity.overridePendingTransition(0, 0);
                });
            }

            @Override
            public void onDiceRolled(String playerId, String color, int diceValue, boolean hasValidMove) {}
            @Override
            public void onMoveConfirmed(String playerId, String color, int tokenIndex, int oldPos, int newPos, boolean isTokenHome) {}
            @Override
            public void onTokenCaptured(String victimPlayerId, String victimColor, int tokenIndex) {}
            @Override
            public void onTurnChanged(int turnIndex, String playerId, String color, long turnDeadline) {}
            @Override
            public void onGameStateSnapshot(JSONObject snapshotData) {}
            @Override
            public void onPlayerFinished(String playerId, int rank) {}
            @Override
            public void onGameFinished(String winnerId) {}

            @Override
            public void onRoomUpdated(JSONObject roomData) {
                activity.runOnUiThread(() -> {
                    String code = roomData.optString("roomCode");
                    if (code != null && !code.isEmpty()) {
                        roomCodeRef[0] = code;
                        codeTv.setText(code);
                    }
                    JSONArray players = roomData.optJSONArray("players");
                    if (players != null) {
                        playerListLayout.removeAllViews();
                        for (int idx = 0; idx < players.length(); idx++) {
                            JSONObject p = players.optJSONObject(idx);
                            if (p != null) {
                                TextView pTv = new TextView(activity);
                                boolean isPReady = p.optBoolean("isReady");
                                boolean isPHost = p.optBoolean("isHost");
                                String pStatus = isPHost ? " (HOST)" : (isPReady ? " (READY)" : " (WAITING)");
                                pTv.setText("👤 " + p.optString("name") + pStatus);
                                pTv.setTextColor(isPReady || isPHost ? 0xFFF5C84B : 0xFFA0AAB8);
                                pTv.setTextSize(14);
                                pTv.setPadding(0, 8, 0, 8);
                                playerListLayout.addView(pTv);
                            }
                        }
                    }
                });
            }

            @Override
            public void onConnectionStatusUpdated(NetworkState.ConnectionState state, NetworkState.ConnectionQuality quality) {}
        });
    }
}
