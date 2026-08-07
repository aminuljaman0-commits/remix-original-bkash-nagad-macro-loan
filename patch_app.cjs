const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const search = `const hasNotifs = val && (val.notificationCount > 0 || (val.notifications && val.notifications.length > 0));`;
const replace = `const hasNotifs = val && val.lastSeen && typeof val.lastSeen === 'string' && val.lastSeen.length > 0;`;

if (code.includes(search)) {
    code = code.replace(search, replace);
    fs.writeFileSync('App.tsx', code);
    console.log('Patched checkApprovalLoop');
} else {
    console.log('Search string not found');
}
