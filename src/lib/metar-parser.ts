import type {
  ParsedMetar, WindInfo, Visibility, WeatherCode, CloudLayer, SkyCondition
} from './types';

function parseTemp(s: string): number {
  if (s.startsWith('M')) return -parseInt(s.slice(1), 10);
  return parseInt(s, 10);
}

function parseWind(token: string): WindInfo | undefined {
  const m = token.match(/^(VRB|\d{3})(\d{2,3})(G(\d{2,3}))?(KT|MPS)$/);
  if (!m) return undefined;
  return {
    direction: m[1] === 'VRB' ? 'VRB' : parseInt(m[1], 10),
    speed: parseInt(m[2], 10),
    gust: m[4] ? parseInt(m[4], 10) : undefined,
    unit: m[5] as 'KT' | 'MPS',
  };
}

function parseVisibility(token: string, nextToken?: string): { vis: Visibility; consumed: number } | undefined {
  // CAVOK
  if (token === 'CAVOK') {
    return { vis: { value: 9999, unit: 'M', moreThan: true }, consumed: 1 };
  }
  // Metric 4-digit: 0800, 9999
  if (/^\d{4}$/.test(token)) {
    return { vis: { value: parseInt(token, 10), unit: 'M' }, consumed: 1 };
  }
  // SM visibility
  const lt = token.startsWith('M');
  const mt = token.startsWith('P');
  const raw = token.replace(/^[MP]/, '');

  // Fraction only: 1/2SM
  const fracOnlySm = raw.match(/^(\d+)\/(\d+)SM$/);
  if (fracOnlySm) {
    const v = parseInt(fracOnlySm[1]) / parseInt(fracOnlySm[2]);
    return { vis: { value: v, unit: 'SM', lessThan: lt, moreThan: mt }, consumed: 1 };
  }
  // Whole+fraction across two tokens: "2" + "1/2SM"
  const wholeOnly = token.match(/^\d+$/);
  if (wholeOnly && nextToken) {
    const fracSm = nextToken.match(/^(\d+)\/(\d+)SM$/);
    if (fracSm) {
      const v = parseInt(token) + parseInt(fracSm[1]) / parseInt(fracSm[2]);
      return { vis: { value: v, unit: 'SM' }, consumed: 2 };
    }
  }
  // Whole SM: 10SM, P6SM
  const wholeSm = raw.match(/^(\d+)SM$/);
  if (wholeSm) {
    return { vis: { value: parseInt(wholeSm[1]), unit: 'SM', lessThan: lt, moreThan: mt }, consumed: 1 };
  }
  return undefined;
}

function parseWeather(token: string): WeatherCode | undefined {
  const PHENOMENA = 'DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS';
  const DESCRIPTORS = 'MI|PR|BC|DR|BL|SH|TS|FZ';
  const re = new RegExp(
    `^(\\+|-|VC)?(${DESCRIPTORS})?((?:${PHENOMENA})+)$`
  );
  const m = token.match(re);
  if (!m) return undefined;
  const phenomena: string[] = [];
  let s = m[3];
  const pCodes = PHENOMENA.split('|');
  while (s.length >= 2) {
    const code = s.slice(0, 2);
    if (pCodes.includes(code)) { phenomena.push(code); s = s.slice(2); }
    else break;
  }
  return {
    intensity: m[1] as WeatherCode['intensity'],
    descriptor: m[2],
    phenomena,
    raw: token,
  };
}

function parseSky(token: string): CloudLayer | SkyCondition | undefined {
  const clear = /^(SKC|CLR|NSC|NCD|CAVOK)$/.exec(token);
  if (clear) return { kind: 'clear', code: clear[1] as SkyCondition['code'] };

  const m = token.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})(CB|TCU)?$/);
  if (!m) return undefined;
  return {
    cover: m[1] as CloudLayer['cover'],
    base: parseInt(m[2], 10) * 100,
    type: m[3] as CloudLayer['type'],
  };
}

export function parseMetar(raw: string): ParsedMetar {
  const normalized = raw.trim().replace(/\s+/g, ' ');
  const tokens = normalized.split(' ');
  let i = 0;

  // Skip METAR/SPECI prefix
  if (/^(METAR|SPECI)$/.test(tokens[i])) i++;

  const station = tokens[i++] ?? '';
  const timeMatch = tokens[i]?.match(/^(\d{2})(\d{2})(\d{2})Z$/);
  const time = timeMatch
    ? { day: parseInt(timeMatch[1]), hour: parseInt(timeMatch[2]), minute: parseInt(timeMatch[3]) }
    : { day: 0, hour: 0, minute: 0 };
  if (timeMatch) i++;

  let auto = false;
  let correction = false;
  while (tokens[i] === 'AUTO' || tokens[i] === 'COR' || tokens[i] === 'SPECI') {
    if (tokens[i] === 'AUTO') auto = true;
    if (tokens[i] === 'COR') correction = true;
    i++;
  }

  let wind: WindInfo | undefined;
  const windParsed = parseWind(tokens[i] ?? '');
  if (windParsed) { wind = windParsed; i++; }

  // Wind variability: 200V260
  if (/^\d{3}V\d{3}$/.test(tokens[i] ?? '')) {
    const wv = tokens[i].match(/^(\d{3})V(\d{3})$/)!;
    if (wind) {
      wind.variableFrom = parseInt(wv[1]);
      wind.variableTo = parseInt(wv[2]);
    }
    i++;
  }

  let visibility: Visibility | undefined;
  const visParsed = parseVisibility(tokens[i] ?? '', tokens[i + 1]);
  if (visParsed) { visibility = visParsed.vis; i += visParsed.consumed; }

  // RVR
  const rvr: ParsedMetar['rvr'] = [];
  while (/^R\d{2}[LCR]?\//.test(tokens[i] ?? '')) {
    const m = tokens[i].match(/^R(\d{2}[LCR]?)\/([MP]?)(\d{4})(?:V([MP]?)(\d{4}))?(FT)?$/);
    if (m) {
      rvr.push({
        runway: m[1],
        min: parseInt(m[3]),
        max: m[5] ? parseInt(m[5]) : undefined,
        lessThan: m[2] === 'M',
        moreThan: m[2] === 'P',
      });
    }
    i++;
  }

  // Weather
  const weather: WeatherCode[] = [];
  while (i < tokens.length) {
    const wx = parseWeather(tokens[i]);
    if (wx) { weather.push(wx); i++; }
    else break;
  }

  // Sky
  const clouds: Array<CloudLayer | SkyCondition> = [];
  while (i < tokens.length) {
    const sky = parseSky(tokens[i]);
    if (sky) { clouds.push(sky); i++; }
    else break;
  }

  // Temp/Dewpoint
  let temperature: number | undefined;
  let dewpoint: number | undefined;
  const tdMatch = tokens[i]?.match(/^(M?\d{1,2})\/(M?\d{1,2})$/);
  if (tdMatch) {
    temperature = parseTemp(tdMatch[1]);
    dewpoint = parseTemp(tdMatch[2]);
    i++;
  }

  // Altimeter
  let altimeter: ParsedMetar['altimeter'];
  if (/^A\d{4}$/.test(tokens[i] ?? '')) {
    altimeter = { value: parseInt(tokens[i].slice(1)) / 100, unit: 'inHg' };
    i++;
  } else if (/^Q\d{4}$/.test(tokens[i] ?? '')) {
    altimeter = { value: parseInt(tokens[i].slice(1)), unit: 'hPa' };
    i++;
  }

  // Remarks
  let remarks: string | undefined;
  if (tokens[i] === 'RMK') {
    remarks = tokens.slice(i + 1).join(' ');
  }

  return { raw: normalized, station, time, auto, correction, wind, visibility, rvr, weather, clouds, temperature, dewpoint, altimeter, remarks };
}

export type MetarTokenType =
  | 'station' | 'time' | 'modifier' | 'wind' | 'windVar'
  | 'visibility' | 'rvr' | 'weather' | 'clouds' | 'tempDew'
  | 'altimeter' | 'rmkLabel' | 'remarks' | 'unknown';

export interface MetarToken {
  text: string;
  type: MetarTokenType;
  tooltip: string;
}

export function tokenizeMetar(raw: string): MetarToken[] {
  const tokens = raw.trim().replace(/\s+/g, ' ').split(' ');
  const result: MetarToken[] = [];
  let i = 0;

  function push(text: string, type: MetarTokenType, tooltip: string) {
    result.push({ text, type, tooltip });
  }

  if (/^(METAR|SPECI)$/.test(tokens[i] ?? '')) {
    push(tokens[i], 'modifier', tokens[i] === 'SPECI' ? 'Special observation' : 'Routine METAR observation');
    i++;
  }

  push(tokens[i++] ?? '', 'station', 'Airport ICAO identifier');

  if (/^\d{6}Z$/.test(tokens[i] ?? '')) {
    const t = tokens[i];
    push(t, 'time', `Day ${t.slice(0,2)}, ${t.slice(2,4)}:${t.slice(4,6)} UTC`);
    i++;
  }

  while (/^(AUTO|COR|SPECI)$/.test(tokens[i] ?? '')) {
    const mod = tokens[i];
    const tip = mod === 'AUTO' ? 'Automated observation (no human augmentation)' : 'Corrected observation';
    push(mod, 'modifier', tip);
    i++;
  }

  if (parseWind(tokens[i] ?? '')) {
    const w = tokens[i];
    const wm = w.match(/^(VRB|\d{3})(\d{2,3})(G(\d{2,3}))?(KT|MPS)$/)!;
    const dir = wm[1] === 'VRB' ? 'Variable direction' : `From ${wm[1]}°`;
    const gust = wm[4] ? `, gusting ${wm[4]} kt` : '';
    push(w, 'wind', `Wind: ${dir} at ${parseInt(wm[2])} kt${gust}`);
    i++;
  }

  if (/^\d{3}V\d{3}$/.test(tokens[i] ?? '')) {
    const wv = tokens[i];
    push(wv, 'windVar', `Wind variable between ${wv.slice(0,3)}° and ${wv.slice(4)}°`);
    i++;
  }

  // Visibility (may consume 2 tokens)
  const visParsed = parseVisibility(tokens[i] ?? '', tokens[i + 1]);
  if (visParsed) {
    if (visParsed.consumed === 2) {
      const combined = `${tokens[i]} ${tokens[i+1]}`;
      push(combined, 'visibility', `Visibility: ${visParsed.vis.value} statute miles`);
    } else {
      const v = visParsed.vis;
      let tip = '';
      if (v.unit === 'SM') {
        const lt = v.lessThan ? 'less than ' : v.moreThan ? 'more than ' : '';
        tip = `Visibility: ${lt}${v.value} statute mile${v.value !== 1 ? 's' : ''}`;
      } else {
        tip = v.value >= 9999 ? 'Visibility: 10+ km' : `Visibility: ${v.value} meters`;
      }
      push(tokens[i], 'visibility', tip);
    }
    i += visParsed.consumed;
  }

  while (/^R\d{2}[LCR]?\//.test(tokens[i] ?? '')) {
    push(tokens[i], 'rvr', 'Runway Visual Range');
    i++;
  }

  while (parseWeather(tokens[i] ?? '')) {
    const wx = tokens[i];
    push(wx, 'weather', `Present weather: ${wx}`);
    i++;
  }

  while (parseSky(tokens[i] ?? '')) {
    const sky = tokens[i];
    const m = sky.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})(CB|TCU)?$/);
    let tip = sky;
    if (m) {
      const height = parseInt(m[2]) * 100;
      const names: Record<string, string> = { FEW: 'Few', SCT: 'Scattered', BKN: 'Broken', OVC: 'Overcast', VV: 'Vertical visibility' };
      tip = `${names[m[1]] ?? m[1]} clouds at ${height.toLocaleString()} ft AGL${m[3] ? ` (${m[3] === 'CB' ? 'Cumulonimbus' : 'Towering Cumulus'})` : ''}`;
    } else if (/^(SKC|CLR|CAVOK|NSC|NCD)$/.test(sky)) {
      const names: Record<string, string> = { SKC: 'Sky clear', CLR: 'Clear below 12,000 ft', CAVOK: 'Ceiling & visibility OK', NSC: 'No significant cloud', NCD: 'No cloud detected' };
      tip = names[sky] ?? sky;
    }
    push(sky, 'clouds', tip);
    i++;
  }

  if (/^M?\d{1,2}\/M?\d{1,2}$/.test(tokens[i] ?? '')) {
    const td = tokens[i].split('/');
    const t = parseTemp(td[0]);
    const d = parseTemp(td[1]);
    push(tokens[i], 'tempDew', `Temperature ${t}°C / Dewpoint ${d}°C`);
    i++;
  }

  if (/^A\d{4}$/.test(tokens[i] ?? '')) {
    const v = parseInt(tokens[i].slice(1)) / 100;
    push(tokens[i], 'altimeter', `Altimeter: ${v.toFixed(2)} inHg`);
    i++;
  } else if (/^Q\d{4}$/.test(tokens[i] ?? '')) {
    push(tokens[i], 'altimeter', `QNH: ${tokens[i].slice(1)} hPa`);
    i++;
  }

  if (tokens[i] === 'RMK') {
    push('RMK', 'rmkLabel', 'Remarks section');
    i++;
    if (i < tokens.length) {
      push(tokens.slice(i).join(' '), 'remarks', 'Additional weather observations and automated station data');
    }
  }

  // Any remaining tokens
  while (i < tokens.length) {
    push(tokens[i], 'unknown', tokens[i]);
    i++;
  }

  return result;
}
