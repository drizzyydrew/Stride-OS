# Spacing

Status: official Phase 2 layout geometry.

## Spacing Scale

Use a 4 pt base grid.

| Token | Value | Use |
| --- | ---: | --- |
| `space1` | 4 | Tight icon-label gaps, pagination dots |
| `space2` | 8 | Metric label gaps, compact row padding |
| `space3` | 12 | Card inner gaps, row spacing |
| `space4` | 16 | Standard screen padding and card padding |
| `space5` | 20 | Large card padding, section gaps |
| `space6` | 24 | Major vertical spacing |
| `space8` | 32 | Screen group separation |

## Screen Padding

In-run phone screen:

- Horizontal safe padding: 20-24 pt.
- Bottom action area: keep at least 24 pt above the home indicator.
- Floating map buttons: 12-16 pt from the right safe edge.

Settings screen:

- Horizontal padding: 20 pt.
- Section gap: 16-20 pt.
- Row vertical padding: 12-14 pt.

Live Activity:

- Outer padding: 16-20 pt.
- Inner metric column gap: 18-24 pt.
- Primary button inset: 16-20 pt from card edge.

## Border Radius

| Surface | Radius |
| --- | ---: |
| Phone screen cards and panels | 22-28 |
| Live Activity card | 22-26 |
| Primary pill button | 18-24 |
| Settings grouped card | 12-16 |
| Run type row | 10-12 |
| Icon button circle | Fully round |
| Pagination dot | Fully round |

Cards should be rounded but not playful. Avoid excessive pill shapes except for primary run controls.

## Button Sizing

Primary Live Activity button:

- Height: 48-56 pt.
- Horizontal fill inside card.
- Radius: 18-24 pt.

In-run circular pause/stop button:

- Diameter: 64-72 pt.
- Icon: 22-28 pt.

Paused resume button:

- Height: 50-56 pt.
- Min width: 150 pt.
- Icon: 18-20 pt.

Settings row controls:

- Minimum row height: 44 pt.
- Toggle target: native iOS size.

## Metric Layout

Live Activity:

- Left column owns time and distance.
- Right column owns pace, heart rate, and elevation.
- Vertical divider separates the columns.
- Button spans the full card width below metrics.

In-run screen:

- Map owns the top half or more.
- Metrics sit in a translucent or opaque bottom panel.
- Time and distance are first row.
- Pace, heart rate, and elevation are second row.
- Primary button sits below metrics.

Paused screen:

- Map thumbnail is left.
- Stats and resume action are right.
- Use a compact card ratio close to 2:1.

## Shadows

Dark mode:

- Use subtle black shadows and a visible border.
- Shadow opacity should be low enough that the card reads as native, not floating.

Light mode:

- Use soft shadows with warm gray color.
- Keep shadow blur moderate.
- Avoid heavy drop shadows under every row.

## Layout Stability

- Fixed-format controls must not resize when values change.
- Metric containers should reserve enough width for likely maximum values.
- Long labels should wrap only in settings and run type rows.
- In-run buttons and metrics must not overlap the home indicator.

