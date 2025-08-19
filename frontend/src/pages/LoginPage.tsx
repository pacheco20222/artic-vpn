import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [twofaCode, setTwofaCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setLoading(true);
      // IMPORTANT: backend login lives under /users/login
      const response = await api.post("/users/login", {
        username,
        password,
        // if user has 2FA enabled, the backend expects this field
        twofa_code: twofaCode || undefined,
      });

      const { access_token, user_id } = response.data || {};
      if (!access_token) throw new Error("No token returned by server");

      localStorage.setItem("access_token", access_token);
      if (user_id !== undefined) localStorage.setItem("user_id", String(user_id));

      // Set default auth header for subsequent requests
      api.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;

      navigate("/dashboard");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Login failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5FAFD] flex flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <img
          alt="Artic VPN"
          src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=blue&shade=500"
          className="mx-auto h-10 w-auto"
        />
        <h2 className="mt-10 text-center text-2xl font-bold text-blue-900">
          Login to your Artic VPN account
        </h2>
        <p className="text-center text-sm text-gray-500">Secure. Simple. Arctic cool.</p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        {error && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-blue-900">
              Username
            </label>
            <input
              id="username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-blue-900">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label htmlFor="twofa" className="block text-sm font-medium text-blue-900">
              2FA Code (if enabled)
            </label>
            <input
              id="twofa"
              name="twofa"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={twofaCode}
              onChange={(e) => setTwofaCode(e.target.value)}
              placeholder="123456"
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center rounded-md bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don’t have an account?{" "}
          <Link to="/signup" className="font-semibold text-blue-900 hover:text-blue-800">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
