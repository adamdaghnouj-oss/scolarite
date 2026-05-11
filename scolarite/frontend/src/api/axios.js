import axios from "axios";

// Use VITE_API_URL if set (e.g. for XAMPP: http://localhost/PFE%20Project/scolarite/public/api)
// Otherwise use /api (works with Vite proxy when Laravel runs on port 8000)
const baseURL = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (!window.location.hash.includes("/login")) {
        window.location.hash = "#/login";
      }
    }
    return Promise.reject(error);
  }
);

export async function ensureCsrfCookie() {
  // For Sanctum SPA auth: sets XSRF-TOKEN cookie.
  // Must be called before state-changing requests (login, otp verify, logout, etc).
  await api.get("/sanctum/csrf-cookie", { baseURL: "/" });
}
