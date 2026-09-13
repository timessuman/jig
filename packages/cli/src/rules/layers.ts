import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The six layers, as a view over the corpus.
 *
 * The layers are a navigation model, not a storage model. Nothing was renumbered
 * to fit one: an id is a permanent address, printed in findings, cited in review
 * and linked from a site, so a unit that belongs in a different layer than its
 * prefix suggests keeps its number and moves here instead.
 *
 * That is what makes the `P-` prefix survivable. It was minted when "pattern"
 * covered both a Button and a Form, and those are different layers — a component
 * is a thing you render, a pattern is a solution you apply. The map splits them
 * without touching a single id.
 *
 * `anti-patterns` carries no ids here on purpose: every entry in
 * `rules.index.json` is that layer by definition, and listing 105 of them again
 * would be a second place to maintain one fact.
 */
export interface Layer {
  question: string;
  file?: string;
  ids: string[];
  note?: string;
}

export interface Layers {
  layers: Record<string, Layer>;
  not_a_layer: Record<string, { question?: string; ids?: string[] }>;
}

export function loadLayers(packageRoot: string): Layers {
  return JSON.parse(readFileSync(join(packageRoot, 'layers.json'), 'utf8')) as Layers;
}

/** Every id the map places, across the six layers and the two that are not layers. */
export function placedIds(l: Layers): string[] {
  return [
    ...Object.values(l.layers).flatMap((x) => x.ids),
    ...Object.values(l.not_a_layer)
      .filter((x) => Array.isArray(x.ids))
      .flatMap((x) => x.ids as string[]),
  ];
}

/** The layer a given id sits in, or undefined for a rule (which is anti-patterns). */
export function layerOf(l: Layers, id: string): string | undefined {
  for (const [name, layer] of Object.entries(l.layers)) {
    if (layer.ids.includes(id)) return name;
  }
  for (const [name, group] of Object.entries(l.not_a_layer)) {
    if (group.ids?.includes(id)) return name;
  }
  return undefined;
}
