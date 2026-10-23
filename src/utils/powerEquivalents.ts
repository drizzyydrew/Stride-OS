export const POWER_REFERENCE_SOURCES = {
  ftc: { title: 'FTC: LED lighting', url: 'https://consumer.ftc.gov/articles/shopping-light-bulbs' },
  honda: { title: 'Honda: approximate running watts', url: 'https://powerequipment.honda.com/generators/generator-wattage-estimation-guide' },
  jackery: { title: 'Jackery: appliance examples', url: 'https://www.jackery.com/pages/jackery-buying-guide' },
} as const;

type Source = keyof typeof POWER_REFERENCE_SOURCES;
type Appliance = { id: string; singular: string; plural: string; watts: number; source: Source; mode: string };

export const POWER_REFERENCE_APPLIANCES: readonly Appliance[] = [
  { id: 'led', singular: 'LED bulb', plural: 'LED bulbs', watts: 9, source: 'ftc', mode: 'One approximately 800-lumen bulb, switched on.' },
  { id: 'phone', singular: 'phone charger', plural: 'phone chargers', watts: 18, source: 'jackery', mode: 'An illustrative charging draw, not a full battery charge; draw varies during charging.' },
  { id: 'monitor', singular: 'LCD monitor', plural: 'LCD monitors', watts: 30, source: 'honda', mode: 'Illustrative operating draw, not standby.' },
  { id: 'fan', singular: 'portable fan', plural: 'portable fans', watts: 40, source: 'honda', mode: 'Running draw; motor startup is not included.' },
  { id: 'radio', singular: 'radio', plural: 'radios', watts: 50, source: 'honda', mode: 'The low end of a published 50-200 W operating range.' },
  { id: 'laptop', singular: 'laptop', plural: 'laptops', watts: 65, source: 'jackery', mode: 'An illustrative operating/charging draw; workload and charge state vary.' },
  { id: 'tv', singular: '46-inch TV', plural: '46-inch TVs', watts: 190, source: 'honda', mode: 'Illustrative switched-on draw; brightness and model vary.' },
  { id: 'slow_cooker', singular: 'slow cooker', plural: 'slow cookers', watts: 200, source: 'honda', mode: 'A reference within the published 170-270 W range, while heating; not a whole-day average.' },
  { id: 'blender', singular: 'blender', plural: 'blenders', watts: 400, source: 'honda', mode: 'While blending; motor startup is not included.' },
  { id: 'rice_cooker', singular: 'rice cooker', plural: 'rice cookers', watts: 500, source: 'jackery', mode: 'While cooking, not keep-warm or cycle-average consumption.' },
  { id: 'coffee', singular: 'small coffee maker', plural: 'small coffee makers', watts: 600, source: 'honda', mode: 'A four-cup machine while brewing/heating, not a cycle-average draw.' },
  { id: 'desktop', singular: 'desktop computer', plural: 'desktop computers', watts: 600, source: 'honda', mode: 'The low end of a published 600-800 W reference; actual workload and model vary.' },
  { id: 'microwave', singular: 'small microwave', plural: 'small microwaves', watts: 1000, source: 'honda', mode: 'Electrical input while cooking, not the lower cooking-output rating.' },
  { id: 'washer', singular: 'washing machine', plural: 'washing machines', watts: 1200, source: 'honda', mode: 'Illustrative running draw, not cycle-average energy or startup demand.' },
  { id: 'heater', singular: 'radiant heater', plural: 'radiant heaters', watts: 1300, source: 'honda', mode: 'While heating, not thermostat-cycle average consumption.' },
  { id: 'frying_pan', singular: 'electric frying pan', plural: 'electric frying pans', watts: 1500, source: 'honda', mode: 'While heating, not thermostat-cycle average consumption.' },
  { id: 'grill', singular: 'tabletop electric grill', plural: 'tabletop electric grills', watts: 1650, source: 'honda', mode: 'While heating, not thermostat-cycle average consumption.' },
  { id: 'dryer', singular: 'hair dryer', plural: 'hair dryers', watts: 1800, source: 'honda', mode: 'Published running reference; heat setting and model vary.' },
] as const;

export type PowerReference = {
  id: string;
  bandWatts: number;
  parts: { applianceId: string; count: number }[];
  watts: number;
  label: string;
};

function appliance(id: string): Appliance {
  const found = POWER_REFERENCE_APPLIANCES.find(item => item.id === id);
  if (!found) throw new Error('Unknown power reference');
  return found;
}

function reference(band: number, key: string, parts: PowerReference['parts']): PowerReference {
  return {
    id: `${band}:${key}`, bandWatts: band, parts,
    watts: parts.reduce((sum, part) => sum + appliance(part.applianceId).watts * part.count, 0),
    label: parts.map(part => `${part.count} ${part.count === 1 ? appliance(part.applianceId).singular : appliance(part.applianceId).plural}`).join(' + '),
  };
}

function multiples(band: number, id: string): PowerReference {
  return reference(band, id, [{ applianceId: id, count: Math.max(1, Math.floor(band / appliance(id).watts)) }]);
}

// Bands choose an illustration, never replace the activity's actual watts. All
// combinations are sums of sourced nominal operating draws, not new ratings.
export const POWER_REFERENCE_BANDS: readonly PowerReference[] = Array.from({ length: 20 }, (_, index) => {
  const band = (index + 1) * 100;
  if (band <= 1000) {
    const ids = ['led', 'phone', band >= 600 ? 'desktop' : 'monitor', band >= 500 ? 'rice_cooker' : 'fan',
      band >= 600 ? 'coffee' : 'laptop', band >= 200 ? 'tv' : 'radio'];
    // At the lowest bands use a distinct mixed desk setup instead of repeating fans.
    const items = ids.slice(0, 6).map(id => multiples(band, id));
    items.push(band >= 400 ? multiples(band, 'blender') : reference(band, 'desk', [
      { applianceId: 'laptop', count: Math.max(1, Math.floor(band / 95)) },
      { applianceId: 'monitor', count: Math.max(1, Math.floor(band / 95)) },
    ]));
    items.push(band >= 1000 ? multiples(band, 'microwave') : band >= 200 ? multiples(band, 'slow_cooker') : reference(band, 'charging', [
      { applianceId: 'laptop', count: 1 }, { applianceId: 'phone', count: 1 },
    ]));
    return items;
  }
  const ids = band < 1300 ? ['microwave', 'coffee', 'rice_cooker', 'desktop']
    : band < 1500 ? ['heater', 'washer', 'microwave', 'coffee']
      : band < 1800 ? ['frying_pan', 'heater', 'washer', 'microwave']
        : ['dryer', 'grill', 'frying_pan', 'heater'];
  return ids.map(id => {
    const parts = [{ applianceId: id, count: 1 }];
    const remainder = band - appliance(id).watts;
    if (remainder >= 500) parts.push({ applianceId: 'rice_cooker', count: 1 });
    else if (remainder >= 190) parts.push({ applianceId: 'tv', count: 1 });
    else if (remainder >= 65) parts.push({ applianceId: 'laptop', count: 1 });
    return reference(band, id, parts);
  });
}).flat();

export function powerReferencePool(watts: number): readonly PowerReference[] {
  if (!Number.isFinite(watts) || watts <= 0 || watts > 2000) return [];
  if (watts < 100) {
    const small = POWER_REFERENCE_APPLIANCES.filter(item => item.watts <= watts);
    return (small.length ? small : [appliance('led')]).map(item => reference(0, item.id, [{ applianceId: item.id, count: 1 }]));
  }
  const band = Math.floor(watts / 100) * 100;
  return POWER_REFERENCE_BANDS.filter(item => item.bandWatts === band);
}

export function energyReferencePool(): readonly PowerReference[] {
  return POWER_REFERENCE_APPLIANCES.slice(0, 8).map(item => reference(0, `energy:${item.id}`, [{ applianceId: item.id, count: 1 }]));
}

export function pickPowerReference(pool: readonly PowerReference[], random: number): PowerReference | undefined {
  if (!pool.length || !Number.isFinite(random)) return undefined;
  return pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random * pool.length)))];
}

export function referenceDetails(item: PowerReference): { draw: string; assumptions: string[]; sources: { title: string; url: string }[] } {
  const parts = item.parts.map(part => appliance(part.applianceId));
  return {
    draw: `${item.watts} W reference draw`,
    assumptions: parts.map(part => `${part.singular}: ${part.watts} W. ${part.mode}`),
    sources: [...new Set(parts.map(part => part.source))].map(source => POWER_REFERENCE_SOURCES[source]),
  };
}

export function equivalentRuntimeSeconds(kilojoules: number, referenceWatts: number): number | null {
  if (![kilojoules, referenceWatts].every(Number.isFinite) || kilojoules <= 0 || referenceWatts <= 0) return null;
  const seconds = kilojoules / referenceWatts * 1000;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export function formatPowerRatio(watts: number, referenceWatts: number): string {
  const ratio = watts / referenceWatts;
  return ratio < 0.1 ? 'less than 0.1' : ratio.toFixed(1);
}

export function formatEquivalentTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'unavailable';
  if (seconds < 60) return seconds < 1 ? 'less than 1 second' : `${Math.round(seconds)} seconds`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} hour${hours === 1 ? '' : 's'}${remainder ? ` ${remainder} minute${remainder === 1 ? '' : 's'}` : ''}`;
}
