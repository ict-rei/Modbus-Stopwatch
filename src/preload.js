// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require("electron");

let settingsPort = null;
const listeners = new Set();

ipcRenderer.on("settingsChannel", (event) => {
  const [port] = event.ports;

  // Debug here (in preload): this should be real.
  console.log("preload received ports:", event.ports?.length);
  console.log("preload port postMessage:", typeof port?.postMessage);

  settingsPort = port;

  settingsPort.onmessage = (ev) => {
    // Only send structured-cloneable data to the page
    for (const fn of listeners) fn(ev.data);
  };

  // Safe to call; required if you use addEventListener, harmless otherwise.
  settingsPort.start?.();
});

contextBridge.exposeInMainWorld("electronAPI", {
  openURL: (url) => ipcRenderer.invoke("openExternal", url),
  onTick: (cb) => ipcRenderer.on("tick", (_e, v) => cb(v)),
  onStop: (cb) => ipcRenderer.on("stop", (_e, v) => cb(v)),
  onFullscreenChanged: (cb) =>
    ipcRenderer.on("fullscreen-changed", (_e, v) => cb(v)),
  onConfig: (cb) => ipcRenderer.on("config", (_e, v) => cb(v)),
  /*   saveConfig: (v) => ipcRenderer.invoke("saveConfig", v), */
  openSettings: () => ipcRenderer.invoke("openSettings"),
  /*   connectModbus: (v) => ipcRenderer.invoke("connectModbus", v), */
  /*   getStatus: (cb) => ipcRenderer.on("status", (_e, v) => cb(v)), */
  onSettingsMessage: (cb) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
});
