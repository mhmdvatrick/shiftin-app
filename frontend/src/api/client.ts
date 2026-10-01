// Thin fetch wrapper. Reads the auth token from secure storage and attaches it.
import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const TOKEN_KEY = "shiftin_token";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getToken(): Promise<string> {
  return (await storage.secureGet<string>(TOKEN_KEY, "")) ?? "";
}

async function parse(res: Response): Promise<any> {
  const text = await res.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { detail: text };
  }
  if (!res.ok) {
    const detail =
      typeof body?.detail === "string"
        ? body.detail
        : Array.isArray(body?.detail)
          ? body.detail.map((d: any) => d.msg).join(", ")
          : `HTTP ${res.status}`;
    throw new ApiError(detail, res.status);
  }
  return body;
}

export const api = {
  async get(path: string) {
    const res = await fetch(`${BASE}/api${path}`, {
      headers: { ...(await authHeader()) },
    });
    return parse(res);
  },
  async post(path: string, data?: any) {
    const res = await fetch(`${BASE}/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: data != null ? JSON.stringify(data) : undefined,
    });
    return parse(res);
  },
  async put(path: string, data?: any) {
    const res = await fetch(`${BASE}/api${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: data != null ? JSON.stringify(data) : undefined,
    });
    return parse(res);
  },
  async del(path: string) {
    const res = await fetch(`${BASE}/api${path}`, {
      method: "DELETE",
      headers: { ...(await authHeader()) },
    });
    return parse(res);
  },
  // Multipart upload (branches per runtime, never set Content-Type manually).
  async upload(uri: string, kind: string): Promise<{ path: string; url: string }> {
    const name = uri.split("/").pop() || `photo_${Date.now()}.jpg`;
    const ext = (name.split(".").pop() || "jpg").toLowerCase();
    const type = ext === "png" ? "image/png" : "image/jpeg";
    const form = new FormData();
    if (Platform.OS === "web") {
      const blob = await (await fetch(uri)).blob();
      form.append("file", blob, name);
    } else {
      form.append("file", { uri, name, type } as any);
    }
    form.append("kind", kind);
    const res = await fetch(`${BASE}/api/upload`, {
      method: "POST",
      headers: { ...(await authHeader()) },
      body: form,
    });
    return parse(res);
  },
};

// Build an auth-aware URL for displaying stored images (token in query for <img>).
export async function fileUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const token = await getToken();
  return `${BASE}/api/files/${path}?token=${token}`;
}
