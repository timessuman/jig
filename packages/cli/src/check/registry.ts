import type { Detector } from './types.js';
import { gradientText } from './detectors/gradient-text.js';
import { emojiIcon } from './detectors/emoji-icon.js';
import { marketingVoice } from './detectors/marketing-voice.js';
import { placeholderContent } from './detectors/placeholder-content.js';
import { backdropBlur } from './detectors/backdrop-blur.js';
import { pureBlackWhite } from './detectors/pure-black-white.js';
import { contrastFloor } from './detectors/contrast-floor.js';
import { focusRemoved } from './detectors/focus-removed.js';
import { hardcodedValue } from './detectors/hardcoded-value.js';
import { violetBandHue } from './detectors/violet-band-hue.js';
import { fixedWidth } from './detectors/fixed-width.js';
import { viewportHeight } from './detectors/viewport-height.js';
import { inputZoom } from './detectors/input-zoom.js';
import { safeArea } from './detectors/safe-area.js';
import { menuState } from './detectors/menu-state.js';
import { undeclaredToken } from './detectors/undeclared-token.js';
import { emDash } from './detectors/em-dash.js';
import { semanticElement } from './detectors/semantic-element.js';
import { metadata } from './detectors/metadata.js';

/**
 * Every detector `check` knows how to run, keyed by the `detector` name
 * `rules.index.json` uses to name it. A rule in the index naming a detector
 * NOT in this map is skipped silently by the runner — the index describes
 * the destination, not what is built (see the task brief).
 */
const DETECTORS: Detector[] = [
  gradientText,
  emojiIcon,
  marketingVoice,
  placeholderContent,
  backdropBlur,
  pureBlackWhite,
  contrastFloor,
  focusRemoved,
  hardcodedValue,
  violetBandHue,
  fixedWidth,
  viewportHeight,
  inputZoom,
  safeArea,
  menuState,
  undeclaredToken,
  emDash,
  semanticElement,
  metadata,
];

export function getDetector(name: string): Detector | undefined {
  return DETECTORS.find((d) => d.name === name);
}

export function allDetectors(): Detector[] {
  return DETECTORS;
}
