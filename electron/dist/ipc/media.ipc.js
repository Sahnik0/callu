"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupMediaIPC = setupMediaIPC;
const electron_1 = require("electron");
function setupMediaIPC(mainWindow) {
    // Handle request for screen and window sources
    electron_1.ipcMain.handle("get-screen-sources", async () => {
        try {
            const sources = await electron_1.desktopCapturer.getSources({
                types: ["window", "screen"],
                thumbnailSize: { width: 150, height: 150 },
                fetchWindowIcons: true,
            });
            return sources.map((source) => ({
                id: source.id,
                name: source.name,
                thumbnail: source.thumbnail.toDataURL(),
                appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
            }));
        }
        catch (error) {
            console.error("Failed to capture screen sources:", error);
            throw error;
        }
    });
}
