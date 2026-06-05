"use client";
import React, { useState, useEffect } from "react";
import ApplyModal, { LoginModal } from "@/components/ApplyModal";
import StyledButton from "@/components/StyledButton";
import MemberButton from "@/components/MemberButton";
import { Mic, Shield, Lock, Zap, Twitter, Linkedin, Github, Mail, Activity } from "lucide-react";
import { Footer } from "@/components/ui/modem-animated-footer";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [showApply, setShowApply] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/dashboard/members", { replace: true });
      }
    }
  }, [user, isLoading, navigate]);

  return (
    <main className="min-h-screen overflow-y-auto bg-black text-white relative">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Navigation Bar */}
      <nav className="relative z-10 flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-1">
          <h1 className="text-3xl font-black tracking-tight">Callu</h1>
          <div className="w-2 h-2 bg-emerald-500 rounded-full" />
        </div>
        <MemberButton onClick={() => setShowLogin(true)} text="Sign In" />
      </nav>

      {/* Hero Header Layout */}
      <div className="relative z-10 flex flex-col items-start justify-start text-left px-6 pt-32 max-w-3xl mx-auto w-full">
        <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-6 text-zinc-100">
          The curated network <br />
          <span className="text-zinc-400">for developers.</span>
        </h2>
        <p className="font-dm text-lg md:text-xl text-zinc-400 max-w-xl mb-8 text-left mx-0">
          A private space for professionals, creators, and builders. Connect through voice, video, and text seamlessly.
        </p>

        {/* Bento Grid Teaser */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-6 gap-6 w-full max-w-3xl mx-0 pb-24 text-left">
          {/* Card 1: Exclusive Access (Large) */}
          <div className="col-span-1 md:col-span-4 bg-[#191919] border border-zinc-800 rounded-lg py-6 pr-6 pl-6 cursor-default min-h-[260px] flex flex-col justify-between text-left">
            <div>
              <div className="w-10 h-10 bg-zinc-800/50 rounded-md flex items-center justify-center mb-4 border border-zinc-700/30">
                <Lock className="text-zinc-400" size={18} />
              </div>
              <h3 className="text-xl font-semibold text-zinc-100 mb-2">Exclusive Access</h3>
              <p className="text-zinc-400 text-sm font-normal max-w-md leading-relaxed">
                Our community is manually curated. We accept less than 1% of applicants to ensure meaningful connections and a high-trust environment.
              </p>
            </div>
          </div>

          {/* Card 2: Instant Connect (Small) */}
          <div className="col-span-1 md:col-span-2 bg-[#191919] border border-zinc-800 rounded-lg py-6 pr-6 pl-6 cursor-default min-h-[260px] flex flex-col justify-between text-left">
            <div>
              <div className="w-10 h-10 bg-zinc-800/50 rounded-md flex items-center justify-center mb-4 border border-zinc-700/30">
                <Zap className="text-zinc-400" size={18} />
              </div>
              <h3 className="text-xl font-semibold text-zinc-100 mb-2">Instant Connect</h3>
              <p className="text-zinc-400 text-sm font-normal max-w-sm leading-relaxed">
                Connect through voice, video, and text seamlessly with instant room generation.
              </p>
            </div>
          </div>

          {/* Card 3: Private by Design (Small) */}
          <div className="col-span-1 md:col-span-2 bg-[#191919] border border-zinc-800 rounded-lg py-6 pr-6 pl-6 cursor-default min-h-[260px] flex flex-col justify-between text-left">
            <div className="w-10 h-10 bg-zinc-800/50 rounded-md border border-zinc-700/30 flex items-center justify-center mb-4">
              <Shield className="text-zinc-400" size={18} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-zinc-100 mb-2">Private by Design</h3>
              <div>
                <p className="text-zinc-400 text-sm font-normal max-w-sm leading-relaxed">
                  Your data is yours. End-to-end encrypted signals protect your workspace.
                </p>
              </div>
            </div>
          </div>
          {/* Card 4: Crystal Voice (Large) */}
          <div className="col-span-1 md:col-span-4 bg-[#191919] border border-zinc-800 rounded-lg py-6 pr-6 pl-6 cursor-default min-h-[260px] flex flex-col justify-between text-left">
            <div className="w-10 h-10 bg-zinc-800/50 rounded-md border border-zinc-700/30 flex items-center justify-center mb-4">
              <Mic className="text-zinc-400" size={18} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-zinc-100 mb-2">Crystal Clear Audio</h3>
              <div>
                <p className="text-zinc-400 text-sm font-normal max-w-md leading-relaxed">
                  Experience high-fidelity voice conversations that feel like you're in the same room. No lag, no noise, just pure connection.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer
        brandName="CALLU"
        brandDescription="The curated community for meaningful connections."
        socialLinks={[
          { icon: <Twitter className="w-5 h-5" />, href: "#", label: "Twitter" },
          { icon: <Linkedin className="w-5 h-5" />, href: "#", label: "LinkedIn" },
          { icon: <Github className="w-5 h-5" />, href: "#", label: "GitHub" },
          { icon: <Mail className="w-5 h-5" />, href: "#", label: "Email" },
        ]}
        navLinks={[
          { label: "Manifesto", href: "#" },
          { label: "Community", href: "#" },
          { label: "Privacy", href: "#" },
          { label: "Terms", href: "#" },
        ]}
        brandIcon={<Activity className="w-8 h-8 text-emerald-500" />}
      />

      {showApply && <ApplyModal onClose={() => setShowApply(false)} />}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </main>
  );
}
