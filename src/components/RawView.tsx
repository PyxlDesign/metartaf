'use client';
import type { MetarToken, MetarTokenType } from '@/lib/metar-parser';
import type { TafToken, TafTokenType } from '@/lib/taf-parser';

type AnyToken = (MetarToken | TafToken) & { type: MetarTokenType | TafTokenType };

const TOKEN_COLORS: Record<string, string> = {
  station:      'text-blue-400 font-bold',
  time:         'text-slate-400',
  modifier:     'text-yellow-400',
  prefix:       'text-yellow-400',
  wind:         'text-orange-400',
  windVar:      'text-orange-300',
  visibility:   'text-yellow-300',
  rvr:          'text-cyan-400',
  weather:      'text-purple-400',
  clouds:       'text-sky-400',
  tempDew:      'text-rose-400',
  altimeter:    'text-green-400',
  rmkLabel:     'text-slate-500 font-semibold',
  remarks:      'text-slate-500',
  validPeriod:  'text-slate-400',
  groupFM:      'text-amber-400 font-semibold',
  groupTEMPO:   'text-violet-400 font-semibold',
  groupBECMG:   'text-teal-400 font-semibold',
  groupPROB:    'text-pink-400 font-semibold',
  nsw:          'text-purple-300',
  unknown:      'text-slate-400',
};

export function RawMetarView({ tokens }: { tokens: MetarToken[] }) {
  return <TokenDisplay tokens={tokens} />;
}

export function RawTafView({ tokens }: { tokens: TafToken[] }) {
  return <TokenDisplay tokens={tokens as AnyToken[]} />;
}

function TokenDisplay({ tokens }: { tokens: AnyToken[] }) {
  return (
    <div className="font-mono text-sm bg-slate-900 rounded-lg p-4 leading-7 select-text">
      {tokens.map((tok, idx) => (
        <span key={idx}>
          <span
            title={tok.tooltip}
            className={`cursor-help underline decoration-dotted decoration-slate-600 ${TOKEN_COLORS[tok.type] ?? 'text-slate-300'}`}
          >
            {tok.text}
          </span>
          {idx < tokens.length - 1 && <span className="text-slate-600"> </span>}
        </span>
      ))}
    </div>
  );
}
