const CAMPUS_LABEL_MAP: Record<string, string> = {
  xianlin: '仙林',
  gulou: '鼓楼',
  suzhou: '苏州',
  pukou: '浦口',
  suzhou_campus: '苏州',
};

function mapScalarValue(key: string | undefined, label: string | undefined, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const text = String(value);
  if (key === 'campus' || label === '校区') {
    return CAMPUS_LABEL_MAP[text.toLowerCase()] || text;
  }
  return text;
}

export function formatCardDisplayValue(
  module: { key?: string; moduleKey?: string; label?: string; value?: unknown },
  emptyText = '—',
): string {
  const key = module.key || module.moduleKey;
  const label = module.label;

  if (Array.isArray(module.value)) {
    const values = module.value
      .map((item) => mapScalarValue(key, label, item))
      .filter(Boolean);
    return values.length > 0 ? values.join('、') : emptyText;
  }

  if (module.value && typeof module.value === 'object') {
    const values = Object.values(module.value as Record<string, unknown>)
      .map((item) => mapScalarValue(key, label, item))
      .filter(Boolean);
    return values.length > 0 ? values.join('、') : emptyText;
  }

  return mapScalarValue(key, label, module.value) || emptyText;
}
