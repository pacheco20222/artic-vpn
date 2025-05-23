import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [twofaCode, setTwofaCode] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post("/login", {
        username,
        password,
        twofa_code: twofaCode,
      });
      const { access_token } = response.data;
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("user_id", response.data.user_id);
      alert("Login successful!");
      navigate("/dashboard");
    } catch (error: any) {
      alert("Login failed: " + (error.response?.data?.detail || "Unknown error"));
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
        <p className="text-center text-sm text-gray-500">
          Secure. Simple. Arctic cool.
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
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
            <label htmlFor="2fa" className="block text-sm font-medium text-blue-900">
              2FA Code (if enabled)
            </label>
            <input
              id="2fa"
              name="2fa"
              value={twofaCode}
              onChange={(e) => setTwofaCode(e.target.value)}
              placeholder="123456"
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <button
              type="submit"
              className="w-full flex justify-center rounded-md bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Login
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don’t have an account?{" "}
          <a href="#" className="font-semibold text-blue-900 hover:text-blue-800">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
