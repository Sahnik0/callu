"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface User {
  _id: string;
  name: string;
  email: string;
  mobile: string;
  status: 'pending' | 'approved' | 'rejected';
  role: 'user' | 'admin';
  avatarConfig: {
    image?: string;
    color: string;
  };
}

interface AuthContextType {
  user: User | null;
  login: (emailOrId: string, password?: string, isAdmin?: boolean) => Promise<boolean>;
  requestLoginCode: (email: string) => Promise<boolean>;
  verifyLoginCode: (email: string, code: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  updateUser: (userData: User) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => false,
  requestLoginCode: async () => false,
  verifyLoginCode: async () => false,
  logout: () => {},
  isLoading: true,
  updateUser: () => {},
});

const SESSION_KEY = "callu_session";
const USER_KEY = "callu_user";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      try {
        const storedSession = localStorage.getItem(SESSION_KEY);
        if (storedSession) {
          try {
            const parsed = JSON.parse(storedSession) as { token: string; expiresAt: string };
            
            // Check if session is still valid (not expired)
            if (parsed?.token && parsed?.expiresAt) {
              const expiryTime = new Date(parsed.expiresAt).getTime();
              const now = Date.now();
              
              if (expiryTime > now) {
                console.log("[Auth] Session found, validating with server...");
                try {
                  const res = await fetch("/api/auth/session", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: parsed.token }),
                  });
                  
                  if (res.ok) {
                    const data = await res.json();
                    console.log("[Auth] ✓ Session validated, user:", data.user?.email);
                    setUser(data.user);
                    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
                    setIsLoading(false);
                    return;
                  } else {
                    console.warn("[Auth] Session validation failed:", res.status);
                    // Session invalid or expired, clear it
                    localStorage.removeItem(SESSION_KEY);
                  }
                } catch (error) {
                  console.error("[Auth] Session validation error:", error);
                }
              } else {
                console.warn("[Auth] Stored session expired, clearing...");
                localStorage.removeItem(SESSION_KEY);
              }
            }
          } catch (parseError) {
            console.error("[Auth] Failed to parse stored session:", parseError);
            localStorage.removeItem(SESSION_KEY);
          }
        }

        // Fallback: check if user is in localStorage (from previous login)
        const storedUser = localStorage.getItem(USER_KEY);
        if (storedUser) {
          try {
            const user = JSON.parse(storedUser);
            console.log("[Auth] Using stored user from cache:", user.email);
            setUser(user);
          } catch (parseError) {
            console.error("[Auth] Failed to parse stored user:", parseError);
            localStorage.removeItem(USER_KEY);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    void init();
  }, []);

  const login = async (emailOrId: string, password?: string, isAdmin?: boolean) => {
    try {
      const body = isAdmin 
        ? { adminId: emailOrId, password }
        : { email: emailOrId };

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        return true;
      } else {
        const error = await res.json();
        toast.error(error.message);
        return false;
      }
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const requestLoginCode = async (email: string) => {
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const error = await res.json();
        toast.error(error.message || "Failed to send code");
        return false;
      }
      return true;
    } catch (e) {
      console.error(e);
      toast.error("Failed to send code");
      return false;
    }
  };

  const verifyLoginCode = async (email: string, code: string) => {
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.message || "Verification failed");
        return false;
      }

      const data = await res.json();
      setUser(data.user);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      if (data.sessionToken && data.expiresAt) {
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ token: data.sessionToken, expiresAt: data.expiresAt })
        );
      }
      return true;
    } catch (e) {
      console.error(e);
      toast.error("Verification failed");
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SESSION_KEY);
    router.push("/");
  };

  const updateUser = (userData: User) => {
    setUser(userData);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ user, login, requestLoginCode, verifyLoginCode, logout, isLoading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
