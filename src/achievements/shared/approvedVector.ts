export type ApprovedBadgeState = 'unlocked' | 'locked' | 'transparent';

export type ApprovedVectorPart = {
  markup: string;
  opaqueOnly?: boolean;
  hideCompact?: boolean;
  lettering?: string;
};

export type ApprovedVector = {
  parts: readonly ApprovedVectorPart[];
  values: Readonly<Record<ApprovedBadgeState, readonly string[]>>;
  sources: Readonly<Record<ApprovedBadgeState, { path: string; sha256: string }>>;
};

export function escapeBadgeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function normalizeApprovedBadgeState(state?: string): ApprovedBadgeState {
  if (state === 'locked') return 'locked';
  if (state === 'transparent' || state === 'share-transparent') return 'transparent';
  return 'unlocked';
}

export type ApprovedVectorOptions = {
  size?: number;
  compact?: boolean;
  label: string;
  namespace: string;
  paint?: Readonly<Record<string, string>>;
  numberMarkup?: string;
};

/** State slots contain paint/references only; approved geometry is stored once. */
export function renderApprovedVector(
  artwork: ApprovedVector,
  inputState: string | undefined,
  options: ApprovedVectorOptions,
): string {
  const state = normalizeApprovedBadgeState(inputState);
  const namespace = options.namespace.replace(/[^a-zA-Z0-9_-]/g, '-');
  const values = artwork.values[state];
  const content = artwork.parts
    .filter(part => !(part.opaqueOnly && state === 'transparent') && !(part.hideCompact && options.compact))
    .map(part => part.lettering === 'number' && options.numberMarkup !== undefined
      ? options.numberMarkup
      : part.markup.replace(/\{\{(\d+)\}\}/g, (_, key: string) => {
        const value = values[Number(key)];
        if (value === undefined) throw new Error(`Missing approved badge paint slot ${key}`);
        return escapeBadgeXml(state !== 'locked' ? options.paint?.[value] ?? value : value);
      }))
    .join('\n');
  // Namespace both declarations and references, including masks and nested defs.
  const body = content
    .replace(/\sid="([^"]+)"/g, (_, id: string) => ` id="${namespace}-${id}"`)
    .replace(/url\(#([^()]+)\)/g, (_, id: string) => `url(#${namespace}-${id})`);
  const size = options.size ?? 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" role="img" aria-label="${escapeBadgeXml(options.label)}">\n${body}\n</svg>\n`;
}
