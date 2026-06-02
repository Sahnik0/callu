"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupPTTIPC = setupPTTIPC;
const uiohook_napi_1 = require("uiohook-napi");
function setupPTTIPC(mainWindow) {
    try {
        uiohook_napi_1.uIOhook.on("keydown", (event) => {
            // event.keycode contains the physical keyboard scan code.
            // E.g., space bar is 57, Ctrl is 29, etc.
            // Broadcast this keydown event to the renderer process
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("ptt-keydown", {
                    keycode: event.keycode,
                });
            }
        });
        uiohook_napi_1.uIOhook.on("keyup", (event) => {
            // Broadcast this keyup event to the renderer process
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("ptt-keyup", {
                    keycode: event.keycode,
                });
            }
        });
        // Start listening to global events
        uiohook_napi_1.uIOhook.start();
        console.log("✅ Global PTT hook started successfully.");
    }
    catch (error) {
        console.error("❌ Failed to start global PTT uiohook:", error);
    }
}
