# Dance motion capture

`dance-motions.json` is derived from **G1 Moves**, published by
Experiential Technologies / Mitch Chaiet (2026). Human dance performer:
**Jasmine Coro**. License: **CC BY 4.0**.

- Dataset and license: https://huggingface.co/datasets/exptech/g1-moves
- Dataset card with performer credits: https://huggingface.co/datasets/exptech/g1-moves/blob/main/README.md
- License text: https://creativecommons.org/licenses/by/4.0/legalcode.en
- Pinned dataset revision: `895d064b2385725e6aabf540461c219afc3e0916`

| Application character | Original capture |
| --- | --- |
| Sakura | LushLife, Sassy, SingleLadies, Gnarly, Salsa, MidnightSun, Thrilling, Party |
| Yuki | MidnightSun, Salsa, LushLife, SingleLadies, Broadway, Sassy, Shuffle, Thrilling, Gnarly |
| Akira | Woah, Blunt, DWG, Shuffle, LetsGO, WestCoast, Hype, Gnarly, Nineties |
| Luna | Sassy, SingleLadies, MidnightSun, LushLife, Salsa, Broadway, Gnarly, Shuffle |
| Hikari | WestCoast, Woah, Nineties, Blunt, Shuffle, DWG, LetsGO, Hype |

Modifications: body-specific windows selected from 17 captures, excluding low
energy idle sections; sixteen phrases combined into each 128-count routine at
an authored 140 BPM; resampled to 30 FPS; mapped to VRM humanoid joints;
recentered facing and bounded travel; 0.5s pre-roll crossfades; quaternion
denoising and angular step limits; authored hip figure-eight, delayed torso
waves, rib/shoulder isolations, chest hits, heel/toe swivels and knee accents;
per-foot contact confidence and baked two-bone plant IK retaining ankle
orientation and captured flight; procedural wrist/finger articulation.
Female profiles are Sensual Club, Silk Flow and Midnight Vogue; male profiles
are Cold Pop and Liquid Lock. Each signature is a separate
12-count, three-phrase sequence that plays once and holds its ending pose.
The underlying dance motions are captured from people, not from the robot
retarget or RL policy files in the dataset. The app's choreography and finish
additions are original runtime adaptations, not animation data from Audition.

Each source URL and source SHA-256 are retained in `dance-motions.json`.
Run `node scripts/prepare-dance-motions.mjs` to regenerate the derived asset.
Normal build/runtime uses the checked-in JSON, with no dataset network access.
