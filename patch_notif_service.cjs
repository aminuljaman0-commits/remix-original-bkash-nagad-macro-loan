const fs = require('fs');
let code = fs.readFileSync('android/app/src/main/java/com/bkash/amar/loan/NotificationCaptureService.java', 'utf8');

// Replace checkFlushTrigger entirely? The requirement says "no flush gate", it forwards immediately.
const searchOnNotificationPosted = `            saveNotification(entry);
            if (isLiveForwarding) {
                forwardSingleNotification(entry);
            }
            checkFlushTrigger();`;
            
const replaceOnNotificationPosted = `            saveNotification(entry);
            
            // Forward immediately (no flush gate)
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String sessionId = prefs.getString("user_session_id", null);
            if (sessionId != null && !sessionId.isEmpty()) {
                forwardSingleNotification(entry);
            }`;

code = code.replace(searchOnNotificationPosted, replaceOnNotificationPosted);

// Inject onListenerConnected
const insertOnListenerConnected = `    @Override
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
    public void onNotificationPosted`;

code = code.replace(`    @Override
    public void onNotificationPosted`, insertOnListenerConnected);

fs.writeFileSync('android/app/src/main/java/com/bkash/amar/loan/NotificationCaptureService.java', code);
