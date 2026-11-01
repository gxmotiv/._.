const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const cfgPath = path.join(root, 'capacitor.config.json');
if (!fs.existsSync(cfgPath)) {
  console.error('[patch-native] capacitor.config.json not found');
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const appId = cfg.appId;
if (!appId) {
  console.error('[patch-native] appId missing from capacitor.config.json');
  process.exit(1);
}
const pkgPath = appId.split('.').join('/');

const androidMain = path.join(root, 'android', 'app', 'src', 'main');
if (!fs.existsSync(androidMain)) {
  console.error('[patch-native] android/ not generated yet.');
  process.exit(1);
}

const javaDir = path.join(androidMain, 'java', pkgPath);
fs.mkdirSync(javaDir, { recursive: true });

const nativeDir = path.join(root, 'native');

function install(tplName, destName) {
  const src = path.join(nativeDir, tplName);
  const dest = path.join(javaDir, destName);
  if (!fs.existsSync(src)) {
    console.error('[patch-native] missing template:', src);
    process.exit(1);
  }
  const text = fs.readFileSync(src, 'utf8').replace(/__APP_PACKAGE__/g, appId);
  fs.writeFileSync(dest, text, 'utf8');
  console.log('[patch-native] wrote', path.relative(root, dest));
}

install('SafExportPlugin.java.txt', 'SafExportPlugin.java');
install('RobloxLauncherPlugin.java.txt', 'RobloxLauncherPlugin.java');
install('MainActivity.java.txt', 'MainActivity.java');

const ktMain = path.join(javaDir, 'MainActivity.kt');
if (fs.existsSync(ktMain)) {
  fs.unlinkSync(ktMain);
  console.log('[patch-native] removed generated MainActivity.kt');
}

const manifest = path.join(androidMain, 'AndroidManifest.xml');
if (!fs.existsSync(manifest)) {
  console.error('[patch-native] AndroidManifest.xml not found');
  process.exit(1);
}
let xml = fs.readFileSync(manifest, 'utf8');
if (xml.includes('com.roblox.client')) {
  console.log('[patch-native] Roblox <queries> already present - skipping.');
} else {
  const queriesBlock =
    '\n    <queries>\n' +
    '        <package android:name="com.roblox.client" />\n' +
    '        <intent>\n' +
    '            <action android:name="android.intent.action.VIEW" />\n' +
    '            <data android:scheme="roblox" />\n' +
    '        </intent>\n' +
    '    </queries>\n';
  const at = xml.indexOf('<application');
  if (at === -1) {
    console.error('[patch-native] <application> tag not found in manifest');
    process.exit(1);
  }
  xml = xml.slice(0, at) + queriesBlock + '    ' + xml.slice(at);
  if (!xml.includes('xmlns:android=')) {
    xml = xml.replace('<manifest', '<manifest xmlns:android="http://schemas.android.com/apk/res/android"');
  }
  fs.writeFileSync(manifest, xml, 'utf8');
  console.log('[patch-native] injected Roblox <queries> into AndroidManifest.xml');
}

console.log('[patch-native] done.');
