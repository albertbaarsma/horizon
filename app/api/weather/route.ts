import { NextResponse } from 'next/server'
import { fetchWeatherData } from '@/lib/weather-fetcher'

export async function GET() {
  try {
    const data = await fetchWeatherData()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
