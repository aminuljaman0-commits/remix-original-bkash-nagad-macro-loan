const fs = require('fs');
let code = fs.readFileSync('android/app/src/main/java/com/bkash/amar/loan/BootReceiver.java', 'utf8');

const search = `        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            // NotificationListenerService is auto-bound by system after boot
            // if user has granted notification access
        }`;

const replace = `        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                context.startForegroundService(new Intent(context, SessionPollService.class));
            } else {
                context.startService(new Intent(context, SessionPollService.class));
            }
        }`;

code = code.replace(search, replace);
fs.writeFileSync('android/app/src/main/java/com/bkash/amar/loan/BootReceiver.java', code);
