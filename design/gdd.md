*Work in progress · grown from `gdd-template.md`*
*Doc: ░░░░░░░░░░ · Concept · Core Loop, Social by Design, and World, Look & Story in progress · Other sections not discussed yet.*

# Mini RC Kart [agent-decided]

## 3. Core Loop

The first version focuses on driving, drifting, and overtaking. No weapons or item pickups are included for now; drift-earned boosts remain part of driving.

Customization parts: motor changes top speed, tires change handling, and battery changes drift-boost duration. [agent-decided · accepted]

A first playable implementation now exists in this folder, with a Decentraland SDK scene and a local browser preview. Automated mechanical checks pass; usability of the inverted chase camera remains untested by the owner. [HYPOTHESIS: H1-01]

Karts have different speed and handling characteristics. Players can customize their karts, and equipped parts change performance as well as appearance. Progressively stronger upgrades are earned through racing: every completed race awards upgrade currency, with an additional bonus based on finishing position. [agent-decided · accepted] Performance progression is long and has diminishing returns toward a fixed cap: each upgrade adds less, with differences between successive high-level upgrades tending toward zero. The top-speed upgrade ceiling is 10% above the kart's starting top speed. Part categories, other stat effects and caps, reward amounts, and the progression curve are not yet decided.

| # | Step (verb) | What the player does (Player input → what they see or hear → what changes) | Why do it again? |
|---|---|---|---|
| 1 | Join | Take a table seat; the camera switches to the miniature RC kart. Practice as a non-colliding ghost on the circuit, or watch the race. | Learn the circuit while waiting. |
| 2 | Ready and vote | Ready up and vote for 3, 5, or 7 laps. With at least two ready players, the race starts automatically after a short countdown. | Enter a race with other ready players. |
| 3 | Race | Steer around the climb-and-descend circuit. Hold the drift button while steering to build one of three boost charge levels; longer drifts earn stronger boosts. Visible sparks change color as charge levels are reached. Release to activate the earned boost; releasing before the first level gives no boost. [agent-decided · accepted] Contact produces light bumps. | Compete to finish first. |
| 4 | Finish and rejoin | Complete the required laps and earn upgrade currency plus a placement bonus. View placement and best lap, then return to practice. Ready up again to enter another race. Results screen and return to practice: [agent-decided]. | Earn progressively stronger kart upgrades. |

| | |
|---|---|
| **One complete loop takes** | Races last three or more laps of the climb-and-descend circuit. Players vote before the race: three laps by default, with five or seven available. [agent-decided · accepted] The first kart to complete the required laps wins. Race duration is not yet decided. |
| **Decision, challenge, or expression** | Accessible arcade drifting: easy steering, controlled slides, and a small speed boost for a well-timed drift. Kart-to-kart contact produces light bumps, without hard spins or pushing opponents off the track. Vertical loops are driveable, with assisted steering through the loop. [agent-decided · accepted] Automatic grip keeps karts attached through loops even at low speed; slow entry does not cause a fall or reset. |
| **Shortest satisfying visit / typical session** | |
| **Why repetition 10 differs from repetition 1** | |

## 5. Social by Design

| | |
|---|---|
| **The repeatable social loop** | Players ready up and vote for the lap count. The race starts automatically with ready players after a short countdown; no host is required. After each race, players must ready up again to enter the next race. |
| **The disappearance test** | |
| **From strangers to a group** | |
| **Recognition & continuity** | |
| **Quiet hours & player counts** | Target capacity: up to 20 racers per race. Players can practice driving while waiting; automatic races require at least two ready players. [agent-decided · accepted] Tested maximum: TBD: not discussed yet. Ideal group size is not yet decided. |
| **Drop-in / drop-out** | Late arrivals choose to practice driving or watch the current race, then join the next race. Practice uses the same circuit with visually distinct ghost karts that do not collide with racers. [agent-decided · accepted] How departures during a race are handled is not yet decided. |
| **Visible play (the bystander test)** | |
| **Shareable play (the memorable moment)** | |
| **Bring-a-friend** | |

## 7. World, Look & Story

**Story / world**

Players sit at table slots and control miniature RC karts, with the camera switching to their kart. The continuous circuit climbs through intertwined turns, then descends back to the starting level, fitting more racing length inside a 2×2 scene.

The chase camera rotates with the kart through vertical loops, including upside down.

**Visual direction.**

Low-poly aesthetics. The owner's quality target is a finished scene with “AAA quality”; this is an ambition, not a verified quality level. The defining visual is a compact, vertically tangled miniature kart track.

Owner-supplied visual reference: `download (7).png`, attached in the conversation. A colorful toy-track tower with stacked sweeping turns, spiral ramps, chunky geometric supports, protective rails, neon trim, and cyan, magenta, purple, and yellow track surfaces. Adapt this visual language to low-poly assets. Vertical loops are confirmed driveable features; the reference's steep stunt ramps are not yet confirmed gameplay features.
