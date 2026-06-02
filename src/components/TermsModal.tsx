"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, CheckCircle2, Sparkles } from "lucide-react";

export default function TermsModal() {
  const [accepted, setAccepted] = useState(false);

  const handleAccept = async () => {
    // ── THIS IS THE TRICK ──
    // The "I Agree" click is a trusted user gesture, so we use it
    // to unlock audio playback for the entire page session.
    try {
      const ctx = new AudioContext();
      // Create a tiny silent buffer and play it — fully unlocks audio
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      ctx.resume().then(() => {
        console.log("🔓 Audio unlocked via Terms acceptance");
        // Keep context alive briefly then close
        setTimeout(() => ctx.close(), 500);
      });
    } catch (e) {
      console.warn("Audio unlock failed:", e);
    }

    // Also pre-warm any Audio elements by playing+pausing a silent one
    try {
      const silentAudio = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
      silentAudio.volume = 0;
      silentAudio.play().then(() => {
        silentAudio.pause();
        console.log("🔓 HTML Audio element unlocked via Terms acceptance");
      }).catch(() => {});
    } catch (e) {
      // ignore
    }

    // Pre-request microphone and camera permissions to ensure WebRTC works seamlessly
    try {
      console.log("🎤 Requesting audio and video permissions...");
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        stream.getTracks().forEach((track) => track.stop());
        console.log("✅ Audio and video permissions granted successfully!");
      }
    } catch (err) {
      console.warn("⚠️ Media permissions request rejected or failed:", err);
      // Fallback: try only audio in case camera is missing
      try {
        console.log("🎤 Requesting audio permission only...");
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStream.getTracks().forEach((track) => track.stop());
          console.log("✅ Audio permission granted successfully!");
        }
      } catch (audioErr) {
        console.error("❌ Audio permission also failed:", audioErr);
      }
    }

    setAccepted(true);
  };

  if (accepted) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.3 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-[420px] mx-4 shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-5 border-b border-zinc-800/50 pb-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
              <Shield className="text-zinc-200 w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight leading-tight">
                Community Guidelines
              </h2>
              <p className="text-zinc-500 text-xs">
                Please review to continue
              </p>
            </div>
          </div>

          {/* Terms Content */}
          <div className="space-y-4 mb-6">
            {[
              {
                title: "Respect & Privacy",
                description: "Be respectful. No recording without consent.",
              },
              {
                title: "No Harassment",
                description: "Hate speech results in immediate ban.",
              },
              {
                title: "Authentic Connections",
                description: "No spam, ads, or solicitation.",
              },
              {
                title: "Audio & Microphone",
                description: "Allows audio access & notifications.",
              },
            ].map((item, index) => (
              <div key={index} className="flex gap-3 items-start">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
                <div>
                  <h3 className="text-zinc-200 font-medium text-xs leading-none mb-1">{item.title}</h3>
                  <p className="text-zinc-500 text-xs leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Agree Button */}
          <button
            onClick={handleAccept}
            className="w-full bg-white hover:bg-zinc-200 text-black py-2.5 rounded-lg font-medium text-sm transition-colors active:scale-[0.98] cursor-pointer"
          >
            I Agree & Enter
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
