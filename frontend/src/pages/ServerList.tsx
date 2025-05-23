import { useEffect, useState } from "react";

interface Server {
    id: number;
    name: string;
    country: string;
    ip_address: string;
    is_active: boolean;
}

export default function ServerList() {
    const [servers, setServers] = useState<Server[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [connectedServerId, setConnectedServerId] = useState<number | null>(null);

    useEffect(() => {
        fetch('http://localhost:8000/servers', {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('access_token')}`,
            },
        })
        .then((res) => {
            if (!res.ok) {
                throw new Error('Failed to fetch servers');
            }
            return res.json();
        })
        .then((data) => {
            setServers(data);
            setLoading(false);
        })
        .catch((err) => {
            setError(err.message);
            setLoading(false);
        });
    }, []);

    const handleConnect = async (server: Server) => {
        const token = localStorage.getItem('access_token');
        const userId = localStorage.getItem('user_id');

        if (!token || !userId) {
            alert('You need to log in first.');
            return;
        }

        try {
            const response = await fetch('http://localhost:8000/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    user_id: parseInt(userId),
                    server_id: server.id,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to connect to server');
            }

            const result = await response.json();
            setConnectedServerId(server.id);
            localStorage.setItem('connected_server', JSON.stringify(server));
        } catch (err: any) {
            alert(err.message || 'An error occurred while connecting to the server.');
        }
    };

    if (loading) return <div className="p-4 text-gray-600">Loading servers...</div>;
    if (error) return <div className="p-4 text-red-600">Error: {error}</div>;
    return (
        <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Available VPN Servers</h1>

        {connectedServerId && (
            <div className="mb-4 p-4 bg-green-100 border border-green-300 rounded text-green-800 text-sm">
            Connected to: <strong>{servers.find(s => s.id === connectedServerId)?.name}</strong>
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
                <td className="px-4 py-2 border capitalize">{server.is_active ? 'Active' : 'Inactive'}</td>
                <td className="px-4 py-2 border">
                    <button
                    className={`px-3 py-1 text-sm rounded ${
                        connectedServerId === server.id
                        ? 'bg-green-500 text-white cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                    onClick={() => handleConnect(server)}
                    disabled={connectedServerId === server.id}
                    >
                    {connectedServerId === server.id ? 'Connected' : 'Connect'}
                    </button>
                </td>
                </tr>
            ))}
            </tbody>
        </table>
        </div>
    );
}