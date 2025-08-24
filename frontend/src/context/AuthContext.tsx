import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";

type AuthUser = {
  userId: number;
  username: string;
  role?: string;
  twofaEnabled?: boolean;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  setUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Bootstraps auth state on page refresh
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }

    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    // Fetch profile to hydrate user info
    (async () => {
      try {
        const prof = await api.get("/users/profile");
        // Your /users/profile returns { message, user: { user_id, username, role, ... } }
        const u = prof.data?.user;
        const me: AuthUser = {
          userId: u?.user_id,
          username: u?.sub || u?.username || "me",
          role: u?.role,
        };

        // Also ask 2FA status (optional, but nice)
        try {
          const s = await api.get("/security/2fa/status");
          me.twofaEnabled = !!s.data?.enabled;
        } catch {
          /* optional */
        }

        setUser(me);
      } catch {
        // token invalid/expired → clear
        delete api.defaults.headers.common["Authorization"];
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_id");
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const logout = () => {
    delete api.defaults.headers.common["Authorization"];
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_id");
    setUser(null);
    // hard redirect avoids any stale state
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};