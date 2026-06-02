import React, { useState, useEffect, useRef } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Minus, Square, X, Monitor } from "lucide-react";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import AdminLayout from "./pages/AdminLayout";
import DashboardLayout from "./pages/DashboardLayout";
import DashboardMembers from "./pages/DashboardMembers";
import DashboardRoom from "./pages/DashboardRoom";
import DashboardSettings from "./pages/DashboardSettings";
import DashboardCalls from "./pages/DashboardCalls";
import DashboardWallet from "./pages/DashboardWallet";
import { AuthProvider } from "./context/AuthContext";
import SmoothScrolling from "./components/SmoothScrolling";

// ═══════════════════════════════════════════════════════════════════
//  Titlebar Component (Frameless Drag and Controls)
// ═══════════════════════════════════════════════════════════════════
const Titlebar = () => {
  if (!window.electron) return null;

  return (
    <div 
      className="h-10 bg-zinc-950 border-b border-zinc-900 flex items-center justify-between px-4 select-none shrink-0 sticky top-0 z-50" 
      style={{ WebkitAppRegion: "drag" } as any}
    >
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-semibold tracking-wider text-zinc-400 font-dm">CALLU DESKTOP</span>
      </div>
      <div className="flex items-center" style={{ WebkitAppRegion: "no-drag" } as any}>
        <button 
          onClick={() => window.electron.send("window-minimize")} 
          className="h-10 w-12 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button 
          onClick={() => window.electron.send("window-maximize-toggle")} 
          className="h-10 w-12 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          title="Maximize"
        >
          <Square className="w-3 h-3" />
        </button>
        <button 
          onClick={() => window.electron.send("window-close")} 
          className="h-10 w-12 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-red-600 transition-colors"
          title="Close to Tray"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
//  Screen Share Source Picker Provider
// ═══════════════════════════════════════════════════════════════════
const ScreenShareProvider = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [sources, setSources] = useState<any[]>([]);
  const resolveRef = useRef<((stream: MediaStream | null) => void) | null>(null);

  useEffect(() => {
    if (!window.electron) return;

    (window as any).showScreenPicker = async () => {
      try {
        const list = await window.electron.invoke("get-screen-sources");
        setSources(list);
        setIsOpen(true);
        return new Promise<MediaStream | null>((resolve) => {
          resolveRef.current = resolve;
        });
      } catch (err) {
        console.error("Failed to load screen sources", err);
        return null;
      }
    };

    // Override the navigator.mediaDevices.getDisplayMedia globally
    navigator.mediaDevices.getDisplayMedia = async (options?: DisplayMediaStreamOptions) => {
      if ((window as any).showScreenPicker) {
        const stream = await (window as any).showScreenPicker();
        if (!stream) {
          throw new DOMException("Screen sharing cancelled by user", "NotAllowedError");
        }
        return stream;
      }
      throw new Error("Screen picker not initialized");
    };

    return () => {
      delete (window as any).showScreenPicker;
    };
  }, []);

  const handleSelect = async (sourceId: string) => {
    setIsOpen(false);
    try {
      let stream: MediaStream;
      try {
        // Try to capture BOTH screen video and system/desktop audio
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: "desktop",
            },
          } as any,
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: sourceId,
              minWidth: 1280,
              maxWidth: 1920,
              minHeight: 720,
              maxHeight: 1080,
            },
          } as any,
        });
        console.log("Successfully captured screen stream WITH desktop/system audio.");
      } catch (audioErr) {
        console.warn("Failed to capture system audio, falling back to video-only screen capture:", audioErr);
        // Fallback to video-only capture
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: sourceId,
              minWidth: 1280,
              maxWidth: 1920,
              minHeight: 720,
              maxHeight: 1080,
            },
          } as any,
        });
      }
      resolveRef.current?.(stream);
    } catch (err) {
      console.error("Error setting up screen capture stream", err);
      resolveRef.current?.(null);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    resolveRef.current?.(null);
  };

  return (
    <>
      {children}
      {isOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-6 font-dm">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col p-8 overflow-hidden shadow-2xl shadow-emerald-500/5">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6 border-b border-zinc-900 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <Monitor className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Share your screen</h2>
                  <p className="text-zinc-400 text-xs mt-0.5">Select a window or screen to share in the voice room.</p>
                </div>
              </div>
              <button 
                onClick={handleCancel} 
                className="p-2 rounded-full hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-6 p-1 pr-2 no-scrollbar">
              {sources.map((src) => (
                <button
                  key={src.id}
                  onClick={() => handleSelect(src.id)}
                  className="flex flex-col items-start p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 hover:bg-zinc-900/80 hover:border-emerald-500/50 transition-all text-left group shrink-0"
                >
                  <div className="w-full aspect-video rounded-xl overflow-hidden bg-zinc-950 mb-3.5 border border-zinc-900 flex items-center justify-center relative shadow-inner">
                    <img 
                      src={src.thumbnail} 
                      alt={src.name} 
                      className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300" 
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full">
                    {src.appIcon && (
                      <img src={src.appIcon} alt="" className="w-4 h-4 object-contain" />
                    )}
                    <span className="text-xs font-semibold text-zinc-300 truncate w-full group-hover:text-white transition-colors">
                      {src.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            
            {/* Modal Footer */}
            <div className="flex justify-end gap-3 mt-6 border-t border-zinc-900 pt-4">
              <button
                onClick={handleCancel}
                className="px-5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════
//  Main Application Component
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <SmoothScrolling>
          <ScreenShareProvider>
            <div className="flex flex-col h-full w-full bg-black text-white min-h-0">
              <Titlebar />
              <div className="flex-1 overflow-hidden relative min-h-0 flex flex-col">
                <Routes>
                  {/* Public route */}
                  <Route path="/" element={<Home />} />
                  
                  {/* Admin routes */}
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<Admin />} />
                  </Route>
                  
                  {/* Dashboard routes */}
                  <Route path="/dashboard" element={<DashboardLayout />}>
                    <Route index element={<Navigate to="/dashboard/members" replace />} />
                    <Route path="members" element={<DashboardMembers />} />
                    <Route path="rooms/:roomId" element={<DashboardRoom />} />
                    <Route path="settings" element={<DashboardSettings />} />
                    <Route path="calls" element={<DashboardCalls />} />
                    <Route path="wallet" element={<DashboardWallet />} />
                  </Route>
                  
                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </div>
          </ScreenShareProvider>
        </SmoothScrolling>
      </AuthProvider>
    </HashRouter>
  );
}
