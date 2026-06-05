"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LogOut, 
  LayoutDashboard, 
  PhoneCall, 
  Settings, 
  ChevronLeft,
  ChevronDown,
  Users,
  Radio,
  Plus,
  Volume2,
  X,
  LayoutGrid,
  Search,
  MessageSquare,
  Wrench,
  DoorOpen,
  Headphones,
  MoreVertical,
  Edit2,
  Trash2
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { useCall } from "@/context/CallContext";
import { useRoomVoice } from "@/context/RoomVoiceContext";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { PhoneOff, Mic, MicOff, VolumeX } from "lucide-react";
import { toast } from "sonner";

interface Room {
  _id: string;
  name: string;
  description: string;
  participants: any[];
  maxParticipants: number;
  participantsCount?: number;
  roomType?: string;
  visibility?: string;
  createdBy?: any;
}

const navItems = [
  { 
    icon: LayoutDashboard, 
    label: "Community", 
    children: [
      { icon: Users, label: "Members", href: "/dashboard/members" },
    ]
  },
  { icon: PhoneCall, label: "Calls", href: "/dashboard/calls" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

export function DashboardSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(["Community"]);
  const [expandedRooms, setExpandedRooms] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    maxParticipants: 10,
    roomType: "public" as "public" | "private",
    visibility: "visible" as "hidden" | "visible",
  });
  const [joinRequestRoomId, setJoinRequestRoomId] = useState<string | null>(null);
  const [editRoomModal, setEditRoomModal] = useState<{ roomId: string, name: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [conflictModal, setConflictModal] = useState<{
    type: "in-call" | "in-room";
    targetRoomId: string;
    targetRoomName: string;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; roomId: string } | null>(null);
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const { isInCall, isInRoom, currentRoomId, currentRoomName } = useCall();
  const { isVoiceConnected, voiceRoomId, voiceRoomName, isMuted, isDeafened, toggleMute, toggleDeafen, leaveVoice } = useRoomVoice();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetchRooms();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const fetchRooms = async () => {
    try {
      // Pass userId so the API can include the owner's own hidden rooms
      const userId = user?._id || '';
      const response = await fetch(`/api/rooms${userId ? `?userId=${userId}` : ''}`);
      const data = await response.json();
      if (response.ok && data.rooms) {
        setRooms((prev) => data.rooms.map((room: Room) => {
          const prevRoom = prev.find((r) => r._id === room._id);
          return {
            ...room,
            // Socket is the source of truth for live counts/participants.
            // DB participants are stale — ignore them for the sidebar.
            participants: prevRoom?.participants ?? [],
            participantsCount: prevRoom?.participantsCount ?? 0,
          };
        }));
      }
    } catch (error) {
      console.error("Failed to fetch rooms:", error);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handleRoomCountUpdated = (data: { roomId: string; count: number; participants: any[] }) => {
      setRooms((prev) => prev.map((room) => {
        return room._id === data.roomId ? { ...room, participantsCount: data.count, participants: data.participants } : room;
      }));
    };

    socket.emit("rooms-counts-request");

    const handleRoomsCounts = (data: { counts: Array<{ roomId: string; count: number; participants: any[] }> }) => {
      setRooms((prev) => prev.map((room) => {
        const match = data.counts.find((item) => item.roomId === room._id);
        return match ? { ...room, participantsCount: match.count, participants: match.participants } : room;
      }));
    };

    socket.on("room-count-updated", handleRoomCountUpdated);
    socket.on("rooms-counts", handleRoomsCounts);

    // Real-time room list sync
    // Guard: hidden private rooms are not broadcast by the server, but add a
    // client-side check too so non-owners never see them even on race conditions.
    const handleRoomCreated = (data: { room: Room }) => {
      setRooms((prev) => {
        if (prev.find(r => r._id === data.room._id)) return prev;
        // Never add a hidden private room for non-owners
        const creatorId = typeof data.room.createdBy === 'string'
          ? data.room.createdBy
          : (data.room.createdBy as any)?._id?.toString();
        const isOwner = !!user?._id && creatorId === user._id.toString();
        if (data.room.roomType === 'private' && data.room.visibility === 'hidden' && !isOwner) {
          return prev;
        }
        return [data.room, ...prev];
      });
    };

    const handleRoomDeleted = (data: { roomId: string }) => {
      setRooms((prev) => prev.filter(r => r._id !== data.roomId));
    };

    const handleRoomUpdated = (data: { roomId: string; name: string }) => {
      setRooms((prev) => prev.map(r => r._id === data.roomId ? { ...r, name: data.name } : r));
    };

    socket.on("room-created", handleRoomCreated);
    socket.on("room-deleted", handleRoomDeleted);
    socket.on("room-updated", handleRoomUpdated);

    const handleJoinResponse = (data: { roomId: string, action: 'admit' | 'reject' }) => {
      if (data.action === 'admit') {
        toast.success("Request to join approved!");
        setJoinRequestRoomId(null);
        // Persist admission so re-clicking the room from another page/tab won't re-trigger a request
        const admittedRooms: string[] = JSON.parse(localStorage.getItem('admitted-rooms') || '[]');
        if (!admittedRooms.includes(data.roomId)) {
          admittedRooms.push(data.roomId);
          localStorage.setItem('admitted-rooms', JSON.stringify(admittedRooms));
        }
        sessionStorage.setItem('room-join-intent', 'true');
        router.push(`/dashboard/rooms/${data.roomId}`);
      } else {
        toast.error("Request to join rejected.");
        setJoinRequestRoomId(null);
      }
    };
    socket.on("room-join-response", handleJoinResponse);

    const handleJoinDenied = (data: { roomId: string; reason: string }) => {
      toast.error(data.reason || "Access denied to this room.");
      setJoinRequestRoomId(null);
      // Remove from admitted rooms if denied at socket gate
      const admittedRooms: string[] = JSON.parse(localStorage.getItem('admitted-rooms') || '[]');
      localStorage.setItem('admitted-rooms', JSON.stringify(admittedRooms.filter(id => id !== data.roomId)));
      router.push("/dashboard/members");
    };
    socket.on("join-denied", handleJoinDenied);

    const handleInvitation = (data: { roomId: string; roomName: string; fromUserId: string }) => {
      toast(
        <div className="flex flex-col gap-2">
          <p className="font-semibold text-white">Room Invitation</p>
          <p className="text-zinc-400 text-sm">You've been invited to join <span className="text-white font-medium">{data.roomName}</span></p>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => {
                const admittedRooms: string[] = JSON.parse(localStorage.getItem('admitted-rooms') || '[]');
                if (!admittedRooms.includes(data.roomId)) {
                  admittedRooms.push(data.roomId);
                  localStorage.setItem('admitted-rooms', JSON.stringify(admittedRooms));
                }
                sessionStorage.setItem('room-join-intent', 'true');
                router.push(`/dashboard/rooms/${data.roomId}`);
                toast.dismiss(`invite-${data.roomId}`);
              }}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors"
            >Join Room</button>
            <button onClick={() => toast.dismiss(`invite-${data.roomId}`)} className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold transition-colors">Dismiss</button>
          </div>
        </div>,
        { duration: 30000, id: `invite-${data.roomId}` }
      );
    };
    socket.on("room-invitation", handleInvitation);

    return () => {
      socket.off("room-count-updated", handleRoomCountUpdated);
      socket.off("rooms-counts", handleRoomsCounts);
      socket.off("room-created", handleRoomCreated);
      socket.off("room-deleted", handleRoomDeleted);
      socket.off("room-updated", handleRoomUpdated);
      socket.off("room-join-response", handleJoinResponse);
      socket.off("join-denied", handleJoinDenied);
      socket.off("room-invitation", handleInvitation);
    };
  }, [socket]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          createdBy: user?._id,
        }),
      });

      const data = await response.json();
      if (response.ok && data.room) {
        setRooms([data.room, ...rooms]);
        setShowCreateRoomModal(false);
        setFormData({
          name: "",
          description: "",
          maxParticipants: 10,
          roomType: "public",
          visibility: "visible",
        });
        
        // Automatically enter the newly created room
        sessionStorage.setItem('room-join-intent', 'true');
        router.push(`/dashboard/rooms/${data.room._id}`);
      } else {
        toast.error(data.message || "Failed to create room");
      }
    } catch (error) {
      console.error("Failed to create room:", error);
      toast.error("Failed to create room");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRoomModal?.name.trim() || !editRoomModal.roomId) return;
    setEditing(true);
    try {
      const response = await fetch(`/api/rooms/${editRoomModal.roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editRoomModal.name.trim() }),
      });
      const data = await response.json();
      if (response.ok && data.room) {
        setRooms(rooms.map(r => r._id === data.room._id ? data.room : r));
        setEditRoomModal(null);
        toast.success("Room renamed successfully");
      } else {
        toast.error(data.message || "Failed to update room");
      }
    } catch (error) {
      console.error("Failed to update room:", error);
      toast.error("Failed to update room");
    } finally {
      setEditing(false);
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    const targetRoom = rooms.find(r => r._id === roomId);
    const targetName = targetRoom?.name || "this room";

    // Already in this room?
    if (isInRoom && currentRoomId === roomId) {
      sessionStorage.setItem('room-join-intent', 'true');
      router.push(`/dashboard/rooms/${roomId}`);
      return;
    }

    // Already been admitted to this private room?
    const admittedRooms: string[] = JSON.parse(localStorage.getItem('admitted-rooms') || '[]');
    if (admittedRooms.includes(roomId)) {
      sessionStorage.setItem('room-join-intent', 'true');
      router.push(`/dashboard/rooms/${roomId}`);
      return;
    }

    if (targetRoom && targetRoom.roomType === 'private' && targetRoom.visibility !== 'hidden' && targetRoom.createdBy?._id?.toString() !== user?._id?.toString()) {
      if (!socket || !user) return;
      setJoinRequestRoomId(roomId);
      socket.emit("room-request-join", { 
        roomId, 
        userId: user._id, 
        name: user.name, 
        avatar: user.avatarConfig?.image || null, 
        color: user.avatarConfig?.color || '#059669' 
      });
      return;
    }

    // In a call? Must end it first.
    if (isInCall) {
      setConflictModal({ type: "in-call", targetRoomId: roomId, targetRoomName: targetName });
      return;
    }

    // Already in another room? Must leave it first.
    if (isInRoom && currentRoomId && currentRoomId !== roomId) {
      setConflictModal({ type: "in-room", targetRoomId: roomId, targetRoomName: targetName });
      return;
    }

    sessionStorage.setItem('room-join-intent', 'true');
    router.push(`/dashboard/rooms/${roomId}`);
  };

  const handleDeleteRoom = async (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm("Are you sure you want to delete this room? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setRooms((prev) => prev.filter((room) => room._id !== roomId));
        toast.success("Room deleted successfully");
      } else {
        toast.error("Failed to delete room");
      }
    } catch (error) {
      console.error("Failed to delete room:", error);
      toast.error("Failed to delete room");
    }
  };

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);
  
  const toggleExpand = (label: string) => {
    setExpandedItems(prev => 
      prev.includes(label) ? prev.filter(item => item !== label) : [...prev, label]
    );
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    return pathname === href || pathname?.startsWith(href + "/");
  };

  const isRoomActive = (roomId: string) => {
    return pathname === `/dashboard/rooms/${roomId}`;
  };

  return (
    <motion.aside
      initial={{ width: 256 }}
      animate={{ width: isCollapsed ? 80 : 256 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={cn(
        "bg-black border-r border-zinc-900 h-full hidden md:flex flex-col pt-6 z-20 relative shrink-0 overflow-hidden"
      )}
    >



      <div className={cn("flex flex-col flex-1 min-h-0", isCollapsed ? "items-center px-2" : "px-6")}>
        {/* Logo */}
        <div className={cn("mb-10 flex items-center h-8 relative transition-all shrink-0", isCollapsed ? "justify-center" : "")}>
          {isCollapsed ? (
             <div className="flex items-center flex-col gap-1">
                <span className="text-xl font-black tracking-tighter text-white">C</span>
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
             </div>
          ) : (
             <div className="flex items-center gap-1">
                <h1 className="text-2xl font-black tracking-tighter text-white">CALLU</h1>
                <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2"></div>
             </div>
          )}
        </div>

        {/* Navigation - SCROLLABLE */}
        <nav className={cn("space-y-2 w-full transition-all flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar overscroll-contain", isCollapsed ? "mt-8" : "")}>
          {navItems.map((item) => (
            <div key={item.label}>
              {/* Parent Item */}
              {item.children ? (
                <button
                  onClick={() => !isCollapsed && toggleExpand(item.label)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-all group w-full cursor-pointer",
                    "hover:bg-zinc-900/50 text-zinc-400 hover:text-white",
                    isCollapsed ? "justify-center" : "justify-between"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <AnimatePresence mode="popLayout">
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="whitespace-nowrap font-medium text-sm"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  {!isCollapsed && (
                    <ChevronDown 
                      className={cn(
                        "w-4 h-4 transition-transform flex-shrink-0",
                        expandedItems.includes(item.label) && "rotate-180"
                      )} 
                    />
                  )}
                </button>
              ) : (
                <Link
                  href={item.href!}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-all group",
                    "hover:bg-zinc-900/50 text-zinc-400 hover:text-white",
                    isActive(item.href) && "bg-zinc-900/50 text-white",
                    isCollapsed ? "justify-center" : ""
                  )}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <AnimatePresence mode="popLayout">
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="whitespace-nowrap font-medium text-sm"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              )}

              {/* Child Items */}
              {item.children && !isCollapsed && (
                <AnimatePresence>
                  {expandedItems.includes(item.label) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="ml-4 mt-1 space-y-1 border-l border-zinc-800 pl-4">
                        {/* Rooms Section */}
                        <div>
                          <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-zinc-900/50 text-zinc-500 hover:text-white transition-all">
                            <button
                              onClick={() => setExpandedRooms(!expandedRooms)}
                              className="flex items-center gap-3 text-sm flex-1 cursor-pointer"
                            >
                              <Radio className="w-4 h-4 flex-shrink-0" />
                              <span className="whitespace-nowrap font-medium">Rooms</span>
                              <ChevronDown 
                                className={cn(
                                  "w-3 h-3 transition-transform flex-shrink-0",
                                  expandedRooms && "rotate-180"
                                )} 
                              />
                            </button>
                            <button
                              onClick={() => setShowCreateRoomModal(true)}
                              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-all cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Room List */}
                          <AnimatePresence>
                            {expandedRooms && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden ml-4 mt-1 space-y-1"
                              >
                                {rooms.length === 0 ? (
                                  <div className="text-xs text-zinc-600 p-2">No rooms yet</div>
                                ) : (
                                  rooms.filter(r => {
                                    // Final client-side safety net: hide private+hidden rooms from non-owners
                                    const creatorId = typeof r.createdBy === 'string'
                                      ? r.createdBy
                                      : (r.createdBy as any)?._id?.toString?.() ?? '';
                                    const isCreator = !!user?._id && creatorId === user._id.toString();
                                    if (r.roomType === 'private' && r.visibility === 'hidden' && !isCreator) return false;
                                    return true;
                                  }).map((room) => {
                                    const isLive = (room.participantsCount ?? 0) > 0;
                                    const isWaiting = joinRequestRoomId === room._id;
                                    return (
                                    <div
                                      key={room._id}
                                      className="group relative"
                                    >
                                      <button
                                        onClick={() => handleJoinRoom(room._id)}
                                        className={cn(
                                          "flex items-center gap-2 w-full rounded-lg transition-all text-left cursor-pointer",
                                          isLive ? "flex-col gap-1.5 p-2.5" : "p-2",
                                          "hover:bg-zinc-900/50",
                                          isRoomActive(room._id) ? "bg-zinc-900/80 text-white" : "text-zinc-500"
                                        )}
                                      >
                                        {/* Top row: icon + name */}
                                        <div className="flex items-center gap-2 w-full">
                                          {isLive ? (
                                            <div className="flex items-end gap-[2px] h-3 w-3 flex-shrink-0">
                                              <span className="w-[3px] bg-emerald-500 rounded-full animate-music-bar h-full" style={{ animationDelay: '0s' }} />
                                              <span className="w-[3px] bg-emerald-500 rounded-full animate-music-bar h-2/3" style={{ animationDelay: '0.15s' }} />
                                              <span className="w-[3px] bg-emerald-500 rounded-full animate-music-bar h-full" style={{ animationDelay: '0.3s' }} />
                                            </div>
                                          ) : (
                                            <Volume2 className="w-3.5 h-3.5 flex-shrink-0 text-zinc-600" />
                                          )}
                                          <div 
                                            className={cn(
                                              "flex-1 overflow-hidden relative text-xs font-medium transition-colors",
                                              isRoomActive(room._id) ? "text-white" : isLive ? "text-zinc-200" : "text-zinc-500 group-hover:text-zinc-300"
                                            )}
                                            title={room.name}
                                            onMouseEnter={(e) => {
                                              const span = e.currentTarget.querySelector('.room-name-text') as HTMLSpanElement;
                                              if (span && span.scrollWidth > e.currentTarget.clientWidth) {
                                                const distance = span.scrollWidth - e.currentTarget.clientWidth;
                                                span.style.setProperty('--scroll-distance', `-${distance}px`);
                                                span.classList.add('should-scroll');
                                              }
                                            }}
                                            onMouseLeave={(e) => {
                                              const span = e.currentTarget.querySelector('.room-name-text') as HTMLSpanElement;
                                              if (span) {
                                                span.classList.remove('should-scroll');
                                                span.style.removeProperty('--scroll-distance');
                                              }
                                            }}
                                          >
                                            <span className="room-name-text whitespace-nowrap">
                                              {room.name}
                                            </span>
                                          </div>
                                          {room.createdBy?._id === user?._id && (
                                            <div
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setContextMenu({ x: rect.left, y: rect.bottom + 5, roomId: room._id });
                                              }}
                                              className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-white transition-all rounded hover:bg-zinc-800 cursor-pointer flex items-center justify-center"
                                              role="button"
                                            >
                                              <MoreVertical className="w-3.5 h-3.5" />
                                            </div>
                                          )}
                                          {!isLive && !isWaiting && (
                                            <span className="text-[10px] text-zinc-600 font-medium">0/{room.maxParticipants}</span>
                                          )}
                                        </div>

                                        {/* Avatars row — only for live rooms */}
                                        {isLive && room.participants && room.participants.length > 0 && (
                                          <div className="flex items-center justify-between pl-5 w-full">
                                            <div className="flex -space-x-1.5">
                                              {room.participants.slice(0, 5).map((p: any, i: number) => {
                                                const avatarUrl = p.avatar || p.avatarConfig?.image;
                                                const avatarColor = p.color || p.avatarConfig?.color || '#059669';
                                                return (
                                                  <div
                                                    key={p.userId || p._id || i}
                                                    className="w-5 h-5 rounded-full border border-black bg-zinc-800 overflow-hidden"
                                                    title={p.name}
                                                    style={{ backgroundColor: !avatarUrl ? avatarColor : undefined }}
                                                  >
                                                    {avatarUrl ? (
                                                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                      <div className="w-full h-full flex items-center justify-center text-[7px] font-bold text-white/80">
                                                        {p.name?.[0]?.toUpperCase()}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                              {room.participants.length > 5 && (
                                                <div className="w-5 h-5 rounded-full border border-black bg-zinc-800 flex items-center justify-center">
                                                  <span className="text-[7px] font-bold text-zinc-400">+{room.participants.length - 5}</span>
                                                </div>
                                              )}
                                            </div>
                                            <span className="text-[10px] text-zinc-500 font-medium">
                                              {room.participantsCount}/{room.maxParticipants}
                                            </span>
                                          </div>
                                        )}
                                      </button>
                                    </div>
                                  );})
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Other Children (Members, etc.) */}
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "flex items-center gap-3 p-2.5 rounded-lg transition-all text-sm",
                              "hover:bg-zinc-900/50 text-zinc-500 hover:text-white",
                              isActive(child.href) && "bg-zinc-900/50 text-white"
                            )}
                          >
                            <child.icon className="w-4 h-4 flex-shrink-0" />
                            <span className="whitespace-nowrap font-medium">{child.label}</span>
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Create Room Modal */}
      <AnimatePresence>
        {showCreateRoomModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="bg-zinc-900 border border-zinc-800/50 rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              {/* Decorative gradient blob */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    Create New Room
                  </h2>
                  <button 
                    onClick={() => setShowCreateRoomModal(false)}
                    className="p-2 bg-zinc-800/50 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors border border-transparent hover:border-zinc-700/50 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <form onSubmit={handleCreateRoom} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Room Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all font-medium"
                      placeholder="e.g. Chill Vibes Only 🎧"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Description <span className="text-zinc-600 font-normal lowercase ml-1">(Optional)</span>
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all resize-none min-h-[100px]"
                      placeholder="What's this room about?"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Max Participants
                      </label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                          type="number"
                          min={2}
                          max={50}
                          value={formData.maxParticipants}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              maxParticipants: parseInt(e.target.value),
                            })
                          }
                          className="w-full pl-10 pr-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Privacy
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                          <ChevronDown className="w-4 h-4 text-zinc-500" />
                        </div>
                        <select
                          value={formData.roomType}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              roomType: e.target.value as "public" | "private",
                            })
                          }
                          className="w-full px-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer"
                        >
                          <option value="public">Public</option>
                          <option value="private">Private</option>
                        </select>
                      </div>
                    </div>

                    {formData.roomType === "private" && (
                      <div className="space-y-2 col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                          Visibility
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                            <ChevronDown className="w-4 h-4 text-zinc-500" />
                          </div>
                          <select
                            value={formData.visibility}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                visibility: e.target.value as "hidden" | "visible",
                              })
                            }
                            className="w-full px-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer"
                          >
                            <option value="visible">Visible (Request to Join)</option>
                            <option value="hidden">Hidden (Invite Only)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCreateRoomModal(false)}
                      className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all font-medium border border-transparent hover:border-zinc-600 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/20 hover:shadow-emerald-900/40 relative overflow-hidden group"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {creating ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                            Create Room
                          </>
                        )}
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editRoomModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />
              <div className="relative z-10">
                <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">Edit Room</h3>
                <p className="text-sm text-zinc-400 mb-8">Rename your room.</p>
                <form onSubmit={handleUpdateRoom} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Room Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <MessageSquare className="w-4 h-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={50}
                        value={editRoomModal.name}
                        onChange={(e) => setEditRoomModal({ ...editRoomModal, name: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                        placeholder="e.g. Daily Standup"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setEditRoomModal(null)}
                      className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editing || !editRoomModal.name.trim()}
                      className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all font-medium cursor-pointer disabled:opacity-50"
                    >
                      {editing ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editRoomModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />
              <div className="relative z-10">
                <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">Edit Room</h3>
                <p className="text-sm text-zinc-400 mb-8">Rename your room.</p>
                <form onSubmit={handleUpdateRoom} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Room Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <MessageSquare className="w-4 h-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={50}
                        value={editRoomModal.name}
                        onChange={(e) => setEditRoomModal({ ...editRoomModal, name: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                        placeholder="e.g. Daily Standup"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setEditRoomModal(null)}
                      className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editing || !editRoomModal.name.trim()}
                      className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all font-medium cursor-pointer disabled:opacity-50"
                    >
                      {editing ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conflict Modal — shown when user tries to join a room while in a call or another room */}
      <AnimatePresence>
        {conflictModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="bg-zinc-900 border border-zinc-800/50 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2 pointer-events-none" />
              
              <div className="relative z-10">
                <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mb-5">
                  {conflictModal.type === "in-call" ? (
                    <PhoneOff className="w-7 h-7 text-red-500" />
                  ) : (
                    <DoorOpen className="w-7 h-7 text-amber-500" />
                  )}
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
                  {conflictModal.type === "in-call" ? "You're in a Call" : "Already in a Room"}
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                  {conflictModal.type === "in-call"
                    ? `You need to end your current call before joining "${conflictModal.targetRoomName}".`
                    : `You're currently in "${currentRoomName || "a room"}". Leave it to join "${conflictModal.targetRoomName}"?`
                  }
                </p>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setConflictModal(null)}
                    className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all font-medium border border-transparent hover:border-zinc-600"
                  >
                    {conflictModal.type === "in-call" ? "No Thanks" : "Stay Here"}
                  </button>
                  
                  {conflictModal.type === "in-room" && (
                    <button
                      onClick={() => {
                        const targetId = conflictModal.targetRoomId;
                        setConflictModal(null);
                        // Navigate to the new room — the room page will handle leaving via socket.data.currentRoom on server
                        sessionStorage.setItem('room-join-intent', 'true');
                        router.push(`/dashboard/rooms/${targetId}`);
                      }}
                      className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-all font-medium shadow-lg shadow-amber-900/20"
                    >
                      Leave & Join
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn("border-t border-zinc-900 bg-black shrink-0 py-4", isCollapsed ? "px-4" : "px-6")}>
        {user && (
          <div className={cn(
            "relative group/voice flex items-center mb-3 rounded-xl p-2 transition-all",
            isCollapsed ? "justify-center" : "gap-3"
          )}>
             <div
               className={cn(
                 "w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 border-2 transition-colors",
                 isVoiceConnected ? "border-emerald-500 cursor-pointer" : "border-zinc-800 bg-zinc-800"
               )}
               onClick={() => {
                 if (isVoiceConnected && voiceRoomId) {
                   sessionStorage.setItem('room-join-intent', 'true');
                   router.push(`/dashboard/rooms/${voiceRoomId}`);
                 }
               }}
             >
                {user.avatarConfig?.image ? (
                  <img
                    src={user.avatarConfig.image}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold text-white">
                    {user.name?.[0]?.toUpperCase() || "U"}
                  </span>
                )}
              </div>
              
              {!isCollapsed && (
                   <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="overflow-hidden flex-1 min-w-0"
                   >
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-white truncate max-w-[100px]">{user.name}</p>
                      <img src="/Verification-Blue-Tick-PNG.webp" alt="Verified" className="w-4 h-4 flex-shrink-0" />
                    </div>
                    <p className="text-xs text-zinc-500 truncate max-w-[120px]">{user.email}</p>
                   </motion.div>
              )}

              {/* ─── Voice Connected tooltip (hover only) ─── */}
              {isVoiceConnected && voiceRoomId && (
                <div
                  onClick={() => {
                    sessionStorage.setItem('room-join-intent', 'true');
                    router.push(`/dashboard/rooms/${voiceRoomId}`);
                  }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-xl bg-zinc-900 border border-emerald-500/30 shadow-xl shadow-black/40 opacity-0 pointer-events-none group-hover/voice:opacity-100 group-hover/voice:pointer-events-auto transition-all duration-200 cursor-pointer hover:bg-zinc-800 whitespace-nowrap z-50"
                >
                  <div className="flex items-center gap-2">
                    <div className="relative flex-shrink-0">
                      <Volume2 className="w-3.5 h-3.5 text-emerald-500" />
                      <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Voice Connected</p>
                      <p className="text-[11px] text-zinc-400 truncate max-w-[140px]">{voiceRoomName || 'Room'}</p>
                    </div>
                  </div>
                  {/* Arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 border-r border-b border-emerald-500/30 rotate-45 -mt-1" />
                </div>
              )}
          </div>
        )}

        {/* ─── Voice controls (mute/deafen/disconnect) ─── */}
        {isVoiceConnected && voiceRoomId && (
          <div className="flex items-center justify-center gap-1 mb-3">
              <button
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                className={cn(
                  "p-1.5 rounded-lg transition-all cursor-pointer",
                  isMuted
                    ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                )}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); toggleDeafen(); }}
                className={cn(
                  "p-1.5 rounded-lg transition-all cursor-pointer",
                  isDeafened
                    ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                )}
                title={isDeafened ? 'Undeafen' : 'Deafen'}
              >
                {isDeafened ? <VolumeX className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  leaveVoice();
                  router.push("/dashboard/members");
                }}
                className="p-1.5 rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600/20 transition-all cursor-pointer"
                title="Disconnect"
              >
                <PhoneOff className="w-3.5 h-3.5" />
              </button>
          </div>
        )}

        <button
          onClick={logout}
          className={cn(
            "flex items-center gap-3 text-red-500 hover:text-red-400 transition-colors w-full p-2 relative cursor-pointer",
            isCollapsed ? "justify-center" : ""
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && (
             <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm font-medium"
             >
                Logout
             </motion.span>
          )}
           
          {isCollapsed && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/80 rounded-md">
                 <span className="sr-only">Logout</span>
            </div>
          )}
        </button>
      </div>

      {/* Right-click context menu for rooms */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div
            className="fixed z-[61] bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-1 min-w-[140px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                const r = rooms.find(rm => rm._id === contextMenu.roomId);
                if (r) setEditRoomModal({ roomId: r._id, name: r.name });
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit Room
            </button>
            <button
              onClick={() => {
                handleDeleteRoom(contextMenu.roomId, { stopPropagation: () => {} } as any);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Room
            </button>
          </div>
        </>
      )}
      {/* Waiting for Approval Overlay in Main Content Area */}
      {joinRequestRoomId && (
        <div 
          className="fixed inset-y-0 right-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto transition-all duration-300" 
          style={{ left: isCollapsed ? '80px' : '280px' }}
        >
          <div className="bg-zinc-950 border border-emerald-900/30 p-8 rounded-3xl flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(16,185,129,0.1)] max-w-sm mx-4 animate-in fade-in zoom-in duration-300">
             <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                <DoorOpen className="w-6 h-6 text-emerald-500 absolute" />
             </div>
             <div className="text-center space-y-2">
               <h2 className="text-xl font-semibold text-white tracking-tight">Request Sent</h2>
               <p className="text-sm text-zinc-400 leading-relaxed">
                 Waiting for the room owner to let you in...
               </p>
             </div>
             <button 
               onClick={() => setJoinRequestRoomId(null)}
               className="mt-2 w-full px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl transition-colors text-sm font-medium border border-zinc-800 hover:border-zinc-700 cursor-pointer"
             >
               Cancel Request
             </button>
          </div>
        </div>
      )}


    </motion.aside>
  );
}
