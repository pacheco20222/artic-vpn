import { useConnection } from "../context/ConnectionContext";
import { useEffect, useState } from "react";

interface Connection {
  id: number;
  user_id: number;
  server_id: number;
  server_name: string;
  country: string;
  connected_at: string;
  disconnected_at: string | null;
}

export default function MyConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [tableLoading, setTableLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Use env-based API URL (fallback to localhost:8000)
  const API_BASE: string = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

  const { disconnect, refresh, loading } = useConnection();

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    const fetchConnections = async () => {
      try {
        const res = await fetch(`${API_BASE}/users/my-connections`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error("Failed to fetch connections.");
        const data = await res.json();
        setConnections(data.connections || []);
      } catch (err: any) {
        setError(err.message || "Error fetching connections.");
      } finally {
        setTableLoading(false);
      }
    };

    fetchConnections();
  }, [API_BASE]);

  const handleDisconnect = async () => {
    try {
      await disconnect(); // uses JWT from axios interceptor
      await refresh();    // refresh global connection state
      // Also refresh this page table so the latest row shows a disconnected_at
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/users/my-connections`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections || []);
      }
    } catch (err: any) {
      alert(err?.response?.data?.detail || err?.message || "An error occurred while disconnecting.");
    }
  };

  if (tableLoading) return <div className="p-6 text-gray-600">Loading connections...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">My Connections</h1>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {connections.length === 0 ? (
        <p className="text-gray-500">No VPN connections yet.</p>
      ) : (
        <table className="w-full table-auto border border-gray-300 text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 border">Server</th>
              <th className="px-4 py-2 border">Country</th>
              <th className="px-4 py-2 border">Connected At</th>
              <th className="px-4 py-2 border">Disconnected At</th>
              <th className="px-4 py-2 border">Action</th>
            </tr>
          </thead>
          <tbody>
            {connections.map((conn) => (
              <tr key={conn.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 border">{conn.server_name}</td>
                <td className="px-4 py-2 border">{conn.country}</td>
                <td className="px-4 py-2 border">{new Date(conn.connected_at).toLocaleString()}</td>
                <td className="px-4 py-2 border">
                  {conn.disconnected_at
                    ? new Date(conn.disconnected_at).toLocaleString()
                    : "Active"}
                </td>
                <td className="px-4 py-2 border">
                  {!conn.disconnected_at && (
                    <button
                      onClick={handleDisconnect}
                      className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
                      disabled={loading}
                    >
                      Disconnect
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
