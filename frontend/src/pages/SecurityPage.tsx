import { useEffect, useState } from "react";
import api from "../api/axios";

// ---- Types that reflect our backend responses ----
type TwoFAStatus = {
  enabled: boolean;
  rotated_at?: string | null;
};

type RecoveryCodesResp = {
  recovery_codes: string[];
};

type RotateResp = {
  message: string;
  qr_data_url: string; // data:image/png;base64,...
  qr_code_base64: string; // (not used directly, but available)
  secret: string; // for manual entry
};

export default function SecurityPage() {
  const [status, setStatus] = useState<TwoFAStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Recovery codes
  const [codes, setCodes] = useState<string[] | null>(null);
  const [codesGenerating, setCodesGenerating] = useState<boolean>(false);

  // Rotation flow
  const [rotateData, setRotateData] = useState<RotateResp | null>(null);
  const [verifyCode, setVerifyCode] = useState<string>("");
  const [verifying, setVerifying] = useState<boolean>(false);

  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");

  // ---- Helpers ----
  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get<TwoFAStatus>("/security/2fa/status");
      setStatus(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to load 2FA status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerateCodes = async () => {
    try {
      setCodesGenerating(true);
      setError("");
      setInfo("");
      const res = await api.post<RecoveryCodesResp>("/security/2fa/recovery-codes");
      setCodes(res.data.recovery_codes);
      setInfo("✅ Recovery codes generated. Save these somewhere safe. You will not see them again.");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to generate recovery codes.");
    } finally {
      setCodesGenerating(false);
    }
  };

  const handleRotate = async () => {
    try {
      setError("");
      setInfo("");
      const res = await api.post<RotateResp>("/security/2fa/rotate");
      setRotateData(res.data);
      setInfo("Scan the new QR and then enter the 6‑digit code to confirm.");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to rotate 2FA secret.");
    }
  };

  const handleVerifyRotated = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setVerifying(true);
      setError("");
      setInfo("");
      await api.post("/security/2fa/verify", { code: verifyCode });
      setVerifyCode("");
      setInfo("✅ 2FA rotation verified.");
      setRotateData(null);
      fetchStatus();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Invalid code. Try again.");
    } finally {
      setVerifying(false);
    }
  };

  const copyCodes = async () => {
    if (!codes) return;
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setInfo("Copied recovery codes to clipboard.");
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  const downloadCodes = () => {
    if (!codes) return;
    const blob = new Blob([codes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "articvpn-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Security</h1>

      {/* Status Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Two‑Factor Authentication</h2>
        {loading ? (
          <p className="text-gray-600 mt-2">Loading status…</p>
        ) : status ? (
          <div className="mt-2 text-sm text-gray-700 space-y-1">
            <p>
              Status: {" "}
              <span className={status.enabled ? "text-emerald-600" : "text-red-600"}>
                {status.enabled ? "Enabled" : "Disabled"}
              </span>
            </p>
            {status.rotated_at && (
              <p>Last rotated: {new Date(status.rotated_at).toLocaleString()}</p>
            )}
          </div>
        ) : (
          <p className="text-gray-600 mt-2">Status unavailable.</p>
        )}
      </div>

      {/* Recovery Codes */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm mb-6">
        <h3 className="text-md font-semibold text-gray-800">Recovery Codes</h3>
        <p className="text-gray-600 text-sm mt-1">
          Use these one‑time codes if you lose access to your authenticator. You can generate a new set at any time; doing so invalidates any old unused codes.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleGenerateCodes}
            disabled={codesGenerating}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {codesGenerating ? "Generating…" : "Generate recovery codes"}
          </button>
          {codes && (
            <>
              <button
                onClick={copyCodes}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Copy
              </button>
              <button
                onClick={downloadCodes}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Download .txt
              </button>
            </>
          )}
        </div>
        {codes && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {codes.map((c) => (
              <code key={c} className="rounded bg-gray-100 px-2 py-1 text-gray-800 text-sm">
                {c}
              </code>
            ))}
          </div>
        )}
      </div>

      {/* Rotate 2FA */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-md font-semibold text-gray-800">Rotate 2FA Secret</h3>
        <p className="text-gray-600 text-sm mt-1">
          Rotating your 2FA secret will require you to scan a new QR and verify a new code. Your existing recovery codes are invalidated so you can generate fresh ones.
        </p>
        {!rotateData ? (
          <button
            onClick={handleRotate}
            className="mt-4 inline-flex items-center rounded-md bg-amber-600 px-4 py-2 text-white hover:bg-amber-500"
          >
            Rotate 2FA Secret
          </button>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-gray-700 mb-2">Scan this QR in your authenticator:</p>
              <img src={rotateData.qr_data_url} alt="2FA QR" className="rounded-md border border-gray-200 p-2 bg-white" />
            </div>
            <div className="text-sm">
              <p className="text-gray-600">Or enter this code manually:</p>
              <code className="mt-1 block rounded bg-gray-100 px-2 py-1 text-gray-800">
                {rotateData.secret}
              </code>
            </div>
            <form onSubmit={handleVerifyRotated} className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                6‑digit code
                <input
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  className="mt-1 block w-40 rounded-md border border-gray-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </label>
              <button
                type="submit"
                disabled={verifying}
                className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {verifying ? "Verifying…" : "Verify & Enable"}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Messages */}
      {(error || info) && (
        <div className="mt-6">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-emerald-700">{info}</p>}
        </div>
      )}
    </div>
  );
}
