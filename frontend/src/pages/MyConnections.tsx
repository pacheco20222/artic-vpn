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
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    fetch("http://localhost:8000/my-connections", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch connections.");
        return res.json();
      })
      .then((data) => {
        setConnections(data.connections); 
      })
      .catch((err) => {
        setError(err.message || "Error fetching connections.");
      });
  }, []);

  const handleDisconnect = async () => {
    const token = localStorage.getItem("access_token");
    const userId = localStorage.getItem("user_id");

    try {
      const res = await fetch("http://localhost:8000/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: parseInt(userId!) }),
      });

      if (!res.ok) throw new Error("Failed to disconnect.");

      // Refresh list
      const updated = await res.json();
      setConnections((prev) =>
        prev.map((conn) =>
          conn.id === updated.connection_id
            ? { ...conn, disconnected_at: updated.disconnected_at }
            : conn
        )
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

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
            </tr>
          </thead>
          <tbody>
            {connections.map((conn) => (
              <tr key={conn.id}>
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
