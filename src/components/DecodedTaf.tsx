'use client';
import type { ParsedTaf, TafGroup, CloudLayer, SkyCondition } from '@/lib/types';
import {
  windDirectionToCardinal, CLOUD_COVER_LABEL, decodeWeatherCode, flightCategory, FLIGHT_CATEGORY_COLORS,
} from '@/lib/units';

function formatHour(day: number, hour: number) {
  return `Day ${String(day).padStart(2,'0')} ${String(hour).padStart(2,'0')}:00Z`;
}

function WindRow({ wind }: { wind: TafGroup['wind'] }) {
  if (!wind) return null;
  if (wind.speed === 0) return <span className="text-slate-300">Calm</span>;
  return (
    <span>
      {wind.direction === 'VRB' ? 'Variable' : `${String(wind.direction).padStart(3,'0')}° (${windDirectionToCardinal(wind.direction as number)})`}
      {' at '}<span className="text-orange-300">{wind.speed} kt</span>
      {wind.gust && <span className="text-orange-400"> G{wind.gust} kt</span>}
    </span>
  );
}

function VisRow({ vis }: { vis: TafGroup['visibility'] }) {
  if (!vis) return null;
  const lt = vis.lessThan ? '< ' : vis.moreThan ? '> ' : '';
  return <span>{lt}{vis.value} {vis.unit}</span>;
}

function CloudsRow({ clouds }: { clouds: TafGroup['clouds'] }) {
  const layers = clouds.filter((c): c is CloudLayer => 'cover' in c);
  const clear = clouds.find((c): c is SkyCondition => 'kind' in c);

  if (clear) return <span className="text-green-400">{CLOUD_COVER_LABEL[clear.code]}</span>;
  if (layers.length === 0) return null;
  return (
    <span className="space-y-0.5">
      {layers.map((l, i) => {
        const isCeiling = l.cover === 'BKN' || l.cover === 'OVC' || l.cover === 'VV';
        return (
          <span key={i} className="block">
            <span className={isCeiling ? 'text-orange-400' : 'text-sky-400'}>{CLOUD_COVER_LABEL[l.cover]}</span>
            {' '}
            <span className="text-slate-100">{l.base.toLocaleString()} ft</span>
            {l.type && <span className="ml-1 text-yellow-400 text-xs">{l.type}</span>}
          </span>
        );
      })}
    </span>
  );
}

const GROUP_STYLES: Record<TafGroup['type'], { border: string; label: string; bg: string }> = {
  BASE:  { border: 'border-sky-600',    label: 'Base Forecast',    bg: 'bg-sky-950' },
  FM:    { border: 'border-amber-500',  label: 'From (FM)',        bg: 'bg-amber-950' },
  TEMPO: { border: 'border-violet-500', label: 'Temporary (TEMPO)',bg: 'bg-violet-950' },
  BECMG: { border: 'border-teal-500',   label: 'Becoming (BECMG)', bg: 'bg-teal-950' },
  PROB:  { border: 'border-pink-500',   label: 'Probability',      bg: 'bg-pink-950' },
};

function GroupCard({ group }: { group: TafGroup }) {
  const style = GROUP_STYLES[group.type];
  const cat = flightCategory(group.clouds, group.visibility?.unit === 'SM' ? group.visibility.value : undefined);
  const catColor = FLIGHT_CATEGORY_COLORS[cat];

  return (
    <div className={`rounded-lg border-l-4 ${style.border} ${style.bg} p-4`}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="font-semibold text-slate-200 text-sm">{style.label}</span>
        {group.probability !== undefined && (
          <span className="text-pink-300 text-sm">{group.probability}% chance</span>
        )}
        {group.from && (
          <span className="text-slate-400 text-xs">
            {group.type === 'FM'
              ? `From ${formatHour(group.from.day, group.from.hour)}`
              : `${formatHour(group.from.day, group.from.hour)} – ${group.to ? formatHour(group.to.day, group.to.hour) : '?'}`
            }
          </span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded font-bold ml-auto ${catColor}`}>{cat}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
        {group.wind && (
          <Row label="Wind"><WindRow wind={group.wind} /></Row>
        )}
        {group.visibility && (
          <Row label="Visibility"><VisRow vis={group.visibility} /></Row>
        )}
        {group.weather.length > 0 && (
          <Row label="Weather">
            <span className="text-purple-300">{group.weather.map(w => decodeWeatherCode(w.raw)).join(', ')}</span>
          </Row>
        )}
        {group.clouds.length > 0 && (
          <Row label="Clouds"><CloudsRow clouds={group.clouds} /></Row>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-500 w-24 shrink-0">{label}</span>
      <span className="text-slate-200">{children}</span>
    </div>
  );
}

export default function DecodedTaf({ taf, stationName }: { taf: ParsedTaf; stationName?: string }) {
  return (
    <div className="space-y-3">
      {/* TAF header */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
        <span><span className="text-slate-500">Station:</span> <span className="text-slate-200">{stationName ?? taf.station}</span></span>
        <span>
          <span className="text-slate-500">Issued:</span>{' '}
          {String(taf.issueTime.day).padStart(2,'0')}/{String(taf.issueTime.hour).padStart(2,'0')}:{String(taf.issueTime.minute).padStart(2,'0')}Z
        </span>
        <span>
          <span className="text-slate-500">Valid:</span>{' '}
          {formatHour(taf.validFrom.day, taf.validFrom.hour)} – {formatHour(taf.validTo.day, taf.validTo.hour)}
        </span>
        {taf.amended && <span className="text-yellow-400">AMENDED</span>}
      </div>

      {/* Change groups */}
      <div className="space-y-2">
        {taf.groups.map((group, i) => (
          <GroupCard key={i} group={group} />
        ))}
      </div>

      {/* Legend */}
      <div className="bg-slate-800 rounded-lg p-3">
        <p className="text-xs text-slate-500 mb-1.5 font-semibold uppercase tracking-wide">TAF Change Groups</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-slate-400">
          <span><span className="text-amber-400 font-mono">FM</span> — From: new conditions replace previous, permanently</span>
          <span><span className="text-violet-400 font-mono">TEMPO</span> — Temporary: fluctuating conditions, each lasting &lt;60 min</span>
          <span><span className="text-teal-400 font-mono">BECMG</span> — Becoming: gradual change during the time period</span>
          <span><span className="text-pink-400 font-mono">PROB</span> — Probability of occurrence (30% or 40%)</span>
        </div>
      </div>
    </div>
  );
}
