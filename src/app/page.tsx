'use client';
import { useState, useRef, FormEvent } from 'react';
import type { ApiWeatherResponse } from '@/lib/types';
import WeatherDisplay from '@/components/WeatherDisplay';

const EXAMPLES = ['KIPT', 'KORD', 'KJFK', 'KLAX', 'KSFO', 'KDEN', 'KBOS', 'KMIA'];

export default function Home() {
  const [input, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<ApiWeatherResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function lookup(station: string) {
    const s = station.trim().toUpperCase();
    if (!s) return;
    setValue(s);
    setLoading(true);
    setError('');
    setData(null);

    try {
      const res = await fetch(`/api/weather?station=${encodeURIComponent(s)}`);
      const json: ApiWeatherResponse = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    lookup(input);
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <span className="text-sky-400 font-bold text-lg tracking-tight">METAR/TAF</span>
          <span className="text-slate-500 text-sm hidden sm:inline">Aviation Weather Practice Reader</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Search */}
        <div className="max-w-lg mx-auto">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setValue(e.target.value.toUpperCase())}
              placeholder="Airport code (e.g. KIPT)"
              maxLength={4}
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono text-lg uppercase"
              autoFocus
              aria-label="Airport ICAO code"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              {loading ? '…' : 'Look Up'}
            </button>
          </form>

          {/* Quick examples */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-xs text-slate-500 self-center">Try:</span>
            {EXAMPLES.map(code => (
              <button
                key={code}
                onClick={() => lookup(code)}
                className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded font-mono transition-colors cursor-pointer"
              >
                {code}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="max-w-lg mx-auto bg-red-950 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center text-slate-400 text-sm py-8">
            Fetching weather data…
          </div>
        )}

        {/* Results */}
        {data && !loading && <WeatherDisplay data={data} />}

        {/* Help text when empty */}
        {!data && !loading && !error && (
          <div className="max-w-2xl mx-auto text-center space-y-3 py-8">
            <p className="text-slate-400">Enter a 4-letter ICAO airport code to retrieve live METAR and TAF data.</p>
            <div className="text-xs text-slate-600 space-y-1">
              <p>Use the <span className="text-slate-400 font-semibold">Raw</span> view to read reports as pilots receive them.</p>
              <p>Use <span className="text-slate-400 font-semibold">Decoded</span> to see each field explained with plain-English meanings.</p>
              <p>Use <span className="text-slate-400 font-semibold">Side by Side</span> to compare raw and decoded together.</p>
              <p className="pt-2">Hover over any token in the raw view for a quick tooltip.</p>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800 mt-16 py-4 text-center text-xs text-slate-600">
        Weather data from{' '}
        <span className="text-slate-500">aviationweather.gov</span>
        {' '}· For training purposes only · Not for navigation
      </footer>
    </div>
  );
}
