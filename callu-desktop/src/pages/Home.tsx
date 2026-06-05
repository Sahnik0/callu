"use client";
import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleOAuthLogin = () => {
    const baseUrl = window.CALLU_SERVER_URL || import.meta.env.VITE_API_URL || "https://callu.up.railway.app";
    const loginUrl = `${baseUrl}/login`;
    if (window.electron) {
      window.electron.send("open-external-url", loginUrl);
    } else {
      window.open(loginUrl, "_blank");
    }
  };

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/dashboard/members", { replace: true });
      }
    }
  }, [user, isLoading, navigate]);

  // Show a black splash screen while:
  // 1. Auth is still resolving (isLoading = true)
  // 2. Auth is done but user is set — navigation is queued in useEffect,
  //    so we stay on the splash to avoid flashing the landing page for a frame.
  if (isLoading || user) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 z-50">
        <img
          src="/icon-nobg.png"
          alt="Callu"
          className="w-20 h-20 object-contain animate-pulse"
          style={{ filter: "drop-shadow(0 0 24px rgba(16,185,129,0.35))" }}
        />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white relative flex flex-col items-center w-full h-full overflow-y-auto selection:bg-emerald-500/30">
      {/* Premium Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="hero-grid">
          <div className="hero-grid-noise" />
        </div>
        <div className="absolute top-[-10%] right-[10%] w-[600px] h-[600px] bg-emerald-900/20 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute top-[20%] left-[-10%] w-[500px] h-[500px] bg-zinc-800/30 rounded-full blur-[150px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black pointer-events-none" />
      </div>

      <nav className="relative z-50 flex justify-between items-center px-6 md:px-12 py-8 w-full max-w-[90rem]">
        <div className="flex items-center gap-1.5 group cursor-pointer">
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center">
            CALLU
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full ml-1 mb-0.5 transition-all duration-500 group-hover:scale-150 group-hover:shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOAuthLogin}
            className="px-6 py-2.5 text-sm font-semibold text-zinc-300 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
          >
            Sign In
          </button>
        </div>
      </nav>

      <div className="relative z-10 flex flex-col items-center justify-center px-4 text-center w-full max-w-6xl pt-20 md:pt-32 pb-16">
        <h2 className="hero-fade-1 text-5xl md:text-6xl font-medium tracking-tighter mb-6 max-w-4xl text-pretty leading-[0.95] select-none text-center">
          The curated community <br className="hidden md:block" /> for <span className="font-playfair bg-gradient-to-b from-emerald-300 via-emerald-100 to-white bg-clip-text text-transparent italic px-2 py-1 box-decoration-clone leading-tight">meaningful connections.</span>
        </h2>

        <p className="hero-fade-2 font-dm text-lg md:text-xl text-zinc-400/90 max-w-2xl mb-12 font-light leading-relaxed text-center">
          A private space for professionals, creators, and visionaries.
          Connect through voice, video, and serendipity.
        </p>

        <div className="hero-fade-4 flex items-center justify-center mb-10 w-full">
          <button
            onClick={handleOAuthLogin}
            className="group relative flex items-center gap-2 px-8 py-4 rounded-full bg-emerald-600/90 hover:bg-emerald-500 text-white font-medium text-sm md:text-base transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_28px_rgba(16,185,129,0.4)] active:scale-[0.97] shadow-[0_0_20px_rgba(16,185,129,0.2)] overflow-hidden"
          >
            <span className="absolute inset-0 w-full h-full rounded-full overflow-hidden pointer-events-none">
              <span className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 group-hover:animate-sweep" />
            </span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            Get Started
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-all duration-300">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

    </main>
  );
}