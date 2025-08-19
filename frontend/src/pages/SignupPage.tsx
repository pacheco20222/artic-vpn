import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";

/**
 * Signup + 2FA enrollment flow
 * 1) User fills username/email/password and registers (POST /users/signup)
 * 2) Auto-login to get JWT (POST /users/login) so we can enroll 2FA for the user
 * 3) Call 2FA setup (POST /security/2fa/setup) → returns QR data URL + secret
 * 4) Show QR + secret; user enters 6‑digit code; verify (POST /security/2fa/verify)
 */
export default function SignupPage() {
  // --- form state ---
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // --- ui state ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- 2FA enrollment state ---
  const [phase, setPhase] = useState<"form" | "2fa">("form");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [totpSecret, setTotpSecret] = useState<string>("");
  const [totpCode, setTotpCode] = useState<string>("");

  const navigate = useNavigate();

  // helper to save token + set auth header for api
  const applyAuthToken = (token: string, userId?: number) => {
    localStorage.setItem("access_token", token);
    if (userId !== undefined) localStorage.setItem("user_id", String(userId));
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    try {
      setLoading(true);

      // 1) Create account
      const reg = await api.post("/users/signup", { username, email, password });
      if (!(reg.status === 200 || reg.status === 201)) {
        throw new Error("Unexpected response during registration.");
      }

      // 2) Auto-login to obtain token (needed for protected 2FA setup)
      const login = await api.post("/users/login", { username, password });
      const token: string = login.data?.access_token;
      const userId: number | undefined = login.data?.user_id;
      if (!token) throw new Error("Login failed after registration.");
      applyAuthToken(token, userId);

      // 3) Call backend to generate TOTP secret + QR for this user
      //    Your route may be "/security/2fa/setup" or similar; adjust if needed.
      const setup = await api.post("/security/2fa/setup");
      // Expecting: { qr_data_url: string, secret: string } (adjust to your backend shape)
      const qr = setup.data?.qr_data_url || setup.data?.qr || setup.data?.qrCode;
      const secret = setup.data?.secret || setup.data?.secret_key || setup.data?.totp_secret;
      if (!qr || !secret) throw new Error("2FA setup did not return QR/secret.");

      setQrDataUrl(qr);
      setTotpSecret(secret);
      setPhase("2fa");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Sign up failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!totpCode.trim()) {
      setError("Enter the 6‑digit code from your authenticator app.");
      return;
    }

    try {
      setLoading(true);
      // 4) Verify code with backend
      const verify = await api.post("/security/2fa/verify", { code: totpCode });
      if (!(verify.status === 200 || verify.status === 204)) {
        throw new Error("Invalid verification response.");
      }

      alert("2FA enabled! You're all set.");
      navigate("/dashboard");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Invalid code.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (phase === "2fa") {
    return (
      <div className="min-h-screen bg-[#F5FAFD] flex flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <img
            alt="Artic VPN"
            src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=blue&shade=500"
            className="mx-auto h-10 w-auto"
          />
          <h2 className="mt-10 text-center text-2xl font-bold text-blue-900">Enable 2FA</h2>
          <p className="text-center text-sm text-gray-500">
            Scan the QR code with Google Authenticator, 1Password, or Authy. Then enter the 6‑digit code.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
          {error && (
            <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
            {/* QR code image from backend (data URL) */}
            {qrDataUrl && (
              <img src={qrDataUrl} alt="2FA QR" className="w-48 h-48 mb-3" />
            )}
            <div className="text-xs text-gray-600 break-all mb-2">
              Secret: <span className="font-mono">{totpSecret}</span>
            </div>
            <div className="text-xs text-gray-500 mb-4">(You can also enter the secret manually.)</div>

            <form onSubmit={handleVerify2FA} className="w-full space-y-4">
              <div>
                <label htmlFor="totp" className="block text-sm font-medium text-blue-900">
                  6‑digit code
                </label>
                <input
                  id="totp"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center rounded-md bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
              >
                {loading ? "Verifying..." : "Verify & Finish"}
              </button>
            </form>

            <button
              onClick={() => navigate("/")}
              className="mt-3 text-sm text-blue-900 hover:text-blue-800"
            >
              I'll do this later
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- default: registration form phase ---
  return (
    <div className="min-h-screen bg-[#F5FAFD] flex flex-col justify-center px-6 py-12 lg:px-8">
      {/* Header / Branding */}
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <img
          alt="Artic VPN"
          src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=blue&shade=500"
          className="mx-auto h-10 w-auto"
        />
        <h2 className="mt-10 text-center text-2xl font-bold text-blue-900">Create your Artic VPN account</h2>
        <p className="text-center text-sm text-gray-500">Secure. Simple. Arctic cool.</p>
      </div>

      {/* Form Card */}
      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        {error && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-blue-900">Username</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-blue-900">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-blue-900">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center rounded-md bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
          >
            {loading ? "Creating..." : "Sign up"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link to="/" className="font-semibold text-blue-900 hover:text-blue-800">Log in</Link>
        </p>
      </div>
    </div>
  );
}