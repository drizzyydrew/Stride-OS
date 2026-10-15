function createRankedStreakArtwork(artwork, digits, system, createFrame) {
  const common = createFrame(artwork);
  function safeDays(days) {
    return Number.isFinite(days) ? Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(days))) : 1;
  }
  function tierForDays(days) {
    const value = safeDays(days);
    return system.tiers.find(tier => value >= tier.minDays && (tier.maxDays == null || value <= tier.maxDays)) || system.tiers[system.tiers.length - 1];
  }
  function numberLayout(days) {
    const value = safeDays(days), text = String(value);
    let cursor = 0;
    let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
    const positions = [];
    for (const digit of text) {
      const glyph = digits.digits[digit];
      positions.push({ glyph, x: cursor });
      left = Math.min(left, cursor + glyph.bounds[0]);
      right = Math.max(right, cursor + glyph.bounds[2]);
      bottom = Math.min(bottom, glyph.bounds[1]); top = Math.max(top, glyph.bounds[3]);
      cursor += glyph.advance;
    }
    const scale = Math.min(17.8 / digits.unitsPerEm, 34 / (right - left));
    const x = 50 - (left + right) / 2 * scale;
    const y = artwork.number.bounds[3] + bottom * scale;
    return { days: value, text, positions, scale, x, y, bounds: [left * scale + x, y - top * scale, right * scale + x, y - bottom * scale] };
  }
  function numberMarkup(days, color) {
    if (safeDays(days) === 3) return common.lettering('number', color);
    const layout = numberLayout(days);
    return `<g data-lettering="number" data-text="${layout.text}" fill="${color}" transform="translate(${layout.x} ${layout.y}) scale(${layout.scale} ${-layout.scale})">${layout.positions.map(({ glyph, x }) => `<path d="${glyph.path}" transform="translate(${x} 0)"/>`).join('')}</g>`;
  }
  function render(days, variant = 'unlocked', size = 800) {
    const count = safeDays(days), state = common.normalize(variant), tier = tierForDays(count);
    const source = tier.colors;
    return common.render(state, size, {
      identity: `streak-${count}-ranked`,
      label: `${count}-day streak, ${tier.label}, ${state}, artwork preview`,
      colors: { ...source, text: source.primary, flameTop: source.center, flameBottom: source.primary, background: system.background || '#070809' },
      numberMarkup: color => numberMarkup(count, color),
    });
  }
  function renderMilestone(id, state = 'unlocked', size = 800) {
    const definition = system.milestones.find(item => item.id === id);
    if (!definition) throw new Error(`Unknown streak award: ${id}`);
    return render(definition.day, state, size);
  }
  return { render, renderMilestone, safeDays, tierForDays, numberLayout, numberMarkup, common, system };
}
if (typeof module !== 'undefined') module.exports = createRankedStreakArtwork;
