import { ipcMain, desktopCapturer, BrowserWindow } from "electron";

export function setupMediaIPC(mainWindow: BrowserWindow | null) {
  // Handle request for screen and window sources
  ipcMain.handle("get-screen-sources", async () => {
    try {
      const sources = await desktopCapturer.getSources({
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
    } catch (error) {
      console.error("Failed to capture screen sources:", error);
      throw error;
    }
  });
}
