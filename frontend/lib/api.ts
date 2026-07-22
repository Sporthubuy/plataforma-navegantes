import axios from 'axios';

export const TOKEN_KEY = 'navegantes_token';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
});

// Adjunta el Bearer token automáticamente si existe.
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { error?: string } | undefined)?.error;
    if (message) return message;
  }
  return fallback;
}

/** Nombre del evento que pide recalcular el contador de la campana. */
export const BADGE_REFRESH_EVENT = 'navegantes:badges';

/** Avisa que algo cambió el contador (leer un hilo, responder…). */
export function refreshBadges() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(BADGE_REFRESH_EVENT));
  }
}
