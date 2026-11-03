# Club dancer

## Current anime cast

`anime-dancer.vrm` is `VRM1_Constraint_Twist_Sample`, (c) 2022 pixiv Inc.

- Source: https://github.com/pixiv/three-vrm/blob/dev/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm
- Sample documentation: https://github.com/vrm-c/vrm-specification/tree/master/samples/VRM1_Constraint_Twist_Sample
- License: VRM Public License 1.0, https://vrm.dev/licenses/1.0/
- Original embedded license settings and downloaded file checksum are recorded
  in `LICENSE-anime-dancer.json`. The embedded metadata is retained in the file.
  It permits avatar use by everyone, commercial use including corporations,
  redistribution, modification and redistribution of modified models. Hateful
  or antisocial usage is not allowed, as specified in that metadata.

The female characters Sakura, Yuki and Luna use this model, with runtime hair
variants, tailored 3D clothes, accessories, choreographies and signature effects.

`anime-male.vrm` is pixiv / VRoid Project's **HairSample_Male**, CC0 1.0.
It provides a separate male face, body, short hair and full-length trousers
for Akira and Hikari. It is not the female model recolored as a male avatar.

- Source mirror: https://github.com/madjin/vrm-samples/blob/master/vroid/beta/HairSample_Male.vrm
- Creator's license statement: https://vroid.pixiv.help/hc/en-us/articles/4402614652569-Do-VRoid-Studio-s-sample-models-come-with-conditions-of-use
- CC0: https://creativecommons.org/publicdomain/zero/1.0/
- Embedded license and file checksum: `LICENSE-anime-male.json`.

The application creates the clothing/accessory additions at runtime in
`frontend/anime-characters.js` and `frontend/character-costumes.js`.
They are not characters or assets extracted from Audition or another game.

The VRM loader and MToon renderer use `@pixiv/three-vrm`, MIT license:
https://github.com/pixiv/three-vrm/blob/dev/LICENSE

Dance animations now use human motion capture from G1 Moves, performed by
Jasmine Coro, published by Experiential Technologies / Mitch Chaiet, CC BY 4.0.
Sources, modifications and individual capture names: [dance credits](../animations/ATTRIBUTION.md).

## Previous model (retained for reference)

`club-dancer.glb` is HVGirl from the Babylon.js Assets repository.

- Source: https://github.com/BabylonJS/Assets/blob/master/meshes/HVGirl.glb
- Download: https://assets.babylonjs.com/meshes/HVGirl.glb
- Attribution: Babylon.js contributors / Babylon.js Assets.
- License: Creative Commons Attribution 4.0 International, as specified by
  https://github.com/BabylonJS/Assets. A copy is in `LICENSE-HVGirl.txt`.

The application changes clothing/hair material colors, scale and animation
playback at runtime. The character is a stylized humanoid; it is not an asset
extracted from Audition.
