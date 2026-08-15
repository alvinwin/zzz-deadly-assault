# zzz deadly assault cycle brief

## purpose

This static site publishes the current Deadly Assault rotation.

It uses source from the GPLv3 project [spiritfxxxx/buhflipexplode](https://github.com/spiritfxxxx/buhflipexplode).

This is a modified version of the upstream work. Copyright 2026 Alvin Nguyen is
claimed only for his original human-authored modifications and original
selection, coordination, and arrangement. Upstream-derived material keeps its
original copyright and GPLv3 license. This notice makes no copyright claim for
purely AI-generated material. This modified work is licensed under GPLv3. The
repository contains the related source and the complete license text in
[LICENSE](LICENSE).

## product hierarchy

`Inter-Knot Brief` is the planned parent entrypoint. `Deadly Assault` and
`Shiyu Defense` are separate mode surfaces beneath it. This repository currently
owns only the Deadly Assault surface. Do not merge mode-specific data, schema,
or update logic merely to create the shared entrypoint. Building Shiyu Defense
is deferred until its own source trace and requirements exist.

## update data

Run `npm run update:data` to update `data/current.json`.

The updater resolves upstream `main` to an immutable commit SHA. A commit SHA
is a fixed identifier for one source version. The updater then fetches three
data files at that version. It uses the documented upstream formula to
calculate HP. It maps elemental multipliers and removes HTML from buff
descriptions. It writes the result to a temporary file and then atomically
replaces `data/current.json`.

The command fails on a network error, an upstream schema error, a missing ID, or
an unavailable current cycle.

## local checks

Run these commands in this order:

```sh
npm install
npm run update:data
npm test
npm run validate
npm run build
npm run check:budget
npm run test:e2e
```

## continuous integration

The GitHub Pages workflow runs in three cases:

- A push to `main` starts the workflow.
- A schedule starts it at minute 17 of every six-hour period.
- A manual dispatch starts it on request.

The workflow runs `npm run update:data` before strict validation. It runs the
tests, validation, build, and budget check. Any failed step blocks deployment.
Only a strictly validated `dist/` directory is uploaded. The deploy job runs
only after the build job succeeds.

## size limit and provenance

`npm run check:budget` keeps the complete uncompressed `dist/` output, including
current data, under 16 KiB. The site is well below this limit.

The four HP values use this exact formula:

`floor((stage===4?15.8:8.74)*versionHPMult[i]*enemy.baseHP[type]*24795/10000)`

Each encounter includes rotation, enemy, and formula provenance. The three
selectable buffs are modeled once at cycle level and include buff provenance.
The sources use immutable GitHub URLs and the resolved commit SHA.

## design and ownership

The design uses original typography, colors, and layout primitives. It includes
no copied game artwork.

Zenless Zone Zero and related names belong to their respective owners. This fan
project is not affiliated with or endorsed by HoYoverse.
