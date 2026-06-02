"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import YouTube, { YouTubeProps, YouTubeEvent } from "react-youtube";
import {
  Music, Play, Pause, SkipForward, SkipBack, Square, Plus,
  Trash2, ListMusic, X, Info, Loader2, ChevronDown,
  ChevronUp, Volume2, Maximize2, Repeat1,
} from "lucide-react";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface Song {
  videoId: string;
  title: string;
  thumbnail: string;
  duration: string;
  addedBy: string;
  addedByName: string;
}

interface RoomMusicPlayerProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────

function extractVideoId(input: string): string | null {
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) return input.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    /music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }
  return null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Circular progress ring constants
const RING_RADIUS = 21;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// ═══════════════════════════════════════════════════════════════

export default function RoomMusicPlayer({ roomId, isOpen, onClose, onOpen }: RoomMusicPlayerProps) {
  const { socket } = useSocket();
  const { user } = useAuth();

  // ─── State ───────────────────────────────────────────────────
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [showQueue, setShowQueue] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isSeeking, setIsSeeking] = useState(false);
  const [repeatOne, setRepeatOne] = useState(false);

  // ─── Refs ────────────────────────────────────────────────────
  const playerRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRespondedToStateRef = useRef(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const currentIndexRef = useRef(currentIndex);
  const queueRef = useRef(queue);
  const isPlayingRef = useRef(isPlaying);
  const repeatOneRef = useRef(repeatOne);
  const socketRef = useRef(socket);

  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { repeatOneRef.current = repeatOne; }, [repeatOne]);
  useEffect(() => { socketRef.current = socket; }, [socket]);

  // ─── YouTube opts ────────────────────────────────────────────
  const playerOpts: YouTubeProps["opts"] = {
    height: "1",
    width: "1",
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      rel: 0,
      origin: typeof window !== "undefined" ? window.location.origin : "",
    },
  };

  // ─── Time tracking ──────────────────────────────────────────
  const startTimeTracker = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (playerRef.current && !isSeeking) {
        const ct = playerRef.current.getCurrentTime?.() ?? 0;
        const dur = playerRef.current.getDuration?.() ?? 0;
        setCurrentTime(ct);
        setDuration(dur);
      }
    }, 500);
  }, [isSeeking]);

  const stopTimeTracker = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => { stopTimeTracker(); }, [stopTimeTracker]);

  useEffect(() => {
    if (playerRef.current) playerRef.current.setVolume?.(volume);
  }, [volume]);

  // ═══════════════════════════════════════════════════════════════
  //  Seek handler – emits socket event for sync
  // ═══════════════════════════════════════════════════════════════

  const createSeekHandlers = useCallback((barRef: React.RefObject<HTMLDivElement | null>) => {
    const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!barRef.current || !playerRef.current || duration <= 0) return;
      setIsSeeking(true);

      const rect = barRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const seekTime = (x / rect.width) * duration;
      playerRef.current.seekTo?.(seekTime, true);
      setCurrentTime(seekTime);

      const onMouseMove = (ev: MouseEvent) => {
        if (!barRef.current || duration <= 0) return;
        const r = barRef.current.getBoundingClientRect();
        const mx = Math.max(0, Math.min(ev.clientX - r.left, r.width));
        setCurrentTime((mx / r.width) * duration);
      };

      const onMouseUp = (ev: MouseEvent) => {
        if (barRef.current && playerRef.current && duration > 0) {
          const r = barRef.current.getBoundingClientRect();
          const mx = Math.max(0, Math.min(ev.clientX - r.left, r.width));
          const st = (mx / r.width) * duration;
          playerRef.current.seekTo?.(st, true);
          setCurrentTime(st);
          // Broadcast seek to other participants
          socketRef.current?.emit("music-seek", { roomId, time: st });
        }
        setIsSeeking(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };
    return onMouseDown;
  }, [duration, roomId]);

  // ═══════════════════════════════════════════════════════════════
  //  Socket listeners
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!socket) return;

    const onAddToQueue = (data: { song: Song }) => {
      setQueue((prev) => [...prev, data.song]);
    };

    const onPlay = (data: { index?: number }) => {
      setCurrentIndex(data.index ?? 0);
      setIsPlaying(true);
      setCurrentTime(0);
      setDuration(0);
    };

    const onPause = () => {
      setIsPlaying(false);
      playerRef.current?.pauseVideo?.();
      stopTimeTracker();
    };

    const onResume = () => {
      setIsPlaying(true);
      playerRef.current?.playVideo?.();
      startTimeTracker();
    };

    const onSkip = () => {
      const next = currentIndexRef.current + 1;
      if (next < queueRef.current.length) {
        setCurrentIndex(next);
        setIsPlaying(true);
        setCurrentTime(0);
        setDuration(0);
      } else {
        setIsPlaying(false);
        setCurrentIndex(-1);
        setCurrentTime(0);
        setDuration(0);
        stopTimeTracker();
      }
    };

    const onPrev = () => {
      if (currentIndexRef.current > 0) {
        setCurrentIndex(currentIndexRef.current - 1);
        setIsPlaying(true);
        setCurrentTime(0);
        setDuration(0);
      }
    };

    const onStop = () => {
      setIsPlaying(false);
      setCurrentIndex(-1);
      setCurrentTime(0);
      setDuration(0);
      playerRef.current?.stopVideo?.();
      stopTimeTracker();
    };

    const onSeek = (data: { time: number }) => {
      if (playerRef.current && typeof data.time === "number") {
        playerRef.current.seekTo?.(data.time, true);
        setCurrentTime(data.time);
      }
    };

    const onRepeat = (data: { repeat: boolean }) => {
      setRepeatOne(data.repeat);
    };

    const onRemoveFromQueue = (data: { index: number }) => {
      setQueue((prev) => {
        const updated = prev.filter((_, i) => i !== data.index);
        // When removing the currently-playing song, auto-advance to the next
        // (which slides into the same index) instead of stopping
        setCurrentIndex((prevIdx) => {
          if (data.index < prevIdx) return prevIdx - 1;
          if (data.index === prevIdx) {
            // If there are more songs after this one, keep same index
            // (the next song slides into this position and YouTube remounts)
            if (data.index < updated.length) {
              // Force a remount by briefly setting -1 then back
              // Actually, the key={videoId}-{index} on YouTube component
              // will handle remount since the videoId changes
              return prevIdx; // same index, new song slides in
            }
            // No more songs — stop playing
            setIsPlaying(false);
            stopTimeTracker();
            return -1;
          }
          return prevIdx;
        });
        return updated;
      });
    };

    const onClearQueue = () => {
      setQueue([]);
      setCurrentIndex(-1);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      playerRef.current?.stopVideo?.();
      stopTimeTracker();
    };

    const onStateRequest = (data: { requesterId: string }) => {
      if (hasRespondedToStateRef.current) return;
      hasRespondedToStateRef.current = true;
      setTimeout(() => { hasRespondedToStateRef.current = false; }, 2000);
      socket.emit("music-state-response", {
        roomId,
        requesterId: data.requesterId,
        state: {
          queue: queueRef.current,
          currentIndex: currentIndexRef.current,
          isPlaying: isPlayingRef.current,
          currentTime: playerRef.current?.getCurrentTime?.() ?? 0,
          repeatOne: repeatOneRef.current,
        },
      });
    };

    const onStateSync = (data: {
      state: { queue?: Song[]; currentIndex?: number; isPlaying?: boolean; currentTime?: number; repeatOne?: boolean };
    }) => {
      const { state } = data;
      if (state.queue && state.queue.length > 0) {
        setQueue(state.queue);
        if (state.currentIndex !== undefined) setCurrentIndex(state.currentIndex);
        if (state.isPlaying !== undefined) setIsPlaying(state.isPlaying);
        if (state.repeatOne !== undefined) setRepeatOne(state.repeatOne);
      }
    };

    socket.on("music-add-to-queue", onAddToQueue);
    socket.on("music-play", onPlay);
    socket.on("music-pause", onPause);
    socket.on("music-resume", onResume);
    socket.on("music-skip", onSkip);
    socket.on("music-prev", onPrev);
    socket.on("music-stop", onStop);
    socket.on("music-seek", onSeek);
    socket.on("music-repeat", onRepeat);
    socket.on("music-remove-from-queue", onRemoveFromQueue);
    socket.on("music-clear-queue", onClearQueue);
    socket.on("music-state-request", onStateRequest);
    socket.on("music-state-sync", onStateSync);

    socket.emit("music-request-state", { roomId });

    return () => {
      socket.off("music-add-to-queue", onAddToQueue);
      socket.off("music-play", onPlay);
      socket.off("music-pause", onPause);
      socket.off("music-resume", onResume);
      socket.off("music-skip", onSkip);
      socket.off("music-prev", onPrev);
      socket.off("music-stop", onStop);
      socket.off("music-seek", onSeek);
      socket.off("music-repeat", onRepeat);
      socket.off("music-remove-from-queue", onRemoveFromQueue);
      socket.off("music-clear-queue", onClearQueue);
      socket.off("music-state-request", onStateRequest);
      socket.off("music-state-sync", onStateSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, roomId]);

  // ═══════════════════════════════════════════════════════════════
  //  Actions
  // ═══════════════════════════════════════════════════════════════

  const addToQueue = async () => {
    if (!linkInput.trim() || !socket || !user) return;
    const videoId = extractVideoId(linkInput.trim());
    if (!videoId) { toast.error("Invalid YouTube link."); return; }
    setIsAdding(true);
    try {
      const res = await fetch(`/api/youtube/oembed?v=${videoId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const song: Song = {
        videoId,
        title: data.title || "Unknown Title",
        thumbnail: data.thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        duration: "",
        addedBy: user._id,
        addedByName: user.name,
      };
      socket.emit("music-add-to-queue", { roomId, song });
      setLinkInput("");
      toast.success(`Added "${song.title}" to queue`);
    } catch {
      toast.error("Could not fetch video info.");
    } finally {
      setIsAdding(false);
    }
  };

  const handlePlay = () => {
    if (!socket) return;
    if (queue.length === 0) { toast.error("Queue is empty!"); return; }
    if (isPlaying) socket.emit("music-pause", { roomId });
    else if (currentIndex >= 0) socket.emit("music-resume", { roomId });
    else socket.emit("music-play", { roomId, index: 0 });
  };

  const handleSkip = () => {
    if (!socket || currentIndex < 0) return;
    socket.emit("music-skip", { roomId });
  };

  const handlePrev = () => {
    if (!socket || currentIndex <= 0) return;
    socket.emit("music-prev", { roomId });
  };

  const handleStop = () => {
    socket?.emit("music-stop", { roomId });
  };

  const handleRepeat = () => {
    socket?.emit("music-repeat", { roomId, repeat: !repeatOne });
  };

  const handleRemove = (index: number) => {
    socket?.emit("music-remove-from-queue", { roomId, index });
  };

  const handleClearQueue = () => {
    socket?.emit("music-clear-queue", { roomId });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); addToQueue(); }
  };

  // ═══════════════════════════════════════════════════════════════
  //  YouTube Player Handlers
  // ═══════════════════════════════════════════════════════════════

  const onPlayerReady = (event: YouTubeEvent) => {
    playerRef.current = event.target;
    event.target.setVolume(volume);
    // Try to get video title from the player API as a fallback
    try {
      const videoData = (event.target as any).getVideoData?.();
      if (videoData?.title) {
        setQueue(prev => prev.map((s, i) =>
          i === currentIndexRef.current && (!s.title || s.title.startsWith("YouTube Video"))
            ? { ...s, title: videoData.title }
            : s
        ));
      }
    } catch {}
    if (isPlayingRef.current) {
      event.target.playVideo();
      startTimeTracker();
    } else {
      event.target.pauseVideo();
    }
  };

  const onPlayerPlay = () => startTimeTracker();
  const onPlayerPause = () => stopTimeTracker();

  const onPlayerEnd = () => {
    stopTimeTracker();
    // Repeat-one: replay same song
    if (repeatOneRef.current) {
      if (playerRef.current) {
        playerRef.current.seekTo?.(0, true);
        playerRef.current.playVideo?.();
        setCurrentTime(0);
        startTimeTracker();
      }
      return;
    }
    // Otherwise advance
    const curIdx = currentIndexRef.current;
    const q = queueRef.current;
    if (curIdx + 1 < q.length) {
      socket?.emit("music-skip", { roomId });
    } else {
      setIsPlaying(false);
      setCurrentIndex(-1);
      setCurrentTime(0);
      setDuration(0);
    }
  };

  const onPlayerError = (event: YouTubeEvent) => {
    const errorCode = event.data;
    const errorMessages: Record<number, string> = {
      2: "Invalid video ID",
      5: "Video cannot be played in embedded player",
      100: "Video not found or removed",
      101: "Embedding not allowed by owner",
      150: "Embedding not allowed by owner",
    };
    const msg = errorMessages[errorCode] || `Player error (code: ${errorCode})`;
    console.error(`YouTube player error: ${msg}`, errorCode);
    
    const curIdx = currentIndexRef.current;
    const q = queueRef.current;
    const failedSong = curIdx >= 0 && curIdx < q.length ? q[curIdx] : null;
    
    // For embedding errors (5, 101, 150), remove the song from queue
    // so it doesn't get replayed in repeat mode or when users navigate back
    if ([5, 101, 150].includes(errorCode) && failedSong) {
      toast.error(`"${failedSong.title}" can't be embedded. Removing & skipping...`);
      // Remove the broken song — this will auto-advance to the next song
      // at the same index (since removal shifts everything down)
      socket?.emit("music-remove-from-queue", { roomId, index: curIdx });
    } else {
      toast.error(`${msg}. Skipping...`);
      if (curIdx + 1 < q.length) {
        socket?.emit("music-skip", { roomId });
      } else {
        setIsPlaying(false);
      }
    }
  };

  // ─── Derived ─────────────────────────────────────────────────
  const currentSong = currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const hasMusic = currentSong !== null;
  const ringOffset = RING_CIRCUMFERENCE - (progressPercent / 100) * RING_CIRCUMFERENCE;

  // ═══════════════════════════════════════════════════════════════
  //  Seekable linear progress bar (full panel)
  // ═══════════════════════════════════════════════════════════════

  const renderProgressBar = (barRef: React.RefObject<HTMLDivElement | null>, height: string = "h-1.5") => (
    <div className="space-y-1">
      <div
        ref={barRef}
        className={`w-full ${height} bg-zinc-800 rounded-full overflow-hidden cursor-pointer relative group`}
        onMouseDown={createSeekHandlers(barRef)}
      >
        <div
          className="h-full bg-emerald-500 rounded-full transition-[width] duration-200 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-emerald-400 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ left: `calc(${progressPercent}% - 6px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
        <span>{formatTime(currentTime)}</span>
        <span>{duration > 0 ? formatTime(duration) : "--:--"}</span>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <>
      {/* Hidden YouTube Player – ALWAYS mounted when a song is loaded */}
      <div className="fixed overflow-hidden pointer-events-none" style={{ top: -9999, left: -9999, width: 1, height: 1, opacity: 0 }} aria-hidden="true">
        {currentSong && (
          <YouTube
            key={`yt-${currentSong.videoId}-${currentIndex}`}
            videoId={currentSong.videoId}
            opts={playerOpts}
            onReady={onPlayerReady}
            onPlay={onPlayerPlay}
            onPause={onPlayerPause}
            onEnd={onPlayerEnd}
            onError={onPlayerError}
          />
        )}
      </div>

      {/* ─── Mini Player – Bottom-Right with Circular Progress Ring ─── */}
      <AnimatePresence>
        {!isOpen && hasMusic && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/50 rounded-2xl px-3 py-2.5 shadow-2xl ring-1 ring-white/5 flex items-center gap-3 max-w-xs">
              {/* Circular thumbnail with ring progress */}
              <div
                className="relative w-12 h-12 flex-shrink-0 cursor-pointer"
                onClick={onOpen}
                title="Expand player"
              >
                <svg className="w-12 h-12 -rotate-90 absolute inset-0" viewBox="0 0 48 48">
                  <circle
                    cx="24" cy="24" r={RING_RADIUS}
                    fill="none" stroke="#27272a" strokeWidth="2.5"
                  />
                  <circle
                    cx="24" cy="24" r={RING_RADIUS}
                    fill="none" stroke="#10b981" strokeWidth="2.5"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={ringOffset}
                    strokeLinecap="round"
                    className="transition-all duration-300 ease-linear"
                  />
                </svg>
                <div className="absolute inset-[4px] rounded-full overflow-hidden bg-zinc-800">
                  <img
                    src={currentSong!.thumbnail}
                    alt={currentSong!.title}
                    className="w-full h-full object-cover"
                  />
                  {isPlaying && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="flex items-center gap-px">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="w-0.5 bg-emerald-400 rounded-full animate-music-bar"
                            style={{ animationDelay: `${i * 0.15}s`, height: "8px" }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Song title */}
              <div className="min-w-0 flex-1">
                <p className="text-white text-[11px] font-medium truncate max-w-[120px]">
                  {currentSong!.title}
                </p>
                <p className="text-zinc-500 text-[9px] font-mono">
                  {formatTime(currentTime)} / {duration > 0 ? formatTime(duration) : "--:--"}
                </p>
              </div>

              {/* Mini controls */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex <= 0}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                >
                  <SkipBack className="w-3 h-3" />
                </button>
                <button
                  onClick={handlePlay}
                  className="p-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black transition-all cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-px" />}
                </button>
                <button
                  onClick={handleSkip}
                  disabled={currentIndex + 1 >= queue.length}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                >
                  <SkipForward className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Full Panel ─── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-zinc-950/95 backdrop-blur-xl border-l border-zinc-800/50 z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <Music className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Music Bot</h2>
                  <p className="text-xs text-zinc-500">
                    {queue.length} song{queue.length !== 1 ? "s" : ""} in queue
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Minimize"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Now Playing */}
            {currentSong && (
              <div className="p-5 border-b border-zinc-800/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-800">
                    <img
                      src={currentSong.thumbnail}
                      alt={currentSong.title}
                      className="w-full h-full object-cover"
                    />
                    {isPlaying && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="flex items-center gap-0.5">
                          {[0, 1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className="w-1 bg-emerald-400 rounded-full animate-music-bar"
                              style={{ animationDelay: `${i * 0.15}s`, height: "16px" }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold text-sm truncate">{currentSong.title}</h3>
                    <p className="text-zinc-500 text-xs mt-0.5">Added by {currentSong.addedByName}</p>
                  </div>
                </div>

                {/* Seekable Progress Bar */}
                {renderProgressBar(progressBarRef, "h-1.5")}

                {/* Playback Controls */}
                <div className="flex items-center justify-center gap-2 mt-3">
                  {/* Repeat One */}
                  <button
                    onClick={handleRepeat}
                    className={`p-2.5 rounded-full transition-all cursor-pointer ${
                      repeatOne
                        ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                        : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                    }`}
                    title={repeatOne ? "Repeat is ON" : "Repeat One"}
                  >
                    <Repeat1 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handlePrev}
                    disabled={currentIndex <= 0}
                    className="p-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handlePlay}
                    className="p-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black transition-all shadow-lg shadow-emerald-900/30 cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  <button
                    onClick={handleSkip}
                    disabled={currentIndex + 1 >= queue.length}
                    className="p-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleStop}
                    className="p-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer"
                  >
                    <Square className="w-4 h-4" />
                  </button>

                  {/* Volume */}
                  <div className="flex items-center gap-2 ml-2 pl-2 border-l border-zinc-800">
                    <Volume2 className="w-3.5 h-3.5 text-zinc-500" />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      className="w-16 h-1 accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Add Song */}
            <div className="p-5 border-b border-zinc-800/50">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-3.5 h-3.5 text-zinc-500" />
                <p className="text-[11px] text-zinc-500">Paste a YouTube URL to add to queue</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="https://youtube.com/watch?v=..."
                  className="flex-1 px-4 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                />
                <button
                  onClick={addToQueue}
                  disabled={isAdding || !linkInput.trim()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                >
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
              {queue.length > 0 && currentIndex < 0 && (
                <button
                  onClick={() => socket?.emit("music-play", { roomId, index: 0 })}
                  className="mt-3 w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-all text-sm font-medium flex items-center justify-center gap-2 border border-emerald-500/20 cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  Play Queue
                </button>
              )}
            </div>

            {/* Queue */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <button
                onClick={() => setShowQueue(!showQueue)}
                className="flex items-center justify-between px-5 py-3 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ListMusic className="w-4 h-4" />
                  <span className="text-sm font-medium">Queue ({queue.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  {queue.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleClearQueue(); }}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10 cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                  {showQueue ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              <AnimatePresence>
                {showQueue && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex-1 overflow-y-auto no-scrollbar px-3 pb-3"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {queue.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                        <Music className="w-10 h-10 mb-3 opacity-50" />
                        <p className="text-sm font-medium">No songs in queue</p>
                        <p className="text-xs mt-1">Paste a YouTube link above to get started</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {queue.map((song, index) => (
                          <motion.div
                            key={`${song.videoId}-${index}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            className={`flex items-center gap-3 p-2.5 rounded-xl transition-all group ${
                              index === currentIndex
                                ? "bg-emerald-500/10 border border-emerald-500/20"
                                : "bg-zinc-900/40 border border-transparent hover:bg-zinc-800/60 hover:border-zinc-700/50"
                            }`}
                          >
                            <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
                              <img
                                src={song.thumbnail}
                                alt={song.title}
                                className="w-full h-full object-cover"
                              />
                              {index === currentIndex && isPlaying && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                  <div className="flex items-center gap-px">
                                    {[0, 1, 2].map((i) => (
                                      <div
                                        key={i}
                                        className="w-0.5 bg-emerald-400 rounded-full animate-music-bar"
                                        style={{ animationDelay: `${i * 0.15}s`, height: "10px" }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium truncate ${
                                index === currentIndex ? "text-emerald-300" : "text-white"
                              }`}>{song.title}</p>
                              <p className="text-[10px] text-zinc-500 mt-0.5">{song.addedByName}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              {index !== currentIndex && (
                                <button
                                  onClick={() => socket?.emit("music-play", { roomId, index })}
                                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-zinc-800 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-400 transition-all cursor-pointer"
                                  title="Play this song"
                                >
                                  <Play className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => handleRemove(index)}
                                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all cursor-pointer"
                                title="Remove"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                              <span className="text-[10px] text-zinc-600 font-mono w-5 text-center">
                                #{index + 1}
                              </span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
