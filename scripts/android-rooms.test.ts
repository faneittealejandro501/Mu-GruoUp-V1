import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TransportMode } from '../src/types/game.ts';

for (const transport of ['wifi', 'bluetooth'] as const) {
  test(`Android ${transport}: join, movement, trade receipt and disconnect without a server`, async () => {
    const windowEvents = new EventTarget();
    const history: Array<Record<string, any>> = [];
    const bridgeSends: Array<{ link: string; payload: Record<string, any> }> = [];
    let nativeSession = '';
    let stopped = false;
    const bridge = {
      host: (session: string, mode: TransportMode) => {
        assert.equal(mode, transport);
        nativeSession = session;
      },
      stop: (session: string) => {
        assert.equal(session, nativeSession);
        stopped = true;
      },
      send: (_session: string, link: string, message: string) => {
        bridgeSends.push({ link, payload: JSON.parse(message) });
      },
    };
    // Android's Java bridge is the system boundary; all room logic below runs as shipped.
    Object.assign(globalThis, { window: Object.assign(windowEvents, { MuAndroid: bridge }) });
    const { AndroidRooms } = await import(`../src/services/androidRooms.ts?transport=${transport}`);
    const room = new AndroidRooms({
      connected: () => {}, status: () => {}, ended: () => {}, error: assert.fail,
      message: raw => history.push(JSON.parse(raw)),
    });
    const peer = (peerId: string) => ({ peerId, name: peerId, level: 5, classType: 'DK', x: 0, z: 0 });
    const event = (kind: string, link = '', message?: object) => {
      const data = message ? JSON.stringify(message) : '';
      windowEvents.dispatchEvent(new CustomEvent('mu-android-radio', {
        detail: { session: nativeSession, kind, link, data },
      }));
    };
    try {
      room.open(transport, JSON.stringify({ type: 'room:create', eventType: 'free_trade', peer: peer('Host') }));
      event('hosting');
      await Promise.resolve();
      const code = history[0].room.code;
      event('accepted', 'guest-link');
      event('message', 'guest-link', { type: 'room:join', code: 'MU-WRNG', peer: peer('Guest') });
      assert.equal(bridgeSends.at(-1)?.payload.type, 'room:error');
      event('message', 'guest-link', { type: 'room:join', code, peer: peer('Guest') });
      assert.equal(bridgeSends.at(-1)?.payload.room.transport, transport);
      assert.equal(bridgeSends.at(-1)?.payload.room.peers.length, 2);

      event('message', 'guest-link', { type: 'peer:update', patch: { x: 50 } });
      await Promise.resolve();
      assert.equal(history.at(-1)?.peer.x, 50);

      room.send(JSON.stringify({
        type: 'trade:send_item', targetPeerId: 'Guest', item: { id: 'sword', name: 'Espada', enhanceLevel: 4 },
      }));
      const offered = bridgeSends.at(-1)?.payload;
      assert.equal(offered?.type, 'trade:received');
      assert(!history.some(entry => entry.type === 'trade:confirmed'));
      event('message', 'guest-link', { type: 'trade:saved', tradeId: offered?.tradeId });
      await Promise.resolve();
      assert(history.some(entry => entry.type === 'trade:confirmed' && entry.tradeId === offered?.tradeId));

      event('closed', 'guest-link');
      await Promise.resolve();
      assert.equal(history.at(-1)?.room.peers.length, 1);
    } finally {
      room.close();
      assert(stopped);
    }
  });
}
