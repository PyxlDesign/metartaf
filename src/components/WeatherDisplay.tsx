'use client';
import { useState } from 'react';
import type { ViewMode, ApiWeatherResponse } from '@/lib/types';
import { parseMetar, tokenizeMetar } from '@/lib/metar-parser';
import { parseTaf, tokenizeTaf } from '@/lib/taf-parser';
import ViewToggle from './ViewToggle';
import { RawMetarView, RawTafView } from './RawView';
import DecodedMetar from './DecodedMetar';
import DecodedTaf from './DecodedTaf';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-3">{title}</h2>
      {children}
    </section>
  );
}

export default function WeatherDisplay({ data }: { data: ApiWeatherResponse }) {
  const [mode, setMode] = useState<ViewMode>('decoded');

  const metar = data.metarRaw ? parseMetar(data.metarRaw) : null;
  const taf   = data.tafRaw   ? parseTaf(data.tafRaw)     : null;
  const metarTokens = data.metarRaw ? tokenizeMetar(data.metarRaw) : null;
  const tafTokens   = data.tafRaw   ? tokenizeTaf(data.tafRaw)     : null;

  const showRaw     = mode === 'raw'         || mode === 'side-by-side';
  const showDecoded = mode === 'decoded'     || mode === 'side-by-side';
  const sideBySide  = mode === 'side-by-side';

  return (
    <div className="space-y-8">
      {/* View toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">
            {data.stationName ?? (metar?.station ?? taf?.station ?? 'Weather')}
          </h1>
          {data.stationElev !== undefined && (
            <p className="text-xs text-slate-500">Elevation: {data.stationElev.toLocaleString()} ft MSL</p>
          )}
        </div>
        <ViewToggle mode={mode} onChange={setMode} />
      </div>

      {/* METAR */}
      {(metar || metarTokens) && (
        <Section title="METAR — Current Conditions">
          {sideBySide ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Raw</p>
                {metarTokens && <RawMetarView tokens={metarTokens} />}
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Decoded</p>
                {metar && <DecodedMetar metar={metar} stationName={data.stationName} stationElev={data.stationElev} />}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {showRaw && metarTokens && <RawMetarView tokens={metarTokens} />}
              {showDecoded && metar && <DecodedMetar metar={metar} stationName={data.stationName} stationElev={data.stationElev} />}
            </div>
          )}
        </Section>
      )}

      {/* TAF */}
      {(taf || tafTokens) && (
        <Section title="TAF — Terminal Aerodrome Forecast">
          {sideBySide ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Raw</p>
                {tafTokens && <RawTafView tokens={tafTokens} />}
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Decoded</p>
                {taf && <DecodedTaf taf={taf} stationName={data.stationName} />}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {showRaw && tafTokens && <RawTafView tokens={tafTokens} />}
              {showDecoded && taf && <DecodedTaf taf={taf} stationName={data.stationName} />}
            </div>
          )}
        </Section>
      )}

      {!metar && !taf && (
        <p className="text-slate-500 text-sm">No data available.</p>
      )}
    </div>
  );
}
