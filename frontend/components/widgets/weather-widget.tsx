'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wind, CloudSun } from 'lucide-react';
import { Widget, WidgetEmpty } from './widget-shell';

const CACHE_KEY = 'navegantes_weather';
const CACHE_MS = 30 * 60 * 1000; // 30 minutos

interface Weather {
  temp: number;
  windKmh: number;
  description: string;
  place: string;
}

interface Cached {
  at: number;
  location: string;
  data: Weather;
}

function readCache(location: string): Weather | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Cached;
    if (cached.location !== location) return null;
    if (Date.now() - cached.at > CACHE_MS) return null;
    return cached.data;
  } catch {
    return null;
  }
}

/**
 * Clima de la zona de navegación del usuario (`profiles.location`).
 *
 * Requiere `NEXT_PUBLIC_OPENWEATHER_API_KEY`. Sin key —o sin zona
 * cargada en el perfil— muestra el estado vacío y no hace ninguna
 * llamada externa. Cachea 30 min en localStorage.
 */
export function WeatherWidget({ location }: { location?: string | null }) {
  const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
  const [weather, setWeather] = useState<Weather | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!apiKey || !location) return;
    let cancelled = false;

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      location
    )}&units=metric&lang=es&appid=${apiKey}`;

    const cached = readCache(location);
    const pending: Promise<Weather> = cached
      ? Promise.resolve(cached)
      : fetch(url)
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error('sin datos'))))
          .then((json) => {
            const data: Weather = {
              temp: Math.round(json.main?.temp ?? 0),
              // OpenWeather devuelve m/s; el viento en náutica se lee en km/h.
              windKmh: Math.round((json.wind?.speed ?? 0) * 3.6),
              description: json.weather?.[0]?.description ?? '',
              place: json.name ?? location,
            };
            localStorage.setItem(
              CACHE_KEY,
              JSON.stringify({ at: Date.now(), location, data } satisfies Cached)
            );
            return data;
          });

    pending
      .then((data) => {
        if (!cancelled) setWeather(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, location]);

  return (
    <Widget title="Condiciones" icon={CloudSun}>
      {!location ? (
        <WidgetEmpty
          text="Configura tu zona de navegación en tu perfil."
          actionLabel="Ir al perfil"
          actionHref="/profile"
        />
      ) : !apiKey ? (
        <p className="text-xs text-navy-400">
          Clima no disponible: falta configurar la API del servicio
          meteorológico.
        </p>
      ) : failed ? (
        <p className="text-xs text-navy-400">
          No se pudo obtener el clima de {location}.
        </p>
      ) : !weather ? (
        <p className="text-xs text-navy-400">Cargando…</p>
      ) : (
        <div>
          <p className="text-2xl font-bold text-navy-900">{weather.temp}°C</p>
          <p className="text-xs capitalize text-navy-500">{weather.description}</p>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-water-600">
            <Wind className="h-4 w-4" />
            {weather.windKmh} km/h
          </p>
          <Link
            href="/profile"
            className="mt-2 block truncate text-xs text-navy-400 hover:underline"
          >
            {weather.place}
          </Link>
        </div>
      )}
    </Widget>
  );
}
