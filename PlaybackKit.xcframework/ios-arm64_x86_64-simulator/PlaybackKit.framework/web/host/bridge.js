// The seam to the host app. One channel each way, same message shape on every platform:
//
//   web → native   a JSON object with a `type`, delivered by the transport below
//   native → web   `window.PLAYBACK_DATA` / `window.PLAYBACK_ENV` before first paint,
//                  then the `window.Playback` API (see host/api.js)
//
// The page cannot tell which host it runs in. Only this file knows.

/** @returns {{send: (msg: object) => void, kind: string}} */
export function createBridge(env = {}) {
  const wk = globalThis.webkit?.messageHandlers?.playback;
  if (wk) {
    // iOS WKWebView: structured clone of a plain object.
    return { kind: 'ios', send: (msg) => wk.postMessage(msg) };
  }
  const android = globalThis.PlaybackNative;
  if (android && typeof android.postMessage === 'function') {
    // Android WebView: addJavascriptInterface only speaks strings.
    return { kind: 'android', send: (msg) => android.postMessage(JSON.stringify(msg)) };
  }
  // Browser: tell whoever framed us (the rig shell), and keep an inspectable log.
  const log = (globalThis.__playbackMessages = globalThis.__playbackMessages || []);
  return {
    kind: 'browser',
    send(msg) {
      log.push(msg);
      if (env.log) console.info('[playback]', JSON.stringify(msg));
      if (globalThis.parent && globalThis.parent !== globalThis) {
        globalThis.parent.postMessage({ source: 'playback', message: msg }, '*');
      }
    },
  };
}
