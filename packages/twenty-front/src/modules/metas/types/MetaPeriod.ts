// Free-text period value: "${TYPE}_${YEAR}_${INDEX}", e.g. "BIMESTER_2026_3".
// Stored as plain TEXT on the backend (not a fixed SELECT list) so any year
// is valid without ever needing another metadata migration.
export type MetaPeriodType = 'SEMESTER' | 'BIMESTER' | 'QUARTER' | 'MONTH';

export type MetaPeriod = {
  type: MetaPeriodType;
  year: number;
  index: number; // 1-based within the year
};

export type MetaPeriodTypeOption = {
  value: MetaPeriodType;
  label: string;
  instancesPerYear: number;
};

export const META_PERIOD_TYPE_OPTIONS: MetaPeriodTypeOption[] = [
  { value: 'SEMESTER', label: 'Semestre', instancesPerYear: 2 },
  { value: 'BIMESTER', label: 'Bimestre', instancesPerYear: 6 },
  { value: 'QUARTER', label: 'Trimestre', instancesPerYear: 4 },
  { value: 'MONTH', label: 'Mês', instancesPerYear: 12 },
];

const MONTH_LABELS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const META_PERIOD_VALUE_PATTERN =
  /^(SEMESTER|BIMESTER|QUARTER|MONTH)_(\d{4})_(\d{1,2})$/;

export const buildMetaPeriodValue = (period: MetaPeriod): string =>
  `${period.type}_${period.year}_${period.index}`;

export const parseMetaPeriodValue = (
  value: string | null | undefined,
): MetaPeriod | null => {
  const match = value?.match(META_PERIOD_VALUE_PATTERN);

  if (!match) {
    return null;
  }

  const [, type, year, index] = match;

  return {
    type: type as MetaPeriodType,
    year: Number(year),
    index: Number(index),
  };
};

export const formatMetaPeriodLabel = (
  value: string | null | undefined,
): string | undefined => {
  const period = parseMetaPeriodValue(value);

  if (!period) {
    return undefined;
  }

  if (period.type === 'MONTH') {
    return `${MONTH_LABELS[period.index - 1]} de ${period.year}`;
  }

  const typeOption = META_PERIOD_TYPE_OPTIONS.find(
    (option) => option.value === period.type,
  );

  return `${period.index}º ${typeOption?.label.toLowerCase()} de ${period.year}`;
};

// Instances offered by the picker for a given period type — a rolling window
// around the current year. Values outside this window (e.g. set via the API
// directly) still parse and display correctly; they just aren't offered as a
// pick here.
export const buildMetaPeriodInstanceOptions = (
  type: MetaPeriodType,
): MetaPeriod[] => {
  const instancesPerYear =
    META_PERIOD_TYPE_OPTIONS.find((option) => option.value === type)
      ?.instancesPerYear ?? 1;
  const currentYear = new Date().getFullYear();
  const years = [
    currentYear - 1,
    currentYear,
    currentYear + 1,
    currentYear + 2,
    currentYear + 3,
  ];

  return years.flatMap((year) =>
    Array.from({ length: instancesPerYear }, (_, index) => ({
      type,
      year,
      index: index + 1,
    })),
  );
};
