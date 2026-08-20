# Deadly Assault current UI data contract

This contract covers only fields consumed by the current Deadly Assault fixture,
validator, build, and renderer. It is not a general Zenless Zone Zero mechanics
model.

## Encounter mode

The existing `encounters[].category` field is authoritative for grouping:

- `standard` renders as the official label `Trial Mode`.
- `adversity` renders as the official label `Adversity Mode`.

No second mode field is permitted.

## Text annotation kind

`buffs[].segments` and `encounters[].mechanicSegments` annotate reviewed source
text for presentation. Each annotation is `[start, end, kind]`, where `start`
and `end` are non-overlapping string offsets and `kind` is exactly one of:

- `quantity`
- `attribute`
- `specialty`
- `mechanic`
- `effect-term`

These values do not model buff/debuff polarity, effect direction, targets,
stacking, or game relationships. The reviewed description remains the mechanics
record. Add another annotation kind only when the current renderer has a named
distinction it cannot present with this set.

## Specialty fit

`encounters[].specialtyFit` is either `null` or:

```json
{
  "specialty": "Anomaly",
  "reason": "Suitable for Agents with Anomaly specialty."
}
```

`specialty` must be a currently supported Specialty and `reason` must be the
non-empty reviewed wording derived from the encounter source. The encounter's
existing `sourceRefs` provide scope and provenance; they are not duplicated
inside `specialtyFit`.

Observed character-use aggregates must never populate `specialtyFit`.
