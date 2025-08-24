import axios, { AxiosHeaders, type AxiosRequestHeaders } from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

// Attach token from localStorage on each request if header missing
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (!token) return config;

  // If headers is AxiosHeaders (Axios v1), prefer .set()
  const maybeHeaders = config.headers as unknown as AxiosHeaders | undefined;
  if (maybeHeaders && typeof maybeHeaders.set === "function") {
    if (!maybeHeaders.has("Authorization")) {
      maybeHeaders.set("Authorization", `Bearer ${token}`);
    }
    return config;
  }

  // Otherwise treat as a plain object and cast to AxiosRequestHeaders
  const hdrs = (config.headers ?? {}) as AxiosRequestHeaders;
  if (!("Authorization" in hdrs)) {
    (hdrs as any).Authorization = `Bearer ${token}`;
  }
  config.headers = hdrs;
  return config;
});

// Global 401 handler
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_id");
      // Force login
      window.location.href = "/";
    }
    return Promise.reject(err);
  }
);

export default api;