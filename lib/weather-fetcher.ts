import { haversineKm, rainValueMmPerHour, wmoToDescription, compassNL } from '@/lib/weather-utils'

// Default location (Amsterdam) — not yet configurable per user/profile.
const LAT = 52.3676
const LON = 4.9041

const OPEN_METEO_URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,winddirection_10m_dominant&timezone=Europe%2FAmsterdam&forecast_days=8`

interface OpenMeteoDaily {
  time: string[]
  weathercode: number[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
  precipitation_probability_max: number[]
  windspeed_10m_max: number[]
  winddirection_10m_dominant: number[]
}

interface BuienStation {
  stationid: number; stationname: string; lat: number; lon: number
  temperature: number; weatherdescription: string; winddirection: string
  windspeed: number; precipitation: number; humidity: number; airpressure: number
  iconurl: string
}

export interface WeatherData {
  station: string; distance: number
  current: { temperature: number; description: string; windDirection: string; windSpeed: number; precipitation: number; humidity: number; icon: string }
  rainForecast: { time: string; mm: number; pct: number }[]
  isRaining: boolean
  forecast: { date: string; maxTemp: number; minTemp: number; rainChance: number; sunChance: number; description: string; iconCode: string; wind: number; windDirection: string }[]
}

export async function fetchWeatherData(): Promise<WeatherData> {
  const [feedResp, rainResp, meteoResp] = await Promise.all([
    fetch('https://data.buienradar.nl/2.0/feed/json', { next: { revalidate: 600 } }),
    fetch(`https://gpsgadget.buienradar.nl/data/raintext/?lat=${LAT}&lon=${LON}`, { next: { revalidate: 300 } }),
    fetch(OPEN_METEO_URL, { next: { revalidate: 3600 } }),
  ])

  if (!feedResp.ok) throw new Error('Buienradar feed failed')

  const feed = await feedResp.json()
  const stations: BuienStation[] = feed.actual?.stationmeasurements ?? []

  let nearest = stations[0]
  let minDist = Infinity
  for (const s of stations) {
    if (!s.lat || !s.lon || s.temperature == null) continue
    const d = haversineKm(LAT, LON, s.lat, s.lon)
    if (d < minDist) { minDist = d; nearest = s }
  }

  const rainLines = rainResp.ok ? (await rainResp.text()).trim().split('\n') : []
  const rainForecast = rainLines.slice(0, 24).map(line => {
    const [val, time] = line.split('|')
    return { time: time?.trim() ?? '', mm: rainValueMmPerHour(parseInt(val ?? '0', 10)) }
  }).filter(r => r.time)

  const maxRain = Math.max(...rainForecast.map(r => r.mm), 0.1)
  const isRaining = rainForecast.some(r => r.mm > 0.1)

  const meteo = meteoResp.ok ? await meteoResp.json() : null
  const daily: OpenMeteoDaily | undefined = meteo?.daily
  const forecastDays = (daily?.time ?? []).map((date: string, i: number) => ({
    date,
    maxTemp: Math.round(daily!.temperature_2m_max[i] ?? 0),
    minTemp: Math.round(daily!.temperature_2m_min[i] ?? 0),
    rainChance: Math.round(daily!.precipitation_probability_max[i] ?? 0),
    sunChance: 0,
    description: wmoToDescription(daily!.weathercode[i]),
    iconCode: '',
    wind: Math.round((daily!.windspeed_10m_max[i] ?? 0) / 3.6),
    windDirection: compassNL(daily!.winddirection_10m_dominant[i] ?? 0),
  }))

  return {
    station: nearest?.stationname ?? 'Twente',
    distance: Math.round(minDist),
    current: {
      temperature: Math.round(nearest?.temperature ?? 0),
      description: nearest?.weatherdescription ?? '',
      windDirection: nearest?.winddirection ?? '',
      windSpeed: Math.round(nearest?.windspeed ?? 0),
      precipitation: nearest?.precipitation ?? 0,
      humidity: nearest?.humidity ?? 0,
      icon: nearest?.iconurl ?? '',
    },
    rainForecast: rainForecast.map(r => ({ ...r, pct: Math.round((r.mm / maxRain) * 100) })),
    isRaining,
    forecast: forecastDays,
  }
}
