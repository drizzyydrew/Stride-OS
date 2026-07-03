# Colors

Status: official Phase 2 palette.

## Reference Palette

The uploaded reference labels the core palette directly:

| Token | Hex | Use |
| --- | --- | --- |
| `sage` | `#8B927C` | Dark-mode primary control, toggles, calm active state |
| `clay` | `#DCC0A7` | Light-mode primary control, brand warmth, secondary highlight |
| `steel` | `#708489` | Map route contrast, cool neutral accents |
| `brown` | `#4D433E` | Low battery, deep warm neutral, destructive-muted action |
| `sand` | `#EFE7DA` | Light-mode app background and card wash |
| `white` | `#FFFFFF` | Light card fill, high-contrast text on dark |

## Extended Tokens

| Token | Hex | Use |
| --- | --- | --- |
| `ink` | `#101010` | Dark-mode app background |
| `inkRaised` | `#181818` | Dark cards and bottom sheets |
| `inkBorder` | `#30302C` | Dark card borders and separators |
| `charcoal` | `#24211F` | Deep warm text or low battery button |
| `textPrimaryDark` | `#F4EEE7` | Primary text on dark backgrounds |
| `textSecondaryDark` | `#CFC7BB` | Labels and supporting copy on dark backgrounds |
| `textMutedDark` | `#8F8A80` | Disabled labels, tertiary dots |
| `paper` | `#F8F5EF` | Light-mode page background |
| `cardLight` | `#FFFFFF` | Light-mode cards and rows |
| `textPrimaryLight` | `#111111` | Primary text on light backgrounds |
| `textSecondaryLight` | `#4D4A45` | Labels and secondary text on light backgrounds |
| `textMutedLight` | `#8B877F` | Disabled labels, inactive pagination |
| `routeSage` | `#6F7F6D` | Route line and active metric accent |
| `success` | `#6F8A63` | Resume state and positive toggles |
| `warning` | `#C79B57` | Caution and paused state label |
| `critical` | `#8A332D` | Low battery action state |

## Mode Roles

### Dark Mode

- Screen background: `ink`.
- Card background: `inkRaised`.
- Primary metrics: `textPrimaryDark`.
- Metric labels: `textSecondaryDark`.
- Hairlines and separators: `inkBorder`.
- Active primary action: `sage`.
- Warm brand accent: `clay`.

### Light Mode

- Screen background: `sand` or `paper`.
- Card background: `cardLight`.
- Primary metrics: `textPrimaryLight`.
- Metric labels: `textSecondaryLight`.
- Hairlines and separators: `#E7DED4`.
- Active primary action: `clay`.
- Utility controls and toggles: `sage`.

## State Colors

| State | Color | Notes |
| --- | --- | --- |
| Running | `sage` | Calm, stable, non-alarming |
| Paused | `clay` or `success` | Use `clay` in light mode, `success` in dark mode if contrast is stronger |
| Low battery | `critical` / `brown` | Must remain legible and not look like generic delete |
| Connected | `sage` | Used for music or system availability |
| Disabled | `textMutedLight` / `textMutedDark` | Reduce contrast without hiding |

## Map Colors

Dark map:

- Base: near-black with low-contrast road lines.
- Route: muted sage or steel.
- Current point: off-white center with sage ring.

Light map:

- Base: sand and pale green blocks.
- Roads: white or pale gray.
- Route: muted sage.
- Current point: white center with sage ring.

## Do Not Use

- Bright neon greens for running state.
- Heavy blue for route or controls.
- Purple gradients.
- Pure red except for explicit critical errors.
- One-color monochrome screens where every element is a shade of the same hue.

