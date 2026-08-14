# zzz deadly assault cycle brief

This static site publishes the current Deadly Assault rotation from the GPLv3 project [spiritfxxxx/buhflipexplode](https://github.com/spiritfxxxx/buhflipexplode). The updater resolves upstream `main` to an immutable commit SHA, fetches the four source files at that SHA, calculates HP, maps elemental multipliers, and strips HTML from buff descriptions before atomically writing `data/current.json`.

## local checks

```sh
npm install
npm run update:data
npm test
npm run validate
npm run build
npm run test:e2e
```

`npm run update:data` fails explicitly on network, upstream schema, missing IDs, or an unavailable current cycle. The Pages workflow runs it before strict validation on push, schedule, and manual dispatch; any failure blocks deployment. Only a strictly validated `dist/` directory is uploaded.

The four HP values are calculated with `floor((stage===4?15.8:8.74)*versionHPMult[i]*enemy.baseHP[type]*24795/10000)`. Each encounter carries rotation, enemy, and formula provenance; the three selectable buffs are modeled once at cycle level with buff provenance. Sources use immutable GitHub URLs and the resolved commit SHA.

The design uses original typography, color, and layout primitives and includes no copied game artwork. Upstream-derived code/data are covered by GPLv3; see [LICENSE](LICENSE).
