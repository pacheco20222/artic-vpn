import { useEffect, useState } from "react";
import WGConfigModal from "../components/WGConfigModal";
import { useConnection } from "../context/ConnectionContext";

interface Server {
  id: number;
  name: string;
  country: string;
  ip_address: string;
  is_active: boolean;
}

interface WGConfigResponse {
  config_text: string;
  qr_code_data_url: string; // may be empty if backend lacks qrcode[pil]
  allocated_ip: string;
}

export default function ServerList() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { connection, connect, disconnect } = useConnection();

  // WireGuard modal state
  const [wgConfig, setWgConfig] = useState<WGConfigResponse | null>(null);
  const [wgServerId, setWgServerId] = useState<number | null>(null);
  const [wgOpen, setWgOpen] = useState(false);
  const [wgLoading, setWgLoading] = useState(false);
  const [wgError, setWgError] = useState<string | null>(null);

  // Use Vite env for API base (fallback to localhost:8000)
  const API_BASE: string = (import.meta as any).env?.VITE_API_URL || "http://localhost:8000";

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const res = await fetch(`${API_BASE}/servers`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        });
        if (!res.ok) throw new Error("Failed to fetch servers");
        const data: Server[] = await res.json();
        setServers(data);
      } catch (err: any) {
        setError(err.message || "Could not load servers");
      } finally {
        setLoading(false);
      }
    };

    fetchServers();
  }, [API_BASE]);

  const handleConnect = async (server: Server) => {
    const token = localStorage.getItem("access_token");
    const userId = localStorage.getItem("user_id");

    if (!token || !userId) {
      alert("You need to log in first.");
      return;
    }

    try {
      await connect(server.id);
      window.dispatchEvent(new CustomEvent('connection-changed', { detail: { connected: true, serverId: server.id } }));
    } catch (err: any) {
      alert(err.message || "An error occurred while connecting to the server.");
    }
  };

  const handleDisconnect = async () => {
    const token = localStorage.getItem("access_token");
    const userId = localStorage.getItem("user_id");
    if (!token || !userId) {
      alert("You need to log in first.");
      return;
    }
    try {
      await disconnect();
      window.dispatchEvent(new CustomEvent('connection-changed', { detail: { connected: false, serverId: null } }));
    } catch (err: any) {
      alert(err.message || "An error occurred while disconnecting from the server.");
    }
  };

  const handleGetConfig = async (server: Server) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      alert("You need to log in first.");
      return;
    }

    try {
      setWgError(null);
      setWgLoading(true);
      setWgServerId(server.id);

      const res = await fetch(`${API_BASE}/servers/${server.id}/wireguard/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const maybeJson = await res.json().catch(() => ({} as any));
        const msg = (maybeJson && (maybeJson.detail || maybeJson.message)) || `Request failed (${res.status})`;
        throw new Error(msg);
      }

      const data: WGConfigResponse = await res.json();
      setWgConfig(data);
      setWgOpen(true);
    } catch (err: any) {
      console.error("get-config error:", err);
      setWgError(err.message || "Failed to generate WireGuard config.");
    } finally {
      setWgLoading(false);
    }
  };

  if (loading) return <div className="p-4 text-gray-600">Loading servers...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Available VPN Servers</h1>

      {connection && connection.server_id && (
        <div className="mb-4 p-4 bg-green-100 border border-green-300 rounded text-green-800 text-sm">
          Connected to: <strong>{servers.find((s) => s.id === connection.server_id)?.name || `#${connection.server_id}`}</strong>
        </div>
      )}

      <table className="w-full table-auto border border-gray-300 text-sm text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 border">Name</th>
            <th className="px-4 py-2 border">IP</th>
            <th className="px-4 py-2 border">Country</th>
            <th className="px-4 py-2 border">Status</th>
            <th className="px-4 py-2 border">Action</th>
          </tr>
        </thead>
        <tbody>
          {servers.map((server) => (
            <tr key={server.id} className="hover:bg-gray-50">
              <td className="px-4 py-2 border">{server.name}</td>
              <td className="px-4 py-2 border">{server.ip_address}</td>
              <td className="px-4 py-2 border">{server.country}</td>
              <td className="px-4 py-2 border">
                <span
                  className={`px-2 py-1 text-xs rounded font-medium ${
                    server.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {server.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-4 py-2 border">
                {connection?.server_id === server.id ? (
                  <button
                    className="px-3 py-1 text-sm rounded bg-red-600 hover:bg-red-700 text-white"
                    onClick={handleDisconnect}
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    className={
                      "px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700" +
                      (connection && connection.server_id !== server.id ? " bg-gray-300 text-gray-600 cursor-not-allowed" : "")
                    }
                    onClick={() => handleConnect(server)}
                    disabled={!!connection && connection.server_id !== server.id}
                  >
                    Connect
                  </button>
                )}
                <button
                  className="ml-2 px-3 py-1 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  onClick={() => handleGetConfig(server)}
                  disabled={!server.is_active}
                >
                  Get Config
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <WGConfigModal
        open={wgOpen}
        onClose={() => setWgOpen(false)}
        config={wgConfig}
        serverId={wgServerId}
        loading={wgLoading}
        error={wgError}
      />
    </div>
  );
}