"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCall } from "@/context/CallContext";
import {
  Settings,
  HelpCircle,
  Keyboard,
  Info,
  AlertCircle,
  Copy,
  UserCircle,
  Home,
  LogOut,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function CustomContextMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isInRoom, currentRoomId, currentRoomName } = useCall();

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Allow default context menu on text inputs and editable content
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      e.preventDefault();

      // Calculate position, ensuring menu stays within viewport
      const menuWidth = 240;
      const menuHeight = 400; // approximate
      const x = e.clientX + menuWidth > window.innerWidth 
        ? window.innerWidth - menuWidth - 10 
        : e.clientX;
      const y = e.clientY + menuHeight > window.innerHeight 
        ? window.innerHeight - menuHeight - 10 
        : e.clientY;

      setPosition({ x, y });
      setIsOpen(true);
    };

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  const copyRoomLink = () => {
    if (currentRoomId) {
      const link = `${window.location.origin}/dashboard/rooms/${currentRoomId}`;
      navigator.clipboard.writeText(link);
      toast.success("Room link copied to clipboard!");
    }
  };

  const openKeyboardShortcuts = () => {
    toast.info(
      "M: Mute/Unmute • D: Deafen • V: Camera • S: Screen • ESC: Close",
      { duration: 5000 }
    );
  };

  const reportIssue = () => {
    const subject = encodeURIComponent("CALLU Issue Report");
    const body = encodeURIComponent(
      `Page: ${pathname}\n\nDescribe the issue:\n\n`
    );
    window.open(
      `mailto:support@callu.app?subject=${subject}&body=${body}`,
      "_blank"
    );
  };

  const showAbout = () => {
    toast.info(
      "CALLU v1.0.0 - Exclusive community platform for voice, video, and serendipitous connections. © 2026",
      { duration: 4000 }
    );
  };

  const menuItems = [
    // Room-specific actions
    ...(isInRoom && currentRoomName
      ? [
          {
            icon: Copy,
            label: `Copy "${currentRoomName}" Link`,
            action: copyRoomLink,
            divider: true,
          },
        ]
      : []),

    // Navigation actions (only if not on that page)
    ...(pathname !== "/dashboard"
      ? [
          {
            icon: Home,
            label: "Go to Dashboard",
            action: () => router.push("/dashboard"),
          },
        ]
      : []),

    ...(pathname !== "/dashboard/settings" && user
      ? [
          {
            icon: Settings,
            label: "Settings",
            action: () => router.push("/dashboard/settings"),
          },
        ]
      : []),

    ...(pathname !== "/dashboard/settings" && user
      ? [
          {
            icon: UserCircle,
            label: "My Profile",
            action: () => router.push("/dashboard/settings"),
            divider: true,
          },
        ]
      : []),

    // Utility actions
    {
      icon: Keyboard,
      label: "Keyboard Shortcuts",
      action: openKeyboardShortcuts,
    },
    {
      icon: HelpCircle,
      label: "Help & Support",
      action: () => window.open("https://callu.app/help", "_blank"),
    },
    {
      icon: AlertCircle,
      label: "Report an Issue",
      action: reportIssue,
    },
    {
      icon: Info,
      label: "About CALLU",
      action: showAbout,
      divider: true,
    },

    // Auth action
    ...(user
      ? [
          {
            icon: LogOut,
            label: "Log Out",
            action: () => {
              logout();
              router.push("/");
            },
            danger: true,
          },
        ]
      : []),
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          className="fixed z-[9999] w-60 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-2xl overflow-hidden font-dm"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
        >
          {/* Menu Items */}
          <div className="py-1">
            {menuItems.map((item, index) => (
              <div key={index}>
                <button
                  onClick={() => handleAction(item.action)}
                  className={`w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors text-left ${
                    item.danger
                      ? "text-red-400 hover:bg-red-500/10"
                      : "text-zinc-300 hover:bg-zinc-800/50"
                  }`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
                {item.divider && (
                  <div className="my-1 mx-2 h-px bg-zinc-800/50" />
                )}
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div className="px-3 py-1.5 border-t border-zinc-800/50 bg-zinc-950/50">
            <p className="text-[10px] text-zinc-500 text-center">
              Press <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400 font-mono">ESC</kbd> to close
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
