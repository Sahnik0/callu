"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
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
electron_1.contextBridge.exposeInMainWorld("electron", {
    send: (channel, data) => {
        if (ALLOWED_CHANNELS.includes(channel)) {
            electron_1.ipcRenderer.send(channel, data);
        }
        else {
            console.warn(`Denied unauthorized IPC send on channel: ${channel}`);
        }
    },
    on: (channel, callback) => {
        if (ALLOWED_CHANNELS.includes(channel)) {
            const subscription = (_event, ...args) => callback(...args);
            electron_1.ipcRenderer.on(channel, subscription);
            return () => {
                electron_1.ipcRenderer.removeListener(channel, subscription);
            };
        }
        else {
            console.warn(`Denied unauthorized IPC listener on channel: ${channel}`);
            return () => { };
        }
    },
    invoke: async (channel, data) => {
        if (ALLOWED_CHANNELS.includes(channel)) {
            return await electron_1.ipcRenderer.invoke(channel, data);
        }
        else {
            console.warn(`Denied unauthorized IPC invoke on channel: ${channel}`);
            throw new Error(`Unauthorized IPC channel: ${channel}`);
        }
    },
});
