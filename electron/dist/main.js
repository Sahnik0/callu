"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const url_1 = require("url");
const electron_updater_1 = require("electron-updater");
const electron_store_1 = __importDefault(require("electron-store"));
const tray_1 = require("./tray");
const media_ipc_1 = require("./ipc/media.ipc");
const ptt_ipc_1 = require("./ipc/ptt.ipc");
// Function to parse .env file content
function loadEnvFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const envContent = fs.readFileSync(filePath, "utf-8");
            for (const line of envContent.split("\n")) {
                const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
                if (match) {
                    const key = match[1];
                    let val = match[2].trim();
                    // Remove quotes if present
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.substring(1, val.length - 1);
                    }
                    process.env[key] = val;
                }
            }
            console.log(`[Env] Loaded environment from: ${filePath}`);
        }
    }
    catch (e) {
        console.error(`[Env] Failed to load env file from ${filePath}:`, e);
    }
}
// Load website's .env manually (parent folder)
loadEnvFile(path.join(__dirname, "../../../.env"));
// Load desktop's .env manually (local callu-desktop folder)
loadEnvFile(path.join(__dirname, "../../.env"));
const store = new electron_store_1.default();
let mainWindow = null;
let ringtoneWindow = null;
let forceQuit = false;
// Apply command line switches for background performance and WebRTC quality
electron_1.app.commandLine.appendSwitch("disable-renderer-backgrounding");
electron_1.app.commandLine.appendSwitch("disable-background-timer-throttling");
electron_1.app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
electron_1.app.commandLine.appendSwitch("enable-gpu-rasterization");
electron_1.app.commandLine.appendSwitch("enable-zero-copy");
electron_1.app.commandLine.appendSwitch("webrtc-max-cpu-consumption-percentage", "100");
electron_1.app.commandLine.appendSwitch("disable-features", "WebRtcHideLocalIpsWithMdns");
electron_1.app.commandLine.appendSwitch("force-fieldtrials", "WebRTC-VP9-Dependency-Descriptor/Enabled/");
const isDev = process.env.NODE_ENV === "development" || !electron_1.app.isPackaged;
const getStoredSessionToken = () => {
    const value = store.get("session");
    if (!value)
        return null;
    if (!electron_1.safeStorage.isEncryptionAvailable()) {
        return value;
    }
    try {
        const encryptedBuffer = Buffer.from(value, "hex");
        return electron_1.safeStorage.decryptString(encryptedBuffer);
    }
    catch (e) {
        console.error("Failed to decrypt startup session:", e);
        return null;
    }
};
async function fetchAndApplyGithubToken(sessionToken) {
    if (!sessionToken)
        return;
    try {
        const backendUrl = process.env.VITE_API_URL || "https://callu-production.up.railway.app";
        const response = await electron_1.net.fetch(`${backendUrl}/api/auth/github-token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ token: sessionToken })
        });
        if (response.ok) {
            const data = await response.json();
            if (data.ghToken) {
                electron_updater_1.autoUpdater.requestHeaders = {
                    Authorization: `token ${data.ghToken}`
                };
                console.log("[AutoUpdater] Configured authorization headers using token fetched from website backend");
            }
        }
    }
    catch (err) {
        console.error("Failed to fetch GitHub token from backend:", err);
    }
}
function createRingtoneWindow() {
    ringtoneWindow = new electron_1.BrowserWindow({
        show: false,
        width: 1,
        height: 1,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false,
        },
    });
    // Load a minimal HTML that exposes play/stop for ringtone using web audio
    const ringtoneHtml = `
    <!DOCTYPE html>
    <html>
    <head><title>Ringtone</title></head>
    <body>
      <audio id="ringtone" src="./assets/ringtone.ogg" loop></audio>
      <script>
        const audio = document.getElementById('ringtone');
        window.play = () => audio.play().catch(e => console.error(e));
        window.stop = () => { audio.pause(); audio.currentTime = 0; };
      </script>
    </body>
    </html>
  `;
    ringtoneWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(ringtoneHtml)}`);
}
function createMainWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 940,
        minHeight: 600,
        frame: false,
        backgroundColor: "#000000",
        icon: electron_1.app.isPackaged
            ? path.join(process.resourcesPath, "icon.png")
            : path.join(__dirname, "../../public/icon.png"),
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false, // Critical to keep WebSockets & timers alive
            webSecurity: false, // Bypasses CORS check in desktop shell
        },
        show: false,
    });
    if (isDev) {
        mainWindow.loadURL("http://localhost:5173");
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
    }
    // Forward renderer console logs to the terminal
    mainWindow.webContents.on("console-message", (event, level, message, line, sourceId) => {
        const levels = ["DEBUG", "INFO", "WARN", "ERROR"];
        const lvlName = levels[level] || `LEVEL-${level}`;
        console.log(`[Renderer Console] [${lvlName}] ${message} (at ${path.basename(sourceId)}:${line})`);
    });
    mainWindow.once("ready-to-show", () => {
        mainWindow?.show();
    });
    mainWindow.on("close", (e) => {
        if (!forceQuit) {
            e.preventDefault();
            mainWindow?.hide();
            (0, tray_1.setTrayStatus)("Running in background");
        }
    });
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
    // Window Controls IPC
    electron_1.ipcMain.on("window-minimize", () => {
        mainWindow?.minimize();
    });
    electron_1.ipcMain.on("window-maximize-toggle", () => {
        if (mainWindow?.isMaximized()) {
            mainWindow?.unmaximize();
        }
        else {
            mainWindow?.maximize();
        }
    });
    electron_1.ipcMain.on("window-close", () => {
        mainWindow?.close(); // Triggers the 'close' event (hide to tray)
    });
    // Ringtone control IPC from renderer to RingtoneWindow
    electron_1.ipcMain.on("play-ringtone", () => {
        ringtoneWindow?.webContents.executeJavaScript("window.play()");
    });
    electron_1.ipcMain.on("stop-ringtone", () => {
        ringtoneWindow?.webContents.executeJavaScript("window.stop()");
    });
    // Setup other IPC modules
    (0, media_ipc_1.setupMediaIPC)(mainWindow);
    (0, ptt_ipc_1.setupPTTIPC)(mainWindow);
    // Secure session storage handlers
    electron_1.ipcMain.handle("get-secure-session", () => {
        const encryptedHex = store.get("session");
        if (!encryptedHex)
            return null;
        if (!electron_1.safeStorage.isEncryptionAvailable()) {
            console.warn("Encryption is not available, returning plaintext");
            return encryptedHex;
        }
        try {
            const encryptedBuffer = Buffer.from(encryptedHex, "hex");
            return electron_1.safeStorage.decryptString(encryptedBuffer);
        }
        catch (e) {
            console.error("Failed to decrypt session:", e);
            return null;
        }
    });
    electron_1.ipcMain.on("set-secure-session", (event, value) => {
        if (!electron_1.safeStorage.isEncryptionAvailable()) {
            store.set("session", value);
            return;
        }
        try {
            const encryptedBuffer = electron_1.safeStorage.encryptString(value);
            store.set("session", encryptedBuffer.toString("hex"));
        }
        catch (e) {
            console.error("Failed to encrypt session:", e);
        }
    });
    electron_1.ipcMain.on("remove-secure-session", () => {
        store.delete("session");
    });
    // Manual Check for Updates handlers
    electron_1.ipcMain.on("check-for-updates", async (event, args) => {
        if (isDev) {
            mainWindow?.webContents.send("update-status", {
                status: "not-available",
                message: "Updates are disabled in development mode."
            });
            return;
        }
        const sessionToken = args?.token;
        if (sessionToken) {
            await fetchAndApplyGithubToken(sessionToken);
        }
        electron_updater_1.autoUpdater.checkForUpdates().catch((err) => {
            let errMsg = err.message || "Failed to check for updates.";
            if (errMsg.includes("404") && errMsg.includes("releases.atom")) {
                errMsg = "Update check failed (404). Please ensure the repository is public and has at least one published release on GitHub.";
            }
            mainWindow?.webContents.send("update-status", {
                status: "error",
                message: errMsg
            });
        });
    });
    electron_1.ipcMain.on("download-update", () => {
        electron_updater_1.autoUpdater.downloadUpdate().catch((err) => {
            mainWindow?.webContents.send("update-status", {
                status: "error",
                message: err.message || "Failed to download update."
            });
        });
    });
    electron_1.ipcMain.on("install-update", () => {
        electron_updater_1.autoUpdater.quitAndInstall();
    });
    electron_1.ipcMain.handle("get-app-version", () => {
        return electron_1.app.getVersion();
    });
    // Initialize tray
    (0, tray_1.createTray)(mainWindow, () => {
        forceQuit = true;
        electron_1.app.quit();
    });
}
async function setupAutoUpdater() {
    if (isDev) {
        console.log("[AutoUpdater] Disabled in development mode");
        return;
    }
    electron_updater_1.autoUpdater.autoDownload = false;
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    if (token) {
        electron_updater_1.autoUpdater.requestHeaders = {
            Authorization: `token ${token}`
        };
        console.log("[AutoUpdater] Configured authorization headers using GH_TOKEN");
    }
    else {
        // Attempt to fetch from website deployment backend using stored session token
        const storedSession = getStoredSessionToken();
        if (storedSession) {
            await fetchAndApplyGithubToken(storedSession);
        }
    }
    electron_updater_1.autoUpdater.on("checking-for-update", () => {
        console.log("[AutoUpdater] Checking for update...");
        mainWindow?.webContents.send("update-status", { status: "checking", message: "Checking for updates..." });
    });
    electron_updater_1.autoUpdater.on("update-not-available", (info) => {
        console.log(`[AutoUpdater] Update not available. Current version: ${electron_1.app.getVersion()}`);
        mainWindow?.webContents.send("update-status", { status: "not-available", message: `Your app is up to date (v${electron_1.app.getVersion()}).` });
    });
    electron_updater_1.autoUpdater.on("update-available", (info) => {
        console.log(`[AutoUpdater] Update available! New version: ${info.version}`);
        mainWindow?.webContents.send("update-status", { status: "available", message: `New version v${info.version} is available.`, version: info.version });
        electron_1.dialog.showMessageBox({
            type: "info",
            title: "Update Available",
            message: `A new version (${info.version}) of Callu is available. Would you like to download it now?`,
            buttons: ["Yes", "Later"],
            defaultId: 0,
            cancelId: 1
        }).then((result) => {
            if (result.response === 0) {
                console.log("[AutoUpdater] Starting update download...");
                electron_updater_1.autoUpdater.downloadUpdate();
            }
        });
    });
    electron_updater_1.autoUpdater.on("download-progress", (progressObj) => {
        console.log(`[AutoUpdater] Downloading... ${progressObj.percent.toFixed(2)}% (${(progressObj.bytesPerSecond / 1024).toFixed(2)} KB/s)`);
        mainWindow?.webContents.send("update-status", {
            status: "downloading",
            message: `Downloading update...`,
            percent: progressObj.percent,
            bytesPerSecond: progressObj.bytesPerSecond
        });
    });
    electron_updater_1.autoUpdater.on("update-downloaded", () => {
        console.log("[AutoUpdater] Update downloaded successfully!");
        mainWindow?.webContents.send("update-status", { status: "downloaded", message: "Update downloaded. Ready to install!" });
        electron_1.dialog.showMessageBox({
            type: "info",
            title: "Update Ready",
            message: "The update has been downloaded. Restart Callu to apply the update now?",
            buttons: ["Restart", "Later"],
            defaultId: 0,
            cancelId: 1
        }).then((result) => {
            if (result.response === 0) {
                electron_updater_1.autoUpdater.quitAndInstall();
            }
        });
    });
    electron_updater_1.autoUpdater.on("error", (err) => {
        console.error("Error in auto-updater: ", err);
        let errMsg = err.message || "Error checking for updates.";
        if (errMsg.includes("404") && errMsg.includes("releases.atom")) {
            errMsg = "Update check failed (404). Please ensure the repository is public and has at least one published release on GitHub.";
        }
        mainWindow?.webContents.send("update-status", { status: "error", message: errMsg });
    });
    // Check for updates immediately, then every hour
    electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
    setInterval(() => {
        electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
    }, 60 * 60 * 1000);
}
electron_1.app.on("ready", () => {
    // Set AppUserModelId for Windows taskbar icon grouping support
    electron_1.app.setAppUserModelId("com.callu.desktop");
    // Grant microphone, camera, and display-capture permissions automatically
    electron_1.session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowed = ["media", "audioCapture", "videoCapture", "notifications", "display-capture"];
        callback(allowed.includes(permission));
    });
    electron_1.session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
        const allowed = ["media", "audioCapture", "videoCapture", "notifications", "display-capture"];
        return allowed.includes(permission);
    });
    // Redirect absolute local requests (like file:///avatars/...) to the local packaged assets or remote server
    electron_1.session.defaultSession.webRequest.onBeforeRequest({ urls: ["file:///*"] }, (details, callback) => {
        const urlStr = details.url;
        try {
            const parsedUrl = new URL(urlStr);
            let pathname = parsedUrl.pathname;
            // On Windows, the pathname starts with "/C:" or "/D:", strip it
            if (pathname.match(/^\/[A-Za-z]:/)) {
                pathname = pathname.substring(3);
            }
            // Remove leading slash if any
            const relativePath = pathname.startsWith("/") ? pathname.substring(1) : pathname;
            const assetPrefixes = [
                "avatars/",
                "music/",
                "Lotties/",
                "Verification-Blue-Tick-PNG.webp",
                "Verification-Blue-Tick-PNG.png",
                "file.svg",
                "globe.svg",
                "next.svg",
                "vercel.svg",
                "window.svg"
            ];
            const matchesAsset = assetPrefixes.some(prefix => {
                if (prefix.endsWith("/")) {
                    return relativePath.startsWith(prefix);
                }
                return relativePath === prefix;
            });
            if (matchesAsset) {
                // Attempt to load locally first from dist directory (fast, works offline)
                const localPath = path.join(__dirname, "../../dist", relativePath);
                if (fs.existsSync(localPath)) {
                    const redirectURL = (0, url_1.pathToFileURL)(localPath).href;
                    console.log(`[Asset Redirect] Local: ${urlStr} -> ${redirectURL}`);
                    callback({ redirectURL });
                    return;
                }
                // Fallback to remote production server
                const backendUrl = process.env.VITE_API_URL || "https://callu-production.up.railway.app";
                const redirectURL = `${backendUrl}/${relativePath}`;
                console.log(`[Asset Redirect] Remote Fallback: ${urlStr} -> ${redirectURL}`);
                callback({ redirectURL });
                return;
            }
        }
        catch (err) {
            console.error("Error processing webRequest URL:", err);
        }
        callback({});
    });
    createMainWindow();
    createRingtoneWindow();
    setupAutoUpdater();
    // Setup auto launch item settings (openAtLogin)
    electron_1.app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true,
    });
});
electron_1.app.on("before-quit", () => {
    forceQuit = true;
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("activate", () => {
    if (mainWindow === null) {
        createMainWindow();
    }
    else {
        mainWindow.show();
    }
});
