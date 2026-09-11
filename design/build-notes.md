# Build scope and implementation choices

The owner requested the game build after approving motor, tires, and battery parts. Building in the current session is authorized. The prototype skill's greybox-only scope is superseded by the owner's finished-scene request.

Implementation defaults (agent choices, tune after testing): 2.5 m track width; 7 m/s base speed; drift thresholds 0.65 / 1.5 / 2.6 seconds; 3/5/7 lap vote ties resolve to the shorter race; 100 completion credits plus up to 80 placement credits. Performance gain follows 0.10 × (1 − exp(−level/35)); top speed never exceeds the +10% ceiling from permanent upgrades. Temporary drift boosts are separate. Tires and batteries provisionally use the same 10% diminishing-return curve.

Quality and 20-player capacity remain unverified until desktop Explorer playtests. The browser preview is a local driving/art preview, not evidence of SDK runtime or multiplayer compatibility. Peer networking and any session-only progression must be clearly distinguished from production persistence.

## Initial verification criterion

Before building: shared driving simulation must complete three continuous laps, including inverted track, without non-finite poses, leaving the road boundaries, or a seam reset. Owner kill-check: drive a lap, use all three boost tiers, and decide whether the rotating chase camera remains usable. No fun verdict will be inferred from automated checks.
