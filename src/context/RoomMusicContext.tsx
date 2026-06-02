"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface RoomMusicContextType {
  /** The room ID music is currently connected to (null = no active music) */
  musicRoomId: string | null;
  /** Whether the full music panel is open */
  isMusicPanelOpen: boolean;
  /** Open the music panel for a specific room (also sets the room) */
  openMusicPlayer: (roomId: string) => void;
  /** Close/minimize the full panel (music keeps playing) */
  closeMusicPanel: () => void;
  /** Fully disconnect music (stops playback, clears room) */
  disconnectMusic: () => void;
  /** Connect music to a room without opening the panel (for auto-sync) */
  connectMusicRoom: (roomId: string) => void;
}

const RoomMusicContext = createContext<RoomMusicContextType>({
  musicRoomId: null,
  isMusicPanelOpen: false,
  openMusicPlayer: () => {},
  closeMusicPanel: () => {},
  disconnectMusic: () => {},
  connectMusicRoom: () => {},
});

export function RoomMusicProvider({ children }: { children: React.ReactNode }) {
  const [musicRoomId, setMusicRoomId] = useState<string | null>(null);
  const [isMusicPanelOpen, setIsMusicPanelOpen] = useState(false);

  const openMusicPlayer = useCallback((roomId: string) => {
    setMusicRoomId(roomId);
    setIsMusicPanelOpen(true);
  }, []);

  const closeMusicPanel = useCallback(() => {
    setIsMusicPanelOpen(false);
  }, []);

  const disconnectMusic = useCallback(() => {
    setMusicRoomId(null);
    setIsMusicPanelOpen(false);
  }, []);

  const connectMusicRoom = useCallback((roomId: string) => {
    setMusicRoomId(roomId);
    // Don't open the panel — just connect so music can auto-sync
  }, []);

  return (
    <RoomMusicContext.Provider
      value={{
        musicRoomId,
        isMusicPanelOpen,
        openMusicPlayer,
        closeMusicPanel,
        disconnectMusic,
        connectMusicRoom,
      }}
    >
      {children}
    </RoomMusicContext.Provider>
  );
}

export function useRoomMusic() {
  return useContext(RoomMusicContext);
}
