// src/context/ConnectionContext.tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../api/axios";

export type ServerSummary = {
  id: number;
  name: string;
  country: string;
  ip_address: string;
};

export type ActiveConnection = {
  id: number;
  user_id: number;
  server_id: number;
  connected_at: string | null;
  disconnected_at: string | null;
  server?: ServerSummary;
} | null;

type Ctx = {
  connection: ActiveConnection;
  loading: boolean;
  refresh: () => Promise<void>;
  connect: (serverId: number) => Promise<void>;
  disconnect: () => Promise<void>;
};

const ConnectionContext = createContext<Ctx | undefined>(undefined);

export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connection, setConnection] = useState<ActiveConnection>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [connRes, serversRes] = await Promise.all([
        api.get("/users/me/connection"),
        api.get<ServerSummary[]>("/servers"),
      ]);

      const conn = (connRes.data ?? null) as Exclude<ActiveConnection, null> | null;

      if (conn && conn.server_id) {
        const servers = serversRes.data ?? [];
        const srv = servers.find((s) => s.id === conn.server_id);
        setConnection(srv ? { ...conn, server: srv } : conn);
      } else {
        setConnection(null);
      }
    } catch (err) {
      console.error("refresh() failed:", err);
      setConnection(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const connect = useCallback(
    async (serverId: number) => {
      const userId = localStorage.getItem("user_id");
      if (!userId) {
        alert("No user id in storage — please log in again.");
        return;
      }

      // Guard: already connected to this server
      if (connection && connection.server_id === serverId && !connection.disconnected_at) {
        return;
      }

      setLoading(true);
      try {
        await api.post("/users/connect", { user_id: Number(userId), server_id: serverId });
        await refresh();
      } catch (err: any) {
        console.error("connect() error:", err);
        const detail = err?.response?.data?.detail || err?.message || "Connect failed";
        alert(`Connect error: ${detail}`);
      } finally {
        setLoading(false);
      }
    },
    [connection, refresh]
  );

  const disconnect = useCallback(async () => {
    const userId = localStorage.getItem("user_id");
    if (!userId) {
      alert("No user id in storage — please log in again.");
      return;
    }

    // Guard: nothing to disconnect
    if (!connection || connection.disconnected_at) return;

    setLoading(true);
    try {
      await api.post("/users/disconnect", { user_id: Number(userId) });
      await refresh();
    } catch (err: any) {
      console.error("disconnect() error:", err);
      const detail = err?.response?.data?.detail || err?.message || "Disconnect failed";
      alert(`Disconnect error: ${detail}`);
    } finally {
      setLoading(false);
    }
  }, [connection, refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ConnectionContext.Provider value={{ connection, loading, refresh, connect, disconnect }}>
      {children}
    </ConnectionContext.Provider>
  );
};

export function useConnection() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error("useConnection must be used within ConnectionProvider");
  return ctx;
}