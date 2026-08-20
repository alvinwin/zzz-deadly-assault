export const strictIsoTimestamp = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  const withoutZulu = value.slice(0, -1);
  const [whole, fraction = ''] = withoutZulu.split('.');
  const canonical = `${whole}.${fraction.padEnd(3, '0')}Z`;
  return new Date(parsed).toISOString() === canonical ? parsed : null;
};

const toMilliseconds = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  return strictIsoTimestamp(value);
};

export const formatCycleRemaining = (endsAt, now = Date.now()) => {
  const endsAtMs = toMilliseconds(endsAt);
  const nowMs = toMilliseconds(now);
  if (endsAtMs === null || nowMs === null) return 'Status unavailable';
  if (nowMs >= endsAtMs) return 'Refresh pending';

  const minutes = Math.ceil((endsAtMs - nowMs) / 60000);
  if (minutes >= 1440) {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    return `${days}d ${hours}h remaining`;
  }
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours}h ${remainder}m remaining` : `${hours}h remaining`;
  }
  return `${Math.max(1, minutes)}m remaining`;
};

export const cycleStatusFromData = data => ({
  schemaVersion: 1,
  mode: 'deadly-assault',
  status: 'current',
  startsAt: data?.cycle?.startsAt,
  endsAt: data?.cycle?.endsAt,
  checkedAt: data?.cycle?.checkedAt,
});

export const validateCycleStatus = status => {
  const errors = [];
  if (status?.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (status?.mode !== 'deadly-assault') errors.push('mode must be deadly-assault');
  if (status?.status !== 'current') errors.push('status must be current');
  for (const field of ['startsAt', 'endsAt', 'checkedAt']) {
    if (toMilliseconds(status?.[field]) === null) errors.push(`${field} must be a valid ISO date`);
  }
  const startsAtMs = toMilliseconds(status?.startsAt);
  const endsAtMs = toMilliseconds(status?.endsAt);
  if (startsAtMs !== null && endsAtMs !== null && startsAtMs >= endsAtMs) errors.push('startsAt must be before endsAt');
  return errors;
};
