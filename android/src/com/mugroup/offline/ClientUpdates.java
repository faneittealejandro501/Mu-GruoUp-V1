package com.mugroup.offline;

import android.content.Context;
import org.json.JSONObject;
import java.io.*;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.zip.*;

// Only the web client in the published package is mounted. Native code is never loaded.
final class ClientUpdates {
    private final Context context;
    private final File dir;
    private final int bundled;
    private int current;
    private volatile String state = "";
    private ZipFile active;
    ClientUpdates(Context ctx) {
        context = ctx.getApplicationContext();
        dir = new File(ctx.getFilesDir(), "web-updates");
        dir.mkdirs();
        int installed = 0;
        try { installed = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(),0).versionCode; }
        catch (Exception ignored) {}
        current = bundled = installed;
        File[] files = dir.listFiles();
        if (files != null) for (File f : files) {
            if (!f.getName().matches("[0-9]+[.]zip")) continue;
            int version = Integer.parseInt(f.getName().split("[.]")[0]);
            if (version <= bundled) { f.delete(); continue; }
            if (version > current) try { activate(f,version); } catch (IOException ignored) {}
        }
        if (files != null) for (File f : files) {
            if (f.getName().matches("[0-9]+[.]zip") && !f.getName().equals(current + ".zip")) f.delete();
        }
    }
    synchronized void close() {
        if (active != null) try { active.close(); } catch (IOException ignored) {}
    }
    private synchronized void activate(File file, int version) throws IOException {
        ZipFile next = new ZipFile(file);
        if (next.getEntry("assets/client/index.html") == null) { next.close(); throw new IOException(); }
        if (active != null) active.close();
        active = next;
        current = version;
    }
    synchronized InputStream open(String path) throws IOException {
        if (active == null) return context.getAssets().open("client" + path);
        ZipEntry entry = active.getEntry("assets/client" + path);
        if (entry == null) throw new FileNotFoundException();
        return active.getInputStream(entry);
    }
    private static InputStream remote(String file) throws IOException {
        HttpsURLConnection c = (HttpsURLConnection)new URL(BuildInfo.DOWNLOAD_PAGE + file).openConnection();
        c.setInstanceFollowRedirects(false);
        c.setConnectTimeout(10000); c.setReadTimeout(30000); c.setUseCaches(false);
        if (c.getResponseCode() != 200) { c.disconnect(); throw new IOException(); }
        return c.getInputStream();
    }
    String status() { return state; }
    synchronized void check() {
        if (!state.isEmpty()) return;
        state = "checking";
        new Thread(() -> {
            File part = null;
            try {
                ByteArrayOutputStream meta = new ByteArrayOutputStream();
                byte[] buf = new byte[65536];
                try (InputStream in = remote("android-download.json")) {
                    int n; while ((n=in.read(buf))!=-1) { if (meta.size()+n>8192) throw new IOException(); meta.write(buf,0,n); }
                }
                JSONObject m = new JSONObject(meta.toString("UTF-8"));
                String v = m.getString("version");
                if (m.optInt("webFormat") != 1 || !v.matches("[0-9]{1,4}\\.[0-9]{1,2}\\.[0-9]{1,2}")) return;
                String[] p=v.split("\\.");
                int number=Integer.parseInt(p[0])*10000+Integer.parseInt(p[1])*100+Integer.parseInt(p[2]);
                if (number<=current) return;
                state="downloading";
                part=File.createTempFile("client-", ".part", dir);
                MessageDigest digest=MessageDigest.getInstance("SHA-256");
                try(InputStream in=remote("MuGro-up-Android.apk"); OutputStream out=new FileOutputStream(part)) {
                    long total=0; int n;
                    while ((n=in.read(buf))!=-1) {
                        if ((total+=n)>1024L*1024*1024) throw new IOException();
                        out.write(buf,0,n); digest.update(buf,0,n);
                    }
                }
                StringBuilder hash=new StringBuilder();
                for (byte b:digest.digest()) hash.append(String.format(Locale.ROOT,"%02x",b));
                if (!hash.toString().equals(m.getString("sha256"))) return;
                try (ZipFile z=new ZipFile(part)) { if(z.getEntry("assets/client/index.html")==null) return; }
                if (!part.renameTo(new File(dir,number+".zip"))) throw new IOException();
                state="ready";
            } catch(Exception ignored) { /* Retry on the next online check. */ }
            finally { if(part!=null) part.delete(); if (!state.equals("ready")) state=""; }
        },"mu-web-update").start();
    }
}
