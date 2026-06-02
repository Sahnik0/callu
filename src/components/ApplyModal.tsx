"use client";
import React, { useEffect, useState } from "react";
import { X, ArrowRight, Loader2, ShieldCheck, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function ApplyModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ name: "", email: "", mobile: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-zinc-950/90 border border-zinc-800/50 p-10 rounded-[2rem] max-w-md text-center backdrop-blur-2xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[50px] -mr-16 -mt-16 pointer-events-none" />
                <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <ShieldCheck size={32} />
                </div>
                <h3 className="text-3xl text-white font-playfair italic mb-3">Application Received</h3>
                <p className="text-zinc-400 mb-8 font-dm leading-relaxed">Your application has been logged in our secure node. We manually review every profile to ensure community quality. Expect an encrypted email soon.</p>
                <button onClick={onClose} className="bg-white text-black px-10 py-3 rounded-full font-medium hover:scale-105 transition-all text-sm uppercase tracking-wide cursor-pointer shadow-lg hover:shadow-white/20">
                    Return to Home
                </button>
            </div>
        </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-zinc-950/80 border border-zinc-800/50 rounded-[2rem] overflow-hidden relative backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent opacity-50" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-emerald-900/10 rounded-full blur-[80px] -mr-20 -mb-20 pointer-events-none" />
        
        <button onClick={onClose} aria-label="Close modal" title="Close modal" className="absolute top-5 right-5 p-2 text-zinc-500 hover:text-white transition-colors cursor-pointer z-10 bg-zinc-900/50 rounded-full hover:bg-zinc-800">
          <X size={18} />
        </button>

        <div className="p-8 sm:p-10">
            <div className="flex items-center gap-3 mb-2">
                <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-500 text-xs font-bold uppercase tracking-widest">Open Registration</span>
            </div>
            <h2 className="text-4xl font-medium text-white mb-2 font-playfair italic">Apply to Join</h2>
            <p className="text-zinc-500 mb-8 font-dm text-sm">Access is exclusive and manually approved. Join the top 1%.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-xs font-bold text-zinc-600 mb-2 uppercase tracking-wider ml-1">Identity</label>
                    <input 
                        required
                        className="w-full bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 text-zinc-200 focus:outline-none focus:border-emerald-500/50 focus:bg-zinc-900 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-zinc-700 font-dm"
                        placeholder="Full Name"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-zinc-600 mb-2 uppercase tracking-wider ml-1">Contact Signal</label>
                    <div className="grid grid-cols-2 gap-4">
                        <input 
                            required
                            type="email"
                            className="col-span-2 sm:col-span-1 w-full bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 text-zinc-200 focus:outline-none focus:border-emerald-500/50 focus:bg-zinc-900 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-zinc-700 font-dm"
                            placeholder="Email Address"
                            value={formData.email}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                        />
                        <input 
                            required
                            className="col-span-2 sm:col-span-1 w-full bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 text-zinc-200 focus:outline-none focus:border-emerald-500/50 focus:bg-zinc-900 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-zinc-700 font-dm"
                            placeholder="Mobile Number"
                            value={formData.mobile}
                            onChange={e => setFormData({...formData, mobile: e.target.value})}
                        />
                    </div>
                </div>

                <div className="pt-2">
                    <button 
                        disabled={loading}
                        type="submit" 
                        className="group w-full bg-gradient-to-b from-white to-zinc-200 text-black font-bold text-lg py-4 rounded-xl hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : "Initiate Application"}
                        {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                    </button>
                    <p className="text-center text-[10px] text-zinc-600 mt-4 font-mono uppercase">Encrypted • Secure • Private</p>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
}

export function LoginModal({ onClose }: { onClose: () => void }) {
    const { login, requestLoginCode, verifyLoginCode } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [adminId, setAdminId] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [step, setStep] = useState<"email" | "code">("email");
    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => {
            setResendCooldown((prev) => prev - 1);
        }, 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const success = await login(isAdminMode ? adminId : email, password, isAdminMode);
        setLoading(false);
        if (success) {
            const stored = JSON.parse(localStorage.getItem("callu_user") || "{}");
            if (stored.role === "admin") router.push("/admin");
            else router.push("/dashboard");
            onClose();
        }
    };

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setLoading(true);
        const success = await requestLoginCode(email);
        setLoading(false);
        // Always move to code step to allow user to resend if first attempt failed
        setStep("code");
        if (success) {
            setResendCooldown(30);
        }
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !code) return;
        setLoading(true);
        const success = await verifyLoginCode(email, code);
        setLoading(false);
        if (success) {
            router.push("/dashboard");
            onClose();
        }
    };

    const handleResendCode = async () => {
        if (!email || resendCooldown > 0) return;
        setLoading(true);
        const success = await requestLoginCode(email);
        setLoading(false);
        if (success) {
            setResendCooldown(30);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-zinc-950/90 border border-zinc-800/80 rounded-[2rem] p-8 sm:p-10 relative backdrop-blur-3xl shadow-2xl overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-zinc-800/20 rounded-full blur-[60px] -mr-10 -mt-10 pointer-events-none" />
            
            <button onClick={onClose} aria-label="Close modal" title="Close modal" className="absolute top-5 right-5 p-2 text-zinc-500 hover:text-white transition-colors cursor-pointer bg-zinc-900/50 rounded-full hover:bg-zinc-800 z-10">
              <X size={18} />
            </button>
            
            <div className="mb-8">
                <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800 mb-4 shadow-inner">
                    <Lock size={20} className="text-white" />
                </div>
                <h2 className="text-3xl font-medium text-white font-playfair italic">{isAdminMode ? "Admin Portal" : "Member Access"}</h2>
                <p className="text-zinc-500 text-sm mt-1 font-dm">Authenticate to enter the private network.</p>
            </div>
            
            <div className="flex p-1 bg-zinc-900/80 rounded-xl mb-8 border border-zinc-800/50">
                <button 
                    onClick={() => setIsAdminMode(false)}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all duration-300 cursor-pointer ${!isAdminMode ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    Member
                </button>
                <button 
                    onClick={() => setIsAdminMode(true)}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all duration-300 cursor-pointer ${isAdminMode ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    Admin
                </button>
            </div>

            <form onSubmit={isAdminMode ? handleLogin : step === "email" ? handleSendCode : handleVerifyCode} className="space-y-4">
                {isAdminMode ? (
                    <>
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            <input 
                                required
                                className="w-full bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 text-zinc-200 focus:outline-none focus:border-white/20 focus:bg-zinc-900 focus:ring-1 focus:ring-white/10 transition-all placeholder:text-zinc-700 font-dm"
                                placeholder="Admin Identification"
                                value={adminId}
                                onChange={e => setAdminId(e.target.value)}
                            />
                            <input 
                                required
                                type="password"
                                className="w-full bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 text-zinc-200 focus:outline-none focus:border-white/20 focus:bg-zinc-900 focus:ring-1 focus:ring-white/10 transition-all placeholder:text-zinc-700 font-dm font-bold tracking-widest"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>
                    </>
                ) : (
                    <div className="animate-in slide-in-from-left-4 duration-300 space-y-4">
                        <input 
                            required
                            type="email"
                            className="w-full bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 text-zinc-200 focus:outline-none focus:border-white/20 focus:bg-zinc-900 focus:ring-1 focus:ring-white/10 transition-all placeholder:text-zinc-700 font-dm"
                            placeholder="access@member.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            disabled={step === "code"}
                        />
                        {step === "code" && (
                          <input
                            required
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            className="w-full bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 text-zinc-200 focus:outline-none focus:border-emerald-500/40 focus:bg-zinc-900 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-zinc-700 font-dm tracking-[0.4em] text-center"
                            placeholder="••••••"
                            value={code}
                            onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          />
                        )}
                        <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50 flex items-start gap-3">
                            <div className="h-5 w-5 rounded-full border border-zinc-700 flex items-center justify-center mt-0.5 shrink-0">
                                <div className="h-2.5 w-2.5 bg-zinc-600 rounded-full"></div>
                            </div>
                            <p className="text-xs text-zinc-500 leading-relaxed font-dm">
                                {step === "code"
                                  ? "Enter the 6 digit code sent to your email. It expires in 10 minutes."
                                  : "We will email a one-time verification code to log you in."}
                            </p>
                        </div>
                    </div>
                )}
                 <button 
                    disabled={loading}
                    type="submit" 
                    className="w-full bg-white text-black font-bold text-lg py-4 rounded-xl hover:bg-zinc-200 transition-all mt-6 flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]"
                >
                    {loading ? <Loader2 className="animate-spin" /> : isAdminMode ? "Establish Connection" : step === "email" ? "Send Code" : "Verify & Enter"}
                </button>
                {!isAdminMode && step === "code" && (
                                    <div className="flex flex-col gap-2">
                                        <button
                                            type="button"
                                            onClick={handleResendCode}
                                            disabled={loading || resendCooldown > 0}
                                            className="w-full text-xs text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
                                        >
                                            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setStep("email")}
                                            className="w-full text-xs text-zinc-400 hover:text-white transition-colors"
                                        >
                                            Change email address
                                        </button>
                                    </div>
                )}
            </form>
          </div>
        </div>
    );
}
