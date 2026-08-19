# Deadly Assault boss character trends

This fixture is a descriptive collection of observed submitted/public-profile
Deadly Assault clears. It contains no team, build, or other recommendations,
and never retains row-level records or `uid` values.

## Input contract

The importer accepts an options object with one pinned `current` descriptor and
one explicit mapping plus pinned `prior` descriptor/mapping for every boss:

```js
{
  current: {
    input: Buffer, sourceRevision: '<40 hex>', sourceSha256: '<64 hex>',
    sourceFile: 'current.csv', sourceUrl: 'https://example.test/blob/revision/current.csv',
    retrievedAt: '2026-08-19T12:00:00Z',
    version: '3.2', phase: 'Phase 2'
  },
  suppressionThreshold: 10,
  bosses: [{
    canonicalId: 'boss-id', displayName: 'Display name',
    currentSourceName: 'Name in current CSV',
    prior: {
      input: Buffer, sourceRevision: '<40 hex>', sourceSha256: '<64 hex>',
      sourceFile: 'prior.csv', sourceUrl: 'https://example.test/blob/revision/prior.csv',
      retrievedAt: '2026-08-19T12:00:00Z',
      version: '3.1', phase: 'Phase 1', sourceName: 'Name in prior CSV'
    }
  }]
}
```

Every source is checked against its exact SHA-256, pinned revision, and
inspectable HTTP(S) `sourceUrl`. The CSV header must be exactly:

```text
uid,floor,star,score,boss,buff,ch1,ch1_rank,ch2,ch2_rank,ch3,ch3_rank,bangboo,rank_percent
```

All current CSV boss names must be mapped exactly once. Each mapped prior name
must be present in its own prior source. Duplicate canonical IDs, display
names, or current source names; missing mappings; schema drift; bad pins; and
malformed included rows are rejected. Rows without all three character fields
are excluded and counted, not retained.

The CLI reads paths from a JSON config and writes the collection to the path
given by `--output`:

```sh
npm run import:da-boss-character-trends -- --config config.json --output data/da-boss-character-trends.json
```

The config uses the same descriptor fields, replacing each `input` with
`inputPath`. A prior descriptor is nested under its boss's `prior` key.

## Output contract

The root has `schemaVersion`, `cohortLabel`, descriptive `methodology`, and a
non-empty `bosses` array. Each boss has a unique `canonicalId`, `displayName`,
and `currentSourceName`, a `status` (`live` or `suppressed`), a comparison of
kind `previous-observed-appearance`, and exactly two phases in `[prior,
current]` order.

Each phase owns its `provenance` (including an immutable inspectable HTTP(S)
`sourceUrl`), `inputRows`, `excludedRows`, `sampleSize`, and aggregate
`characters`. `inputRows` equals `excludedRows + sampleSize`.
Character rows are sorted by `clearCount` descending then name ascending,
with each character counted at most once per clear. `appearanceRate` is
`clearCount / sampleSize`; prior characters have
`priorAppearanceChange: null`, while current characters contain the exact
current rate minus prior rate (zero when absent previously).

When either phase's sample is below the suppression threshold, the boss is
suppressed and both phase character arrays are withheld. The default threshold
is 10.
