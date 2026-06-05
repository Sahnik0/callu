"use client";

import { useRoomMusic } from "@/context/RoomMusicContext";
import RoomMusicPlayer from "./RoomMusicPlayer";

/**
 * Wrapper that renders the music player at the dashboard layout level.
 * This ensures music keeps playing even when navigating between pages.
 */
export default function PersistentMusicPlayer() {
  const { musicRoomId, isMusicPanelOpen, openMusicPlayer, closeMusicPanel } = useRoomMusic();

  if (!musicRoomId) return null;

  return (
    <RoomMusicPlayer
      key={musicRoomId}
      roomId={musicRoomId}
      isOpen={isMusicPanelOpen}
      onClose={closeMusicPanel}
      onOpen={() => openMusicPlayer(musicRoomId)}
    />
  );
}
