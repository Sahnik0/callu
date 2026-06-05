"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { useCall } from "@/context/CallContext";
import { Bell, Mic, Video } from "lucide-react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { toast } from "sonner";

interface User {
  _id: string;
  name: string;
  avatarConfig: {
    image: string;
    color: string;
  };
  email: string;
}

export default function MembersPage() {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const { callUser } = useCall();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifyState, setNotifyState] = useState<Record<string, "idle" | "loading" | "sent">>({});

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/users?status=approved");
        const data = await res.json();
        // Filter out self
        const others = data.users.filter((u: User) => u._id !== user?._id);
        setUsers(others);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchUsers();
  }, [user]);

  const isOnline = (id: string) => onlineUsers.includes(id);
  const onlineCount = users.filter((u) => isOnline(u._id)).length;

  const handleNotify = async (targetUserId: string) => {
    if (!user?._id) return;
    setNotifyState((prev) => ({ ...prev, [targetUserId]: "loading" }));
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, callerId: user._id }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.message || "Failed to send notification");
        setNotifyState((prev) => ({ ...prev, [targetUserId]: "idle" }));
        return;
      }
      setNotifyState((prev) => ({ ...prev, [targetUserId]: "sent" }));
    } catch (err) {
      console.error(err);
      toast.error("Failed to send notification");
      setNotifyState((prev) => ({ ...prev, [targetUserId]: "idle" }));
    }
  };

  return (
    <div className="space-y-8">
      <header>
         <h2 className="text-3xl font-light tracking-tight text-white">Members</h2>
         <p className="text-zinc-500 mt-2">
           {users.length > 0
             ? `${onlineCount} online • ${users.length} total`
             : "No members yet"}
         </p>
      </header>

      {/* Bento Grid or Empty State */}
      {!loading && users.length === 0 ? (
        // Empty state - no users
        <div className="flex flex-col items-center justify-center min-h-[500px] w-full bg-zinc-900/40 border border-zinc-800 rounded-3xl backdrop-blur-sm p-12">
          <div className="w-56 h-56 mb-8 bg-zinc-900/50 rounded-full flex items-center justify-center relative">
             <div className="absolute inset-0 bg-zinc-500/5 rounded-full blur-3xl" />
             <div className="w-full h-full -translate-y-3 -translate-x-2">
               <DotLottieReact
                src="/Lotties/nobody.lottie"
                loop
                autoplay
              />
             </div>
          </div>
          <div className="text-center space-y-3 max-w-md">
            <h3 className="text-3xl font-light text-white tracking-tight">No Members Yet</h3>
            <p className="text-zinc-500 leading-relaxed font-light">Invite people to join and the community will show up here.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {users.map((member) => (
             <div key={member._id} className="group relative bg-zinc-900/40 border border-zinc-800/50 rounded-3xl p-6 backdrop-blur-sm hover:border-zinc-700/80 hover:bg-zinc-800/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50">
                
                {/* Status Indicator */}
                <div className="absolute top-6 right-6 flex items-center gap-2">
                  {isOnline(member._id) ? (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-zinc-600"></span>
                  )}
                </div>

                <div className="flex flex-col items-center mb-6 pt-4">
                   <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center bg-zinc-800 ring-4 ring-zinc-800/50 group-hover:ring-zinc-700 transition-all mb-4 shadow-lg">
                      {member.avatarConfig?.image ? (
                        <img 
                          src={member.avatarConfig.image} 
                          alt={member.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-3xl font-bold text-white">{member.name[0].toUpperCase()}</span>
                      )}
                   </div>
                   <div className="flex items-center justify-center gap-2">
                     <h3 className="text-xl font-medium text-white group-hover:text-emerald-400 transition-colors">{member.name}</h3>
                     <img src="/Verification-Blue-Tick-PNG.webp" alt="Verified" className="w-5 h-5 flex-shrink-0" />
                   </div>
                   <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Verified Member</p>
                </div>

                <div className="space-y-3">
                  {isOnline(member._id) ? (
                    <>
                      <button
                        onClick={() => callUser(member._id, member.name, member.avatarConfig?.image, "voice")}
                        className="w-full bg-white text-black hover:bg-zinc-200 py-3 rounded-2xl font-medium flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-lg shadow-white/5"
                        title="Start Voice Call"
                      >
                        <Mic size={18} /> <span className="tracking-wide">Voice Call</span>
                      </button>
                      <button
                        onClick={() => callUser(member._id, member.name, member.avatarConfig?.image, "video")}
                        className="w-full bg-blue-600 text-white hover:bg-blue-700 py-3 rounded-2xl font-medium flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-lg shadow-blue-500/20"
                        title="Start Video Call"
                      >
                        <Video size={18} /> <span className="tracking-wide">Video Call</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleNotify(member._id)}
                      className="w-full py-4 rounded-2xl bg-zinc-800/50 text-zinc-300 border border-zinc-700/30 hover:bg-zinc-800 hover:text-white hover:border-zinc-600 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={notifyState[member._id] === "loading" || notifyState[member._id] === "sent"}
                      title="Send an email notification"
                    >
                      <Bell size={20} />
                      <span className="tracking-wide">
                        {notifyState[member._id] === "sent"
                          ? "Notified"
                          : notifyState[member._id] === "loading"
                          ? "Notifying..."
                          : "Notify"
                        }
                      </span>
                    </button>
                  )}
                </div>
             </div>
          ))}
          
          {loading && [1,2,3,4].map(i => (
             <div key={i} className="animate-pulse bg-zinc-900/30 border border-zinc-800 rounded-3xl p-6 h-[320px]" />
          ))}
        </div>
      )}
    </div>
  );
}
