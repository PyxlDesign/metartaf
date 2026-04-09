import { NextRequest, NextResponse } from 'next/server';
import type { ApiWeatherResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('station') ?? '';
  const station = raw.toUpperCase().trim();

  if (!station || !/^[A-Z0-9]{2,6}$/.test(station)) {
    return NextResponse.json<ApiWeatherResponse>(
      { error: 'Enter an airport identifier (e.g. KIPT or KORD).' },
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

    const safeJson = async (res: Response): Promise<Record<string, unknown>[]> => {
      try {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    };

    const [metarData, tafData] = await Promise.all([
      safeJson(metarRes),
      safeJson(tafRes),
    ]);

    const metar = metarData[0] ?? null;
    const taf = tafData[0] ?? null;

    if (!metar && !taf) {
      return NextResponse.json<ApiWeatherResponse>(
        { error: `No METAR or TAF available for ${station}. Not all airports publish weather reports — try a nearby towered airport, or check that the identifier is correct.` },
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
