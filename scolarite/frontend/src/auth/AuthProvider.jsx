import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ensureCsrfCookie } from "../api/axios";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const res = await api.get("/user");
      setUser(res.data || null);
      return res.data || null;
    } catch (e) {
      if (e?.response?.status === 401) {
        setUser(null);
        return null;
      }
      throw e;
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const u = await refreshMe();
        if (!active) return;
        setUser(u);
      } catch {
        if (!active) return;
        setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshMe]);

  const login = useCallback(async ({ email, password }) => {
    await ensureCsrfCookie();
    const res = await api.post("/login", { email, password });
    if (res?.data?.user) {
      setUser(res.data.user);
      return { status: "logged_in", user: res.data.user };
    }
    await refreshMe();
    return { status: "logged_in" };
  }, [refreshMe]);

  const verifyOtp = useCallback(async ({ email, code }) => {
    await ensureCsrfCookie();
    const res = await api.post("/verify-otp", { email, code });
    const u = await refreshMe();
    return { user: u || res.data?.user || null };
  }, [refreshMe]);

  const logout = useCallback(async () => {
    try {
      await ensureCsrfCookie();
      await api.post("/logout");
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => {
    const role = user?.role ?? null;
    return {
      user,
      role,
      loading,
      isAuthed: !!user,
      refreshMe,
      login,
      verifyOtp,
      logout,
    };
  }, [user, loading, refreshMe, login, verifyOtp, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

