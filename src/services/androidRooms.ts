import { createRoomHub, type RoomConnection } from './roomHub.ts';
import type { TransportMode } from '../types/game';

interface AndroidBridge {
  host(session: string, transport: TransportMode): void;
  join(session: string, transport: TransportMode, address: string): void;
  send(session: string, link: string, message: string): void;
  stop(session: string): void;
  exportBackup(contents: string): void;
  openDownload(): void;
}
export const androidClient = (window as Window & { MuAndroid?: AndroidBridge }).MuAndroid;

interface RadioEvent {
  session: string;
  link?: string;
  kind: 'hosting' | 'joined' | 'accepted' | 'message' | 'closed' | 'error';
  data?: string;
}

interface PeerLink {
  connection: RoomConnection;
  receive(message: string): void;
  close(): void;
}

function peerLink(send: (message: string) => void): PeerLink {
  let open = true;
  let receive = (_message: string) => {};
  let close = () => {};
  return {
    connection: {
      isOpen: () => open,
      send: message => { if (open) send(message); },
      onMessage: handler => { receive = handler; },
      onClose: handler => { close = handler; },
    },
    receive: message => { if (open) receive(message); },
    close: () => { if (open) { open = false; close(); } },
  };
}

export class AndroidRooms {
  private session: string | undefined;
  private input: ((message: string) => void) | undefined;
  private listener: ((event: Event) => void) | undefined;

  private readonly callbacks: {
    connected(connected: boolean): void;
    message(message: string): void;
    ended(message: string): void;
    status(message: string): void;
    error(message: string): void;
  };

  constructor(callbacks: AndroidRooms['callbacks']) {
    this.callbacks = callbacks;
  }

  open(transport: TransportMode, message: string, address?: string) {
    const bridge = androidClient;
    if (!bridge) return;
    this.close();
    const session = this.session = crypto.randomUUID();
    const hosting = address === undefined;
    const hub = hosting ? createRoomHub({ transport }) : undefined;
    const guests = new Map<string, PeerLink>();
    this.listener = event => {
      const { session: eventSession, kind, link, data = '' } = (event as CustomEvent<RadioEvent>).detail;
      if (eventSession !== this.session) return;
      if (kind === 'hosting') {
        const host = peerLink(raw => queueMicrotask(() => {
          if (this.session === session) this.callbacks.message(raw);
        }));
        hub?.attach(host.connection);
        this.input = host.receive;
        this.callbacks.connected(true);
        this.callbacks.status(transport === 'wifi'
          ? `Comparte la dirección ${data} y el código de sala con tus invitados.`
          : 'Comparte el código y el nombre Bluetooth de este dispositivo con tus invitados.');
        this.input(message);
      } else if (kind === 'joined' && link) {
        this.input = raw => bridge.send(session, link, raw);
        this.callbacks.connected(true);
        this.input(message);
      } else if (kind === 'accepted' && link) {
        const guest = peerLink(raw => bridge.send(session, link, raw));
        hub?.attach(guest.connection, false);
        guests.set(link, guest);
      } else if (kind === 'message' && link) {
        if (hosting) guests.get(link)?.receive(data);
        else this.callbacks.message(data);
      } else if (kind === 'closed' && hosting && link) {
        const guest = guests.get(link);
        guests.delete(link);
        guest?.close();
      } else if (kind === 'closed' || kind === 'error') {
        this.close();
        if (kind === 'error') this.callbacks.error(data);
        else this.callbacks.ended('Se cerró la conexión local.');
      }
    };
    window.addEventListener('mu-android-radio', this.listener);
    if (hosting) bridge.host(session, transport);
    else bridge.join(session, transport, address);
  }

  send(message: string) {
    this.input?.(message);
  }

  close() {
    const session = this.session;
    this.session = undefined;
    this.input = undefined;
    if (this.listener) window.removeEventListener('mu-android-radio', this.listener);
    this.listener = undefined;
    if (session) {
      androidClient?.stop(session);
      this.callbacks.connected(false);
    }
  }
}
