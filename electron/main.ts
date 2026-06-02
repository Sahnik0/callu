import { app, BrowserWindow, ipcMain, screen, safeStorage, session, dialog, net } from "electron";
import * as path from "path";
import * as fs from "fs";
import { pathToFileURL } from "url";
import { autoUpdater } from "electron-updater";
import Store from "electron-store";
import { createTray, setTrayStatus } from "./tray";
import { setupMediaIPC } from "./ipc/media.ipc";
import { setupPTTIPC } from "./ipc/ptt.ipc";

// Function to parse .env file content
function loadEnvFile(filePath: string) {
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
  } catch (e) {
    console.error(`[Env] Failed to load env file from ${filePath}:`, e);
  }
}

// Load website's .env manually (parent folder)
loadEnvFile(path.join(__dirname, "../../../.env"));
// Load desktop's .env manually (local callu-desktop folder)
loadEnvFile(path.join(__dirname, "../../.env"));

const store = new Store();

let mainWindow: BrowserWindow | null = null;
let ringtoneWindow: BrowserWindow | null = null;
let forceQuit = false;

// Apply command line switches for background performance and WebRTC quality
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("webrtc-max-cpu-consumption-percentage", "100");
app.commandLine.appendSwitch("disable-features", "WebRtcHideLocalIpsWithMdns");
app.commandLine.appendSwitch("force-fieldtrials", "WebRTC-VP9-Dependency-Descriptor/Enabled/");

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

const getStoredSessionToken = (): string | null => {
  const value = store.get("session") as string | null;
  if (!value) return null;
  if (!safeStorage.isEncryptionAvailable()) {
    return value;
  }
  try {
    const encryptedBuffer = Buffer.from(value, "hex");
    return safeStorage.decryptString(encryptedBuffer);
  } catch (e) {
    console.error("Failed to decrypt startup session:", e);
    return null;
  }
};

async function fetchAndApplyGithubToken(sessionToken: string | null) {
  if (!sessionToken) return;
  try {
    const backendUrl = process.env.VITE_API_URL || "https://callu-production.up.railway.app";
    const response = await net.fetch(`${backendUrl}/api/auth/github-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ token: sessionToken })
    });
    if (response.ok) {
      const data = await response.json();
      if (data.ghToken) {
        autoUpdater.requestHeaders = {
          Authorization: `token ${data.ghToken}`
        };
        console.log("[AutoUpdater] Configured authorization headers using token fetched from website backend");
      }
    }
  } catch (err) {
    console.error("Failed to fetch GitHub token from backend:", err);
  }
}

function createRingtoneWindow() {
  ringtoneWindow = new BrowserWindow({
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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    frame: false,
    backgroundColor: "#000000",
    icon: app.isPackaged
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
  } else {
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
      setTrayStatus("Running in background");
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Window Controls IPC
  ipcMain.on("window-minimize", () => {
    mainWindow?.minimize();
  });

  ipcMain.on("window-maximize-toggle", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow?.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on("window-close", () => {
    mainWindow?.close(); // Triggers the 'close' event (hide to tray)
  });

  // Ringtone control IPC from renderer to RingtoneWindow
  ipcMain.on("play-ringtone", () => {
    ringtoneWindow?.webContents.executeJavaScript("window.play()");
  });

  ipcMain.on("stop-ringtone", () => {
    ringtoneWindow?.webContents.executeJavaScript("window.stop()");
  });

  // Setup other IPC modules
  setupMediaIPC(mainWindow);
  setupPTTIPC(mainWindow);

  // Secure session storage handlers
  ipcMain.handle("get-secure-session", () => {
    const encryptedHex = store.get("session") as string;
    if (!encryptedHex) return null;

    if (!safeStorage.isEncryptionAvailable()) {
      console.warn("Encryption is not available, returning plaintext");
      return encryptedHex;
    }

    try {
      const encryptedBuffer = Buffer.from(encryptedHex, "hex");
      return safeStorage.decryptString(encryptedBuffer);
    } catch (e) {
      console.error("Failed to decrypt session:", e);
      return null;
    }
  });

  ipcMain.on("set-secure-session", (event, value: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      store.set("session", value);
      return;
    }

    try {
      const encryptedBuffer = safeStorage.encryptString(value);
      store.set("session", encryptedBuffer.toString("hex"));
    } catch (e) {
      console.error("Failed to encrypt session:", e);
    }
  });

  ipcMain.on("remove-secure-session", () => {
    store.delete("session");
  });

  // Manual Check for Updates handlers
  ipcMain.on("check-for-updates", async (event, args) => {
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

    autoUpdater.checkForUpdates().catch((err) => {
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

  ipcMain.on("download-update", () => {
    autoUpdater.downloadUpdate().catch((err) => {
      mainWindow?.webContents.send("update-status", {
        status: "error",
        message: err.message || "Failed to download update."
      });
    });
  });

  ipcMain.on("install-update", () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle("get-app-version", () => {
    return app.getVersion();
  });

  // Initialize tray
  createTray(mainWindow, () => {
    forceQuit = true;
    app.quit();
  });
}

async function setupAutoUpdater() {
  if (isDev) {
    console.log("[AutoUpdater] Disabled in development mode");
    return;
  }

  autoUpdater.autoDownload = false;

  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (token) {
    autoUpdater.requestHeaders = {
      Authorization: `token ${token}`
    };
    console.log("[AutoUpdater] Configured authorization headers using GH_TOKEN");
  } else {
    // Attempt to fetch from website deployment backend using stored session token
    const storedSession = getStoredSessionToken();
    if (storedSession) {
      await fetchAndApplyGithubToken(storedSession);
    }
  }

  autoUpdater.on("checking-for-update", () => {
    console.log("[AutoUpdater] Checking for update...");
    mainWindow?.webContents.send("update-status", { status: "checking", message: "Checking for updates..." });
  });

  autoUpdater.on("update-not-available", (info) => {
    console.log(`[AutoUpdater] Update not available. Current version: ${app.getVersion()}`);
    mainWindow?.webContents.send("update-status", { status: "not-available", message: `Your app is up to date (v${app.getVersion()}).` });
  });

  autoUpdater.on("update-available", (info) => {
    console.log(`[AutoUpdater] Update available! New version: ${info.version}`);
    mainWindow?.webContents.send("update-status", { status: "available", message: `New version v${info.version} is available.`, version: info.version });
    dialog.showMessageBox({
      type: "info",
      title: "Update Available",
      message: `A new version (${info.version}) of Callu is available. Would you like to download it now?`,
      buttons: ["Yes", "Later"],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        console.log("[AutoUpdater] Starting update download...");
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on("download-progress", (progressObj) => {
    console.log(`[AutoUpdater] Downloading... ${progressObj.percent.toFixed(2)}% (${(progressObj.bytesPerSecond / 1024).toFixed(2)} KB/s)`);
    mainWindow?.webContents.send("update-status", {
      status: "downloading",
      message: `Downloading update...`,
      percent: progressObj.percent,
      bytesPerSecond: progressObj.bytesPerSecond
    });
  });

  autoUpdater.on("update-downloaded", () => {
    console.log("[AutoUpdater] Update downloaded successfully!");
    mainWindow?.webContents.send("update-status", { status: "downloaded", message: "Update downloaded. Ready to install!" });
    dialog.showMessageBox({
      type: "info",
      title: "Update Ready",
      message: "The update has been downloaded. Restart Callu to apply the update now?",
      buttons: ["Restart", "Later"],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on("error", (err) => {
    console.error("Error in auto-updater: ", err);
    let errMsg = err.message || "Error checking for updates.";
    if (errMsg.includes("404") && errMsg.includes("releases.atom")) {
      errMsg = "Update check failed (404). Please ensure the repository is public and has at least one published release on GitHub.";
    }
    mainWindow?.webContents.send("update-status", { status: "error", message: errMsg });
  });

  // Check for updates immediately, then every hour
  autoUpdater.checkForUpdatesAndNotify();
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 60 * 60 * 1000);
}

app.on("ready", () => {
  // Set AppUserModelId for Windows taskbar icon grouping support
  app.setAppUserModelId("com.callu.desktop");

  // Grant microphone, camera, and display-capture permissions automatically
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ["media", "audioCapture", "videoCapture", "notifications", "display-capture"];
    callback(allowed.includes(permission));
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    const allowed = ["media", "audioCapture", "videoCapture", "notifications", "display-capture"];
    return allowed.includes(permission);
  });

  // Redirect absolute local requests (like file:///avatars/...) to the local packaged assets or remote server
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ["file:///*"] },
    (details, callback) => {
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
            const redirectURL = pathToFileURL(localPath).href;
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
      } catch (err) {
        console.error("Error processing webRequest URL:", err);
      }
      callback({});
    }
  );

  createMainWindow();
  createRingtoneWindow();
  setupAutoUpdater();

  // Setup auto launch item settings (openAtLogin)
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
  });
});

app.on("before-quit", () => {
  forceQuit = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createMainWindow();
  } else {
    mainWindow.show();
  }
});
