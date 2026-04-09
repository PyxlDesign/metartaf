import { NextRequest, NextResponse } from 'next/server';
import type { ApiWeatherResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('station') ?? '';
  const station = raw.toUpperCase().trim();

  if (!station || !/^[A-Z]{3,4}$/.test(station)) {
    return NextResponse.json<ApiWeatherResponse>(
      { error: 'Enter a valid 3–4 letter ICAO airport code (e.g. KIPT).' },
      { status: 400 }
    );
  }

  try {
    const [metarRes, tafRes] = await Promise.all([
      fetch(
        `https://aviationweather.gov/api/data/metar?ids=${station}&format=json&hours=2`,
        { next: { revalidate: 60 } }
      ),
      fetch(
        `https://aviationweather.gov/api/data/taf?ids=${station}&format=json`,
        { next: { revalidate: 60 } }
      ),
    ]);

    if (!metarRes.ok || !tafRes.ok) {
      return NextResponse.json<ApiWeatherResponse>(
        { error: 'Failed to reach aviationweather.gov. Try again.' },
        { status: 502 }
      );
    }

    const metarData: Record<string, unknown>[] = await metarRes.json();
    const tafData: Record<string, unknown>[] = await tafRes.json();

    const metar = metarData[0] ?? null;
    const taf = tafData[0] ?? null;

    if (!metar && !taf) {
      return NextResponse.json<ApiWeatherResponse>(
        { error: `No weather data found for ${station}. Verify the ICAO code.` },
        { status: 404 }
      );
    }

    const response: ApiWeatherResponse = {
      stationName: (metar?.name as string) ?? (taf?.name as string) ?? undefined,
      stationElev: (metar?.elev as number) ?? undefined,
      metarRaw: (metar?.rawOb as string) ?? undefined,
      tafRaw: (taf?.rawTAF as string) ?? undefined,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json<ApiWeatherResponse>(
      { error: 'Network error. Check your connection and try again.' },
      { status: 500 }
    );
  }
}
