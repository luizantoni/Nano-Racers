# Mini RC Drift Club

A Decentraland SDK7 kart scene and a local browser playtest sharing the driving physics, track, upgrade rules, and race state machine.

## Play the local preview

Run `npm run build:preview`, then `npm run preview`. Open http://127.0.0.1:4173.

Take a seat. W accelerates, S brakes, A/D steer, Space holds a drift, and releasing Space activates the earned boost. C switches between chase and overview cameras. Touch controls appear on touch devices.

Use **Add 3 bots** to test a race alone. Ready up, vote for 3/5/7 laps, and wait for the countdown. Bots exist only in the preview. Other tabs on the same origin join the local room through BroadcastChannel; this is not Internet multiplayer. Finishers receive 100 credits plus a placement bonus of up to 80. Buy motor, tire, and battery upgrades in the garage between races. The browser saves its garage locally.

## Decentraland scene

Open this folder in Creator Hub, or run `npm start` and launch the desktop Explorer preview. Run `npm run build` to compile. The scene uses four parcels: 0,0 / 0,1 / 1,0 / 1,1. These are local coordinates, not a claim of deployment rights.

Static content is authored in `assets/scene/main.composite`; SDK 7.27 loads that asset explicitly. `scripts/generate-assets.mjs` regenerates the circuit and six kart liveries from the shared track. Do not regenerate while editing those generated assets in Creator Hub.

The SDK scene uses MessageBus peer synchronization, automatic coordinator election, repeated state announcements for late arrivals, ready checks, lap voting, countdowns, ghost practice, light bumps, results, and session upgrade currency. A player takes one of 20 table stations and the virtual camera follows their RC kart, including upside down. Motor upgrades approach a fixed +10% top-speed ceiling. Tire and battery caps, costs, and race timers are implementation defaults documented in `design/build-notes.md`.

## Verification

- `npm test`: road frame continuity, inverted poses, three-lap completion, drift tiers, upgrade cap/costs, bump bounds, vote ties, and a 20-peer race lifecycle.
- `npm run build`: SDK bundle and TypeScript checks.
- `npm run assets`: regenerate low-poly assets. Run `node scripts/generate-audio.mjs` for the original synthesized boost effect.

## Current limits

This is a first playable build, not a certified AAA-quality release. The desktop Explorer camera, seated avatar emote, GLB coordinate conversion, touch UI, network latency, and performance with 20 real players require runtime testing. Automated peers do not establish real-world multiplayer capacity.

SDK garage progress currently lasts one scene session. Durable authenticated progression, server-authoritative race results and anti-cheat, production hosting, and deployment remain unfinished. Peer-reported results are appropriate for a cooperative playtest, not a secure economy. No external service or public deployment was created.

The browser preview shares the road and driving model but uses Three.js; its successful rendering does not prove Decentraland runtime behavior. Cosmetic customization currently consists of six body colors and three functional part upgrades; distinct visible part models are not yet implemented.

## Source references

Official SDK references downloaded into `reference/` were used for implementation. Reference `.composite` files have a `.reference` suffix to prevent SDK 7.27's recursive compiler discovery from merging example scenes into this project. References, design files, and browser tooling are excluded from scene deployment through `.dclignore`.
