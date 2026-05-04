// Resolves the API server base URL.
// In production with separate frontend/API services (Railway), set
// VITE_API_BASE_URL to the API domain (e.g. "api.hiregood.one").
// In dev or single-service deployments the default "" uses relative URLs.
const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
const trimmed = raw.replace(/\/+$/, "");

export const API_BASE = trimmed
  ? trimmed.startsWith("http") ? trimmed : `https://${trimmed}`
  : "";
