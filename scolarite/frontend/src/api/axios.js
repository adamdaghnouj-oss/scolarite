import axios from "axios";

// Use VITE_API_URL if set (e.g. for XAMPP: http://localhost/PFE%20Project/scolarite/public/api)
// Otherwise use /api (works with Vite proxy when Laravel runs on port 8000)
const baseURL = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});