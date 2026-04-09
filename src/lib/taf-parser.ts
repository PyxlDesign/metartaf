import type {
  ParsedTaf, TafGroup, WindInfo, Visibility, WeatherCode, CloudLayer, SkyCondition
} from './types';

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
  if (token === 'CAVOK') return { vis: { value: 9999, unit: 'M', moreThan: true }, consumed: 1 };
  if (/^\d{4}$/.test(token)) return { vis: { value: parseInt(token), unit: 'M' }, consumed: 1 };

  const lt = token.startsWith('M');
  const mt = token.startsWith('P');
  const raw = token.replace(/^[MP]/, '');

  const fracOnly = raw.match(/^(\d+)\/(\d+)SM$/);
  if (fracOnly) return { vis: { value: parseInt(fracOnly[1]) / parseInt(fracOnly[2]), unit: 'SM', lessThan: lt, moreThan: mt }, consumed: 1 };

  if (/^\d+$/.test(token) && nextToken?.match(/^\d+\/\d+SM$/)) {
    const fm = nextToken.match(/^(\d+)\/(\d+)SM$/)!;
    return { vis: { value: parseInt(token) + parseInt(fm[1]) / parseInt(fm[2]), unit: 'SM' }, consumed: 2 };
  }

  const whole = raw.match(/^(\d+)SM$/);
  if (whole) return { vis: { value: parseInt(whole[1]), unit: 'SM', lessThan: lt, moreThan: mt }, consumed: 1 };

  return undefined;
}

function parseWeather(token: string): WeatherCode | undefined {
  const PHENOMENA = 'DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS';
  const DESCRIPTORS = 'MI|PR|BC|DR|BL|SH|TS|FZ';
  const re = new RegExp(`^(\\+|-|VC)?(${DESCRIPTORS})?((?:${PHENOMENA})+)$`);
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
  return { intensity: m[1] as WeatherCode['intensity'], descriptor: m[2], phenomena, raw: token };
}

function parseSky(token: string): CloudLayer | SkyCondition | undefined {
  const clear = /^(SKC|CLR|NSC|NCD|CAVOK)$/.exec(token);
  if (clear) return { kind: 'clear', code: clear[1] as SkyCondition['code'] };
  const m = token.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})(CB|TCU)?$/);
  if (!m) return undefined;
  return { cover: m[1] as CloudLayer['cover'], base: parseInt(m[2]) * 100, type: m[3] as CloudLayer['type'] };
}

function parseGroupBody(tokens: string[], start: number): { wind?: WindInfo; visibility?: Visibility; weather: WeatherCode[]; clouds: Array<CloudLayer | SkyCondition>; end: number } {
  let i = start;
  let wind: WindInfo | undefined;
  let visibility: Visibility | undefined;
  const weather: WeatherCode[] = [];
  const clouds: Array<CloudLayer | SkyCondition> = [];

  // Stop at next group keyword
  const isGroupStart = (t: string) => /^(FM\d{6}|TEMPO|BECMG|PROB\d{2})$/.test(t);

  if (i < tokens.length && parseWind(tokens[i])) {
    wind = parseWind(tokens[i]);
    i++;
  }

  if (i < tokens.length && !isGroupStart(tokens[i])) {
    const vp = parseVisibility(tokens[i], tokens[i + 1]);
    if (vp) { visibility = vp.vis; i += vp.consumed; }
  }

  // NSW (No Significant Weather) or weather
  while (i < tokens.length && !isGroupStart(tokens[i])) {
    if (tokens[i] === 'NSW') { i++; break; }
    const wx = parseWeather(tokens[i]);
    if (wx) { weather.push(wx); i++; }
    else break;
  }

  while (i < tokens.length && !isGroupStart(tokens[i])) {
    const sky = parseSky(tokens[i]);
    if (sky) { clouds.push(sky); i++; }
    else break;
  }

  return { wind, visibility, weather, clouds, end: i };
}

export function parseTaf(raw: string): ParsedTaf {
  const normalized = raw.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = normalized.split(' ');
  let i = 0;

  // Skip TAF/AMD/COR prefixes
  while (/^(TAF|AMD|COR|AAA|AAB|CCA|CCB)$/.test(tokens[i] ?? '')) i++;

  const amended = raw.includes('AMD');
  const station = tokens[i++] ?? '';

  const issueMatch = tokens[i]?.match(/^(\d{2})(\d{2})(\d{2})Z$/);
  const issueTime = issueMatch
    ? { day: parseInt(issueMatch[1]), hour: parseInt(issueMatch[2]), minute: parseInt(issueMatch[3]) }
    : { day: 0, hour: 0, minute: 0 };
  if (issueMatch) i++;

  const validMatch = tokens[i]?.match(/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/);
  const validFrom = validMatch ? { day: parseInt(validMatch[1]), hour: parseInt(validMatch[2]) } : { day: 0, hour: 0 };
  const validTo = validMatch ? { day: parseInt(validMatch[3]), hour: parseInt(validMatch[4]) } : { day: 0, hour: 0 };
  if (validMatch) i++;

  // Skip CAVOK or AMD token if it appears here
  if (tokens[i] === 'AMD') i++;

  const groups: TafGroup[] = [];

  // Base group
  const base = parseGroupBody(tokens, i);
  i = base.end;
  groups.push({
    type: 'BASE',
    wind: base.wind,
    visibility: base.visibility,
    weather: base.weather,
    clouds: base.clouds,
  });

  // Change groups
  while (i < tokens.length) {
    const t = tokens[i];

    if (/^FM\d{6}$/.test(t)) {
      const fm = t.match(/^FM(\d{2})(\d{2})(\d{2})$/)!;
      i++;
      const body = parseGroupBody(tokens, i);
      i = body.end;
      groups.push({
        type: 'FM',
        from: { day: parseInt(fm[1]), hour: parseInt(fm[2]), minute: parseInt(fm[3]) },
        wind: body.wind,
        visibility: body.visibility,
        weather: body.weather,
        clouds: body.clouds,
      });
    } else if (t === 'TEMPO' || t === 'BECMG') {
      const groupType = t as 'TEMPO' | 'BECMG';
      i++;
      const timeRange = tokens[i]?.match(/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/);
      const from = timeRange ? { day: parseInt(timeRange[1]), hour: parseInt(timeRange[2]) } : undefined;
      const to = timeRange ? { day: parseInt(timeRange[3]), hour: parseInt(timeRange[4]) } : undefined;
      if (timeRange) i++;
      const body = parseGroupBody(tokens, i);
      i = body.end;
      groups.push({
        type: groupType,
        from,
        to,
        wind: body.wind,
        visibility: body.visibility,
        weather: body.weather,
        clouds: body.clouds,
      });
    } else if (/^PROB(\d{2})$/.test(t)) {
      const probMatch = t.match(/^PROB(\d{2})$/)!;
      const prob = parseInt(probMatch[1]);
      i++;
      // Optional TEMPO after PROB
      const isProb = tokens[i] === 'TEMPO';
      const groupType: TafGroup['type'] = isProb ? 'TEMPO' : 'PROB';
      if (isProb) i++;
      const timeRange = tokens[i]?.match(/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/);
      const from = timeRange ? { day: parseInt(timeRange[1]), hour: parseInt(timeRange[2]) } : undefined;
      const to = timeRange ? { day: parseInt(timeRange[3]), hour: parseInt(timeRange[4]) } : undefined;
      if (timeRange) i++;
      const body = parseGroupBody(tokens, i);
      i = body.end;
      groups.push({
        type: groupType,
        probability: prob,
        from,
        to,
        wind: body.wind,
        visibility: body.visibility,
        weather: body.weather,
        clouds: body.clouds,
      });
    } else {
      // Skip unknown tokens (remarks, etc.)
      i++;
    }
  }

  return { raw: normalized, station, issueTime, validFrom, validTo, groups, amended };
}

export type TafTokenType =
  | 'prefix' | 'station' | 'time' | 'validPeriod'
  | 'groupFM' | 'groupTEMPO' | 'groupBECMG' | 'groupPROB'
  | 'wind' | 'visibility' | 'weather' | 'clouds' | 'nsw' | 'unknown';

export interface TafToken {
  text: string;
  type: TafTokenType;
  tooltip: string;
}

export function tokenizeTaf(raw: string): TafToken[] {
  const tokens = raw.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
  const result: TafToken[] = [];
  let i = 0;

  function push(text: string, type: TafTokenType, tooltip: string) {
    result.push({ text, type, tooltip });
  }

  while (/^(TAF|AMD|COR|AAA|CCA)$/.test(tokens[i] ?? '')) {
    const t = tokens[i];
    push(t, 'prefix', t === 'TAF' ? 'Terminal Aerodrome Forecast' : t === 'AMD' ? 'Amended TAF' : 'Corrected TAF');
    i++;
  }

  push(tokens[i++] ?? '', 'station', 'Airport ICAO identifier');

  if (/^\d{6}Z$/.test(tokens[i] ?? '')) {
    const t = tokens[i];
    push(t, 'time', `Issued day ${t.slice(0,2)} at ${t.slice(2,4)}:${t.slice(4,6)} UTC`);
    i++;
  }

  if (/^\d{4}\/\d{4}$/.test(tokens[i] ?? '')) {
    const v = tokens[i];
    const m = v.match(/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/)!;
    push(v, 'validPeriod', `Valid from day ${m[1]} at ${m[2]}:00 UTC to day ${m[3]} at ${m[4]}:00 UTC`);
    i++;
  }

  while (i < tokens.length) {
    const t = tokens[i];

    if (/^FM\d{6}$/.test(t)) {
      const m = t.match(/^FM(\d{2})(\d{2})(\d{2})$/)!;
      push(t, 'groupFM', `From: day ${m[1]} at ${m[2]}:${m[3]} UTC — conditions change at this time`);
      i++;
    } else if (t === 'TEMPO') {
      push(t, 'groupTEMPO', 'Temporary conditions (lasting < 60 min each occurrence, < half the period)');
      i++;
    } else if (t === 'BECMG') {
      push(t, 'groupBECMG', 'Becoming — conditions expected to change to these values within the time period');
      i++;
    } else if (/^PROB\d{2}$/.test(t)) {
      const pct = t.slice(4);
      push(t, 'groupPROB', `${pct}% probability of the following conditions`);
      i++;
    } else if (/^\d{4}\/\d{4}$/.test(t)) {
      const m = t.match(/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/)!;
      push(t, 'validPeriod', `Day ${m[1]} ${m[2]}:00 UTC to day ${m[3]} ${m[4]}:00 UTC`);
      i++;
    } else if (parseWind(t)) {
      const wm = t.match(/^(VRB|\d{3})(\d{2,3})(G(\d{2,3}))?(KT|MPS)$/)!;
      const dir = wm[1] === 'VRB' ? 'Variable direction' : `From ${wm[1]}°`;
      const gust = wm[4] ? `, gusting ${wm[4]} kt` : '';
      push(t, 'wind', `Wind: ${dir} at ${parseInt(wm[2])} kt${gust}`);
      i++;
    } else if (t === 'NSW') {
      push(t, 'nsw', 'No Significant Weather — previous weather no longer expected');
      i++;
    } else {
      const visParsed = parseVisibility(t, tokens[i + 1]);
      if (visParsed) {
        if (visParsed.consumed === 2) {
          push(`${t} ${tokens[i+1]}`, 'visibility', `Visibility: ${visParsed.vis.value} SM`);
        } else {
          const v = visParsed.vis;
          const lt = v.lessThan ? '<' : v.moreThan ? '>' : '';
          const tip = v.unit === 'SM'
            ? `Visibility: ${lt}${v.value} statute miles`
            : v.value >= 9999 ? 'Visibility: 10+ km' : `Visibility: ${v.value} m`;
          push(t, 'visibility', tip);
        }
        i += visParsed.consumed;
        continue;
      }

      const wx = parseWeather(t);
      if (wx) { push(t, 'weather', `Weather: ${t}`); i++; continue; }

      const sky = parseSky(t);
      if (sky) {
        let tip = t;
        if ('cover' in sky) {
          const names: Record<string, string> = { FEW: 'Few', SCT: 'Scattered', BKN: 'Broken', OVC: 'Overcast', VV: 'Vert. vis.' };
          tip = `${names[sky.cover] ?? sky.cover} clouds at ${sky.base.toLocaleString()} ft${sky.type ? ` (${sky.type})` : ''}`;
        }
        push(t, 'clouds', tip);
        i++;
        continue;
      }

      push(t, 'unknown', t);
      i++;
    }
  }

  return result;
}
