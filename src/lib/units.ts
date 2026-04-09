import type { CloudLayer, SkyCondition, FlightCategory } from './types';

export function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

export function windDirectionToCardinal(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function relativeHumidity(tempC: number, dewpC: number): number {
  const a = 17.625;
  const b = 243.04;
  const alpha = (a * dewpC) / (b + dewpC);
  const alphaT = (a * tempC) / (b + tempC);
  return Math.round(100 * Math.exp(alpha - alphaT));
}

export function flightCategory(
  clouds: Array<CloudLayer | SkyCondition>,
  visSm?: number
): FlightCategory {
  let ceiling = Infinity;
  for (const c of clouds) {
    if ('cover' in c && (c.cover === 'BKN' || c.cover === 'OVC' || c.cover === 'VV')) {
      if (c.base < ceiling) ceiling = c.base;
    }
  }
  const vis = visSm ?? Infinity;
  if (ceiling < 500 || vis < 1) return 'LIFR';
  if (ceiling < 1000 || vis < 3) return 'IFR';
  if (ceiling < 3000 || vis < 5) return 'MVFR';
  return 'VFR';
}

export const FLIGHT_CATEGORY_COLORS: Record<FlightCategory, string> = {
  VFR:  'bg-green-600 text-white',
  MVFR: 'bg-blue-600 text-white',
  IFR:  'bg-red-600 text-white',
  LIFR: 'bg-fuchsia-700 text-white',
};

export const CLOUD_COVER_LABEL: Record<string, string> = {
  FEW:   'Few',
  SCT:   'Scattered',
  BKN:   'Broken',
  OVC:   'Overcast',
  VV:    'Vertical Visibility',
  SKC:   'Sky Clear',
  CLR:   'Clear',
  CAVOK: 'Ceiling & Visibility OK',
  NSC:   'No Significant Cloud',
  NCD:   'No Cloud Detected',
};

export const CLOUD_COVER_DETAIL: Record<string, string> = {
  FEW:   '1–2 oktas (≤25% coverage)',
  SCT:   '3–4 oktas (25–50% coverage)',
  BKN:   '5–7 oktas (51–87% coverage) — counts as ceiling',
  OVC:   '8 oktas (100% coverage) — counts as ceiling',
  VV:    'Sky obscured — counts as ceiling',
  SKC:   'No clouds reported',
  CLR:   'No clouds below 12,000 ft',
  CAVOK: 'Visibility >10 km, no cloud below 5,000 ft, no significant wx',
  NSC:   'No significant clouds',
  NCD:   'No clouds detected by automated station',
};

export const WEATHER_INTENSITY: Record<string, string> = {
  '+':  'Heavy',
  '-':  'Light',
  'VC': 'In Vicinity',
};

export const WEATHER_DESCRIPTOR: Record<string, string> = {
  MI: 'Shallow',
  PR: 'Partial',
  BC: 'Patches of',
  DR: 'Low Drifting',
  BL: 'Blowing',
  SH: 'Shower',
  TS: 'Thunderstorm',
  FZ: 'Freezing',
};

export const WEATHER_PHENOMENA: Record<string, string> = {
  DZ: 'Drizzle',
  RA: 'Rain',
  SN: 'Snow',
  SG: 'Snow Grains',
  IC: 'Ice Crystals',
  PL: 'Ice Pellets',
  GR: 'Hail',
  GS: 'Small Hail/Snow Pellets',
  UP: 'Unknown Precipitation',
  BR: 'Mist',
  FG: 'Fog',
  FU: 'Smoke',
  VA: 'Volcanic Ash',
  DU: 'Widespread Dust',
  SA: 'Sand',
  HZ: 'Haze',
  PY: 'Spray',
  PO: 'Dust/Sand Whirls',
  SQ: 'Squalls',
  FC: 'Funnel Cloud/Tornado',
  SS: 'Sandstorm',
  DS: 'Duststorm',
};

export function decodeWeatherCode(raw: string): string {
  let s = raw;
  const parts: string[] = [];

  // Intensity
  if (s.startsWith('+')) { parts.push('Heavy'); s = s.slice(1); }
  else if (s.startsWith('-')) { parts.push('Light'); s = s.slice(1); }
  else if (s.startsWith('VC')) { s = s.slice(2); parts.push('In Vicinity'); }

  // Descriptor (2-letter)
  const descCodes = ['MI','PR','BC','DR','BL','SH','TS','FZ'];
  for (const d of descCodes) {
    if (s.startsWith(d)) {
      parts.push(WEATHER_DESCRIPTOR[d]);
      s = s.slice(2);
      break;
    }
  }

  // Phenomena (2-letter each)
  while (s.length >= 2) {
    const code = s.slice(0, 2);
    const label = WEATHER_PHENOMENA[code];
    if (label) { parts.push(label); s = s.slice(2); }
    else break;
  }

  return parts.join(' ') || raw;
}
