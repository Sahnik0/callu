"use client";
import { useEffect, useRef, useState } from "react";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { useCall } from "@/context/CallContext";
import { useRoomVoice } from "@/context/RoomVoiceContext";
import { useRoomMusic } from "@/context/RoomMusicContext";
import { Phone, PhoneOff, Mic, MicOff, Minimize2, Maximize2, Video, VideoOff, Volume2, ChevronDown, MonitorUp, MonitorOff, ArrowsUpFromLine, PictureInPicture2 } from "lucide-react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { toast } from "sonner";

// ICE server config shared by both caller and answerer
const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    {
      urls: "turn:a.relay.metered.ca:80",
      username: "87a60b73f341b6abffa20ad6",
      credential: "ePS6V5R5d+xpKOH8",
    },
    {
      urls: "turn:a.relay.metered.ca:443",
      username: "87a60b73f341b6abffa20ad6",
      credential: "ePS6V5R5d+xpKOH8",
    },
    {
      urls: "turn:a.relay.metered.ca:443?transport=tcp",
      username: "87a60b73f341b6abffa20ad6",
      credential: "ePS6V5R5d+xpKOH8",
    },
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: "all",
};

export default function CallManager() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { outgoingCallData, setOutgoingCallData, setIsInCall, isInRoom, currentRoomId, currentRoomName, setIsInRoom, setCurrentRoomId, setCurrentRoomName } = useCall();
  const { isVoiceConnected, leaveVoice, voiceRoomName } = useRoomVoice();
  const { disconnectMusic } = useRoomMusic();

  const [incomingCall, setIncomingCall] = useState<{
    from: string;
    name: string;
    avatar?: string;
    signal: RTCSessionDescriptionInit;
    callType: "voice" | "video";
  } | null>(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [ringtoneMuted, setRingtoneMuted] = useState(false);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [isRemoteSpeaking, setIsRemoteSpeaking] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [remoteVideoAvailable, setRemoteVideoAvailable] = useState(false);
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
  const [availableSpeakers, setAvailableSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string | null>(null);
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string | null>(null);
  const [showMicMenu, setShowMicMenu] = useState(false);
  const [showSpeakerMenu, setShowSpeakerMenu] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);
  const [pipHovered, setPipHovered] = useState(false);
  const [isInPiP, setIsInPiP] = useState(false);

  const myVideo = useRef<HTMLVideoElement>(null);
  const userVideo = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const connectionRef = useRef<RTCPeerConnection | null>(null);
  const incomingRingtone = useRef<HTMLAudioElement | null>(null);
  const outgoingRingtone = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const localSpeakRaf = useRef<number | null>(null);
  const remoteSpeakRaf = useRef<number | null>(null);
  const callStartRef = useRef<number | null>(null);
  const callLoggedRef = useRef(false);

  // Screen sharing refs
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);

  // Audio mixing refs (for screen share + mic mixing)
  const mixingCtxRef = useRef<AudioContext | null>(null);
  const originalMicTrackRef = useRef<MediaStreamTrack | null>(null);
  const [isShareAudioActive, setIsShareAudioActive] = useState(false);

  // ICE candidate buffer - stores candidates that arrive before peer is ready
  const iceCandidateBuffer = useRef<RTCIceCandidateInit[]>([]);
  const audioUnlocked = useRef(false);
  // Use ref for stream so cleanup always has latest value
  const streamRef = useRef<MediaStream | null>(null);

  // Refs for beforeunload call cleanup (avoids stale closures)
  const outgoingCallDataRef = useRef(outgoingCallData);
  const incomingCallRef = useRef(incomingCall);
  useEffect(() => { outgoingCallDataRef.current = outgoingCallData; }, [outgoingCallData]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

  // ─── Notify other party on page close/refresh ───────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      const otherUserId = incomingCallRef.current?.from || outgoingCallDataRef.current?.userId;
      if (otherUserId && socket) {
        socket.emit("end-call", { to: otherUserId, from: user?._id });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [socket, user]);

  // ─── Audio helpers ───────────────────────────────────────────
  const playRingtone = (audio: HTMLAudioElement | null, name: string) => {
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = 1;
    audio.muted = false;
    audio.loop = true;

    audio.play()
      .then(() => console.log(`🔔 ${name} playing`))
      .catch(() => {
        // Try muted fallback (browser may allow muted autoplay)
        audio.muted = true;
        audio.play()
          .then(() => console.log(`🔕 ${name} playing muted — click anywhere to unmute`))
          .catch((e) => console.error(`❌ ${name} completely blocked:`, e.message));
      });
  };

  const stopRingtone = (audio: HTMLAudioElement | null) => {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  };

  const ensureAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const startSpeakingDetector = (
    stream: MediaStream,
    setSpeaking: (value: boolean) => void,
    analyserRef: React.MutableRefObject<AnalyserNode | null>,
    rafRef: React.MutableRefObject<number | null>
  ) => {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let lastSpeaking = false;

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const speaking = average > 15;

      if (speaking !== lastSpeaking) {
        lastSpeaking = speaking;
        setSpeaking(speaking);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    tick();
  };

  // ─── Unlock audio on first-ever user interaction ─────────────
  useEffect(() => {
    const unlock = () => {
      if (audioUnlocked.current) return;
      audioUnlocked.current = true;

      // Resume an AudioContext to globally unlock audio playback
      const ctx = new AudioContext();
      ctx.resume().then(() => {
        ctx.close();
        console.log("🔓 Audio unlocked by user interaction");
      });

      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume();
      }

      // Unmute any playing-but-muted ringtones
      if (incomingRingtone.current && !incomingRingtone.current.paused && incomingRingtone.current.muted) {
        incomingRingtone.current.muted = false;
        incomingRingtone.current.play().catch(() => {});
        console.log("🔊 Incoming ringtone unmuted");
      }
      if (outgoingRingtone.current && !outgoingRingtone.current.paused && outgoingRingtone.current.muted) {
        outgoingRingtone.current.muted = false;
        outgoingRingtone.current.play().catch(() => {});
        console.log("🔊 Outgoing ringtone unmuted");
      }

      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("keydown", unlock);
    };

    document.addEventListener("click", unlock);
    document.addEventListener("touchstart", unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  // ─── Initialize ringtone elements ────────────────────────────
  useEffect(() => {
    // Check if we're in a secure context (required for camera access)
    console.log("🔒 Secure context:", window.isSecureContext);
    console.log("📍 Protocol:", window.location.protocol);
    console.log("🌐 Hostname:", window.location.hostname);
    
    if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      console.warn("⚠️ NOT in secure context! Camera access requires HTTPS (except on localhost)");
    }
    
    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error("❌ getUserMedia is not available in this browser!");
    } else {
      console.log("✅ getUserMedia is available");
    }
    
    // Create a persistent audio element for remote call audio (survives re-renders)
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    audioEl.style.display = 'none';
    document.body.appendChild(audioEl);
    remoteAudioRef.current = audioEl;
    console.log("✅ Created persistent remote audio element");

    incomingRingtone.current = new Audio("/music/callin.mp3");
    incomingRingtone.current.loop = true;
    incomingRingtone.current.volume = 1;
    outgoingRingtone.current = new Audio("/music/ringing.mp3");
    outgoingRingtone.current.loop = true;
    outgoingRingtone.current.volume = 1;

    // Poll for muted ringtones to show UI banner
    const interval = setInterval(() => {
      const incoming = incomingRingtone.current;
      const outgoing = outgoingRingtone.current;
      const isMuted =
        (incoming && !incoming.paused && incoming.muted) ||
        (outgoing && !outgoing.paused && outgoing.muted);
      setRingtoneMuted(!!isMuted);
    }, 200);

    return () => {
      clearInterval(interval);
      // Remove the persistent audio element
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
        remoteAudioRef.current.remove();
        remoteAudioRef.current = null;
      }
    };
  }, []);

  // ─── Local cleanup (no socket emit) ──────────────────────────
  const endCallLocally = () => {
    const shouldLog = callAccepted && !!callStartRef.current;
    if (shouldLog) {
      void logCall("completed");
    }

    stopRingtone(incomingRingtone.current);
    stopRingtone(outgoingRingtone.current);

    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }

    const currentStream = streamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
    }

    if (myVideo.current) myVideo.current.srcObject = null;
    if (userVideo.current) userVideo.current.srcObject = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
    remoteStreamRef.current = null;

    iceCandidateBuffer.current = [];
    setIncomingCall(null);
    setOutgoingCallData(null);
    setCallAccepted(false);
    setIsInCall(false);
    setIsMicOn(true);
    setAudioBlocked(false);
    setIsLocalSpeaking(false);
    setIsRemoteSpeaking(false);
    setIsMinimized(false);

    if (localSpeakRaf.current) cancelAnimationFrame(localSpeakRaf.current);
    if (remoteSpeakRaf.current) cancelAnimationFrame(remoteSpeakRaf.current);
    localSpeakRaf.current = null;
    remoteSpeakRaf.current = null;
    localAnalyserRef.current = null;
    remoteAnalyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsVideoOn(true);
    setRemoteVideoAvailable(false);
    setIsScreenSharing(false);
    setIsSwapped(false);
    setPipHovered(false);
    setIsShareAudioActive(false);
    setIsInPiP(false);

    // Exit PiP if active
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }

    // Cleanup screen share
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    cameraTrackRef.current = null;
    originalMicTrackRef.current = null;

    // Cleanup audio mixing context
    if (mixingCtxRef.current) {
      try {
        mixingCtxRef.current.close();
      } catch {
        // already closed
      }
      mixingCtxRef.current = null;
    }

    socket?.off("call-answered");
  };

  const logCall = async (status: "completed" | "missed" | "rejected") => {
    if (callLoggedRef.current) return;
    if (!callStartRef.current) return;
    const ownerId = user?._id;
    const otherUserId = outgoingCallData ? outgoingCallData.userId : incomingCall?.from;
    const type = outgoingCallData ? "outgoing" : "incoming";
    if (!ownerId || !otherUserId) return;

    const duration = Math.max(0, Math.floor((Date.now() - callStartRef.current) / 1000));
    callLoggedRef.current = true;

    try {
      await fetch("/api/calls/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId,
          otherUserId,
          type,
          duration,
          status,
        }),
      });
    } catch (error) {
      console.error("Failed to log call:", error);
    }
  };

  const cancelOutgoingAttempt = () => {
    stopRingtone(outgoingRingtone.current);

    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }

    const currentStream = streamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
    }

    if (myVideo.current) myVideo.current.srcObject = null;
    if (userVideo.current) userVideo.current.srcObject = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
    remoteStreamRef.current = null;

    iceCandidateBuffer.current = [];
    setOutgoingCallData(null);
    setCallAccepted(false);
    setIsMicOn(true);
  };

  // ─── End call (notify other party + cleanup) ─────────────────
  const endCall = () => {
    const otherUserId = incomingCall?.from || outgoingCallData?.userId;
    if (otherUserId && socket) {
      console.log("📴 Ending call, notifying:", otherUserId);
      socket.emit("end-call", { to: otherUserId, from: user?._id });
    }
    endCallLocally();
  };

  // ─── Flush buffered ICE candidates into peer ─────────────────
  const flushIceCandidates = async (peer: RTCPeerConnection) => {
    const buffered = [...iceCandidateBuffer.current];
    iceCandidateBuffer.current = [];
    if (buffered.length === 0) return;

    console.log(`🧊 Flushing ${buffered.length} buffered ICE candidates`);
    for (const candidate of buffered) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("❌ Error adding buffered ICE candidate:", err);
      }
    }
  };

  // ─── Handle remote ICE candidate (buffer or add) ─────────────
  const handleRemoteIceCandidate = async (candidate: RTCIceCandidateInit) => {
    const peer = connectionRef.current;
    if (peer && peer.remoteDescription) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(`🧊 Added ICE candidate directly`);
      } catch (err) {
        console.error("❌ Error adding ICE candidate:", err);
      }
    } else {
      iceCandidateBuffer.current.push(candidate);
      console.log(`🧊 Buffered ICE candidate (total: ${iceCandidateBuffer.current.length})`);
    }
  };

  // ─── Global socket listeners ─────────────────────────────────
  // This is the KEY fix — signal-received is registered GLOBALLY so
  // we NEVER miss ICE candidates regardless of timing
  useEffect(() => {
    if (!socket) return;

    socket.on("call-made", (data: { from: string; name: string; avatar?: string; signal: RTCSessionDescriptionInit; callType: "voice" | "video" }) => {
      const sameUserAsOutgoing = outgoingCallData?.userId === data.from;

      if (callAccepted) {
        socket.emit("end-call", { to: data.from, from: user?._id });
        return;
      }

      if (sameUserAsOutgoing) {
        cancelOutgoingAttempt();
      }

      setIncomingCall({ from: data.from, name: data.name, avatar: data.avatar, signal: data.signal, callType: data.callType });
      setIsInCall(true);
      iceCandidateBuffer.current = [];
      console.log("📞 Incoming call from", data.name);
      playRingtone(incomingRingtone.current, "Incoming ringtone");
    });

    socket.on("call-ended", () => {
      console.log("📴 Other party ended the call");
      endCallLocally();
    });

    // GLOBAL ICE candidate listener — never misses candidates
    socket.on("signal-received", async (data: { signal: { candidate?: RTCIceCandidateInit }; from: string }) => {
      if (data.signal?.candidate) {
        await handleRemoteIceCandidate(data.signal.candidate);
      }
    });

    return () => {
      socket.off("call-made");
      socket.off("call-ended");
      socket.off("signal-received");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // ─── Play outgoing ringtone ──────────────────────────────────
  useEffect(() => {
    if (outgoingCallData && !callAccepted) {
      console.log("📞 Calling", outgoingCallData.userName);
      playRingtone(outgoingRingtone.current, "Outgoing ringtone");
    } else if (callAccepted) {
      stopRingtone(outgoingRingtone.current);
    }
  }, [outgoingCallData, callAccepted]);

  useEffect(() => {
    if (incomingCall || outgoingCallData) {
      callStartRef.current = null;
      callLoggedRef.current = false;
    }
  }, [incomingCall, outgoingCallData]);

  useEffect(() => {
    if (callAccepted && !callStartRef.current) {
      callStartRef.current = Date.now();
    }
  }, [callAccepted]);

  // ─── Attach remote stream to video element ───────────────────
  const attachRemoteStream = (event: RTCTrackEvent, role: string) => {
    console.log(`[${role}] Received remote track:`, event.track.kind, event.streams.length);
    
    if (!event.streams[0]) {
      console.error(`[${role}] No stream in track event!`);
      return;
    }

    if (event.track.kind === "video") {
      console.log(`[${role}] 📹 VIDEO track received! ID: ${event.track.id}, label: ${event.track.label}, enabled: ${event.track.enabled}`);
      setRemoteVideoAvailable(true);
    }

    // Always store stream in ref first — the re-apply effect will handle the rest
    const remoteStream = event.streams[0];
    remoteStreamRef.current = remoteStream;

    if (userVideo.current) {
      userVideo.current.srcObject = remoteStream;
      userVideo.current.muted = true;
      userVideo.current.volume = 0;
      userVideo.current.play()
        .then(() => console.log(`✅ [${role}] Remote video element playing (muted for video-only)`))
        .catch((err) => console.error(`❌ [${role}] Remote video play failed:`, err.message));
    } else {
      console.warn(`[${role}] userVideo ref is null — stream stored in ref, will be applied by effect`);
    }

    const tracks = remoteStream.getTracks();
    console.log(`[${role}] Set remote stream with ${tracks.length} tracks:`,
      tracks.map((t) => `${t.kind} (${t.label}) enabled:${t.enabled} muted:${t.muted}`)
    );

    // Route audio through the persistent programmatic <audio> element (survives re-renders)
    const audioEl = remoteAudioRef.current;
    if (audioEl) {
      audioEl.srcObject = remoteStream;
      audioEl.muted = false;
      audioEl.volume = 1;
      if (selectedSpeakerId) {
        void applySpeakerSink(selectedSpeakerId);
      }
      audioEl.play()
        .then(() => {
          console.log(`✅ [${role}] Remote audio playing via persistent element (vol: ${audioEl.volume}, muted: ${audioEl.muted})`);
          setAudioBlocked(false);
        })
        .catch((err) => {
          console.error(`❌ [${role}] Remote audio playback failed:`, err.message);
          setAudioBlocked(true);
        });
    } else {
      console.error(`❌ [${role}] Persistent audio element is null! Audio will not work.`);
    }

    startSpeakingDetector(remoteStream, setIsRemoteSpeaking, remoteAnalyserRef, remoteSpeakRaf);
  };

  // ─── Set up peer connection state monitors ───────────────────
  const setupPeerMonitors = (peer: RTCPeerConnection, role: string) => {
    let failTimeout: ReturnType<typeof setTimeout> | null = null;

    peer.onconnectionstatechange = () => {
      console.log(`[${role}] Connection state:`, peer.connectionState);
      if (peer.connectionState === "connected") {
        console.log(`✅ [${role}] Connection established!`);
        if (failTimeout) clearTimeout(failTimeout);
      } else if (peer.connectionState === "failed") {
        console.error(`❌ [${role}] Connection failed, waiting 5s...`);
        failTimeout = setTimeout(() => {
          if (connectionRef.current?.connectionState === "failed") {
            console.error(`❌ [${role}] Still failed after 5s, ending call`);
            endCall();
          }
        }, 5000);
      }
    };

    peer.oniceconnectionstatechange = () => {
      console.log(`[${role}] ICE state:`, peer.iceConnectionState);
      if (peer.iceConnectionState === "connected" || peer.iceConnectionState === "completed") {
        console.log(`✅ [${role}] ICE connected!`);
        if (failTimeout) clearTimeout(failTimeout);
      }
    };

    peer.onicegatheringstatechange = () => {
      console.log(`[${role}] ICE gathering:`, peer.iceGatheringState);
    };
  };

  // ─── START CALL (Caller) ─────────────────────────────────────
  const startCall = async (idToCall: string) => {
    // If in a room, properly disconnect voice + music before starting the call
    if (isVoiceConnected) {
      leaveVoice();
      disconnectMusic();
      toast.info("Disconnected from room to start call");
    }

    try {
      const callType = outgoingCallData?.callType || "voice";
      const mediaConstraints = {
        video: callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        audio: true,
      };
      
      console.log("[CALLER] Requesting media:", mediaConstraints);
      
      let currentStream;
      try {
        currentStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      } catch (mediaErr: any) {
        console.error("[CALLER] getUserMedia failed:", mediaErr);
        const errorMsg = callType === "video" 
          ? `Camera access denied or unavailable: ${mediaErr.message}\n\nPlease ensure:\n1. Camera permission is granted\n2. No other app is using the camera\n3. You're on HTTPS (required for camera access)`
          : `Microphone access denied: ${mediaErr.message}`;
        alert(errorMsg);
        endCall();
        return;
      }
      
      setStream(currentStream);
      streamRef.current = currentStream;
      if (myVideo.current) {
        myVideo.current.srcObject = currentStream;
        console.log("[CALLER] Set local video element srcObject");
      }
      
      const videoTracks = currentStream.getVideoTracks();
      const audioTracks = currentStream.getAudioTracks();
      console.log(`[CALLER] Got local stream - Video tracks: ${videoTracks.length}, Audio tracks: ${audioTracks.length}`);
      
      if (callType === "video" && videoTracks.length === 0) {
        console.warn("[CALLER] Video call requested but no video track obtained!");
        toast.error("Camera not available. Please check your camera permissions and try again.");
        endCall();
        return;
      }
      
      videoTracks.forEach(track => {
        console.log(`[CALLER] Video track: ${track.label}, enabled: ${track.enabled}, muted: ${track.muted}`);
      });
      audioTracks.forEach(track => {
        console.log(`[CALLER] Audio track: ${track.label}, enabled: ${track.enabled}, muted: ${track.muted}`);
      });

      startSpeakingDetector(currentStream, setIsLocalSpeaking, localAnalyserRef, localSpeakRaf);

      const peer = new RTCPeerConnection(ICE_CONFIG);
      connectionRef.current = peer;

      // Add audio tracks
      currentStream.getTracks().forEach((track) => {
        peer.addTrack(track, currentStream);
        console.log("[CALLER] Added track:", track.kind);
      });

      // Set up monitors
      setupPeerMonitors(peer, "CALLER");

      // Send ICE candidates to answerer
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("[CALLER] Sending ICE (type:", event.candidate.type, ")");
          socket?.emit("send-signal", {
            to: idToCall,
            signal: { candidate: event.candidate },
            from: user?._id,
          });
        } else {
          console.log("[CALLER] All ICE candidates sent");
        }
      };

      // Receive audio from answerer
      peer.ontrack = (event) => attachRemoteStream(event, "CALLER");

      // Listen for answer BEFORE sending offer (so we don't miss it)
      socket?.off("call-answered");
      socket?.on("call-answered", async (data: { signal: RTCSessionDescriptionInit; from: string }) => {
        console.log("[CALLER] Received answer", data.signal ? "✅" : "❌ NO SIGNAL");
        if (data.signal?.type && data.signal?.sdp) {
          try {
            await peer.setRemoteDescription(new RTCSessionDescription(data.signal));
            console.log("[CALLER] Set remote description (answer)");

            // NOW flush any ICE candidates that were buffered
            await flushIceCandidates(peer);

            stopRingtone(outgoingRingtone.current);
            setCallAccepted(true);
          } catch (err) {
            console.error("[CALLER] Error setting remote description:", err);
          }
        } else {
          console.error("[CALLER] Invalid signal in call-answered");
        }
      });

      // Create and send offer
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      console.log("[CALLER] Created + sent offer");

      socket?.emit("call-user", {
        userToCall: idToCall,
        signalData: offer,
        from: user?._id,
        name: user?.name,
        avatar: user?.avatarConfig?.image,
        callType: callType,
      });
    } catch (err) {
      console.error("Failed to start call:", err);
      endCall();
    }
  };

  // ─── ANSWER CALL (Answerer) ──────────────────────────────────
  const answerCall = async () => {
    if (!incomingCall) return;

    // If in a room, properly disconnect voice + music before accepting the call
    if (isVoiceConnected) {
      leaveVoice();
      disconnectMusic();
      toast.info("Disconnected from room to accept call");
    }

    // User clicked Accept — this IS a user gesture
    if (incomingRingtone.current?.muted) {
      incomingRingtone.current.muted = false;
    }
    stopRingtone(incomingRingtone.current);
    setCallAccepted(true);

    try {
      const callType = incomingCall.callType || "voice";
      const mediaConstraints = {
        video: callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        audio: true,
      };
      
      console.log("[ANSWERER] Requesting media:", mediaConstraints);
      
      let currentStream;
      try {
        currentStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      } catch (mediaErr: any) {
        console.error("[ANSWERER] getUserMedia failed:", mediaErr);
        const errorMsg = callType === "video" 
          ? `Camera access denied or unavailable: ${mediaErr.message}\n\nPlease ensure:\n1. Camera permission is granted\n2. No other app is using the camera\n3. You're on HTTPS (required for camera access)`
          : `Microphone access denied: ${mediaErr.message}`;
        toast.error(errorMsg);
        endCall();
        return;
      }
      
      setStream(currentStream);
      streamRef.current = currentStream;
      if (myVideo.current) {
        myVideo.current.srcObject = currentStream;
        console.log("[ANSWERER] Set local video element srcObject");
      }
      
      const videoTracks = currentStream.getVideoTracks();
      const audioTracks = currentStream.getAudioTracks();
      console.log(`[ANSWERER] Got local stream - Video tracks: ${videoTracks.length}, Audio tracks: ${audioTracks.length}`);
      
      if (callType === "video" && videoTracks.length === 0) {
        console.warn("[ANSWERER] Video call requested but no video track obtained!");
        toast.error("Camera not available. Please check your camera permissions and try again.");
        endCall();
        return;
      }
      
      videoTracks.forEach(track => {
        console.log(`[ANSWERER] Video track: ${track.label}, enabled: ${track.enabled}, muted: ${track.muted}`);
      });
      audioTracks.forEach(track => {
        console.log(`[ANSWERER] Audio track: ${track.label}, enabled: ${track.enabled}, muted: ${track.muted}`);
      });

      startSpeakingDetector(currentStream, setIsLocalSpeaking, localAnalyserRef, localSpeakRaf);

      const peer = new RTCPeerConnection(ICE_CONFIG);
      connectionRef.current = peer;

      // Add audio tracks
      currentStream.getTracks().forEach((track) => {
        peer.addTrack(track, currentStream);
        console.log("[ANSWERER] Added track:", track.kind);
      });

      // Set up monitors
      setupPeerMonitors(peer, "ANSWERER");

      // Send ICE candidates to caller
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("[ANSWERER] Sending ICE (type:", event.candidate.type, ")");
          socket?.emit("send-signal", {
            to: incomingCall.from,
            signal: { candidate: event.candidate },
            from: user?._id,
          });
        } else {
          console.log("[ANSWERER] All ICE candidates sent");
        }
      };

      // Receive audio from caller
      peer.ontrack = (event) => attachRemoteStream(event, "ANSWERER");

      // Set remote description (the caller's offer)
      console.log("[ANSWERER] Setting remote description (offer)");
      await peer.setRemoteDescription(new RTCSessionDescription(incomingCall.signal));

      // Flush ICE candidates that arrived while user was deciding to Accept
      await flushIceCandidates(peer);

      // Create and send answer
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      console.log("[ANSWERER] Created + sent answer");

      socket?.emit("answer-call", {
        signal: answer,
        to: incomingCall.from,
        from: user?._id,
      });
    } catch (err) {
      console.error("Failed to answer call:", err);
      endCall();
    }
  };

  const toggleMic = () => {
    const audioTrack = stream?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !isMicOn;
      setIsMicOn(!isMicOn);
    }
  };

  const toggleCamera = () => {
    const videoTrack = stream?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !isVideoOn;
      setIsVideoOn(!isVideoOn);
    }
  };

  const toggleScreenShare = async () => {
    const peer = connectionRef.current;
    if (!peer) return;

    if (!isScreenSharing) {
      // START screen sharing
      try {
        // Request screen with audio — Chrome will show "Share tab audio" checkbox
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" } as MediaTrackConstraints,
          audio: true,
          systemAudio: "include",
        } as DisplayMediaStreamOptions);
        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) return;

        // Save current camera track so we can restore later
        const currentVideoTrack = streamRef.current?.getVideoTracks()[0] || null;
        cameraTrackRef.current = currentVideoTrack;

        // Replace the video track on the peer connection
        const videoSender = peer.getSenders().find((s) => s.track?.kind === "video");
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        }

        // ─── Screen audio + mic mixing ───────────────────────────
        const screenAudioTracks = screenStream.getAudioTracks();
        if (screenAudioTracks.length > 0) {
          // User opted to share tab/system audio
          const micTrack = streamRef.current?.getAudioTracks()[0] || null;

          // Save original mic track for later restoration
          if (micTrack) {
            originalMicTrackRef.current = micTrack;
          }

          // Create a mixing AudioContext
          const mixCtx = new AudioContext();
          mixingCtxRef.current = mixCtx;

          const destination = mixCtx.createMediaStreamDestination();

          // Source 1: screen/tab audio
          const screenAudioStream = new MediaStream(screenAudioTracks);
          const screenSource = mixCtx.createMediaStreamSource(screenAudioStream);
          const screenGain = mixCtx.createGain();
          screenGain.gain.value = 0.7;
          screenSource.connect(screenGain).connect(destination);

          // Source 2: microphone audio
          if (micTrack) {
            const micStream = new MediaStream([micTrack]);
            const micSource = mixCtx.createMediaStreamSource(micStream);
            const micGain = mixCtx.createGain();
            micGain.gain.value = 1.0;
            micSource.connect(micGain).connect(destination);
          }

          // Get the mixed audio track and send it to the peer
          const mixedTrack = destination.stream.getAudioTracks()[0];
          if (mixedTrack) {
            const audioSender = peer.getSenders().find((s) => s.track?.kind === "audio");
            if (audioSender) {
              await audioSender.replaceTrack(mixedTrack);
            }
          }

          setIsShareAudioActive(true);
          console.log("🔊 Screen audio + mic mixed and sending to peer");
        }

        // Update local preview to show screen share
        screenStreamRef.current = screenStream;
        if (myVideo.current) {
          const previewStream = new MediaStream([screenTrack]);
          myVideo.current.srcObject = previewStream;
        }

        setIsScreenSharing(true);

        // Listen for browser's native "Stop sharing" button
        screenTrack.onended = () => {
          void stopScreenShare();
        };

        console.log("🖥️ Screen sharing started");
      } catch (err) {
        // User cancelled the screen share picker — that's fine
        console.log("Screen share cancelled or failed:", err);
      }
    } else {
      // STOP screen sharing
      await stopScreenShare();
    }
  };

  const stopScreenShare = async () => {
    const peer = connectionRef.current;

    // Stop screen tracks
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    // ─── Restore original mic track (undo audio mixing) ─────────
    // Always attempt to restore — use ref directly to avoid stale closure
    const savedMicTrack = originalMicTrackRef.current;
    if (peer) {
      const audioSender = peer.getSenders().find((s) => s.track?.kind === "audio");
      if (audioSender) {
        if (savedMicTrack && savedMicTrack.readyState === "live") {
          // Restore the saved original mic track
          await audioSender.replaceTrack(savedMicTrack);
          console.log("🎤 Restored original mic track");
        } else {
          // Fallback: grab mic track from the current local stream
          const fallbackMicTrack = streamRef.current?.getAudioTracks()[0] || null;
          if (fallbackMicTrack && fallbackMicTrack.readyState === "live") {
            await audioSender.replaceTrack(fallbackMicTrack);
            console.log("🎤 Restored mic track from local stream (fallback)");
          }
        }
      }
    }
    originalMicTrackRef.current = null;

    // Close mixing AudioContext
    if (mixingCtxRef.current) {
      try {
        await mixingCtxRef.current.close();
      } catch {
        // already closed
      }
      mixingCtxRef.current = null;
    }
    setIsShareAudioActive(false);

    // Restore camera track
    const cameraTrack = cameraTrackRef.current;
    if (cameraTrack && peer) {
      const videoSender = peer.getSenders().find((s) => s.track?.kind === "video");
      if (videoSender) {
        await videoSender.replaceTrack(cameraTrack);
      }
    }
    cameraTrackRef.current = null;

    // Restore local preview
    if (myVideo.current && streamRef.current) {
      myVideo.current.srcObject = streamRef.current;
    }

    setIsScreenSharing(false);
    console.log("🖥️ Screen sharing stopped");
  };

  // ─── Picture-in-Picture ──────────────────────────────────────
  const enterPiP = async () => {
    const videoEl = userVideo.current;
    if (!videoEl) return;
    if (!document.pictureInPictureEnabled) return;
    if (document.pictureInPictureElement) return; // already in PiP

    try {
      await videoEl.requestPictureInPicture();
      setIsInPiP(true);
      console.log("📺 Entered Picture-in-Picture");
    } catch (err) {
      console.log("PiP not available:", (err as Error).message);
    }
  };

  const exitPiP = async () => {
    if (!document.pictureInPictureElement) return;
    try {
      await document.exitPictureInPicture();
      setIsInPiP(false);
      console.log("📺 Exited Picture-in-Picture");
    } catch (err) {
      console.log("PiP exit failed:", (err as Error).message);
    }
  };

  const togglePiP = async () => {
    if (isInPiP) {
      await exitPiP();
    } else {
      await enterPiP();
    }
  };

  const refreshDeviceLists = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((d) => d.kind === "audioinput");
      const speakers = devices.filter((d) => d.kind === "audiooutput");
      setAvailableMics(mics);
      setAvailableSpeakers(speakers);

      const currentMicId = streamRef.current?.getAudioTracks()[0]?.getSettings().deviceId || null;
      const micStillValid = selectedMicId && mics.some((d) => d.deviceId === selectedMicId);
      if (!micStillValid) {
        const found = currentMicId ? mics.find((d) => d.deviceId === currentMicId) : undefined;
        const nextMic = found?.deviceId || mics[0]?.deviceId || null;
        setSelectedMicId(nextMic);
      }

      const speakerStillValid = selectedSpeakerId && speakers.some((d) => d.deviceId === selectedSpeakerId);
      if (!speakerStillValid) {
        const defaultSpeaker = speakers.find((d) => d.deviceId === "default")?.deviceId || speakers[0]?.deviceId || null;
        setSelectedSpeakerId(defaultSpeaker);
      }
    } catch (err) {
      console.error("Failed to enumerate devices:", err);
    }
  };

  const applySpeakerSink = async (deviceId: string) => {
    if (!remoteAudioRef.current) return;
    const audioEl = remoteAudioRef.current as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (typeof audioEl.setSinkId !== "function") {
      console.warn("setSinkId not supported in this browser.");
      return;
    }
    try {
      await audioEl.setSinkId(deviceId);
      console.log("🔊 Speaker set to device:", deviceId);
    } catch (err) {
      console.error("Failed to set speaker device:", err);
    }
  };

  const switchMicDevice = async (deviceId: string) => {
    try {
      const newAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: false,
      });
      const newAudioTrack = newAudioStream.getAudioTracks()[0];
      if (!newAudioTrack) return;

      newAudioTrack.enabled = isMicOn;

      const peer = connectionRef.current;
      const audioSender = peer?.getSenders().find((s) => s.track?.kind === "audio");
      if (audioSender) {
        await audioSender.replaceTrack(newAudioTrack);
      }

      const current = streamRef.current;
      const newStream = new MediaStream();
      if (current) {
        current.getVideoTracks().forEach((t) => newStream.addTrack(t));
        const oldAudio = current.getAudioTracks()[0];
        if (oldAudio) oldAudio.stop();
      }
      newStream.addTrack(newAudioTrack);

      streamRef.current = newStream;
      setStream(newStream);
      if (myVideo.current) myVideo.current.srcObject = newStream;
      startSpeakingDetector(newStream, setIsLocalSpeaking, localAnalyserRef, localSpeakRaf);

      setSelectedMicId(deviceId);
      console.log("🎤 Microphone switched to:", deviceId);
    } catch (err) {
      console.error("Failed to switch microphone:", err);
    }
  };

  const enableAudio = () => {
    // Unmute ringtones on click
    if (incomingRingtone.current && !incomingRingtone.current.paused && incomingRingtone.current.muted) {
      incomingRingtone.current.muted = false;
    }
    if (outgoingRingtone.current && !outgoingRingtone.current.paused && outgoingRingtone.current.muted) {
      outgoingRingtone.current.muted = false;
    }
    // Unmute WebRTC audio
    if (remoteAudioRef.current && audioBlocked) {
      remoteAudioRef.current.play()
        .then(() => {
          console.log("✅ Audio enabled by click");
          setAudioBlocked(false);
        })
        .catch((err) => console.error("❌ Still blocked:", err));
    }

    if (audioContextRef.current && audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
  };

  useEffect(() => {
    if (!stream) return;
    refreshDeviceLists();

    const handleDeviceChange = () => {
      refreshDeviceLists();
    };

    navigator.mediaDevices?.addEventListener?.("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", handleDeviceChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream]);

  useEffect(() => {
    if (selectedSpeakerId) {
      void applySpeakerSink(selectedSpeakerId);
    }
  }, [selectedSpeakerId]);

  // ─── Trigger outgoing call ───────────────────────────────────
  useEffect(() => {
    if (outgoingCallData && !callAccepted && !incomingCall) {
      startCall(outgoingCallData.userId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outgoingCallData, incomingCall]);

  // ─── Re-apply video streams after React re-renders ───────────
  // When React conditional branches swap, video elements are destroyed and
  // re-created, losing their srcObject. This effect re-applies them.
  useEffect(() => {
    if (myVideo.current && streamRef.current) {
      if (myVideo.current.srcObject !== streamRef.current) {
        myVideo.current.srcObject = streamRef.current;
        console.log("🔄 Re-applied local stream to myVideo element");
      }
    }
    if (userVideo.current && remoteStreamRef.current) {
      if (userVideo.current.srcObject !== remoteStreamRef.current) {
        userVideo.current.srcObject = remoteStreamRef.current;
        userVideo.current.muted = true;
        userVideo.current.volume = 0;
        userVideo.current.play()
          .then(() => console.log("🔄 Re-applied remote stream to userVideo element"))
          .catch(() => {});
      }
    }
  });

  // ─── Auto Picture-in-Picture on tab switch ───────────────────
  useEffect(() => {
    const isVideoCall = outgoingCallData?.callType === "video" || incomingCall?.callType === "video";
    if (!callAccepted || !isVideoCall) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden → enter PiP
        void enterPiP();
      } else {
        // Tab visible → exit PiP  
        void exitPiP();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [callAccepted, outgoingCallData?.callType, incomingCall?.callType]);

  // ─── PiP event listeners on remote video ─────────────────────
  useEffect(() => {
    const videoEl = userVideo.current;
    if (!videoEl) return;

    const onEnterPiP = () => setIsInPiP(true);
    const onLeavePiP = () => setIsInPiP(false);

    videoEl.addEventListener("enterpictureinpicture", onEnterPiP);
    videoEl.addEventListener("leavepictureinpicture", onLeavePiP);

    return () => {
      videoEl.removeEventListener("enterpictureinpicture", onEnterPiP);
      videoEl.removeEventListener("leavepictureinpicture", onLeavePiP);
    };
  });

  // ─── RENDER ──────────────────────────────────────────────────
  if (!incomingCall && !outgoingCallData) return null;

  if (isMinimized && callAccepted) {
    const displayName = incomingCall?.name || outgoingCallData?.userName || "Call";
    const isVoiceCall = outgoingCallData?.callType === "voice" || incomingCall?.callType === "voice";

    if (isVoiceCall) {
      // ─── VOICE CALL minimized ──────────────────────────────────
      return (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl overflow-hidden shadow-2xl w-64 bg-zinc-900 border border-zinc-700 cursor-pointer" onClick={enableAudio}>
          <div className="flex items-center gap-3 p-3">
            {/* Lottie avatar */}
            <div className="w-12 h-12 flex-shrink-0">
              <DotLottieReact src="/Lotties/love.lottie" loop autoplay />
            </div>

            {/* Name + status */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-white truncate">{displayName}</span>
                <img src="/Verification-Blue-Tick-PNG.webp" alt="Verified" className="w-4 h-4 flex-shrink-0" />
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[11px] text-emerald-400">On call</span>
                {/* Speaking indicator */}
                {isRemoteSpeaking && (
                  <div className="flex items-center gap-0.5 ml-1">
                    <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: "3px", animation: "soundwave 0.6s ease-in-out infinite", animationDelay: "0s" }}></span>
                    <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: "5px", animation: "soundwave 0.6s ease-in-out infinite", animationDelay: "0.1s" }}></span>
                    <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: "3px", animation: "soundwave 0.6s ease-in-out infinite", animationDelay: "0.2s" }}></span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between px-3 pb-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(false);
              }}
              className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
              aria-label="Restore call"
            >
              <Maximize2 size={14} />
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMic();
                }}
                className={`p-1.5 rounded-lg ${!isMicOn ? "bg-red-600/80" : "bg-zinc-800/80"} text-white cursor-pointer`}
                aria-label="Toggle mic"
              >
                {isMicOn ? <Mic size={14} /> : <MicOff size={14} />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  endCall();
                }}
                className="p-1.5 rounded-lg bg-red-600/80 text-white cursor-pointer"
                aria-label="End call"
              >
                <PhoneOff size={14} />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ─── VIDEO CALL minimized ──────────────────────────────────
    return (
      <div className="fixed bottom-6 right-6 z-50 rounded-2xl overflow-hidden shadow-2xl w-48 h-32 bg-black border border-zinc-700 cursor-pointer" onClick={enableAudio}>
        {/* Remote video in background */}
        {remoteVideoAvailable && (
          <video
            playsInline
            ref={userVideo}
            autoPlay
            className="w-full h-full object-cover absolute inset-0"
          />
        )}
        
        {/* Local video overlay in corner */}
        <video
          playsInline
          muted
          ref={myVideo}
          autoPlay
          className={`absolute bottom-1 right-1 w-16 h-16 rounded-lg object-cover border border-zinc-600 ${isVideoOn ? '' : 'hidden'}`}
          style={!isScreenSharing ? { transform: "scaleX(-1)" } : undefined}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-between p-2">
          <div className="text-xs font-medium text-white truncate">{displayName}</div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(false);
              }}
              className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
              aria-label="Restore call"
            >
              <Maximize2 size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCamera();
              }}
              className={`p-1.5 rounded-lg ${!isVideoOn ? "bg-red-600/80" : "bg-zinc-800/80"} text-white cursor-pointer`}
              aria-label="Toggle camera"
            >
              {isVideoOn ? <Video size={14} /> : <VideoOff size={14} />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMic();
              }}
              className={`p-1.5 rounded-lg ${!isMicOn ? "bg-red-600/80" : "bg-zinc-800/80"} text-white cursor-pointer`}
              aria-label="Toggle mic"
            >
              {isMicOn ? <Mic size={14} /> : <MicOff size={14} />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                endCall();
              }}
              className="p-1.5 rounded-lg bg-red-600/80 text-white cursor-pointer"
              aria-label="End call"
            >
              <PhoneOff size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md" onClick={enableAudio}>
      {callAccepted ? (
        // Call connected view - conditional UI based on call type
        outgoingCallData?.callType === "voice" || incomingCall?.callType === "voice" ? (
          // VOICE CALL - Modal style
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-8 w-full max-w-md mx-4 flex flex-col items-center relative shadow-2xl">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsMinimized(true);
              }}
              className="absolute top-4 right-4 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
              aria-label="Minimize call"
            >
              <Minimize2 size={16} />
            </button>

            <div className="w-48 h-48 mb-2">
              <DotLottieReact src="/Lotties/love.lottie" loop autoplay />
            </div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <h3 className="text-2xl font-medium text-white">{incomingCall?.name || outgoingCallData?.userName}</h3>
              <img src="/Verification-Blue-Tick-PNG.webp" alt="Verified" className="w-6 h-6 flex-shrink-0" />
            </div>
            <div className="flex items-center gap-2 mb-8">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm text-emerald-400">Connected</span>
            </div>

            <div className="flex items-center gap-3 mb-8">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${isLocalSpeaking ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>
                <span className="text-[11px] uppercase tracking-widest">You</span>
                {isLocalSpeaking && (
                  <div className="flex items-center gap-0.5">
                    <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: "4px", animation: "soundwave 0.6s ease-in-out infinite", animationDelay: "0s" }}></span>
                    <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: "6px", animation: "soundwave 0.6s ease-in-out infinite", animationDelay: "0.1s" }}></span>
                    <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: "4px", animation: "soundwave 0.6s ease-in-out infinite", animationDelay: "0.2s" }}></span>
                  </div>
                )}
              </div>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${isRemoteSpeaking ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>
                <span className="text-[11px] uppercase tracking-widest">Them</span>
                {isRemoteSpeaking && (
                  <div className="flex items-center gap-0.5">
                    <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: "4px", animation: "soundwave 0.6s ease-in-out infinite", animationDelay: "0s" }}></span>
                    <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: "6px", animation: "soundwave 0.6s ease-in-out infinite", animationDelay: "0.1s" }}></span>
                    <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: "4px", animation: "soundwave 0.6s ease-in-out infinite", animationDelay: "0.2s" }}></span>
                  </div>
                )}
              </div>
            </div>

            {/* Call Controls */}
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center gap-2 relative">
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMic}
                    className={`p-4 rounded-full transition-all cursor-pointer ${
                      !isMicOn ? "bg-red-500 text-white shadow-lg shadow-red-500/50" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                    aria-label="Toggle mic"
                  >
                    {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMicMenu((prev) => !prev);
                      setShowSpeakerMenu(false);
                    }}
                    className="p-2 rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                    aria-label="Select microphone"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
                <span className="text-xs text-zinc-500">{isMicOn ? "Mute" : "Unmute"}</span>

                {showMicMenu && (
                  <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-2 min-w-[220px] z-50">
                    {availableMics.length === 0 ? (
                      <div className="text-xs text-zinc-400 px-2 py-1">No microphones found</div>
                    ) : (
                      availableMics.map((device, index) => (
                        <button
                          key={device.deviceId}
                          onClick={(e) => {
                            e.stopPropagation();
                            void switchMicDevice(device.deviceId);
                            setShowMicMenu(false);
                          }}
                          className={`w-full text-left px-2 py-1 rounded-lg text-xs hover:bg-zinc-800 cursor-pointer ${
                            selectedMicId === device.deviceId ? "text-emerald-400" : "text-zinc-200"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{device.label || `Microphone ${index + 1}`}</span>
                            {selectedMicId === device.deviceId && <span className="text-[10px]">Active</span>}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-2 relative">
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSpeakerMenu((prev) => !prev);
                      setShowMicMenu(false);
                    }}
                    className="p-4 rounded-full transition-all cursor-pointer bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    aria-label="Select speaker"
                  >
                    <Volume2 size={24} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSpeakerMenu((prev) => !prev);
                      setShowMicMenu(false);
                    }}
                    className="p-2 rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                    aria-label="Select speaker"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
                <span className="text-xs text-zinc-500">Speaker</span>

                {showSpeakerMenu && (
                  <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-2 min-w-[220px] z-50">
                    {availableSpeakers.length === 0 ? (
                      <div className="text-xs text-zinc-400 px-2 py-1">No speakers found</div>
                    ) : (
                      availableSpeakers.map((device, index) => (
                        <button
                          key={device.deviceId}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSpeakerId(device.deviceId);
                            setShowSpeakerMenu(false);
                          }}
                          className={`w-full text-left px-2 py-1 rounded-lg text-xs hover:bg-zinc-800 cursor-pointer ${
                            selectedSpeakerId === device.deviceId ? "text-emerald-400" : "text-zinc-200"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{device.label || `Speaker ${index + 1}`}</span>
                            {selectedSpeakerId === device.deviceId && <span className="text-[10px]">Active</span>}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-2">
                <button onClick={endCall} className="p-5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg hover:shadow-red-500/50 cursor-pointer">
                  <PhoneOff size={28} />
                </button>
                <span className="text-xs text-zinc-500">End call</span>
              </div>
            </div>

          </div>
        ) : (
          // VIDEO CALL - Full-screen style
          <div className="fixed inset-0 bg-black z-50">
            {/* Main video — fills the ENTIRE screen */}
            {/* When swapped: local is main, remote is PiP. Default: remote is main, local is PiP */}
            {isSwapped ? (
              <video
                playsInline
                muted
                ref={myVideo}
                autoPlay
                className="absolute inset-0 w-full h-full object-cover"
                style={!isScreenSharing ? { transform: "scaleX(-1)" } : undefined}
              />
            ) : (
              <video
                playsInline
                ref={userVideo}
                autoPlay
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* Fallback if no remote video */}
            {!remoteVideoAvailable && !isSwapped && (
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-black flex flex-col items-center justify-center z-[1]">
                <div className="w-32 h-32 rounded-full mb-4 overflow-hidden ring-4 ring-green-500">
                  {incomingCall?.avatar ? (
                    <img src={incomingCall.avatar} alt={incomingCall.name} className="w-full h-full object-cover" />
                  ) : outgoingCallData?.userAvatar ? (
                    <img src={outgoingCallData.userAvatar} alt={outgoingCallData.userName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-4xl font-bold text-white">
                      {(incomingCall?.name || outgoingCallData?.userName || "?")[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <p className="text-zinc-400">Waiting for video...</p>
              </div>
            )}

            {/* PiP video — overlaid on top */}
            <div
              className={`absolute top-4 right-4 z-20 group ${(isSwapped || isVideoOn) ? '' : 'hidden'}`}
              onMouseEnter={() => setPipHovered(true)}
              onMouseLeave={() => setPipHovered(false)}
            >
              {isSwapped ? (
                <video
                  playsInline
                  ref={userVideo}
                  autoPlay
                  className="w-32 h-40 object-cover rounded-2xl border-2 border-zinc-700/50 shadow-2xl"
                />
              ) : (
                <video
                  playsInline
                  muted
                  ref={myVideo}
                  autoPlay
                  className={`w-32 h-40 object-cover rounded-2xl border-2 border-zinc-700/50 shadow-2xl ${isVideoOn ? '' : 'hidden'}`}
                  style={!isScreenSharing ? { transform: "scaleX(-1)" } : undefined}
                />
              )}
              {/* Swap button on hover */}
              {pipHovered && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSwapped((prev) => !prev);
                  }}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl backdrop-blur-[2px] cursor-pointer transition-all"
                  aria-label="Swap video views"
                >
                  <ArrowsUpFromLine size={20} className="text-white drop-shadow-lg" />
                </button>
              )}
            </div>

            {/* Minimize button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsMinimized(true);
              }}
              className="absolute top-4 left-4 p-2 rounded-lg bg-black/50 backdrop-blur-sm hover:bg-black/70 text-zinc-200 z-20 cursor-pointer"
              aria-label="Minimize call"
            >
              <Minimize2 size={16} />
            </button>

            {/* Speaking indicators — overlaid top center */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full backdrop-blur-sm ${isLocalSpeaking ? "border border-emerald-500/60 bg-emerald-500/10 text-emerald-300" : "border border-zinc-700/50 bg-black/30 text-zinc-400"}`}>
                <span className="text-[10px] uppercase tracking-widest">You</span>
                {isLocalSpeaking && (
                  <div className="flex items-center gap-0.5">
                    <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: "4px", animation: "soundwave 0.6s ease-in-out infinite", animationDelay: "0s" }}></span>
                    <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: "6px", animation: "soundwave 0.6s ease-in-out infinite", animationDelay: "0.1s" }}></span>
                    <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: "4px", animation: "soundwave 0.6s ease-in-out infinite", animationDelay: "0.2s" }}></span>
                  </div>
                )}
              </div>

              <div className={`flex items-center gap-2 px-3 py-1 rounded-full backdrop-blur-sm ${isRemoteSpeaking ? "border border-emerald-500/60 bg-emerald-500/10 text-emerald-300" : "border border-zinc-700/50 bg-black/30 text-zinc-400"}`}>
                <span className="text-[10px] uppercase tracking-widest">Them</span>
                {isRemoteSpeaking && (
                  <div className="flex items-center gap-0.5">
                    <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: "4px", animation: "soundwave 0.6s ease-in-out infinite", animationDelay: "0s" }}></span>
                    <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: "6px", animation: "soundwave 0.6s ease-in-out infinite", animationDelay: "0.1s" }}></span>
                    <span className="w-0.5 bg-emerald-400 rounded-full" style={{ height: "4px", animation: "soundwave 0.6s ease-in-out infinite", animationDelay: "0.2s" }}></span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom overlay — name + controls bar on top of video */}
            <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-8 px-6 flex flex-col items-center">
              {/* Call info */}
              <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <h3 className="text-xl font-medium text-white drop-shadow-lg">{incomingCall?.name || outgoingCallData?.userName}</h3>
                  <img src="/Verification-Blue-Tick-PNG.webp" alt="Verified" className="w-5 h-5 flex-shrink-0" />
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-sm text-emerald-400">Connected</span>
                </div>
              </div>

              {/* Call Controls */}
              <div className="flex items-center gap-4 bg-black/50 backdrop-blur-md px-6 py-4 rounded-full border border-zinc-700/50">
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={toggleCamera}
                    className={`p-3 rounded-full transition-all cursor-pointer ${
                      !isVideoOn ? "bg-red-500 text-white shadow-lg shadow-red-500/50" : "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700"
                    }`}
                    aria-label="Toggle camera"
                  >
                    {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
                  </button>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => void toggleScreenShare()}
                    className={`p-3 rounded-full transition-all cursor-pointer relative ${
                      isScreenSharing ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/50" : "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700"
                    }`}
                    aria-label="Toggle screen share"
                  >
                    {isScreenSharing ? <MonitorOff size={20} /> : <MonitorUp size={20} />}
                    {isShareAudioActive && (
                      <span className="absolute -top-1 -right-1 bg-emerald-400 rounded-full p-0.5">
                        <Volume2 size={10} className="text-black" />
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => void togglePiP()}
                    className={`p-3 rounded-full transition-all cursor-pointer ${
                      isInPiP ? "bg-blue-500 text-white shadow-lg shadow-blue-500/50" : "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700"
                    }`}
                    aria-label="Toggle Picture-in-Picture"
                    title="Picture-in-Picture"
                  >
                    <PictureInPicture2 size={20} />
                  </button>
                </div>

                <div className="flex flex-col items-center gap-1 relative">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleMic}
                      className={`p-3 rounded-full transition-all cursor-pointer ${
                        !isMicOn ? "bg-red-500 text-white shadow-lg shadow-red-500/50" : "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700"
                      }`}
                      aria-label="Toggle mic"
                    >
                      {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMicMenu((prev) => !prev);
                        setShowSpeakerMenu(false);
                      }}
                      className="p-2 rounded-full bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                      aria-label="Select microphone"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  {showMicMenu && (
                    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-2 min-w-[220px] z-50">
                      {availableMics.length === 0 ? (
                        <div className="text-xs text-zinc-400 px-2 py-1">No microphones found</div>
                      ) : (
                        availableMics.map((device, index) => (
                          <button
                            key={device.deviceId}
                            onClick={(e) => {
                              e.stopPropagation();
                              void switchMicDevice(device.deviceId);
                              setShowMicMenu(false);
                            }}
                            className={`w-full text-left px-2 py-1 rounded-lg text-xs hover:bg-zinc-800 cursor-pointer ${
                              selectedMicId === device.deviceId ? "text-emerald-400" : "text-zinc-200"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">{device.label || `Microphone ${index + 1}`}</span>
                              {selectedMicId === device.deviceId && <span className="text-[10px]">Active</span>}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center gap-1 relative">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSpeakerMenu((prev) => !prev);
                        setShowMicMenu(false);
                      }}
                      className="p-3 rounded-full transition-all cursor-pointer bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700"
                      aria-label="Select speaker"
                    >
                      <Volume2 size={20} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSpeakerMenu((prev) => !prev);
                        setShowMicMenu(false);
                      }}
                      className="p-2 rounded-full bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                      aria-label="Select speaker"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  {showSpeakerMenu && (
                    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-2 min-w-[220px] z-50">
                      {availableSpeakers.length === 0 ? (
                        <div className="text-xs text-zinc-400 px-2 py-1">No speakers found</div>
                      ) : (
                        availableSpeakers.map((device, index) => (
                          <button
                            key={device.deviceId}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSpeakerId(device.deviceId);
                              setShowSpeakerMenu(false);
                            }}
                            className={`w-full text-left px-2 py-1 rounded-lg text-xs hover:bg-zinc-800 cursor-pointer ${
                              selectedSpeakerId === device.deviceId ? "text-emerald-400" : "text-zinc-200"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">{device.label || `Speaker ${index + 1}`}</span>
                              {selectedSpeakerId === device.deviceId && <span className="text-[10px]">Active</span>}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button onClick={endCall} className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg hover:shadow-red-500/50 cursor-pointer">
                    <PhoneOff size={20} />
                  </button>
                </div>
              </div>
            </div>

          </div>
        )
      ) : (
        // Call pre-connection modal
        <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-8 w-full max-w-md mx-4 flex flex-col items-center relative shadow-2xl">

        {/* Audio Blocked Banner */}
        {audioBlocked && callAccepted && (
          <div className="absolute top-4 left-4 right-4 bg-yellow-500/90 text-black px-4 py-2 rounded-xl text-sm font-medium text-center animate-pulse">
            🔊 Click anywhere to enable audio
          </div>
        )}

        {/* Ringtone Muted Banner */}
        {ringtoneMuted && !callAccepted && (
          <div className="absolute top-4 left-4 right-4 bg-orange-500/90 text-white px-4 py-2 rounded-xl text-sm font-medium text-center animate-pulse">
            🔇 Ringtone is muted — Click to unmute
          </div>
        )}

        {/* Pre-Connect UI */}
        {!callAccepted && (
          <div className="flex flex-col items-center justify-center py-8">
            {/* Avatar */}
            {incomingCall && (
              <div className="w-32 h-32 rounded-full overflow-hidden mb-6 ring-4 ring-green-500 ring-offset-4 ring-offset-zinc-900">
                {incomingCall.avatar ? (
                  <img src={incomingCall.avatar} alt={incomingCall.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                    <span className="text-4xl font-bold text-white">{incomingCall.name[0].toUpperCase()}</span>
                  </div>
                )}
              </div>
            )}
            {!incomingCall && outgoingCallData && (
              <div className="w-32 h-32 rounded-full overflow-hidden mb-6 ring-4 ring-blue-500 ring-offset-4 ring-offset-zinc-900 animate-pulse">
                {outgoingCallData.userAvatar ? (
                  <img src={outgoingCallData.userAvatar} alt={outgoingCallData.userName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <span className="text-4xl font-bold text-white">{outgoingCallData.userName[0].toUpperCase()}</span>
                  </div>
                )}
              </div>
            )}

            {incomingCall ? (
              <>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <h3 className="text-2xl font-medium text-white text-center">{incomingCall.name}</h3>
                  <img src="/Verification-Blue-Tick-PNG.webp" alt="Verified" className="w-6 h-6 flex-shrink-0" />
                </div>
                <p className="text-zinc-400 mb-8">
                  Incoming {incomingCall.callType === "video" ? "video" : "voice"} call...
                </p>
                {isVoiceConnected && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-6 max-w-xs text-center">
                    <p className="text-amber-400 text-xs font-medium">
                      ⚠️ Accepting will disconnect you from &quot;{voiceRoomName || "your room"}&quot;
                    </p>
                  </div>
                )}
                <div className="flex gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <button onClick={endCall} className="bg-red-500 hover:bg-red-600 p-5 rounded-full transition-all shadow-lg hover:shadow-red-500/50 cursor-pointer">
                      <PhoneOff className="text-white" size={28} />
                    </button>
                    <span className="text-xs text-zinc-500">Decline</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <button onClick={answerCall} className="bg-green-500 hover:bg-green-600 p-5 rounded-full transition-all animate-bounce shadow-lg hover:shadow-green-500/50 cursor-pointer">
                      <Phone className="text-white" size={28} />
                    </button>
                    <span className="text-xs text-zinc-500">Accept</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <h3 className="text-2xl font-medium text-white text-center">{outgoingCallData?.userName}</h3>
                  <img src="/Verification-Blue-Tick-PNG.webp" alt="Verified" className="w-6 h-6 flex-shrink-0" />
                </div>
                <p className="text-zinc-400 mb-8">
                  {outgoingCallData?.callType === "video" ? "Calling (video)..." : "Calling (voice)..."}
                </p>
                <div className="flex flex-col items-center gap-2">
                  <button onClick={endCall} className="bg-red-500 hover:bg-red-600 p-5 rounded-full transition-all shadow-lg hover:shadow-red-500/50 cursor-pointer">
                    <PhoneOff className="text-white" size={28} />
                  </button>
                  <span className="text-xs text-zinc-500">End call</span>
                </div>
              </>
            )}
          </div>
        )}

</div>
      )}
    </div>
  );
}
