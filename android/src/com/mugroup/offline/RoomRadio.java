package com.mugroup.offline;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothServerSocket;
import android.bluetooth.BluetoothSocket;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import java.io.Closeable;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ConcurrentHashMap;

final class RoomRadio {
    interface Events {
        void emit(String session, String kind, String link, String data);
    }

    private static final int PERMISSION_REQUEST = 410;
    private static final int PORT = 32183;
    private static final int MAX_FRAME = 256 * 1024;
    private static final int MAX_LINKS = 7;
    private static final UUID GAME_SERVICE = UUID.fromString("bd55e48b-7e97-4b4b-8b19-9d2943c99cad");
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Activity activity;
    private final Events events;
    private volatile Session current;
    private Session pendingPermission;
    private AlertDialog devicePicker;

    RoomRadio(Activity activity, Events events) {
        this.activity = activity;
        this.events = events;
    }

    private final class Session implements Closeable {
        final String id;
        final boolean host;
        final Map<String, Link> links = new ConcurrentHashMap<>();
        private Closeable listeningOrConnecting;
        private volatile boolean closed;
        int nextLink;

        Session(String id, boolean host) {
            this.id = id;
            this.host = host;
        }

        synchronized void track(Closeable resource) throws IOException {
            if (closed) {
                quietClose(resource);
                throw new IOException("Sesión cerrada");
            }
            listeningOrConnecting = resource;
        }

        synchronized void link(Closeable socket, InputStream input, OutputStream output) throws IOException {
            if (closed || links.size() >= MAX_LINKS) {
                quietClose(socket);
                return;
            }
            String key = Integer.toString(++nextLink);
            Link link = new Link(this, key, socket, input, output);
            links.put(key, link);
            emit(this, host ? "accepted" : "joined", key, "");
            link.start();
        }

        @Override public synchronized void close() {
            closed = true;
            quietClose(listeningOrConnecting);
            for (Link link : links.values()) link.close();
            links.clear();
        }
    }

    private final class Link implements Closeable {
        final Session session;
        final String id;
        final Closeable socket;
        final DataInputStream input;
        final DataOutputStream output;
        final ArrayBlockingQueue<byte[]> outgoing = new ArrayBlockingQueue<>(128);
        private volatile Thread writer;

        Link(Session session, String id, Closeable socket, InputStream input, OutputStream output) {
            this.session = session;
            this.id = id;
            this.socket = socket;
            this.input = new DataInputStream(input);
            this.output = new DataOutputStream(output);
        }

        void start() {
            writer = new Thread(() -> {
                try {
                    while (!Thread.currentThread().isInterrupted()) {
                        byte[] bytes = outgoing.take();
                        output.writeInt(bytes.length);
                        output.write(bytes);
                        output.flush();
                    }
                } catch (IOException | InterruptedException ignored) {
                    close();
                }
            }, "mu-radio-write");
            writer.start();
            new Thread(() -> {
                try {
                    while (true) {
                        int size = input.readInt();
                        if (size <= 0 || size > MAX_FRAME) break;
                        byte[] bytes = new byte[size];
                        input.readFully(bytes);
                        emit(session, "message", id, new String(bytes, StandardCharsets.UTF_8));
                    }
                } catch (IOException ignored) {
                    // Both abrupt disconnects and normal departures end the link.
                } finally {
                    close();
                    session.links.remove(id);
                    emit(session, "closed", id, "");
                }
            }, "mu-radio-read").start();
        }

        void send(String message) {
            byte[] bytes = message.getBytes(StandardCharsets.UTF_8);
            if (bytes.length > MAX_FRAME || !outgoing.offer(bytes)) close();
        }

        @Override public void close() {
            if (writer != null) writer.interrupt();
            quietClose(socket);
        }
    }

    void start(String id, boolean host, String transport, String address) {
        stop(null);
        Session session = new Session(id, host);
        current = session;
        if ("wifi".equals(transport)) {
            work(session, () -> {
                if (host) hostWifi(session);
                else joinWifi(session, address);
            }, host ? "Conecta el dispositivo a Wi-Fi o activa su punto de acceso." :
                "No se llegó al anfitrión. Comprueba su dirección y usa la misma red Wi-Fi.");
        } else if ("bluetooth".equals(transport)) {
            if (Build.VERSION.SDK_INT >= 31 &&
                activity.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                pendingPermission = session;
                activity.requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT}, PERMISSION_REQUEST);
            } else startBluetooth(session);
        } else emit(session, "error", "", "Transporte no disponible.");
    }

    void permissionResult(int code, int[] result) {
        if (code != PERMISSION_REQUEST) return;
        Session session = pendingPermission;
        pendingPermission = null;
        if (session == null || session != current) return;
        if (result.length > 0 && result[0] == PackageManager.PERMISSION_GRANTED) startBluetooth(session);
        else emit(session, "error", "", "Permite Dispositivos cercanos para usar Bluetooth.");
    }

    private void startBluetooth(Session session) {
        try {
            BluetoothManager manager = activity.getSystemService(BluetoothManager.class);
            BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
            if (adapter == null || !adapter.isEnabled()) {
                emit(session, "error", "", "Activa Bluetooth en los ajustes de Android.");
                return;
            }
            if (session.host) {
                work(session, () -> {
                    BluetoothServerSocket listener = adapter.listenUsingRfcommWithServiceRecord("MuGro-up", GAME_SERVICE);
                    session.track(listener);
                    emit(session, "hosting", "", "");
                    while (!session.closed) {
                        BluetoothSocket guest = listener.accept();
                        try {
                            session.link(guest, guest.getInputStream(), guest.getOutputStream());
                        } catch (IOException ignored) {
                            quietClose(guest);
                        }
                    }
                }, "No se pudo abrir la sala Bluetooth.");
                return;
            }
            ArrayList<BluetoothDevice> devices = new ArrayList<>(adapter.getBondedDevices());
            if (devices.isEmpty()) {
                emit(session, "error", "", "Vincula los dos dispositivos en los ajustes Bluetooth de Android.");
                return;
            }
            String[] names = new String[devices.size()];
            for (int i = 0; i < names.length; i++) {
                BluetoothDevice device = devices.get(i);
                String name = device.getName();
                names[i] = name == null ? device.getAddress() : name + " · " + device.getAddress();
            }
            devicePicker = new AlertDialog.Builder(activity)
                .setTitle("Elige el dispositivo anfitrión")
                .setItems(names, (dialog, index) -> {
                    devicePicker = null;
                    work(session, () -> joinBluetooth(session, devices.get(index)),
                        "No se pudo conectar por Bluetooth. Comprueba que el anfitrión tenga la sala abierta.");
                })
                .setOnCancelListener(dialog -> {
                    devicePicker = null;
                    emit(session, "error", "", "Conexión Bluetooth cancelada.");
                })
                .show();
        } catch (SecurityException denied) {
            emit(session, "error", "", "Permite Dispositivos cercanos para usar Bluetooth.");
        }
    }

    private void joinBluetooth(Session session, BluetoothDevice host) throws IOException {
        BluetoothSocket socket = host.createRfcommSocketToServiceRecord(GAME_SERVICE);
        session.track(socket);
        Runnable timeout = () -> quietClose(socket);
        main.postDelayed(timeout, 12000);
        try {
            socket.connect();
        } finally {
            main.removeCallbacks(timeout);
        }
        session.link(socket, socket.getInputStream(), socket.getOutputStream());
    }

    private void hostWifi(Session session) throws IOException {
        InetAddress address = null;
        // Android may not expose a running tethering AP as an active Wi-Fi Network.
        Network wifi = wifiNetwork();
        if (wifi != null) {
            LinkProperties properties = activity.getSystemService(ConnectivityManager.class).getLinkProperties(wifi);
            if (properties != null) {
                address = properties.getLinkAddresses().stream().map(link -> link.getAddress())
                    .filter(RoomRadio::localV4).findFirst().orElse(null);
            }
        }
        if (address == null) {
            for (NetworkInterface iface : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!iface.isUp() || !iface.getName().matches("(?i)(wlan|swlan|softap|ap|wifi).*")) continue;
                address = Collections.list(iface.getInetAddresses()).stream().filter(RoomRadio::localV4).findFirst().orElse(null);
                if (address != null) break;
            }
        }
        if (address == null) throw new IOException("Sin dirección Wi-Fi local");
        ServerSocket listener = new ServerSocket();
        session.track(listener);
        listener.setReuseAddress(true);
        listener.bind(new InetSocketAddress(address, PORT));
        emit(session, "hosting", "", address.getHostAddress());
        while (!session.closed) {
            Socket guest = listener.accept();
            try {
                guest.setTcpNoDelay(true);
                session.link(guest, guest.getInputStream(), guest.getOutputStream());
            } catch (IOException ignored) {
                quietClose(guest);
            }
        }
    }

    private void joinWifi(Session session, String host) throws IOException {
        if (!host.matches("(?:[0-9]{1,3}\\.){3}[0-9]{1,3}")) throw new IOException("Dirección inválida");
        InetAddress address = InetAddress.getByName(host);
        if (!localV4(address)) throw new IOException("Dirección fuera de la red local");
        Network wifi = wifiNetwork();
        Socket socket = wifi == null ? new Socket() : wifi.getSocketFactory().createSocket();
        session.track(socket);
        socket.connect(new InetSocketAddress(address, PORT), 5500);
        socket.setTcpNoDelay(true);
        session.link(socket, socket.getInputStream(), socket.getOutputStream());
    }

    private Network wifiNetwork() {
        ConnectivityManager connectivity = activity.getSystemService(ConnectivityManager.class);
        if (connectivity == null) return null;
        for (Network network : connectivity.getAllNetworks()) {
            NetworkCapabilities capabilities = connectivity.getNetworkCapabilities(network);
            if (capabilities != null && capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
                && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)) return network;
        }
        return null;
    }

    private static boolean localV4(InetAddress address) {
        return address instanceof Inet4Address && (address.isSiteLocalAddress() || address.isLinkLocalAddress());
    }

    void send(String id, String linkId, String message) {
        Session session = current;
        if (session == null || !session.id.equals(id)) return;
        Link link = session.links.get(linkId);
        if (link != null) link.send(message);
    }

    void stop(String id) {
        Session session = current;
        if (session == null || (id != null && !session.id.equals(id))) return;
        current = null;
        if (pendingPermission == session) pendingPermission = null;
        if (devicePicker != null) {
            devicePicker.dismiss();
            devicePicker = null;
        }
        session.close();
    }

    private void emit(Session session, String kind, String link, String data) {
        main.post(() -> {
            if (current == session) events.emit(session.id, kind, link, data);
        });
    }

    private interface IoWork { void run() throws IOException; }

    private void work(Session session, IoWork work, String failure) {
        new Thread(() -> {
            try {
                work.run();
            } catch (IOException | RuntimeException err) {
                session.close();
                emit(session, "error", "", failure);
            }
        }, "mu-radio").start();
    }

    private static void quietClose(Closeable resource) {
        try {
            if (resource != null) resource.close();
        } catch (IOException ignored) {
        }
    }
}
