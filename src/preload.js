// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
  openURL: (url) => ipcRenderer.invoke("openExternal", url),
  firstStart: (callback) => ipcRenderer.on("firstStart", callback),
});
