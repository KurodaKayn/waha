function attach(manager, session, logger) {
  if (process.env.WAHA_GOWS_QR_AUTO_RESTART !== 'true' || session.engine !== 'GOWS') {
    return;
  }

  let timer = null;
  function clearTimer() {
    clearTimeout(timer);
    timer = null;
  }

  session.getEventObservable('session.status').subscribe({
    next: function onStatus(update) {
      clearTimer();
      if (update.status !== 'FAILED' || update.data?.reason?.event !== 'qr.timeout') {
        return;
      }
      timer = setTimeout(function renewQR() {
        timer = null;
        manager.withLock(session.name, async function restartExpiredPairing() {
          if (manager.sessions[session.name] !== session ||
              session.status !== 'FAILED' ||
              session.statusData?.reason?.event !== 'qr.timeout') {
            return;
          }
          logger.info('Renewing expired QR pairing session');
          await manager.stop(session.name, true);
          await manager.start(session.name);
        }).catch(function onRestartError(error) {
          logger.error({ err: error }, 'Unable to renew QR pairing session');
        });
      }, 1000);
    },
    complete: clearTimer,
    error: clearTimer,
  });
}

module.exports = { attach: attach };
