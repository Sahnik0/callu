import { app, Menu, Tray, BrowserWindow } from "electron";
import * as path from "path";

let tray: Tray | null = null;
let currentStatus = "Running";

export function createTray(mainWindow: BrowserWindow, onQuit: () => void) {
  // Use a transparent PNG or application icon. For now, use a fallback path
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "Verification-Blue-Tick-PNG.png")
    : path.join(__dirname, "../../public/Verification-Blue-Tick-PNG.png");
  
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Callu",
      click: () => {
        mainWindow.show();
      },
    },
    {
      label: `Status: ${currentStatus}`,
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        onQuit();
      },
    },
  ]);

  tray.setToolTip("Callu - Curated Community");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
}

export function setTrayStatus(status: string) {
  currentStatus = status;
  // Re-build menu if tray exists to update text dynamically
  if (tray) {
    tray.setToolTip(`Callu - ${status}`);
  }
}
