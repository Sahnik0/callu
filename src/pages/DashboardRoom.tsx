"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import {
  Volume2, VolumeX, PhoneOff, Mic, MicOff,
  Video, VideoOff, MonitorUp, MonitorOff,
  PictureInPicture2, LayoutGrid, Maximize2, Minimize2,
  Wrench, Music, MessageSquare, X, Paperclip, Send, File as FileIcon, Smile, ChevronDown,
} from "lucide-react";
import { useSocket } from "@/context/SocketContext";
import { useRoomVoice } from "@/context/RoomVoiceContext";
import { useRoomMusic } from "@/context/RoomMusicContext";
import { toast } from "sonner";

interface Room {
  _id: string;
  name: string;
  description: string;
  createdBy: { _id: string; name: string };
  participants: Array<{
    _id: string;
    name: string;
    avatarConfig: { image?: string; color: string };
  }>;
  maxParticipants: number;
  isActive: boolean;
  roomType: "public" | "private";
}

interface ChatAttachment {
  key: string;
  url: string;
  name: string;
  type: string;
  size: number;
  expiresAt: string;
}

interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  content: string;
  attachments?: ChatAttachment[];
  createdAt: string;
}

export default function RoomVoiceChatPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const roomId = params?.roomId as string;
  const { socket } = useSocket();

  // ─── Voice state from persistent context ────────────────────────
  const {
    isVoiceConnected,
    voiceRoomId,
    participants,
    setParticipants,
    isMuted,
    isDeafened,
    availableMics,
    availableSpeakers,
    selectedMicId,
    selectedSpeakerId,
    switchMicDevice,
    setSpeakerDevice,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    peerConnectionsRef,
    remoteVideoStreamsRef,
    videoElementsRef,
    localStreamRef,
    localVideoTrackRef,
    localVideoStreamRef,
    isPTTEnabled,
    setIsPTTEnabled,
    isPTTActive,
    userVolumes,
    userMutes,
    setUserVolume,
    setUserMute,
  } = useRoomVoice();

  // ─── Local page state (dies on navigation — that's fine) ────────
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isInPiP, setIsInPiP] = useState(false);
  const [layout, setLayout] = useState<"grid" | "spotlight">("grid");
  const [spotlightUserId, setSpotlightUserId] = useState<string | null>(null);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const { isMusicPanelOpen: isMusicOpen, openMusicPlayer, closeMusicPanel, disconnectMusic, connectMusicRoom } = useRoomMusic();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMicMenu, setShowMicMenu] = useState(false);
  const [showSpeakerMenu, setShowSpeakerMenu] = useState(false);
  const [isScreenShareFullscreen, setIsScreenShareFullscreen] = useState(false);

  const chatListRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const spotlightVideoRef = useRef<HTMLVideoElement | null>(null);
  const spotlightContainerRef = useRef<HTMLDivElement | null>(null);
  const autoPiPRef = useRef(false);
  const canvasPiPVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasAnimFrameRef = useRef<number | null>(null);
  const pipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipImgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const participantsRef = useRef(participants);

  // ─── Local refs (video-only, page-scoped) ───────────────────────
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const localVideoElRef = useRef<HTMLVideoElement | null>(null);
  const mixingCtxRef = useRef<AudioContext | null>(null);
  const originalMicTrackRef = useRef<MediaStreamTrack | null>(null);

  // Refs for stable cleanup closures
  const socketRef = useRef(socket);
  const userIdRef = useRef(user?._id);
  const isVideoOnRef = useRef(false);
  const isScreenSharingRef = useRef(false);

  useEffect(() => { socketRef.current = socket; }, [socket]);
  useEffect(() => { userIdRef.current = user?._id; }, [user]);
  useEffect(() => { isVideoOnRef.current = isVideoOn; }, [isVideoOn]);
  useEffect(() => { isScreenSharingRef.current = isScreenSharing; }, [isScreenSharing]);
  useEffect(() => { participantsRef.current = participants; }, [participants]);

  // ─── Listen for Escape key to exit client-fullscreen ────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isScreenShareFullscreen) {
        setIsScreenShareFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isScreenShareFullscreen]);

  // ─── Force containing block to viewport for CSS fullscreen ──────
  useEffect(() => {
    if (isScreenShareFullscreen) {
      const el = spotlightContainerRef.current;
      if (!el) return;

      const ancestors: HTMLElement[] = [];
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        ancestors.push(parent);
        parent = parent.parentElement;
      }

      ancestors.forEach((ancestor) => {
        ancestor.setAttribute("data-prev-transform", ancestor.style.transform);
        ancestor.setAttribute("data-prev-filter", ancestor.style.filter);
        ancestor.setAttribute("data-prev-will-change", ancestor.style.willChange);

        ancestor.style.setProperty("transform", "none", "important");
        ancestor.style.setProperty("filter", "none", "important");
        ancestor.style.setProperty("will-change", "auto", "important");
      });

      return () => {
        ancestors.forEach((ancestor) => {
          const prevTransform = ancestor.getAttribute("data-prev-transform");
          const prevFilter = ancestor.getAttribute("data-prev-filter");
          const prevWillChange = ancestor.getAttribute("data-prev-will-change");

          if (prevTransform !== null) ancestor.style.transform = prevTransform;
          if (prevFilter !== null) ancestor.style.filter = prevFilter;
          if (prevWillChange !== null) ancestor.style.willChange = prevWillChange;
        });
      };
    }
  }, [isScreenShareFullscreen]);

  // ─── Pre-warm canvas PiP stream on mount ─────────────────────────
  useEffect(() => {
    if (typeof document === "undefined" || !document.pictureInPictureEnabled) return;
    const pipVideoEl = canvasPiPVideoRef.current;
    if (!pipVideoEl) return;

    // Mark this element for automatic PiP (Chrome 80+) — bypasses user-gesture requirement
    pipVideoEl.setAttribute("autopictureinpicture", "");

    // Create the canvas once and keep it alive
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 270;
    pipCanvasRef.current = canvas;

    // Seed a dark background so there's no white flash
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, 480, 270);
    }

    const stream = (canvas as any).captureStream(24) as MediaStream;
    pipVideoEl.srcObject = stream;
    // play() silently — this primes the video element so requestPictureInPicture
    // can be called later without needing a fresh user gesture.
    pipVideoEl.play().catch(() => {});

    return () => {
      pipVideoEl.removeAttribute("autopictureinpicture");
      pipVideoEl.pause();
      pipVideoEl.srcObject = null;
      pipCanvasRef.current = null;
    };
  }, []);

  // ─── Auto PiP when browser is minimized / tab hidden ─────────────
  useEffect(() => {
    // ── helpers ──────────────────────────────────────────────────
    const stopCanvasAnim = () => {
      if (canvasAnimFrameRef.current !== null) {
        cancelAnimationFrame(canvasAnimFrameRef.current);
        canvasAnimFrameRef.current = null;
      }
    };

    // Draw one frame of participant info onto the canvas
    const drawFrame = (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      const parts = participantsRef.current;

      // Background
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, W, H);

      const visible = parts.slice(0, 4);

      if (visible.length > 0) {
        // Preload avatar images
        visible.forEach((p) => {
          if (p.avatar && !pipImgCacheRef.current.has(p.avatar)) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = p.avatar;
            pipImgCacheRef.current.set(p.avatar, img);
          }
        });

        const cols = visible.length <= 1 ? 1 : 2;
        const rows = Math.ceil(visible.length / cols);
        const cellW = W / cols;
        const cellH = H / rows;
        const R = Math.min(cellW, cellH) * 0.23;

        visible.forEach((p, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const cx = cellW * col + cellW / 2;
          const cy = cellH * row + cellH / 2 - 14;

          // Cell background
          ctx.fillStyle = p.isSpeaking ? "rgba(16,185,129,0.07)" : "rgba(39,39,42,0.5)";
          if ((ctx as any).roundRect) {
            ctx.beginPath();
            (ctx as any).roundRect(cellW * col + 4, cellH * row + 4, cellW - 8, cellH - 8, 10);
            ctx.fill();
          } else {
            ctx.fillRect(cellW * col + 4, cellH * row + 4, cellW - 8, cellH - 8);
          }

          // Speaking glow ring
          if (p.isSpeaking) {
            ctx.beginPath();
            ctx.arc(cx, cy, R + 7, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(16,185,129,0.35)";
            ctx.lineWidth = 6;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, R + 4, 0, Math.PI * 2);
            ctx.strokeStyle = "#10b981";
            ctx.lineWidth = 2.5;
            ctx.stroke();
          }

          // Avatar circle fill
          ctx.beginPath();
          ctx.arc(cx, cy, R, 0, Math.PI * 2);
          ctx.fillStyle = p.color || "#27272a";
          ctx.fill();

          // Avatar image or initial letter
          const img = p.avatar ? pipImgCacheRef.current.get(p.avatar) : null;
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(img, cx - R, cy - R, R * 2, R * 2);
            ctx.restore();
          } else {
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.font = `bold ${Math.round(R * 0.75)}px system-ui,sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(p.name?.[0]?.toUpperCase() || "U", cx, cy);
          }

          // Muted badge — red circle at top-right of avatar
          if (p.isMuted) {
            const bx = cx + R * 0.66;
            const by = cy - R * 0.66;
            const br = R * 0.24;
            ctx.beginPath();
            ctx.arc(bx, by, br, 0, Math.PI * 2);
            ctx.fillStyle = "#ef4444";
            ctx.fill();
            // Simple mic-slash lines
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(bx - br * 0.5, by - br * 0.5);
            ctx.lineTo(bx + br * 0.5, by + br * 0.5);
            ctx.stroke();
          }

          // Name label
          const fontSize = Math.max(11, Math.min(14, Math.round(cellW / 13)));
          ctx.font = `${fontSize}px system-ui,sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          let name = p.name || "User";
          const maxNameW = cellW - 20;
          while (ctx.measureText(name).width > maxNameW && name.length > 1) {
            name = name.slice(0, -1);
          }
          if (name !== p.name) name += "\u2026";
          ctx.fillStyle = "rgba(255,255,255,0.88)";
          ctx.fillText(name, cx, cy + R + 7);
        });

        // Overflow label
        if (parts.length > 4) {
          ctx.font = "11px system-ui,sans-serif";
          ctx.textAlign = "right";
          ctx.textBaseline = "top";
          ctx.fillStyle = "rgba(255,255,255,0.45)";
          ctx.fillText(`+${parts.length - 4} more`, W - 8, 8);
        }
      }

      canvasAnimFrameRef.current = requestAnimationFrame(() => drawFrame(canvas));
    };

    // ── enter PiP ────────────────────────────────────────────────
    // Always uses the canvas avatar approach — never the raw video stream.
    // The canvas is pre-warmed on mount so this call is instant and doesn't
    // need a fresh user gesture (the earlier .play() primes the element).
    const startPiP = async () => {
      if (!document.pictureInPictureEnabled) return;
      if (document.pictureInPictureElement) return;

      const pipVideoEl = canvasPiPVideoRef.current;
      if (!pipVideoEl) return;

      // Re-use the persistent canvas or create one if not yet ready
      const canvas = pipCanvasRef.current ?? (() => {
        const c = document.createElement("canvas");
        c.width = 480;
        c.height = 270;
        pipCanvasRef.current = c;
        return c;
      })();

      // Start / restart the animated frame loop
      stopCanvasAnim();
      drawFrame(canvas);

      // If the video isn't playing yet (edge case), re-prime it
      if (!pipVideoEl.srcObject || pipVideoEl.paused) {
        const stream = (canvas as any).captureStream(24) as MediaStream;
        pipVideoEl.srcObject = stream;
        try {
          await pipVideoEl.play();
          await new Promise<void>((res) => {
            if (pipVideoEl.readyState >= 1) { res(); return; }
            pipVideoEl.addEventListener("loadedmetadata", () => res(), { once: true });
            setTimeout(res, 400);
          });
        } catch {
          stopCanvasAnim();
          return;
        }
      }

      try {
        await pipVideoEl.requestPictureInPicture();
        autoPiPRef.current = true;
        setIsInPiP(true);
      } catch (err) {
        console.warn("Canvas PiP failed:", err);
        stopCanvasAnim();
      }
    };

    // ── exit PiP ─────────────────────────────────────────────────
    const stopPiP = async () => {
      stopCanvasAnim();
      if (autoPiPRef.current && document.pictureInPictureElement) {
        try { await document.exitPictureInPicture(); } catch {}
      }
      autoPiPRef.current = false;
      setIsInPiP(false);
      const pipVideoEl = canvasPiPVideoRef.current;
      if (pipVideoEl) {
        pipVideoEl.pause();
        pipVideoEl.srcObject = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        void startPiP();
      } else {
        void stopPiP();
      }
    };

    // window.blur fires when the OS window itself is minimized or focus moves
    // to another application — this is more reliable than visibilitychange for
    // the "minimize browser" case in Chrome.
    const handleWindowBlur = () => { void startPiP(); };
    const handleWindowFocus = () => { void stopPiP(); };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      stopCanvasAnim();
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  //  Room details fetch
  // ═══════════════════════════════════════════════════════════════════

  const fetchRoomDetails = async (): Promise<Room | null> => {
    try {
      const response = await fetch(`/api/rooms?roomId=${roomId}`);
      const data = await response.json();
      if (response.ok && data.rooms?.length > 0) {
        setRoom(data.rooms[0]);
        return data.rooms[0];
      } else {
        toast.error("Room not found");
        router.push("/dashboard/members");
        return null;
      }
    } catch (error) {
      console.error("Failed to fetch room:", error);
      router.push("/dashboard/members");
      return null;
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  Initialize: join voice OR reconnect UI
  // ═══════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!user || !roomId) {
      router.push("/dashboard/members");
      return;
    }

    // Already connected to THIS room → just load room info
    if (voiceRoomId === roomId) {
      fetchRoomDetails();
      return;
    }

    // Connected to a DIFFERENT room → leave old, join new
    if (isVoiceConnected && voiceRoomId !== roomId) {
      leaveVoice();
      disconnectMusic(); // Stop music from old room
    }


    const init = async () => {
      const roomData = await fetchRoomDetails();
      if (!roomData) return;

      const success = await joinVoice(roomId, roomData.name);
      if (success) {
        // Auto-connect music so new joiners hear active music without clicking Tools
        connectMusicRoom(roomId);
      } else {
        toast.error("Failed to join voice channel");
        router.push("/dashboard/members");
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, roomId]);

  // ═══════════════════════════════════════════════════════════════════
  //  Clean up VIDEO on page unmount (voice stays connected!)
  // ═══════════════════════════════════════════════════════════════════

  useEffect(() => {
    // Capture refs for cleanup closure
    const pcRef = peerConnectionsRef;
    const localSRef = localStreamRef;

    return () => {
      const hadVideo = isVideoOnRef.current;
      const hadScreen = isScreenSharingRef.current;
      const peers = pcRef.current;

      // Stop screen share tracks
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }

      // Stop camera / video tracks
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current = null;
      }
      if (localVideoStreamRef.current) {
        localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
        localVideoStreamRef.current = null;
      }

      // Replace video track with null on all peers (fire-and-forget)
      peers.forEach((pc) => {
        const videoSender = pc.getSenders().find((s) => {
          if (s.track?.kind === "video") return true;
          const tx = pc.getTransceivers().find((t) => t.sender === s && t.receiver.track?.kind === "video");
          return !!tx;
        });
        if (videoSender) {
          videoSender.replaceTrack(null).catch(() => {});
        }
      });

      // Restore original mic track if we were mixing screen audio
      const savedMic = originalMicTrackRef.current;
      if (savedMic && savedMic.readyState === "live") {
        peers.forEach((pc) => {
          const audioSender = pc.getSenders().find((s) => s.track?.kind === "audio");
          if (audioSender) {
            audioSender.replaceTrack(savedMic).catch(() => {});
          }
        });
      } else {
        // Try to restore from localStream
        const fallbackMic = localSRef.current?.getAudioTracks()[0];
        if (fallbackMic && fallbackMic.readyState === "live") {
          peers.forEach((pc) => {
            const audioSender = pc.getSenders().find((s) => s.track?.kind === "audio");
            if (audioSender) {
              audioSender.replaceTrack(fallbackMic).catch(() => {});
            }
          });
        }
      }
      originalMicTrackRef.current = null;
      cameraTrackRef.current = null;

      // Close mixing context
      if (mixingCtxRef.current) {
        try { mixingCtxRef.current.close(); } catch {}
        mixingCtxRef.current = null;
      }

      // Exit PiP if active
      if (typeof document !== "undefined" && document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      }

      // Notify other participants that our video/screen is off
      const s = socketRef.current;
      const uid = userIdRef.current;
      if (s && uid) {
        if (hadVideo) {
          s.emit("room-video-toggle", { roomId, userId: uid, isVideoOn: false });
        }
        if (hadScreen) {
          s.emit("room-screen-share", { roomId, userId: uid, isSharing: false });
        }
      }

      // Update participant state in context
      if (uid) {
        setParticipants((prev) =>
          prev.map((p) =>
            p.userId === uid ? { ...p, isVideoOn: false, isScreenSharing: false } : p
          )
        );
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  //  Video ref callbacks
  // ═══════════════════════════════════════════════════════════════════

  /** Callback ref for local video — ensures srcObject is always in sync */
  const attachLocalVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      localVideoElRef.current = el;
      if (el && localVideoStreamRef.current) {
        if (el.srcObject !== localVideoStreamRef.current) {
          el.srcObject = localVideoStreamRef.current;
          el.play().catch(() => {});
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /** Callback ref for remote participant video */
  const attachVideoRef = useCallback(
    (userId: string, el: HTMLVideoElement | null) => {
      if (!el) {
        videoElementsRef.current.delete(userId);
        return;
      }
      videoElementsRef.current.set(userId, el);
      const stream = remoteVideoStreamsRef.current.get(userId);
      if (stream && el.srcObject !== stream) {
        el.srcObject = stream;
        el.play().catch(() => {});
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /** Re-sync local video element when layout / video state changes */
  useEffect(() => {
    const el = localVideoElRef.current;
    const stream = localVideoStreamRef.current;
    if (el && stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
        el.play().catch(() => {});
      }
    }
  }, [isVideoOn, isScreenSharing, layout, spotlightUserId]);

  /** Clear spotlight when the spotlighted user leaves */
  useEffect(() => {
    if (spotlightUserId && !participants.find((p) => p.userId === spotlightUserId)) {
      setSpotlightUserId(null);
    }
  }, [participants, spotlightUserId]);

  // ═══════════════════════════════════════════════════════════════════
  //  Room Chat
  // ═══════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (isMusicOpen && isChatOpen) {
      setIsChatOpen(false);
    }
  }, [isMusicOpen, isChatOpen]);

  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
    }
  }, [isChatOpen]);

  useEffect(() => {
    if (!socket || !roomId) return;

    const handleHistory = (payload: { roomId: string; messages: ChatMessage[] }) => {
      if (payload.roomId !== roomId) return;
      setChatMessages(payload.messages || []);
    };

    const handleMessage = (message: ChatMessage) => {
      if (message.roomId !== roomId) return;
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message].slice(-200);
      });
      if (!isChatOpen && message.userId !== user?._id) {
        setUnreadCount((prev) => prev + 1);
      }
    };

    socket.on("room-chat-history", handleHistory);
    socket.on("room-chat-message", handleMessage);
    socket.emit("room-chat-history-request", { roomId });

    return () => {
      socket.off("room-chat-history", handleHistory);
      socket.off("room-chat-message", handleMessage);
    };
  }, [socket, roomId, user?._id, isChatOpen]);

  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [chatMessages, isChatOpen]);

  const openChatPanel = () => {
    closeMusicPanel();
    setShowToolsMenu(false);
    setIsChatOpen(true);
  };

  const addPendingFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setPendingFiles((prev) => [...prev, ...files]);
    const count = files.length;
    toast.success(`${count} file${count === 1 ? "" : "s"} added. Tap Send to share.`);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadChatFiles = async (files: File[]) => {
    if (!files.length) return [] as ChatAttachment[];
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("roomId", roomId);
      if (user?._id) formData.append("userId", user._id);
      files.forEach((file) => formData.append("files", file, file.name));

      const response = await fetch("/api/rooms/chat/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Upload failed");
      }
      return (data.attachments || []) as ChatAttachment[];
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!socket || !user || !roomId) return;
    const trimmed = chatInput.trim();
    if (!trimmed && pendingFiles.length === 0) return;

    let attachments: ChatAttachment[] = [];
    if (pendingFiles.length > 0) {
      try {
        attachments = await uploadChatFiles(pendingFiles);
      } catch (error: any) {
        console.error(error);
        const message = error?.message || "Failed to upload files";
        toast.error(message);
        return;
      }
    }

    const message: ChatMessage = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      roomId,
      userId: user._id,
      userName: user.name,
      userAvatar: user.avatarConfig?.image || null,
      content: trimmed,
      attachments,
      createdAt: new Date().toISOString(),
    };

    setChatMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      return [...prev, message].slice(-200);
    });
    socket.emit("room-chat-message", message);
    setChatInput("");
    setPendingFiles([]);
    setShowEmojiPicker(false);
  };

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    const kb = size / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const formatChatTime = (value: string) =>
    new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const emojiOptions = ["😀", "😂", "😍", "🥳", "🤝", "👍", "🔥", "😢", "😮", "🎉"];

  const handleAddEmoji = (emoji: string) => {
    setChatInput((prev) => `${prev}${emoji}`);
    setShowEmojiPicker(false);
  };


  // ═══════════════════════════════════════════════════════════════════
  //  Toggle Camera
  // ═══════════════════════════════════════════════════════════════════

  const toggleCamera = async () => {
    if (isVideoOn) {
      // ─── Turn camera OFF ────────────────────────────────
      for (const [, pc] of peerConnectionsRef.current) {
        const videoSender = pc.getSenders().find((s) => {
          if (s.track?.kind === "video") return true;
          const tx = pc.getTransceivers().find((t) => t.sender === s && t.receiver.track?.kind === "video");
          return !!tx;
        });
        if (videoSender) {
          await videoSender.replaceTrack(null);
        }
      }

      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current = null;
      }
      if (localVideoStreamRef.current) {
        localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
        localVideoStreamRef.current = null;
      }
      if (localVideoElRef.current) {
        localVideoElRef.current.srcObject = null;
      }

      setIsVideoOn(false);
      setParticipants((prev) =>
        prev.map((p) => (p.userId === user?._id ? { ...p, isVideoOn: false } : p))
      );
      if (socket && roomId) {
        socket.emit("room-video-toggle", { roomId, userId: user?._id, isVideoOn: false });
      }
    } else {
      // ─── Turn camera ON ─────────────────────────────────
      try {
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { min: 640, ideal: 1920, max: 1920 },
            height: { min: 480, ideal: 1080, max: 1080 },
            frameRate: { ideal: 30, max: 60 }, // 30 FPS standard, up to 60 FPS peak
          },
        });
        const videoTrack = cameraStream.getVideoTracks()[0];
        if (!videoTrack) return;

        localVideoTrackRef.current = videoTrack;
        localVideoStreamRef.current = cameraStream;

        // Replace track on all peers AND renegotiate
        for (const [peerId, pc] of peerConnectionsRef.current) {
          const videoSender = pc.getSenders().find((s) => {
            if (s.track?.kind === "video") return true;
            const tx = pc.getTransceivers().find((t) => t.sender === s && t.receiver.track?.kind === "video");
            return !!tx;
          });
          if (videoSender) {
            await videoSender.replaceTrack(videoTrack);

            if (pc.signalingState === "stable" && socket) {
              try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit("room-signal", {
                  roomId,
                  targetUserId: peerId,
                  signal: { type: "offer", sdp: offer },
                });
              } catch (err) {
                console.error(`Failed to renegotiate with ${peerId}:`, err);
              }
            }
          }
        }

        if (localVideoElRef.current) {
          localVideoElRef.current.srcObject = cameraStream;
          localVideoElRef.current.play().catch(() => {});
        }

        setIsVideoOn(true);
        setParticipants((prev) =>
          prev.map((p) => (p.userId === user?._id ? { ...p, isVideoOn: true } : p))
        );
        if (socket && roomId) {
          socket.emit("room-video-toggle", { roomId, userId: user?._id, isVideoOn: true });
        }
      } catch (err) {
        console.error("Failed to get camera:", err);
        toast.error("Camera access denied or unavailable.");
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  Toggle Screen Share
  // ═══════════════════════════════════════════════════════════════════

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      // ─── START screen sharing ───────────────────────────
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: "always",
            frameRate: { ideal: 30, max: 60 }, // Higher FPS for smoother screen sharing
          } as MediaTrackConstraints,
          audio: true,
          systemAudio: "include",
        } as DisplayMediaStreamOptions);

        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) return;

        // Save camera track if we have one
        cameraTrackRef.current = localVideoTrackRef.current;

        // Replace video track on ALL peers AND renegotiate
        for (const [peerId, pc] of peerConnectionsRef.current) {
          const videoSender = pc.getSenders().find((s) => {
            if (s.track?.kind === "video") return true;
            const tx = pc.getTransceivers().find((t) => t.sender === s && t.receiver.track?.kind === "video");
            return !!tx;
          });
          if (videoSender) {
            await videoSender.replaceTrack(screenTrack);

            if (pc.signalingState === "stable" && socket) {
              try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit("room-signal", {
                  roomId,
                  targetUserId: peerId,
                  signal: { type: "offer", sdp: offer },
                });
              } catch (err) {
                console.error(`Failed to renegotiate screen share with ${peerId}:`, err);
              }
            }
          }
        }

        // Handle screen audio + mic mixing
        const screenAudioTracks = screenStream.getAudioTracks();
        if (screenAudioTracks.length > 0) {
          const micTrack = localStreamRef.current?.getAudioTracks()[0] || null;
          if (micTrack) originalMicTrackRef.current = micTrack;

          const mixCtx = new AudioContext();
          mixingCtxRef.current = mixCtx;
          const destination = mixCtx.createMediaStreamDestination();

          // Screen audio
          const screenAudioStream = new MediaStream(screenAudioTracks);
          const screenSource = mixCtx.createMediaStreamSource(screenAudioStream);
          const screenGain = mixCtx.createGain();
          screenGain.gain.value = 0.7;
          screenSource.connect(screenGain).connect(destination);

          // Mic audio
          if (micTrack) {
            const micStream = new MediaStream([micTrack]);
            const micSource = mixCtx.createMediaStreamSource(micStream);
            const micGain = mixCtx.createGain();
            micGain.gain.value = 1.0;
            micSource.connect(micGain).connect(destination);
          }

          // Send mixed audio to all peers
          const mixedTrack = destination.stream.getAudioTracks()[0];
          if (mixedTrack) {
            for (const [, pc] of peerConnectionsRef.current) {
              const audioSender = pc.getSenders().find((s) => s.track?.kind === "audio");
              if (audioSender) {
                await audioSender.replaceTrack(mixedTrack);
              }
            }
          }
        }

        screenStreamRef.current = screenStream;
        localVideoTrackRef.current = screenTrack;
        localVideoStreamRef.current = screenStream;

        // Update local preview
        if (localVideoElRef.current) {
          localVideoElRef.current.srcObject = new MediaStream([screenTrack]);
          localVideoElRef.current.play().catch(() => {});
        }

        setIsScreenSharing(true);
        setIsVideoOn(true);
        setParticipants((prev) =>
          prev.map((p) =>
            p.userId === user?._id ? { ...p, isVideoOn: true, isScreenSharing: true } : p
          )
        );
        if (socket && roomId) {
          socket.emit("room-video-toggle", { roomId, userId: user?._id, isVideoOn: true });
          socket.emit("room-screen-share", { roomId, userId: user?._id, isSharing: true });
        }

        // Listen for native "Stop sharing" button
        screenTrack.onended = () => {
          void stopScreenShare();
        };
      } catch (err) {
        console.log("Screen share cancelled or failed:", err);
      }
    } else {
      await stopScreenShare();
    }
  };

  const stopScreenShare = async () => {
    // Stop screen tracks
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    // Restore original mic track (undo audio mixing)
    const savedMicTrack = originalMicTrackRef.current;
    for (const [, pc] of peerConnectionsRef.current) {
      const audioSender = pc.getSenders().find((s) => s.track?.kind === "audio");
      if (audioSender) {
        if (savedMicTrack && savedMicTrack.readyState === "live") {
          await audioSender.replaceTrack(savedMicTrack);
        } else {
          const fallback = localStreamRef.current?.getAudioTracks()[0] || null;
          if (fallback && fallback.readyState === "live") {
            await audioSender.replaceTrack(fallback);
          }
        }
      }
    }
    originalMicTrackRef.current = null;

    // Close mixing context
    if (mixingCtxRef.current) {
      try { await mixingCtxRef.current.close(); } catch {}
      mixingCtxRef.current = null;
    }

    // Restore camera track or remove video
    const savedCameraTrack = cameraTrackRef.current;
    if (savedCameraTrack && savedCameraTrack.readyState === "live") {
      localVideoTrackRef.current = savedCameraTrack;
      for (const [, pc] of peerConnectionsRef.current) {
        const videoSender = pc.getSenders().find((s) => {
          if (s.track?.kind === "video") return true;
          const tx = pc.getTransceivers().find((t) => t.sender === s && t.receiver.track?.kind === "video");
          return !!tx;
        });
        if (videoSender) {
          await videoSender.replaceTrack(savedCameraTrack);
        }
      }
      if (localVideoElRef.current && localVideoStreamRef.current) {
        localVideoElRef.current.srcObject = localVideoStreamRef.current;
      }
      setIsVideoOn(true);
    } else {
      // No camera was on → turn off video entirely
      for (const [, pc] of peerConnectionsRef.current) {
        const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (videoSender) {
          await videoSender.replaceTrack(null);
        }
      }
      localVideoTrackRef.current = null;
      localVideoStreamRef.current = null;
      if (localVideoElRef.current) localVideoElRef.current.srcObject = null;
      setIsVideoOn(false);
      setParticipants((prev) =>
        prev.map((p) => (p.userId === user?._id ? { ...p, isVideoOn: false } : p))
      );
      if (socket && roomId) {
        socket.emit("room-video-toggle", { roomId, userId: user?._id, isVideoOn: false });
      }
    }
    cameraTrackRef.current = null;

    setIsScreenSharing(false);
    setParticipants((prev) =>
      prev.map((p) => (p.userId === user?._id ? { ...p, isScreenSharing: false } : p))
    );
    if (socket && roomId) {
      socket.emit("room-screen-share", { roomId, userId: user?._id, isSharing: false });
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  Picture-in-Picture
  // ═══════════════════════════════════════════════════════════════════

  const togglePiP = async () => {
    if (isInPiP) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
      setIsInPiP(false);
    } else {
      const targetId =
        spotlightUserId ||
        participants.find((p) => p.isVideoOn && p.userId !== user?._id)?.userId;
      if (targetId) {
        const videoEl = videoElementsRef.current.get(targetId);
        if (videoEl && document.pictureInPictureEnabled) {
          try {
            await videoEl.requestPictureInPicture();
            setIsInPiP(true);
          } catch (err) {
            console.error("PiP failed:", err);
          }
        }
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  Leave Room
  // ═══════════════════════════════════════════════════════════════════

  const leaveRoom = () => {
    leaveVoice();
    disconnectMusic();
    router.push("/dashboard/members");
  };

  const toggleScreenShareFullscreen = () => {
    setIsScreenShareFullscreen(prev => !prev);
  };

  // ═══════════════════════════════════════════════════════════════════
  //  Loading / not-found guards
  // ═══════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl">Loading room...</div>
      </div>
    );
  }

  if (!room) {
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  UI
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-zinc-950 p-4 md:p-6 font-dm overflow-hidden flex flex-col rounded-3xl border border-zinc-800/30">
      {/* Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[128px] mix-blend-screen" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-900/10 rounded-full blur-[128px] mix-blend-screen" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto flex-1 flex flex-col">
        {/* Room Header */}
        <header className="flex items-start justify-between mb-8 sm:mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <Volume2 className="w-5 h-5 text-emerald-500" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{room.name}</h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] uppercase font-bold tracking-wider">
                Live
              </span>
            </div>
            {room.description && (
              <p className="text-zinc-400 text-sm max-w-md leading-relaxed ml-1">{room.description}</p>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 border border-zinc-800 rounded-full">
              <div className="flex -space-x-2">
                {participants.slice(0, 3).map((p, i) => (
                  <div key={i} className="w-6 h-6 rounded-full border-2 border-zinc-900 overflow-hidden bg-zinc-800">
                    {p.avatar && <img src={p.avatar} alt="" className="w-full h-full object-cover" />}
                  </div>
                ))}
              </div>
              <span className="text-xs font-semibold text-zinc-400 pl-1">
                {participants.length} / {room.maxParticipants}
              </span>
            </div>

            <button
              onClick={() => (isChatOpen ? setIsChatOpen(false) : openChatPanel())}
              className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-xs font-semibold ${
                isChatOpen
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-emerald-950 text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* ─── SPOTLIGHT LAYOUT ─── */}
        {layout === "spotlight" ? (
          <div className="flex-1 flex flex-col pb-24 gap-4">
            {/* Main spotlight area */}
            <div
              ref={spotlightContainerRef}
              className={
                isScreenShareFullscreen
                  ? "fixed inset-0 rounded-none z-[99999] bg-zinc-950 overflow-hidden"
                  : "flex-1 relative rounded-3xl overflow-hidden bg-zinc-900/40 border border-zinc-800/50 min-h-[300px] transition-all"
              }
            >
              {(() => {
                const currentSpotlightId =
                  spotlightUserId ||
                  participants.find((p) => p.isVideoOn || p.isScreenSharing)?.userId ||
                  participants[0]?.userId;
                const sp = participants.find((p) => p.userId === currentSpotlightId);
                if (!sp) return null;
                const isLocal = sp.userId === user?._id;
                const isSharing = sp.isScreenSharing;
                return (
                  <>
                    {sp.isVideoOn ? (
                      isLocal ? (
                        <video
                          ref={(el) => {
                            attachLocalVideoRef(el);
                            spotlightVideoRef.current = el;
                          }}
                          autoPlay
                          playsInline
                          muted
                          className={`absolute inset-0 w-full h-full bg-zinc-950 object-contain`}
                          style={!isScreenSharing ? { transform: "scaleX(-1)" } : undefined}
                        />
                      ) : (
                        <video
                          ref={(el) => {
                            attachVideoRef(sp.userId, el);
                            spotlightVideoRef.current = el;
                          }}
                          autoPlay
                          playsInline
                          muted
                          className={`absolute inset-0 w-full h-full bg-zinc-950 object-contain`}
                        />
                      )
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="w-32 h-32 rounded-full overflow-hidden mb-4" style={{ backgroundColor: sp.color || "#27272a" }}>
                          {sp.avatar ? (
                            <img src={sp.avatar} alt={sp.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white text-5xl font-bold opacity-80">
                              {sp.name?.[0]?.toUpperCase() || "U"}
                            </div>
                          )}
                        </div>
                        <h3 className="text-white text-xl font-semibold">{sp.name}</h3>
                      </div>
                    )}
                    {/* Overlay info */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 z-20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <h3 className="text-white font-medium">{sp.name}</h3>
                          {sp.userId === user?._id && (
                            <span className="text-[10px] text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded uppercase">You</span>
                          )}
                          {sp.isScreenSharing && (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              <MonitorUp className="w-3 h-3" /> Sharing
                            </span>
                          )}
                          {sp.isSpeaking && (
                            <div className="flex items-center gap-0.5 ml-1">
                              {[0, 0.1, 0.2].map((d, i) => (
                                <span
                                  key={i}
                                  className="w-0.5 bg-emerald-400 rounded-full"
                                  style={{
                                    height: i === 1 ? "6px" : "4px",
                                    animation: "soundwave 0.6s ease-in-out infinite",
                                    animationDelay: `${d}s`,
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        {sp.userId !== user?._id && (
                          <div className="flex items-center gap-2 bg-zinc-950/75 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800/50 mr-2 shadow-lg" onClick={(e) => e.stopPropagation()}>
                            <button
                              tabIndex={-1}
                              onFocus={(e) => e.currentTarget.blur()}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.currentTarget.blur();
                                setUserMute(sp.userId, !userMutes[sp.userId]);
                              }}
                              className={`p-1 rounded-md transition ${
                                userMutes[sp.userId]
                                  ? "text-red-400 hover:bg-red-500/10"
                                  : "text-zinc-400 hover:bg-zinc-850 hover:text-white"
                              }`}
                              title={userMutes[sp.userId] ? "Unmute locally" : "Mute locally"}
                            >
                              {userMutes[sp.userId] ? (
                                <VolumeX className="w-4 h-4" />
                              ) : (
                                <Volume2 className="w-4 h-4" />
                              )}
                            </button>
                            
                            <div className="w-20 flex items-center">
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={Math.round((userVolumes[sp.userId] !== undefined ? userVolumes[sp.userId] : 1.0) * 100)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setUserVolume(sp.userId, parseInt(e.target.value, 10) / 100);
                                }}
                                className="w-full accent-emerald-500 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer outline-none transition hover:bg-zinc-600"
                                title={`Local Volume: ${Math.round((userVolumes[sp.userId] !== undefined ? userVolumes[sp.userId] : 1.0) * 100)}%`}
                              />
                            </div>
                          </div>
                        )}
                        {(sp.isScreenSharing || sp.isVideoOn) && (
                          <button
                            onClick={toggleScreenShareFullscreen}
                            className="ml-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                            title={isScreenShareFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                          >
                            {isScreenShareFullscreen ? (
                              <Minimize2 className="w-4 h-4" />
                            ) : (
                              <Maximize2 className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Speaking border */}
                    {sp.isSpeaking && (
                      <div className="absolute inset-0 rounded-3xl border-2 border-emerald-500/50 z-30 pointer-events-none" />
                    )}
                    {/* Mute badge */}
                    {sp.isMuted && (
                      <div className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-zinc-700/80 backdrop-blur-sm flex items-center justify-center">
                        <MicOff className="w-4 h-4 text-red-400" />
                      </div>
                    )}
                    {/* Local Mute badge */}
                    {userMutes[sp.userId] && (
                      <div className="absolute top-3 left-3 z-30 w-8 h-8 rounded-full bg-red-500/20 backdrop-blur-sm flex items-center justify-center border border-red-500/30">
                        <VolumeX className="w-4 h-4 text-red-400" />
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Bottom strip — everyone EXCEPT the current spotlight user */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {(() => {
                const currentSpotlightId =
                  spotlightUserId ||
                  participants.find((p) => p.isVideoOn || p.isScreenSharing)?.userId ||
                  participants[0]?.userId;
                return participants
                  .filter((p) => p.userId !== currentSpotlightId)
                  .map((p) => (
                    <div
                      key={p.userId}
                      onClick={() => setSpotlightUserId(p.userId)}
                      className={`group relative flex-shrink-0 w-28 h-28 rounded-2xl overflow-hidden bg-zinc-900/60 border cursor-pointer transition-all hover:border-zinc-600 ${
                        p.isSpeaking ? "border-emerald-500/50" : "border-zinc-800/50"
                      }`}
                    >
                      {p.isVideoOn ? (
                        p.userId === user?._id ? (
                          <video
                            ref={attachLocalVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                            style={!isScreenSharing ? { transform: "scaleX(-1)" } : undefined}
                          />
                        ) : (
                          <video
                            ref={(el) => attachVideoRef(p.userId, el)}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                          />
                        )
                      ) : (
                        <div
                          className="w-full h-full flex flex-col items-center justify-center"
                          style={{ backgroundColor: p.color || "#27272a" }}
                        >
                          {p.avatar ? (
                            <img src={p.avatar} alt={p.name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <span className="text-white text-lg font-bold opacity-80">
                              {p.name?.[0]?.toUpperCase()}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                        <span className="text-white text-[10px] font-medium truncate block">{p.name}</span>
                      </div>
                      {p.isScreenSharing && (
                        <div className="absolute top-1 right-1 bg-emerald-500/20 rounded p-0.5">
                          <MonitorUp className="w-2.5 h-2.5 text-emerald-400" />
                        </div>
                      )}
                      {p.isMuted && (
                        <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-zinc-700/80 flex items-center justify-center">
                          <MicOff className="w-2.5 h-2.5 text-red-400" />
                        </div>
                      )}
                      {/* Local Mute Badge / Button in Sidebar */}
                      {p.userId !== user?._id && (
                        <button
                          tabIndex={-1}
                          onFocus={(e) => e.currentTarget.blur()}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.currentTarget.blur();
                            setUserMute(p.userId, !userMutes[p.userId]);
                          }}
                          className={`absolute top-1 left-7 w-5 h-5 rounded-full backdrop-blur-sm flex items-center justify-center border transition z-30 ${
                            userMutes[p.userId]
                              ? "bg-red-500/20 border-red-500/30 text-red-400"
                              : "bg-zinc-800/80 border-zinc-700/50 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-white"
                          }`}
                          title={userMutes[p.userId] ? "Unmute locally" : "Mute locally"}
                        >
                          {userMutes[p.userId] ? (
                            <VolumeX className="w-2.5 h-2.5" />
                          ) : (
                            <Volume2 className="w-2.5 h-2.5" />
                          )}
                        </button>
                      )}
                    </div>
                  ));
              })()}
            </div>
          </div>
        ) : (
          /* ─── GRID LAYOUT ─── */
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 content-start pb-24 grid-flow-dense">
            <AnimatePresence mode="popLayout">
              {participants.map((participant) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  key={participant.userId}
                  className={`group relative rounded-3xl bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/50 overflow-hidden flex flex-col items-center justify-center transition-all hover:bg-zinc-800/40 hover:border-zinc-700/50 hover:shadow-xl hover:shadow-black/20 ${
                    (participant.isVideoOn || participant.isScreenSharing)
                      ? "col-span-2 row-span-2 aspect-video"
                      : "aspect-[3/4]"
                  }`}
                >
                  {/* Video — shown when participant has video on or is screen sharing */}
                  {(participant.isVideoOn || participant.isScreenSharing) ? (
                    <>
                      {participant.userId === user?._id ? (
                        <video
                          ref={attachLocalVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="absolute inset-0 w-full h-full object-cover z-10"
                          style={!isScreenSharing ? { transform: "scaleX(-1)" } : undefined}
                        />
                      ) : (
                        <video
                          ref={(el) => attachVideoRef(participant.userId, el)}
                          autoPlay
                          playsInline
                          muted
                          className="absolute inset-0 w-full h-full object-cover z-10"
                        />
                      )}
                      {/* Overlay bar */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 z-20">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white text-xs font-medium truncate">{participant.name}</h3>
                          {participant.userId === user?._id && (
                            <span className="text-[9px] text-zinc-400 bg-zinc-800/80 px-1 py-0.5 rounded uppercase">You</span>
                          )}
                          {participant.isScreenSharing && <MonitorUp className="w-3 h-3 text-emerald-400" />}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Avatar fallback */
                    <>
                      <div className="relative mb-4 p-4">
                        <div className="relative z-10 w-20 h-20 md:w-24 md:h-24 rounded-full p-1 bg-gradient-to-b from-zinc-700 to-zinc-800 shadow-lg">
                          <div
                            className="w-full h-full rounded-full overflow-hidden bg-zinc-900 flex items-center justify-center text-white"
                            style={{ backgroundColor: participant.color || "#27272a" }}
                          >
                            {participant.avatar ? (
                              <img src={participant.avatar} alt={participant.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-2xl font-bold opacity-80">
                                {participant.name?.[0]?.toUpperCase() || "U"}
                              </span>
                            )}
                          </div>
                        </div>
                        {participant.isSpeaking && (
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-zinc-900 flex items-center justify-center z-20 animate-pulse">
                            <Mic className="w-3 h-3 text-emerald-950" />
                          </div>
                        )}
                      </div>
                      <div className="text-center w-full relative z-10 px-2 space-y-1">
                        <h3 className="text-white font-semibold truncate text-sm md:text-base tracking-tight">
                          {participant.name}
                        </h3>
                        {participant.userId === user?._id && (
                          <div className="inline-block px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            You
                          </div>
                        )}
                        {participant.isSpeaking && (
                          <div className="flex items-center justify-center gap-0.5 h-3 mt-2">
                            {[...Array(5)].map((_, i) => (
                              <div
                                key={i}
                                className="w-1 bg-emerald-500 rounded-full animate-music-bar"
                                style={{ animationDelay: `${i * 0.1}s`, height: "100%" }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Speaking border (both modes) */}
                  {participant.isSpeaking && (
                    <div className="absolute inset-0 rounded-3xl border-2 border-emerald-500/50 shadow-[inset_0_0_20px_rgba(16,185,129,0.2)] z-30 pointer-events-none" />
                  )}
                  {/* Mute badge */}
                  {participant.isMuted && (
                    <div className="absolute top-2 right-2 z-40 w-7 h-7 rounded-full bg-zinc-700/80 backdrop-blur-sm flex items-center justify-center">
                      <MicOff className="w-3.5 h-3.5 text-red-400" />
                    </div>
                  )}

                  {/* Local Mute Badge (when not hovered) */}
                  {userMutes[participant.userId] && (
                    <div className="absolute top-2 left-2 z-30 group-hover:opacity-0 transition-opacity duration-200 w-7 h-7 rounded-full bg-red-500/20 backdrop-blur-sm flex items-center justify-center border border-red-500/30">
                      <VolumeX className="w-3.5 h-3.5 text-red-400" />
                    </div>
                  )}

                  {/* Local per-user Volume/Mute controls overlay (when hovered) */}
                  {participant.userId !== user?._id && (
                    <div className="absolute top-2 left-2 z-40 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-zinc-950/80 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-zinc-800/60 shadow-lg" onClick={(e) => e.stopPropagation()}>
                      <button
                        tabIndex={-1}
                        onFocus={(e) => e.currentTarget.blur()}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.currentTarget.blur();
                          setUserMute(participant.userId, !userMutes[participant.userId]);
                        }}
                        className={`p-1 rounded-md transition ${
                          userMutes[participant.userId]
                            ? "text-red-400 hover:bg-red-500/10"
                            : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                        }`}
                        title={userMutes[participant.userId] ? "Unmute locally" : "Mute locally"}
                      >
                        {userMutes[participant.userId] ? (
                          <VolumeX className="w-3.5 h-3.5" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                      
                      <div className="w-16 flex items-center">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={Math.round((userVolumes[participant.userId] !== undefined ? userVolumes[participant.userId] : 1.0) * 100)}
                          onChange={(e) => {
                            e.stopPropagation();
                            setUserVolume(participant.userId, parseInt(e.target.value, 10) / 100);
                          }}
                          className="w-full accent-emerald-500 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer outline-none transition hover:bg-zinc-600"
                          title={`Local Volume: ${Math.round((userVolumes[participant.userId] !== undefined ? userVolumes[participant.userId] : 1.0) * 100)}%`}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

        {/* ─── Floating Controls ─── */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-fit px-4">
          <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/50 p-2 rounded-2xl shadow-2xl flex items-center gap-1.5 md:gap-2 ring-1 ring-white/5">
            {/* Mic */}
            <div className="relative flex items-center">
              <button
                tabIndex={-1}
                onFocus={(e) => e.currentTarget.blur()}
                onClick={(e) => {
                  e.currentTarget.blur();
                  toggleMute();
                }}
                className={`p-3 md:p-3.5 rounded-xl transition-all duration-200 group relative cursor-pointer ${
                  isMuted
                    ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                    : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                }`}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-950 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-zinc-800">
                  {isMuted ? "Unmute" : "Mute"}
                </span>
              </button>
              <button
                tabIndex={-1}
                onFocus={(e) => e.currentTarget.blur()}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setShowMicMenu((prev) => !prev);
                  setShowSpeakerMenu(false);
                }}
                className="ml-1 p-2 rounded-lg bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-all"
                aria-label="Select microphone"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              {showMicMenu && (
                <div className="absolute bottom-full mb-3 left-0 w-56 rounded-2xl border border-zinc-800/60 bg-zinc-950/95 backdrop-blur-xl p-2 shadow-2xl z-[70]">
                  <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-500">Microphone</p>
                  <div className="max-h-48 overflow-y-auto overscroll-contain no-scrollbar">
                    {availableMics.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-zinc-500">No microphones found</p>
                    ) : (
                      availableMics.map((mic, index) => (
                        <button
                          key={mic.deviceId}
                          tabIndex={-1}
                          onFocus={(e) => e.currentTarget.blur()}
                          onClick={(e) => {
                            e.currentTarget.blur();
                            if (typeof document !== "undefined") {
                              (document.activeElement as HTMLElement)?.blur();
                            }
                            void switchMicDevice(mic.deviceId);
                            setShowMicMenu(false);
                          }}
                          className={`w-full text-left px-2 py-2 rounded-lg text-xs transition ${
                            mic.deviceId === selectedMicId
                              ? "bg-emerald-500/10 text-emerald-300"
                              : "text-zinc-300 hover:bg-zinc-800/70"
                          }`}
                        >
                          {mic.label || `Microphone ${index + 1}`}
                        </button>
                      ))
                    )}
                  </div>
                  {/* PTT Toggle */}
                  <div className="border-t border-zinc-800/60 mt-1 pt-1">
                    <button
                      tabIndex={-1}
                      onFocus={(e) => e.currentTarget.blur()}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        if (typeof document !== "undefined") {
                          (document.activeElement as HTMLElement)?.blur();
                        }
                        setIsPTTEnabled(!isPTTEnabled);
                        setShowMicMenu(false); // Close dropdown immediately!
                      }}
                      className={`w-full flex items-center justify-between px-2 py-2 rounded-lg text-xs transition cursor-pointer ${
                        isPTTEnabled
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200"
                      }`}
                    >
                      <span>Push-to-Talk</span>
                      <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full ${
                        isPTTEnabled
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-zinc-800 text-zinc-500"
                      }`}>
                        {isPTTEnabled ? "ON" : "OFF"}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Deafen */}
            <div className="relative flex items-center">
              <button
                tabIndex={-1}
                onFocus={(e) => e.currentTarget.blur()}
                onClick={toggleDeafen}
                className={`p-3 md:p-3.5 rounded-xl transition-all duration-200 group relative cursor-pointer ${
                  isDeafened
                    ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                    : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                }`}
              >
                {isDeafened ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-950 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-zinc-800">
                  {isDeafened ? "Undeafen" : "Deafen"}
                </span>
              </button>
              <button
                tabIndex={-1}
                onFocus={(e) => e.currentTarget.blur()}
                onClick={() => {
                  setShowSpeakerMenu((prev) => !prev);
                  setShowMicMenu(false);
                }}
                className="ml-1 p-2 rounded-lg bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-all"
                aria-label="Select speaker"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              {showSpeakerMenu && (
                <div className="absolute bottom-full mb-3 left-0 w-56 rounded-2xl border border-zinc-800/60 bg-zinc-950/95 backdrop-blur-xl p-2 shadow-2xl z-[70]">
                  <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-500">Speaker</p>
                  <div className="max-h-48 overflow-y-auto overscroll-contain no-scrollbar">
                    {availableSpeakers.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-zinc-500">No speakers found</p>
                    ) : (
                      availableSpeakers.map((speaker, index) => (
                        <button
                          key={speaker.deviceId}
                          tabIndex={-1}
                          onFocus={(e) => e.currentTarget.blur()}
                          onClick={() => {
                            void setSpeakerDevice(speaker.deviceId);
                            setShowSpeakerMenu(false);
                          }}
                          className={`w-full text-left px-2 py-2 rounded-lg text-xs transition ${
                            speaker.deviceId === selectedSpeakerId
                              ? "bg-emerald-500/10 text-emerald-300"
                              : "text-zinc-300 hover:bg-zinc-800/70"
                          }`}
                        >
                          {speaker.label || `Speaker ${index + 1}`}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-8 bg-zinc-800" />

            {/* Camera */}
            <button
              tabIndex={-1}
              onFocus={(e) => e.currentTarget.blur()}
              onClick={() => void toggleCamera()}
              className={`p-3 md:p-3.5 rounded-xl transition-all duration-200 group relative cursor-pointer ${
                isVideoOn && !isScreenSharing
                  ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              {isVideoOn && !isScreenSharing ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-950 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-zinc-800">
                {isVideoOn && !isScreenSharing ? "Camera Off" : "Camera On"}
              </span>
            </button>

            {/* Screen Share */}
            <button
              tabIndex={-1}
              onFocus={(e) => e.currentTarget.blur()}
              onClick={() => void toggleScreenShare()}
              className={`p-3 md:p-3.5 rounded-xl transition-all duration-200 group relative cursor-pointer ${
                isScreenSharing
                  ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-950 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-zinc-800">
                {isScreenSharing ? "Stop Sharing" : "Share Screen"}
              </span>
            </button>

            {/* PiP */}
            {participants.some((p) => p.isVideoOn && p.userId !== user?._id) && (
              <button
                tabIndex={-1}
                onFocus={(e) => e.currentTarget.blur()}
                onClick={() => void togglePiP()}
                className={`p-3 md:p-3.5 rounded-xl transition-all duration-200 group relative cursor-pointer ${
                  isInPiP
                    ? "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                    : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                }`}
              >
                <PictureInPicture2 className="w-5 h-5" />
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-950 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-zinc-800">
                  {isInPiP ? "Exit PiP" : "Picture-in-Picture"}
                </span>
              </button>
            )}

            <div className="w-px h-8 bg-zinc-800" />

            {/* Layout toggle (hidden on mobile) */}
            <button
              tabIndex={-1}
              onFocus={(e) => e.currentTarget.blur()}
              onClick={() => setLayout((l) => (l === "grid" ? "spotlight" : "grid"))}
              className="hidden sm:block p-3 md:p-3.5 rounded-xl bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-all duration-200 group relative cursor-pointer"
            >
              {layout === "grid" ? <LayoutGrid className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-950 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-zinc-800">
                {layout === "grid" ? "Spotlight" : "Grid"}
              </span>
            </button>

            {/* Chat (mobile) */}
            <button
              tabIndex={-1}
              onFocus={(e) => e.currentTarget.blur()}
              onClick={() => (isChatOpen ? setIsChatOpen(false) : openChatPanel())}
              className={`sm:hidden p-3 md:p-3.5 rounded-xl transition-all duration-200 group relative cursor-pointer ${
                isChatOpen
                  ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-emerald-500 text-emerald-950 text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-950 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-zinc-800">
                Room Chat
              </span>
            </button>

            {/* Tools */}
            <div className="relative">
              <button
                tabIndex={-1}
                onFocus={(e) => e.currentTarget.blur()}
                onClick={() => setShowToolsMenu(!showToolsMenu)}
                className={`p-3 md:p-3.5 rounded-xl transition-all duration-200 group relative cursor-pointer ${
                  isMusicOpen
                    ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                }`}
              >
                <Wrench className="w-5 h-5" />
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-950 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-zinc-800">
                  Tools
                </span>
              </button>

              {/* Tools dropdown */}
              <AnimatePresence>
                {showToolsMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-52 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-2 shadow-2xl ring-1 ring-white/5 z-[60]"
                  >
                    <button
                      tabIndex={-1}
                      onFocus={(e) => e.currentTarget.blur()}
                      onClick={() => {
                        openMusicPlayer(roomId);
                        setIsChatOpen(false);
                        setShowToolsMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-all cursor-pointer"
                    >
                      <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <Music className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Play Music</p>
                        <p className="text-[10px] text-zinc-500">YouTube music bot</p>
                      </div>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="w-px h-8 bg-zinc-800" />

            {/* Leave */}
            <button
              tabIndex={-1}
              onFocus={(e) => e.currentTarget.blur()}
              onClick={leaveRoom}
              className="p-3 md:p-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-900/20 group relative cursor-pointer"
            >
              <PhoneOff className="w-5 h-5" />
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-950 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-zinc-800">
                Leave Room
              </span>
            </button>

            {/* Mobile participant count */}
            <div className="sm:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
              <span className="text-xs font-bold text-zinc-400">{participants.length}</span>
            </div>
          </div>
        </div>

      {/* Close tools menu on click outside */}
      {showToolsMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowToolsMenu(false)}
        />
      )}

      {/* Room Chat Panel */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[55] sm:hidden"
              onClick={() => setIsChatOpen(false)}
            />
            <motion.aside
              initial={{ x: 480, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 480, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="fixed top-0 right-0 h-full w-full sm:w-[380px] md:w-[420px] sm:min-w-[280px] sm:max-w-[90vw] sm:resize-x sm:overflow-hidden bg-zinc-950/95 backdrop-blur-xl border-l border-zinc-800/60 z-[60] flex flex-col min-h-0 shadow-2xl ring-1 ring-white/5"
            >
              <div className="px-5 py-4 border-b border-zinc-800/70 flex items-center justify-between bg-gradient-to-b from-zinc-950/90 to-transparent">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-zinc-500">Room Chat</p>
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-semibold tracking-tight">{room?.name || "Room"}</h3>
                      <span className="flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                        Live
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div ref={chatListRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain no-scrollbar px-5 py-4 space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-emerald-400/80" />
                    </div>
                    <p className="text-sm">Start the conversation. Your room chat lives here.</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isMine = msg.userId === user?._id;
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[82%] rounded-2xl px-3.5 py-3 border shadow-sm break-words ${
                          isMine
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-50 shadow-emerald-500/10"
                            : "bg-zinc-900/70 border-zinc-800/60 text-zinc-100"
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            {!isMine && (
                              <div className="w-6 h-6 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700">
                                {msg.userAvatar ? (
                                  <img src={msg.userAvatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-white/80">
                                    {msg.userName?.[0]?.toUpperCase() || "U"}
                                  </div>
                                )}
                              </div>
                            )}
                            <span className={`text-xs font-semibold ${isMine ? "text-emerald-200" : "text-zinc-300"}`}>
                              {isMine ? "You" : msg.userName}
                            </span>
                            <span className="text-[10px] text-zinc-500">{formatChatTime(msg.createdAt)}</span>
                          </div>

                          {msg.content && (
                            <p className="text-sm leading-relaxed text-zinc-100/90 whitespace-pre-wrap break-words">
                              {msg.content}
                            </p>
                          )}

                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {msg.attachments.map((file) => {
                                const isExpired = new Date(file.expiresAt).getTime() <= Date.now();
                                const isImage = file.type?.startsWith("image/");
                                return (
                                  <div
                                    key={file.key}
                                    className={`rounded-xl border px-3 py-2 ${
                                      isExpired
                                        ? "border-zinc-800 bg-zinc-900/40 text-zinc-500"
                                        : "border-zinc-800/70 bg-zinc-900/70 text-zinc-200"
                                    }`}
                                  >
                                    {isImage && !isExpired ? (
                                      <a href={file.url} target="_blank" rel="noreferrer" className="block">
                                        <img
                                          src={file.url}
                                          alt={file.name}
                                          className="w-full max-h-56 object-cover rounded-lg border border-zinc-800/60"
                                          loading="lazy"
                                        />
                                      </a>
                                    ) : null}
                                    <div className="flex items-center justify-between gap-3 mt-2">
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold truncate">{file.name}</p>
                                        <p className="text-[10px] text-zinc-500">{formatFileSize(file.size)}</p>
                                      </div>
                                      {isExpired ? (
                                        <span className="text-[10px] uppercase text-zinc-500">Expired</span>
                                      ) : (
                                        <a
                                          href={file.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-[10px] uppercase text-emerald-300 hover:text-emerald-200"
                                        >
                                          Open
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {pendingFiles.length > 0 && (
                <div className="px-5 pb-2 space-y-2">
                  {pendingFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-zinc-800/70 bg-zinc-900/60">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-200 truncate">{file.name}</p>
                          <p className="text-[10px] text-zinc-500">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removePendingFile(index)}
                        className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800/70"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-4 border-t border-zinc-800/70 bg-zinc-950/90">
                <div className="flex items-end gap-2">
                  <div className="flex-1 rounded-2xl border border-zinc-800/80 bg-zinc-900/70 px-3 py-2 transition focus-within:border-emerald-500/40 focus-within:ring-1 focus-within:ring-emerald-500/30">
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                      placeholder="Message the room..."
                      rows={1}
                      className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 resize-none focus:outline-none"
                    />
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setShowEmojiPicker((prev) => !prev)}
                      className="p-2.5 rounded-xl bg-zinc-800/70 text-zinc-400 hover:text-white hover:bg-zinc-700 transition"
                      type="button"
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-12 right-0 z-20 w-48 rounded-2xl border border-zinc-800/70 bg-zinc-950/95 p-2 shadow-2xl">
                        <div className="grid grid-cols-5 gap-1">
                          {emojiOptions.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleAddEmoji(emoji)}
                              className="rounded-lg p-1.5 text-lg hover:bg-zinc-800/70 transition"
                              type="button"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 rounded-xl bg-zinc-800/70 text-zinc-400 hover:text-white hover:bg-zinc-700 transition"
                    disabled={isUploading}
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => void handleSendMessage()}
                    disabled={isUploading || (!chatInput.trim() && pendingFiles.length === 0)}
                    className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                {isUploading && (
                  <p className="text-[10px] text-emerald-400 mt-2">Uploading files...</p>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addPendingFiles(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Music Player Panel – now rendered persistently in dashboard layout */}

      {/* Hidden video element used by canvas-based Picture-in-Picture.
          autopictureinpicture (Chrome 80+) lets Chrome trigger PiP automatically
          when the page is hidden — no user-gesture required after initial play(). */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={canvasPiPVideoRef}
        muted
        playsInline
        disablePictureInPicture={false}
        style={{ position: "fixed", width: 1, height: 1, opacity: 0, pointerEvents: "none", top: 0, left: 0, zIndex: -1 }}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes music-bar {
          0%, 100% { transform: scaleY(0.5); opacity: 0.5; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        .animate-music-bar {
          animation: music-bar 0.5s ease-in-out infinite alternate;
        }
        @keyframes soundwave {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1.2); }
        }
      ` }} />
    </div>
  );
}

