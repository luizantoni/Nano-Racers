# H1-01 — Inverted driving

**IF/THEN:** IF the circuit uses automatic grip and a kart-relative chase camera, THEN the owner can complete one lap without stopping because the inverted view is unusable.
**Source section:** Core Loop; World, Look & Story
**Cheapest killing test:** Desktop Explorer, owner drives one lap through the vertical loop.
**Key metric:** Completed laps without a camera-usability stop.
**Mobile-sensitive:** yes
**Tested on:** automated simulation and browser visual smoke only; desktop Explorer pending
**Created:** 2026-09-07

## Brief

The pre-build criterion is also recorded in build-notes.md: the shared simulation must complete three laps without non-finite poses, escaping road boundaries, or a seam reset. This is mechanical verification, not evidence of fun or camera comfort.

Criterion (external): one completed lap with zero stops attributed to an unusable inverted view. Failure means the tester must stop because they cannot use the camera through the loop.

Kill-check (owner-testable): drive a lap and decide whether the rotating chase camera remains usable. The owner supplies the feel verdict. Automated simulation cannot close it.

The owner explicitly requested building the game, superseding the skill's greybox-only scope. Source, generated assets, SDK adapter, race rules, garage, and browser preview are in the current project.

## Sessions

- 2026-09-07 · Smoke: browser preview visibly loaded the generated circuit, entered a table slot, accepted ready input, showed lap voting with three preview bots, then entered the race with a chase camera. No sustained human driving test was performed.
- 2026-09-07 · Mechanical checks: seven test groups passed, including three laps, inverted orthonormal frames, all drift tiers, upgrade bounds, 20 simulated peers, late arrivals, and once-only rewards for the last finisher.
- 2026-09-07 · SDK bundle and TypeScript checks passed. Dependency declaration checking uses skipLibCheck because @dcl/js-runtime 7.27.0 contains unresolved relative type references; project source remains strictly checked.

## Verdict

Pending owner driving test in desktop Explorer. No fun, comfort, or real 20-player capacity verdict has been awarded.
