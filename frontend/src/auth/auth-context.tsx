import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";

import { api, TOKEN_KEY } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

export type Role = "worker" | "business";

export type User = {
  id: string;
  email: string;
  role: Role;
  name: string;
  onboarded: boolean;
  verified: boolean;
  blocked: boolean;
  photo_url?: string | null;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  register: (email: string, password: string, role: Role, name: string) => Promise<User>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    (async () => {
      const token = await storage.secureGet<string>(TOKEN_KEY, "");
      if (token) {
        try {
          const me = await api.get("/auth/me");
          setUserState(me);
        } catch {
          await storage.secureRemove(TOKEN_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

  async function persist(token: string, u: User) {
    await storage.secureSet(TOKEN_KEY, token);
    setUserState(u);
  }

  const register: AuthState["register"] = async (email, password, role, name) => {
    const res = await api.post("/auth/register", { email, password, role, name });
    await persist(res.access_token, res.user);
    return res.user;
  };

  const login: AuthState["login"] = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    await persist(res.access_token, res.user);
    return res.user;
  };

  const logout = async () => {
    await storage.secureRemove(TOKEN_KEY);
    setUserState(null);
    queryClient.clear();
  };

  const refresh = async () => {
    try {
      const me = await api.get("/auth/me");
      setUserState(me);
    } catch {
      /* ignore */
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, register, login, logout, refresh, setUser: setUserState }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Route the user to the right place based on auth + onboarding state.
export function useAuthRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/welcome");
    } else if (!user.onboarded) {
      router.replace(user.role === "worker" ? "/onboarding/worker" : "/onboarding/business");
    } else {
      router.replace(user.role === "worker" ? "/(worker)" : "/(business)");
    }
  }, [user, loading]);
}
