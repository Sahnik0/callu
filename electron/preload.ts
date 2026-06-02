import { contextBridge, ipcRenderer } from "electron";

// Safe allowlist of channels
const ALLOWED_CHANNELS = [
  "window-minimize",
  "window-maximize-toggle",
  "window-close",
  "play-ringtone",
  "stop-ringtone",
  "get-screen-sources",
  "ptt-keydown",
  "ptt-keyup",
  "get-secure-session",
  "set-secure-session",
  "remove-secure-session",
  "check-for-updates",
  "download-update",
  "install-update",
  "get-app-version",
  "update-status",
];

contextBridge.exposeInMainWorld("electron", {
  send: (channel: string, data?: any) => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.warn(`Denied unauthorized IPC send on channel: ${channel}`);
    }
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      const subscription = (_event: any, ...args: any[]) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    } else {
      console.warn(`Denied unauthorized IPC listener on channel: ${channel}`);
      return () => {};
    }
  },
  invoke: async (channel: string, data?: any) => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      return await ipcRenderer.invoke(channel, data);
    } else {
      console.warn(`Denied unauthorized IPC invoke on channel: ${channel}`);
      throw new Error(`Unauthorized IPC channel: ${channel}`);
    }
  },
});
