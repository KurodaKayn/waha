const assert = require('node:assert/strict');
const test = require('node:test');
const { setImmediate: nextTurn } = require('node:timers/promises');
const { attach } = require('./qr-timeout-recovery.cjs');

function setup(t) {
  const previous = process.env.WAHA_GOWS_QR_AUTO_RESTART;
  process.env.WAHA_GOWS_QR_AUTO_RESTART = 'true';
  t.after(function restoreEnvironment() {
    if (previous === undefined) delete process.env.WAHA_GOWS_QR_AUTO_RESTART;
    else process.env.WAHA_GOWS_QR_AUTO_RESTART = previous;
  });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let observer;
  const calls = [];
  const session = {
    name: 'pairing', engine: 'GOWS', status: 'SCAN_QR_CODE', statusData: null,
    getEventObservable: function getEventObservable(event) {
      assert.equal(event, 'session.status');
      return { subscribe: function subscribe(value) { observer = value; } };
    },
  };
  const manager = {
    sessions: { pairing: session },
    withLock: async function withLock(name, action) { await action(); },
    stop: async function stop(name) { calls.push('stop'); emit('STOPPED'); },
    start: async function start(name) { calls.push('start'); },
  };
  function emit(status, event) {
    session.status = status;
    session.statusData = { reason: { event: event } };
    observer.next({ status: status, data: session.statusData });
  }
  attach(manager, session, { info: function info() {}, error: function error() {} });
  return { manager: manager, session: session, calls: calls, emit: emit };
}

test('renews pairing after the engine reports QR timeout', async function (t) {
  const state = setup(t);
  state.emit('FAILED', 'qr.timeout');
  t.mock.timers.tick(1000);
  await nextTurn();
  assert.deepEqual(state.calls, ['stop', 'start']);
});

test('does not retry authentication rejection', async function (t) {
  const state = setup(t);
  state.emit('FAILED', 'LoggedOut');
  t.mock.timers.tick(5000);
  await nextTurn();
  assert.deepEqual(state.calls, []);
});

test('manual stop cancels pending renewal', async function (t) {
  const state = setup(t);
  state.emit('FAILED', 'qr.timeout');
  state.emit('STOPPED');
  t.mock.timers.tick(5000);
  await nextTurn();
  assert.deepEqual(state.calls, []);
});

test('does not restart a replaced session', async function (t) {
  const state = setup(t);
  state.emit('FAILED', 'qr.timeout');
  state.manager.sessions.pairing = { status: 'WORKING' };
  t.mock.timers.tick(1000);
  await nextTurn();
  assert.deepEqual(state.calls, []);
});

test('checks session state again after acquiring the lock', async function (t) {
  const state = setup(t);
  let queued;
  state.manager.withLock = async function withLock(name, action) { queued = action; };
  state.emit('FAILED', 'qr.timeout');
  t.mock.timers.tick(1000);
  state.emit('WORKING');
  await queued();
  assert.deepEqual(state.calls, []);
});
