#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
sdk=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
: "${sdk:?Configura ANDROID_HOME con el SDK Android.}"
tools="$sdk/build-tools/35.0.0"
platform="$sdk/platforms/android-35/android.jar"
out="${1:-build/android/MuGro-up-Android.apk}"
[[ -f dist/offline-files.json && -f "$platform" && -x "$tools/apksigner" ]] || {
  echo "Ejecuta bun run build e instala platforms;android-35 y build-tools;35.0.0." >&2
  exit 1
}
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT
mkdir -p "$staging"/{assets/client,classes,dex,res/drawable,generated}
package_options=()
channel=release
if [[ -z "${MU_ANDROID_KEYSTORE:-}" ]]; then
  package_options=(--rename-manifest-package com.mugroup.offline.preview)
  channel=preview
fi
cp public/pwa-192x192.png "$staging/res/drawable/mugroup.png"
node --input-type=module - "$staging" <<'NODE'
import { copyFileSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

const staging = process.argv[2];
const dist = resolve('dist');
const destination = join(staging, 'assets/client');
const manifest = JSON.parse(readFileSync(join(dist, 'ota-manifest.json'), 'utf8'));
const files = JSON.parse(readFileSync(join(dist, 'offline-files.json'), 'utf8'));
for (const [file] of files) {
  if (/^(registerSW\.js|sw\.js|workbox-.*\.js|offline-files\.json)$/.test(file)) continue;
  if (!resolve(dist, file).startsWith(dist + sep)) throw new Error(`Invalid asset: ${file}`);
  const to = join(destination, file);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(join(dist, file), to);
}
mkdirSync(join(destination, 'mugroup/licencias'), { recursive: true });
const html = join(destination, 'index.html');
writeFileSync(html, readFileSync(html, 'utf8')
  .replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/g, ''));
const parts = manifest.version.match(/^(\d+)\.(\d{1,2})\.(\d{1,2})$/);
if (!parts) throw new Error('Use a numeric Android version: major.minor.patch');
const versionCode = Number(parts[1]) * 10000 + Number(parts[2]) * 100 + Number(parts[3]);
const pagesUrl = new URL(manifest.pagesUrl);
if (pagesUrl.protocol !== 'https:') throw new Error('Pages URL must use HTTPS');
writeFileSync(join(staging, 'version'), `${manifest.version} ${versionCode}\n`);
writeFileSync(join(staging, 'generated/BuildInfo.java'),
  `package com.mugroup.offline; final class BuildInfo { static final String DOWNLOAD_PAGE = ${JSON.stringify(pagesUrl.href)}; }\n`);
NODE
cp -R public/mugroup/licencias/. "$staging/assets/client/mugroup/licencias/"
read -r version version_code < "$staging/version"

"$tools/aapt2" compile --dir "$staging/res" -o "$staging/resources.zip"
"$tools/aapt2" link -I "$platform" --manifest android/AndroidManifest.xml \
  --version-name "$version" --version-code "$version_code" "${package_options[@]}" -A "$staging/assets" \
  -o "$staging/base.apk" "$staging/resources.zip"
mapfile -t java_sources < <(find android/src "$staging/generated" -name '*.java' -print)
javac --release 8 -classpath "$platform" -d "$staging/classes" "${java_sources[@]}"
mapfile -t classes < <(find "$staging/classes" -name '*.class' -print)
"$tools/d8" --min-api 26 --lib "$platform" --output "$staging/dex" "${classes[@]}"
zip -q -j "$staging/base.apk" "$staging/dex/classes.dex"
"$tools/zipalign" -f 4 "$staging/base.apk" "$staging/aligned.apk"

mkdir -p "$(dirname "$out")"
if [[ -n "${MU_ANDROID_KEYSTORE:-}" ]]; then
  : "${MU_ANDROID_KEY_ALIAS:?Configura MU_ANDROID_KEY_ALIAS.}"
  : "${MU_ANDROID_STORE_PASSWORD:?Configura MU_ANDROID_STORE_PASSWORD.}"
  : "${MU_ANDROID_KEY_PASSWORD:?Configura MU_ANDROID_KEY_PASSWORD.}"
  "$tools/apksigner" sign --ks "$MU_ANDROID_KEYSTORE" --ks-key-alias "$MU_ANDROID_KEY_ALIAS" \
    --ks-pass env:MU_ANDROID_STORE_PASSWORD --key-pass env:MU_ANDROID_KEY_PASSWORD \
    --out "$staging/signed.apk" "$staging/aligned.apk"
else
  debug_key="${MU_ANDROID_DEBUG_KEYSTORE:-$HOME/.android/mugroup-debug.jks}"
  mkdir -p "$(dirname "$debug_key")"
  if [[ ! -f "$debug_key" ]]; then
    (umask 077; keytool -genkeypair -noprompt -keystore "$debug_key" -storepass android \
      -keypass android -alias androiddebugkey -dname 'CN=MuGro-up Test' -keyalg RSA -keysize 2048 -validity 3650)
  fi
  "$tools/apksigner" sign --ks "$debug_key" --ks-key-alias androiddebugkey \
    --ks-pass pass:android --key-pass pass:android --out "$staging/signed.apk" "$staging/aligned.apk"
fi
"$tools/apksigner" verify --min-sdk-version 26 "$staging/signed.apk"
chmod 0644 "$staging/signed.apk"
mv "$staging/signed.apk" "$out"
if [[ "$out" == dist/MuGro-up-Android.apk ]]; then
  printf '{"file":"MuGro-up-Android.apk","version":"%s","channel":"%s"}\n' "$version" "$channel" > dist/android-download.json
  chmod 0644 dist/android-download.json
fi
printf 'APK listo: %s\n' "$out"
