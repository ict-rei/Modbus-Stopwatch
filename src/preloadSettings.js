// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require("electron");

let settingsPort = null;
const listeners = new Set();

ipcRenderer.on("settingsChannel", (event) => {
  const [port] = event.ports;

  settingsPort = port;

  settingsPort.onmessage = (ev) => {
    // Only send structured-cloneable data to the page
    for (const fn of listeners) fn(ev.data);
  };

  // Safe to call; required if you use addEventListener, harmless otherwise.
  settingsPort.start?.();
});

contextBridge.exposeInMainWorld("electronAPI", {
  onConfig: (cb) => ipcRenderer.on("config", (_e, v) => cb(v)),
  saveConfig: (v) => ipcRenderer.invoke("saveConfig", v),
  connectModbus: (v) => ipcRenderer.invoke("connectModbus", v),
  getPollStatus: (cb) => ipcRenderer.on("polling", (_e, v) => cb(v)),
  getSettingsChannel: () => ipcRenderer.send("getSettingsChannel"),
  sendSettingsMessage: (data) => {
    if (!settingsPort) throw new Error("Settings port not ready yet");
    settingsPort.postMessage(data);
  },
  setOpacity: (value) => ipcRenderer.send("setOpacity", value),
});
