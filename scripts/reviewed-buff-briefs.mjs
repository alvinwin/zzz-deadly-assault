import { createHash } from 'node:crypto';

export const reviewedBuffBriefs = {
  '69000066': {
    brief: {
      who: 'Squads with 2–3 Anomaly Agents',
      trigger: 'Build the squad; inflict an Attribute Anomaly',
      payoff: 'More Anomaly Proficiency and Attribute Anomaly DMG; the trigger lowers All-Attribute RES',
    },
    fingerprint: 'e45ad38b206496d662681245e64f498087f99997ff384582f82d64ed169024e9',
  },
  '69000068': {
    brief: {
      who: 'Attack Agents',
      trigger: 'Hit with Basic, EX Special, or Chain Attacks; hit a Stunned enemy',
      payoff: 'More ATK, Ice/Ether RES ignore, and Stun DMG Multiplier',
    },
    fingerprint: 'e4dd528a00ae2b96d3c88956802d1f86a3fc980e24f3cb91174410e16eeb6144',
  },
  '69000055': {
    brief: {
      who: 'Rupture Agents',
      trigger: 'Enter Ether Veil; keep hitting the enemy',
      payoff: 'More Sheer and Ether DMG, faster Miasma Shield removal, and more Stun DMG Multiplier',
    },
    fingerprint: '43477834c83536a3e86021944e557162edf10612b2274d535a852442ebfa00fb',
  },
};

export const buffSourceFingerprint = description => createHash('sha256').update(String(description ?? '').replace(/\s+/g, ' ').trim()).digest('hex');

const briefsMatch = (actual, expected) => actual && typeof actual === 'object' && !Array.isArray(actual) && Object.keys(expected).every(key => actual[key] === expected[key]) && Object.keys(actual).length === Object.keys(expected).length;

export const reviewedBuffBriefFor = (id, description) => {
  const review = reviewedBuffBriefs[id];
  if (!review) throw new Error(`missing reviewed buff brief coverage for ${id}`);
  const fingerprint = buffSourceFingerprint(description);
  if (fingerprint !== review.fingerprint) throw new Error(`reviewed buff brief source fingerprint changed for ${id}`);
  return { brief: review.brief, briefReview: 'reviewed', briefSourceSha256: fingerprint };
};

export const isCanonicalReviewedBuff = buff => {
  const review = reviewedBuffBriefs[buff?.id];
  if (!review) return false;
  const fingerprint = buffSourceFingerprint(buff?.description);
  return buff?.briefReview === 'reviewed'
    && buff?.briefSourceSha256 === review.fingerprint
    && fingerprint === review.fingerprint
    && briefsMatch(buff?.brief, review.brief);
};
