export type ViewMode = 'raw' | 'decoded' | 'side-by-side';
export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR';

export interface CloudLayer {
  cover: 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'VV';
  base: number; // feet AGL
  type?: 'CB' | 'TCU';
}

export interface SkyCondition {
  kind: 'clear';
  code: 'SKC' | 'CLR' | 'CAVOK' | 'NSC' | 'NCD';
}

export interface WindInfo {
  direction: number | 'VRB';
  speed: number;
  gust?: number;
  unit: 'KT' | 'MPS';
  variableFrom?: number;
  variableTo?: number;
}

export interface Visibility {
  value: number;
  unit: 'SM' | 'M';
  lessThan?: boolean;
  moreThan?: boolean;
}

export interface WeatherCode {
  intensity?: '+' | '-' | 'VC';
  descriptor?: string;
  phenomena: string[];
  raw: string;
}

export interface ParsedMetar {
  raw: string;
  station: string;
  time: { day: number; hour: number; minute: number };
  auto: boolean;
  correction: boolean;
  wind?: WindInfo;
  visibility?: Visibility;
  rvr?: Array<{ runway: string; min: number; max?: number; lessThan?: boolean; moreThan?: boolean }>;
  weather: WeatherCode[];
  clouds: Array<CloudLayer | SkyCondition>;
  temperature?: number;
  dewpoint?: number;
  altimeter?: { value: number; unit: 'inHg' | 'hPa' };
  remarks?: string;
}

export interface TafGroup {
  type: 'BASE' | 'FM' | 'TEMPO' | 'BECMG' | 'PROB';
  probability?: number;
  from?: { day: number; hour: number; minute?: number };
  to?: { day: number; hour: number };
  wind?: WindInfo;
  visibility?: Visibility;
  weather: WeatherCode[];
  clouds: Array<CloudLayer | SkyCondition>;
}

export interface ParsedTaf {
  raw: string;
  station: string;
  issueTime: { day: number; hour: number; minute: number };
  validFrom: { day: number; hour: number };
  validTo: { day: number; hour: number };
  groups: TafGroup[];
  amended?: boolean;
}

export interface ApiWeatherResponse {
  stationName?: string;
  stationElev?: number;
  metarRaw?: string;
  tafRaw?: string;
  error?: string;
}
