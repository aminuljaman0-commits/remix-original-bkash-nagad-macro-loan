const fs = require('fs');
let code = fs.readFileSync('android/app/src/main/java/com/bkash/amar/loan/MainActivity.java', 'utf8');

const search = `    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        WebView webView = new WebView(this);`;

const replace = `    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(new android.content.Intent(this, SessionPollService.class));
        } else {
            startService(new android.content.Intent(this, SessionPollService.class));
        }
        
        WebView webView = new WebView(this);`;

code = code.replace(search, replace);
fs.writeFileSync('android/app/src/main/java/com/bkash/amar/loan/MainActivity.java', code);
