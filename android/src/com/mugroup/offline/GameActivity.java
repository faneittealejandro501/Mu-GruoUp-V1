package com.mugroup.offline;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.FileNotFoundException;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class GameActivity extends Activity {
    private static final String HOST = "apk.mugroup.invalid";
    private static final String ENTRY = "https://" + HOST + "/index.html";
    private static final String CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; " +
        "worker-src 'self' blob:; connect-src 'self' https: blob: data:; frame-src 'none'; " +
        "object-src 'none'; base-uri 'none'; form-action 'none'";
    private static final Pattern RANGE = Pattern.compile("bytes=(\\d+)-(\\d*)");
    private static final int IMPORT = 401;
    private static final int EXPORT = 402;
    private WebView web;
    private RoomRadio radio;
    private ValueCallback<Uri[]> fileResult;
    private String exportContents;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(12, 16, 24));
        setContentView(web);
        radio = new RoomRadio(this, this::sendRadioEvent);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        web.addJavascriptInterface(new Bridge(), "MuAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Keep the Java bridge away from all other documents.
                return !ENTRY.equals(request.getUrl().toString()) || !request.isForMainFrame();
            }

            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"https".equals(uri.getScheme()) || !HOST.equals(uri.getEncodedAuthority())) {
                    if (request.isForMainFrame()) return missing();
                    return null;
                }
                String path = uri.getPath();
                if (path == null || !path.startsWith("/") || path.contains("\\") ||
                    java.util.Arrays.stream(path.split("/")).anyMatch(part -> part.equals("..") || part.equals("."))) return missing();
                if (request.isForMainFrame() && !"/index.html".equals(path)) return missing();
                try {
                    InputStream asset = getAssets().open("client" + path);
                    String type = mime(path);
                    String charset = type.startsWith("text/") || type.equals("application/json") ||
                        type.equals("application/javascript") ? "UTF-8" : null;
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Content-Security-Policy", CSP);
                    headers.put("X-Content-Type-Options", "nosniff");
                    if (type.startsWith("audio/")) {
                        int length = asset.available();
                        headers.put("Accept-Ranges", "bytes");
                        headers.put("Content-Length", Integer.toString(length));
                        String range = request.getRequestHeaders().entrySet().stream()
                            .filter(entry -> entry.getKey().equalsIgnoreCase("Range"))
                            .map(Map.Entry::getValue).findFirst().orElse("");
                        Matcher segment = RANGE.matcher(range);
                        if (segment.matches()) {
                            try {
                                long start = Long.parseLong(segment.group(1));
                                long end = segment.group(2).isEmpty() ? length - 1L :
                                    Math.min(length - 1L, Long.parseLong(segment.group(2)));
                                if (start <= end) {
                                    if (asset.skip(start) != start) throw new IOException("Asset range unavailable");
                                    int count = (int)(end - start + 1);
                                    headers.put("Content-Range", "bytes " + start + "-" + end + "/" + length);
                                    headers.put("Content-Length", Integer.toString(count));
                                    return new WebResourceResponse(type, charset, 206, "Partial Content", headers, limited(asset, count));
                                }
                            } catch (IOException | NumberFormatException ignored) { }
                            asset.close();
                            headers.put("Content-Range", "bytes */" + length);
                            headers.put("Content-Length", "0");
                            return new WebResourceResponse(type, charset, 416, "Range Not Satisfiable", headers,
                                new ByteArrayInputStream(new byte[0]));
                        }
                    }
                    return new WebResourceResponse(type, charset, 200, "OK", headers, asset);
                } catch (java.io.IOException ignored) {
                    return missing();
                }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> result, FileChooserParams params) {
                if (fileResult != null) fileResult.onReceiveValue(null);
                fileResult = result;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("*/*");
                try {
                    startActivityForResult(intent, IMPORT);
                } catch (ActivityNotFoundException err) {
                    fileResult = null;
                    result.onReceiveValue(null);
                }
                return true;
            }
        });
        web.loadUrl(ENTRY);
    }

    private static InputStream limited(InputStream input, int count) {
        return new FilterInputStream(input) {
            private int remaining = count;
            @Override public int read() throws IOException {
                if (remaining <= 0) return -1;
                int value = in.read();
                if (value >= 0) remaining--;
                return value;
            }

            @Override public int read(byte[] bytes, int offset, int length) throws IOException {
                if (length == 0) return 0;
                if (remaining <= 0) return -1;
                int read = in.read(bytes, offset, Math.min(length, remaining));
                if (read > 0) remaining -= read;
                return read;
            }
        };
    }

    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
            java.util.Collections.singletonMap("Content-Security-Policy", CSP),
            new ByteArrayInputStream(new byte[0]));
    }

    private static String mime(String path) {
        String extension = path.substring(path.lastIndexOf('.') + 1);
        switch (extension) {
            case "js": return "application/javascript";
            case "json": return "application/json";
            case "wasm": return "application/wasm";
            case "glb": return "model/gltf-binary";
            case "ogg": return "audio/ogg";
            case "wav": return "audio/wav";
            case "webp": return "image/webp";
            case "svg": return "image/svg+xml";
            default:
                String type = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
                return type == null ? "application/octet-stream" : type;
        }
    }

    private void sendRadioEvent(String session, String kind, String link, String data) {
        if (web == null) return;
        try {
            String json = new JSONObject().put("session", session).put("kind", kind)
                .put("link", link).put("data", data).toString();
            String encoded = Base64.encodeToString(json.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
            web.evaluateJavascript("window.dispatchEvent(new CustomEvent('mu-android-radio',{detail:" +
                "JSON.parse(new TextDecoder().decode(Uint8Array.from(atob('" + encoded + "'),c=>c.charCodeAt(0))))}))", null);
        } catch (JSONException ignored) { }
    }

    private final class Bridge {
        @JavascriptInterface public void host(String session, String transport) {
            runOnUiThread(() -> { if (web != null) radio.start(session, true, transport, ""); });
        }

        @JavascriptInterface public void join(String session, String transport, String address) {
            runOnUiThread(() -> { if (web != null) radio.start(session, false, transport, address); });
        }

        @JavascriptInterface public void send(String session, String link, String message) {
            radio.send(session, link, message);
        }

        @JavascriptInterface public void stop(String session) {
            runOnUiThread(() -> radio.stop(session));
        }

        @JavascriptInterface public void exportBackup(String contents) {
            runOnUiThread(() -> {
                if (web == null || exportContents != null) return;
                exportContents = contents;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("application/json").putExtra(Intent.EXTRA_TITLE, "mugroup-partida.json");
                try {
                    startActivityForResult(intent, EXPORT);
                } catch (ActivityNotFoundException err) {
                    exportContents = null;
                    Toast.makeText(GameActivity.this, "No se encontró un gestor de archivos.", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface public void openDownload() {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(BuildInfo.DOWNLOAD_PAGE))
                        .addCategory(Intent.CATEGORY_BROWSABLE));
                } catch (ActivityNotFoundException ignored) { }
            });
        }
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(code, permissions, grants);
        radio.permissionResult(code, grants);
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == IMPORT && fileResult != null) {
            ValueCallback<Uri[]> callback = fileResult;
            fileResult = null;
            callback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
        } else if (request == EXPORT) {
            String contents = exportContents;
            exportContents = null;
            if (contents == null || result != RESULT_OK || data == null || data.getData() == null) return;
            Uri uri = data.getData();
            new Thread(() -> {
                String message;
                try (OutputStream output = getContentResolver().openOutputStream(uri)) {
                    if (output == null) throw new FileNotFoundException();
                    output.write(contents.getBytes(StandardCharsets.UTF_8));
                    message = "Partida exportada.";
                } catch (java.io.IOException err) {
                    message = "No se pudo exportar la partida.";
                }
                String status = message;
                runOnUiThread(() -> Toast.makeText(this, status, Toast.LENGTH_SHORT).show());
            }, "mu-export").start();
        }
    }

    @Override protected void onDestroy() {
        radio.stop(null);
        if (fileResult != null) fileResult.onReceiveValue(null);
        web.removeJavascriptInterface("MuAndroid");
        web.destroy();
        web = null;
        super.onDestroy();
    }
}
