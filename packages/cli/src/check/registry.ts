import type { Detector } from './types.js';
import { gradientText } from './detectors/gradient-text.js';
import { backdropBlur } from './detectors/backdrop-blur.js';
import { pureBlackWhite } from './detectors/pure-black-white.js';
import { contrastFloor } from './detectors/contrast-floor.js';
import { focusRemoved } from './detectors/focus-removed.js';
import { hardcodedValue } from './detectors/hardcoded-value.js';
import { violetBandHue } from './detectors/violet-band-hue.js';

/**
 * Every detector `check` knows how to run, keyed by the `detector` name
 * `rules.index.json` uses to name it. A rule in the index naming a detector
 * NOT in this map is skipped silently by the runner — the index describes
 * the destination, not what is built (see the task brief).
 */
const DETECTORS: Detector[] = [
  gradientText,
  backdropBlur,
  pureBlackWhite,
  contrastFloor,
  focusRemoved,
  hardcodedValue,
  violetBandHue,
];

export function getDetector(name: string): Detector | undefined {
  return DETECTORS.find((d) => d.name === name);
}

export function allDetectors(): Detector[] {
  return DETECTORS;
}
