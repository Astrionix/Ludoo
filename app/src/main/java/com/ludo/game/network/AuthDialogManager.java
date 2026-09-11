package com.ludo.game.network;

import android.app.AlertDialog;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class AuthDialogManager {
    public static final String AUTH_SERVER_URL = "https://ludoo-d085.onrender.com";
    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");
    private static final OkHttpClient httpClient = new OkHttpClient();
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    public interface AuthCallback {
        void onSuccess(String username, String email, String userId);
    }

    public static void showAuthDialog(Context context, AuthCallback callback) {
        AlertDialog.Builder builder = new AlertDialog.Builder(context);
        LinearLayout layout = new LinearLayout(context);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 40, 50, 30);

        TextView title = new TextView(context);
        title.setText("LUDO ONLINE ACCOUNT");
        title.setTextSize(20);
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        title.setTextColor(0xFFF5C84B); // Gold
        title.setGravity(android.view.Gravity.CENTER);
        layout.addView(title);

        LinearLayout tabLayout = new LinearLayout(context);
        tabLayout.setOrientation(LinearLayout.HORIZONTAL);
        tabLayout.setPadding(0, 20, 0, 20);

        Button tabLogin = new Button(context);
        tabLogin.setText("LOG IN");
        Button tabSignup = new Button(context);
        tabSignup.setText("SIGN UP");

        tabLayout.addView(tabLogin, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f));
        tabLayout.addView(tabSignup, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f));
        layout.addView(tabLayout);

        EditText etName = new EditText(context);
        etName.setHint("Full Name");
        etName.setVisibility(View.GONE);
        layout.addView(etName);

        EditText etEmail = new EditText(context);
        etEmail.setHint("Email Address (e.g. player@gmail.com)");
        etEmail.setInputType(android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        layout.addView(etEmail);

        EditText etPassword = new EditText(context);
        etPassword.setHint("Password");
        etPassword.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
        layout.addView(etPassword);

        TextView tvStatus = new TextView(context);
        tvStatus.setPadding(0, 15, 0, 15);
        tvStatus.setGravity(android.view.Gravity.CENTER);
        layout.addView(tvStatus);

        Button btnSubmit = new Button(context);
        btnSubmit.setText("LOG IN");
        btnSubmit.setBackgroundColor(0xFFE8A928);
        btnSubmit.setTextColor(0xFF000000);
        layout.addView(btnSubmit);

        final boolean[] isSignupMode = {false};

        tabLogin.setOnClickListener(v -> {
            isSignupMode[0] = false;
            etName.setVisibility(View.GONE);
            btnSubmit.setText("LOG IN");
            tvStatus.setText("");
        });

        tabSignup.setOnClickListener(v -> {
            isSignupMode[0] = true;
            etName.setVisibility(View.VISIBLE);
            btnSubmit.setText("CREATE ACCOUNT");
            tvStatus.setText("");
        });

        builder.setView(layout);
        AlertDialog dialog = builder.create();
        dialog.show();

        btnSubmit.setOnClickListener(v -> {
            String email = etEmail.getText().toString().trim();
            String password = etPassword.getText().toString().trim();
            String name = etName.getText().toString().trim();

            if (email.isEmpty() || password.isEmpty() || (isSignupMode[0] && name.isEmpty())) {
                tvStatus.setText("Please fill all required fields.");
                tvStatus.setTextColor(0xFFE3132B);
                return;
            }

            tvStatus.setText("Authenticating...");
            tvStatus.setTextColor(0xFFF5C84B);

            new Thread(() -> {
                try {
                    JSONObject reqObj = new JSONObject();
                    reqObj.put("email", email);
                    reqObj.put("password", password);
                    if (isSignupMode[0]) {
                        reqObj.put("name", name);
                    }

                    String endpoint = isSignupMode[0] ? "/api/auth/signup" : "/api/auth/login";
                    RequestBody body = RequestBody.create(reqObj.toString(), JSON);
                    Request request = new Request.Builder()
                            .url(AUTH_SERVER_URL + endpoint)
                            .post(body)
                            .build();

                    Response response = httpClient.newCall(request).execute();
                    String respStr = response.body() != null ? response.body().string() : "";
                    JSONObject respObj = new JSONObject(respStr);

                    mainHandler.post(() -> {
                        if (respObj.optBoolean("success")) {
                            JSONObject profile = respObj.optJSONObject("profile");
                            JSONObject user = respObj.optJSONObject("user");
                            String finalName = name;
                            if (profile != null && profile.has("username")) {
                                finalName = profile.optString("username");
                            }
                            String userId = user != null ? user.optString("id") : "USER_" + System.currentTimeMillis();

                            // Store credentials locally in SharedPreferences
                            SharedPreferences sp = context.getSharedPreferences("LudoUserAuth", Context.MODE_PRIVATE);
                            sp.edit()
                                    .putBoolean("isLoggedIn", true)
                                    .putString("username", finalName)
                                    .putString("email", email)
                                    .putString("userId", userId)
                                    .apply();

                            Toast.makeText(context, "Welcome " + finalName + "!", Toast.LENGTH_SHORT).show();
                            dialog.dismiss();
                            if (callback != null) {
                                callback.onSuccess(finalName, email, userId);
                            }
                        } else {
                            String err = respObj.optString("error", "Authentication failed.");
                            tvStatus.setText(err);
                            tvStatus.setTextColor(0xFFE3132B);
                        }
                    });
                } catch (Exception e) {
                    mainHandler.post(() -> {
                        tvStatus.setText("Error: " + e.getMessage());
                        tvStatus.setTextColor(0xFFE3132B);
                    });
                }
            }).start();
        });
    }
}
