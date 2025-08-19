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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Use env-based API URL (fallback to localhost:8000)
  const API_BASE: string = (import.meta as any).env?.VITE_API_URL || "http://localhost:8000";

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    const fetchConnections = async () => {
      try {
        const res = await fetch(`${API_BASE}/my-connections`, {
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
        setLoading(false);
      }
    };

    fetchConnections();
  }, [API_BASE]);

  const handleDisconnect = async () => {
    const token = localStorage.getItem("access_token");
    const userId = localStorage.getItem("user_id");

    if (!token || !userId) {
      alert("You must be logged in.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/disconnect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: parseInt(userId, 10) }),
      });

      if (!res.ok) throw new Error("Failed to disconnect.");

      const updated = await res.json();
      // Expecting backend to return { connection_id, disconnected_at }
      setConnections((prev) =>
        prev.map((conn) =>
          conn.id === updated.connection_id
            ? { ...conn, disconnected_at: updated.disconnected_at }
            : conn
        )
      );
      // Optional: also clear any local client flag
      localStorage.removeItem("connected_server");
    } catch (err: any) {
      alert(err.message || "An error occurred while disconnecting.");
    }
  };

  if (loading) return <div className="p-6 text-gray-600">Loading connections...</div>;

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
                      className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
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
