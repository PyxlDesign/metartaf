'use client';
import type { ParsedMetar, CloudLayer, SkyCondition } from '@/lib/types';
import {
  celsiusToFahrenheit, windDirectionToCardinal, relativeHumidity,
  flightCategory, FLIGHT_CATEGORY_COLORS, CLOUD_COVER_LABEL, CLOUD_COVER_DETAIL,
  decodeWeatherCode,
} from '@/lib/units';

function Card({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`bg-slate-800 rounded-lg p-4 ${wide ? 'col-span-2' : ''}`}>
      <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      {children}
    </div>
  );
}

function Temp({ c }: { c: number }) {
  return (
    <span>
      <span className="text-xl font-semibold text-slate-100">{celsiusToFahrenheit(c)}°F</span>
      <span className="text-sm text-slate-400 ml-1.5">{c}°C</span>
    </span>
  );
}

export default function DecodedMetar({ metar, stationName, stationElev }: {
  metar: ParsedMetar;
  stationName?: string;
  stationElev?: number;
}) {
  const cloudLayers = metar.clouds.filter((c): c is CloudLayer => 'cover' in c);
  const skyCond = metar.clouds.find((c): c is SkyCondition => 'kind' in c);
  const cat = flightCategory(metar.clouds, metar.visibility?.unit === 'SM' ? metar.visibility.value : undefined);
  const catColor = FLIGHT_CATEGORY_COLORS[cat];

  const windSpeed = metar.wind?.speed ?? 0;
  const windDir = metar.wind?.direction;

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`px-3 py-1 rounded font-bold text-sm ${catColor}`}>{cat}</span>
        <span className="text-slate-400 text-sm">
          {stationName ?? metar.station}
          {stationElev !== undefined && <span className="ml-2 text-slate-500">({stationElev.toLocaleString()} ft MSL)</span>}
        </span>
        {metar.auto && <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-400 rounded">AUTO</span>}
        {metar.correction && <span className="text-xs px-2 py-0.5 bg-yellow-900 text-yellow-300 rounded">COR</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {/* Observation time */}
        <Card label="Observation Time">
          <p className="text-slate-100 font-mono">
            {String(metar.time.day).padStart(2,'0')}/
            {String(metar.time.hour).padStart(2,'0')}:
            {String(metar.time.minute).padStart(2,'0')}Z
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Day/HH:MMZ UTC</p>
        </Card>

        {/* Wind */}
        <Card label="Wind">
          {!metar.wind || windSpeed === 0 ? (
            <p className="text-slate-100">Calm</p>
          ) : (
            <>
              <p className="text-slate-100">
                {windDir === 'VRB'
                  ? 'Variable'
                  : `${String(windDir).padStart(3,'0')}° (${windDirectionToCardinal(windDir as number)})`
                }
              </p>
              <p className="text-slate-300 text-sm">
                {windSpeed} kt
                {metar.wind.gust && <span className="text-orange-400"> G{metar.wind.gust} kt</span>}
              </p>
              {metar.wind.variableFrom !== undefined && (
                <p className="text-xs text-slate-500">Variable {metar.wind.variableFrom}°–{metar.wind.variableTo}°</p>
              )}
            </>
          )}
        </Card>

        {/* Visibility */}
        <Card label="Visibility">
          {metar.visibility ? (
            <>
              <p className="text-slate-100">
                {metar.visibility.lessThan && '< '}
                {metar.visibility.moreThan && '> '}
                {metar.visibility.value}
                {' '}{metar.visibility.unit === 'SM' ? 'SM' : 'm'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Statute miles visibility</p>
            </>
          ) : skyCond?.code === 'CAVOK' ? (
            <p className="text-green-400">CAVOK</p>
          ) : (
            <p className="text-slate-500">Not reported</p>
          )}
        </Card>

        {/* Present Weather */}
        {metar.weather.length > 0 && (
          <Card label="Present Weather">
            {metar.weather.map((wx, i) => (
              <p key={i} className="text-purple-300">{decodeWeatherCode(wx.raw)}</p>
            ))}
          </Card>
        )}

        {/* Cloud layers */}
        {cloudLayers.length > 0 ? (
          <Card label={`Cloud Layers (${cloudLayers.length})`} wide={cloudLayers.length > 2}>
            <div className="space-y-1.5">
              {cloudLayers.map((layer, i) => {
                const isCeiling = layer.cover === 'BKN' || layer.cover === 'OVC' || layer.cover === 'VV';
                return (
                  <div key={i} className="flex items-baseline justify-between gap-2">
                    <span className={`text-sm font-medium ${isCeiling ? 'text-orange-400' : 'text-sky-400'}`}>
                      {CLOUD_COVER_LABEL[layer.cover]}
                      {layer.type && <span className="ml-1 text-xs text-yellow-400">{layer.type}</span>}
                    </span>
                    <span className="text-slate-100 font-mono text-sm">{layer.base.toLocaleString()} ft</span>
                  </div>
                );
              })}
            </div>
            {/* Ceiling indicator */}
            {(() => {
              const ceiling = cloudLayers.find(l => l.cover === 'BKN' || l.cover === 'OVC' || l.cover === 'VV');
              if (ceiling) return (
                <p className="text-xs text-orange-400 mt-2">Ceiling: {ceiling.base.toLocaleString()} ft AGL</p>
              );
            })()}
          </Card>
        ) : skyCond ? (
          <Card label="Sky Condition">
            <p className="text-green-400">{CLOUD_COVER_LABEL[skyCond.code]}</p>
            <p className="text-xs text-slate-500 mt-0.5">{CLOUD_COVER_DETAIL[skyCond.code]}</p>
          </Card>
        ) : null}

        {/* Temperature */}
        {metar.temperature !== undefined && (
          <Card label="Temperature">
            <Temp c={metar.temperature} />
          </Card>
        )}

        {/* Dewpoint */}
        {metar.dewpoint !== undefined && (
          <Card label="Dewpoint">
            <Temp c={metar.dewpoint} />
            {metar.temperature !== undefined && (
              <p className="text-xs text-slate-500 mt-0.5">
                Spread: {metar.temperature - metar.dewpoint}°C &nbsp;·&nbsp;
                RH: {relativeHumidity(metar.temperature, metar.dewpoint)}%
              </p>
            )}
          </Card>
        )}

        {/* Altimeter */}
        {metar.altimeter && (
          <Card label="Altimeter">
            <p className="text-slate-100 text-xl font-semibold">
              {metar.altimeter.unit === 'inHg'
                ? `${metar.altimeter.value.toFixed(2)} inHg`
                : `${metar.altimeter.value} hPa`}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {metar.altimeter.unit === 'inHg' ? 'Set altimeter to this value' : 'QNH pressure setting'}
            </p>
          </Card>
        )}

        {/* Flight Category explanation */}
        <Card label="Flight Category">
          <p className={`text-xl font-bold ${cat === 'VFR' ? 'text-green-400' : cat === 'MVFR' ? 'text-blue-400' : cat === 'IFR' ? 'text-red-400' : 'text-fuchsia-400'}`}>
            {cat}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {cat === 'VFR'  && 'Visual: ceiling ≥3,000 ft & vis ≥5 SM'}
            {cat === 'MVFR' && 'Marginal VFR: ceiling 1,000–2,999 ft or vis 3–4 SM'}
            {cat === 'IFR'  && 'Instrument: ceiling 500–999 ft or vis 1–2 SM'}
            {cat === 'LIFR' && 'Low IFR: ceiling <500 ft or vis <1 SM'}
          </p>
        </Card>

        {/* RVR */}
        {metar.rvr && metar.rvr.length > 0 && (
          <Card label="Runway Visual Range">
            {metar.rvr.map((r, i) => (
              <p key={i} className="text-slate-100 text-sm">
                RWY {r.runway}: {r.lessThan && '<'}{r.moreThan && '>'}{r.min.toLocaleString()} ft
                {r.max && <> – {r.max.toLocaleString()} ft</>}
              </p>
            ))}
          </Card>
        )}
      </div>

      {/* Remarks */}
      {metar.remarks && (
        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Remarks</p>
          <p className="font-mono text-sm text-slate-400">{metar.remarks}</p>
          <RemarksDecoder remarks={metar.remarks} />
        </div>
      )}
    </div>
  );
}

function RemarksDecoder({ remarks }: { remarks: string }) {
  const tokens = remarks.split(/\s+/);
  const decoded: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === 'AO1') decoded.push('Automated station without precipitation discriminator');
    else if (t === 'AO2') decoded.push('Automated station with precipitation discriminator');
    else if (/^SLP\d{3}$/.test(t)) {
      const v = parseInt(t.slice(3));
      const slp = v >= 500 ? 900 + v / 10 : 1000 + v / 10;
      decoded.push(`Sea-level pressure: ${slp.toFixed(1)} hPa`);
    } else if (/^T\d{8}$/.test(t)) {
      const ts = t.slice(1);
      const tSign = ts[0] === '1' ? -1 : 1;
      const dSign = ts[4] === '1' ? -1 : 1;
      const temp = tSign * parseInt(ts.slice(1, 4)) / 10;
      const dew = dSign * parseInt(ts.slice(5, 8)) / 10;
      decoded.push(`Precise temp: ${celsiusToFahrenheit(temp)}°F (${temp}°C) / Dewpoint: ${celsiusToFahrenheit(dew)}°F (${dew}°C)`);
    } else if (t === 'TSNO') decoded.push('Thunderstorm info not available');
    else if (t === 'PRESRR') decoded.push('Pressure rising rapidly');
    else if (t === 'PRESFR') decoded.push('Pressure falling rapidly');
    else if (/^P\d{4}$/.test(t)) decoded.push(`Hourly precipitation: ${parseInt(t.slice(1)) / 100}" (${(parseInt(t.slice(1)) / 100 * 25.4).toFixed(1)} mm)`);
  }

  if (decoded.length === 0) return null;
  return (
    <ul className="mt-2 space-y-0.5">
      {decoded.map((d, i) => (
        <li key={i} className="text-xs text-slate-400">• {d}</li>
      ))}
    </ul>
  );
}
