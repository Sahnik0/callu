import { ipcMain, BrowserWindow } from "electron";
import { uIOhook } from "uiohook-napi";

export function setupPTTIPC(mainWindow: BrowserWindow | null) {
  try {
    uIOhook.on("keydown", (event) => {
      // event.keycode contains the physical keyboard scan code.
      // E.g., space bar is 57, Ctrl is 29, etc.
      // Broadcast this keydown event to the renderer process
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("ptt-keydown", {
          keycode: event.keycode,
        });
      }
    });

    uIOhook.on("keyup", (event) => {
      // Broadcast this keyup event to the renderer process
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("ptt-keyup", {
          keycode: event.keycode,
        });
      }
    });

    // Start listening to global events
    uIOhook.start();
    console.log("✅ Global PTT hook started successfully.");
  } catch (error) {
    console.error("❌ Failed to start global PTT uiohook:", error);
  }
}
