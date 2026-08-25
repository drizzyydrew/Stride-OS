# StrideOS Cumulative Elevation Gain Mountain Achievements

Research/design gate prepared on 2026-08-19.

This is the pre-implementation gate for the mountain achievement family. These assets are visual research and preview direction only. Final app assets should be generated from controlled templates after the family direction is selected.

## Preview Artwork

- Mount Hood: `docs/achievements/elevation/previews/mount-hood-preview-pair.png`
- Denali: `docs/achievements/elevation/previews/denali-preview-pair.png`
- Everest: `docs/achievements/elevation/previews/everest-preview-pair.png`
- Olympus Mons: `docs/achievements/elevation/previews/olympus-mons-preview-pair.png`

Direction read: Variant A is generally the stronger family direction. It is more photographic, more landmark-led, and closer to the approved Denali structure. Variant B is useful for limited editorial treatments but risks becoming more illustrated than the requested family.

Selected implementation direction: Variant A for Mount Hood, Mount Fuji, Mount Rainier, Kilimanjaro, Denali, Aconcagua, Mount Everest, Mauna Kea, and Ascraeus Mons. Olympus Mons uses the slightly more stylized editorial direction to make the final planetary milestone feel distinct while staying restrained and scientifically plausible.

## Canonical Measurement Ladder

| Sort | Landmark | Chosen StrideOS Value | Display - Imperial | Display - Metric | Measurement Definition | Primary Source | Source URL | Source Access Date | Disagreement / Caveat |
| ---: | --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Mount Hood | 11,240 ft | 11,240 ft | 3,426 m | Summit elevation above sea level | USGS Mount Hood volcano page | `https://www.usgs.gov/volcanoes/mount-hood` | 2026-08-19 | Some public sources cite 11,249 ft; StrideOS uses USGS volcano value. |
| 2 | Mount Fuji | 3,776 m | 12,388 ft | 3,776 m | Public summit elevation above sea level | GSI / official Fuji climbing site | `https://www.gsi.go.jp/WNEW/PRESS-RELEASE/keikaku61003.html` | 2026-08-19 | GSI notes the surveyed triangle point is 3,775.56 m while the public highest-point elevation remains 3,776 m. |
| 3 | Mount Rainier | 14,410 ft | 14,410 ft | 4,392 m | Official Columbia Crest summit elevation above sea level | USGS Mount Rainier page; NPS volcano page | `https://www.usgs.gov/volcanoes/mount-rainier` | 2026-08-19 | Recent research has reported lower current bare-rock/ice-cap values; official USGS/NPS value remains 14,410 ft. |
| 4 | Kilimanjaro | 5,895 m | 19,341 ft | 5,895 m | Uhuru Peak/Kibo summit elevation above sea level | Tanzania National Parks | `https://www.tanzaniaparks.go.tz/nationalparks/kilimanjaro` | 2026-08-19 | Later surveys have reported slightly different heights; TANAPA/park value remains 5,895 m. |
| 5 | Denali | 20,310 ft | 20,310 ft | 6,190 m | Summit ice-cap elevation above sea level | NPS Denali summit survey; USGS 2015 release | `https://www.nps.gov/articles/denali-crp-summit-survey.htm` | 2026-08-19 | Replaced older 20,320 ft value; survey measured top of ice cap, not definitively rock summit. |
| 6 | Aconcagua | 6,960.8 m | 22,837 ft | 6,960.8 m | Summit elevation above mean sea level | Instituto Geografico Nacional Argentina | `https://www.ign.gob.ar/Novedades/NuevaAlturaAconcagua` | 2026-08-19 | Older/common values include 6,959.6 m, 6,961 m, and 6,962 m; StrideOS uses the IGN/SIGMA value. |
| 7 | Mount Everest | 8,848.86 m | 29,032 ft | 8,848.86 m | Snow/ice summit elevation above sea level | 2020 Nepal-China joint announcement, reported by official China SCIO | `https://english.scio.gov.cn/in-depth/2020-12/24/content_77046507.htm` | 2026-08-19 | Earlier accepted values include 8,848 m; 2020 joint value is current canonical. |
| 8 | Mauna Kea | 33,500 ft | 33,500 ft | 10,211 m | Ocean floor / base-to-summit total height | USGS Hawaiian Volcano Observatory FAQ | `https://www.usgs.gov/faqs/how-big-are-hawaiian-volcanoes` | 2026-08-19 | USGS phrases the total as nearly 33,500 ft from 13,796 ft above sea level plus about 19,700 ft below sea level; label must not say ordinary summit elevation. |
| 9 | Ascraeus Mons | 18,225 m | 59,793 ft | 18,225 m | Elevation above Martian datum | NASA/JPL THEMIS image notes | `https://www.jpl.nasa.gov/images/pia24141-ascraeus-mons/` | 2026-08-19 | Other sources round to 18 km or describe local relief around 15 km; StrideOS uses NASA/JPL's 18,225 m datum value. |
| 10 | Olympus Mons | 40 km+ | 131,234 ft+ | 40 km+ | Base-to-summit height, published as over 40 km | NASA Mars facts; NASA/JPL Olympus Mons caldera note | `https://science.nasa.gov/mars/facts/` | 2026-08-19 | Datum/local-relief values vary around 21-26 km; for the final ladder StrideOS should use the NASA base-to-summit concept and label it explicitly as `BASE TO SUMMIT`. |

## Product Copy Rules

- Standard Earth summit entries: `CUMULATIVE ELEVATION GAIN`.
- Mauna Kea: `OCEAN FLOOR TO SUMMIT`.
- Ascraeus Mons: `ABOVE MARTIAN DATUM`.
- Olympus Mons: `BASE TO SUMMIT`.
- Do not use motivational copy such as "conquered", "elite", "legendary", or "serious climber".

## Proposed Visual Treatment

- Mount Hood: cold Pacific Northwest volcanic cone, snow/glacier cap, evergreen foreground, clean single-spire silhouette.
- Mount Fuji: near-symmetrical cone, restrained lake/lowland context, quiet atmospheric distance; avoid decorative cliches.
- Mount Rainier: huge glaciated mass, layered alpine foreground, more breadth and glacier texture than Hood.
- Kilimanjaro: broad Kibo volcanic massif, highland/savanna atmospheric base, snow cap used carefully and not over-romanticized.
- Denali: immense white massif, Alaska Range scale, layered glaciated foreground, cold restrained palette.
- Aconcagua: dry Andes ochre/stone face, rugged south-wall mass, sparse high-altitude atmosphere.
- Everest: sharp Himalayan summit/ridge identity, glacier/rock contrast, no climbers/flags/prayer-flag cliches.
- Mauna Kea: broad Hawaiian shield form, volcanic geology, observatory/summit context used sparingly; no false above-water full-height depiction.
- Ascraeus Mons: scientifically plausible Mars lava plains, flank flows, caldera/volcanic texture; no fantasy sci-fi.
- Olympus Mons: monumental broad shield volcano, caldera and escarpment cues, dusty Mars palette, final-achievement scale.

## Proposed Reference Sets

Reference images are for visual research only. Final artwork must be original and must not trace, clone, reproduce, or redistribute reference photos unless licenses allow that use.

### Mount Hood

- USGS Mount Hood volcano page: summit/elevation context and volcano character. `https://www.usgs.gov/volcanoes/mount-hood`
- Wikimedia Commons - Mount Hood reflected in Mirror Lake: clean cone, reflection, PNW foreground. `https://commons.wikimedia.org/wiki/File:Mount_Hood_reflected_in_Mirror_Lake,_Oregon.jpg`
- Wikimedia Commons - Mount Hood 2619s: Sandy Glacier, Reid/Sandy/Yocum ridgelines. `https://commons.wikimedia.org/wiki/File:Mount_Hood_2619s.jpg`
- Wikimedia Commons - Upper glacier, Mount Hood: glacier texture and steep upper slopes. `https://commons.wikimedia.org/wiki/File:Upper_glacier,_Mount_Hood_(3679693698).jpg`
- Wikimedia Commons Mount Hood category: alternate seasonal and aerial silhouette checks. `https://commons.wikimedia.org/wiki/Category:Mount_Hood`

### Mount Fuji

- GSI Fuji elevation press note: measurement nuance and official 3,776 m continuity. `https://www.gsi.go.jp/WNEW/PRESS-RELEASE/keikaku61003.html`
- Japan Ministry of Environment Fuji-Hakone-Izu National Park: official park context. `https://www.env.go.jp/en/np/index_2.html`
- Official Mount Fuji climbing site - summit rim: Kengamine/highest point context. `https://www.fujisan-climb.jp/en/ohachimeguri/`
- Wikimedia Commons Mount Fuji category: cone symmetry, lake views, winter snow patterns. `https://commons.wikimedia.org/wiki/Category:Mount_Fuji`
- Wikimedia Commons - Mount Fuji Japan with Snow, Lakes and Surrounding Mountains: lake/lowland context. `https://commons.wikimedia.org/wiki/File:Mount_Fuji_Japan_with_Snow,_Lakes_and_Surrounding_Mountains.jpg`

### Mount Rainier

- USGS Mount Rainier page: official elevation and volcano context. `https://www.usgs.gov/volcanoes/mount-rainier`
- NPS Mount Rainier volcano page: official park description and 14,410 ft value. `https://www.nps.gov/mora/learn/nature/volcanoes.htm`
- Wikimedia Commons Mount Rainier gallery: distant silhouette and foreground options. `https://commons.wikimedia.org/wiki/Mount_Rainier`
- Wikimedia Commons - Mount Rainier and Carbon Glacier: glacier texture/scale. `https://commons.wikimedia.org/wiki/File:Mount_Rainier_and_Carbon_Glacier.jpg`
- Wikimedia Commons - Nisqually Glacier: glacier/foreground context. `https://commons.wikimedia.org/wiki/File:Nisqually_Glacier_(6851680978).jpg`

### Kilimanjaro

- Tanzania National Parks Kilimanjaro page: official Kibo 5,895 m value. `https://www.tanzaniaparks.go.tz/nationalparks/kilimanjaro`
- KINAPA / Kilimanjaro National Park site: peak elevation and park context. `https://kinapa.org/`
- Wikimedia Commons Kilimanjaro category: Kibo massing and terrain variety. `https://commons.wikimedia.org/wiki/Category:Kilimanjaro`
- Wikimedia Commons - Kibo summit of Mt Kilimanjaro: summit/snowfield identity. `https://commons.wikimedia.org/wiki/File:Kibo_summit_of_Mt_Kilimanjaro_001.JPG`
- Wikimedia Commons - Kibo summit cropped: silhouette check. `https://commons.wikimedia.org/wiki/File:Kibo_summit_of_Mt_Kilimanjaro_001_(cropped).JPG`

### Denali

- NPS Denali summit survey: canonical 20,310 ft and measurement method. `https://www.nps.gov/articles/denali-crp-summit-survey.htm`
- USGS Denali elevation release: official value and previous-value context. `https://www.usgs.gov/news/national-news-release/new-elevation-nations-highest-peak`
- Wikimedia Commons Denali gallery: Alaska Range massing. `https://commons.wikimedia.org/wiki/Denali`
- Wikimedia Commons - Denali and the Alaska Range, Jacob W. Frank: layered foothills and massif scale. `https://commons.wikimedia.org/wiki/File:Denali_and_the_Alaska_Range_(9bb48405-142a-4f6d-af13-bf3fbc30ecb4).jpg`
- Wikimedia Commons Alaska Range category: foreground/range layering. `https://commons.wikimedia.org/wiki/Category:Alaska_Range`

### Aconcagua

- IGN Argentina new official height: canonical 6,960.8 m. `https://www.ign.gob.ar/Novedades/NuevaAlturaAconcagua`
- UIAA Aconcagua page: secondary technical context for 6,960.8 m and mountain character. `https://www.theuiaa.org/mountain-medicine/aconcagua/`
- Wikimedia Commons Aconcagua gallery: south face and aerial references. `https://commons.wikimedia.org/wiki/Aconcagua`
- Wikimedia Commons - Aconcagua south wall 2020: dry Andes south-wall mass. `https://commons.wikimedia.org/wiki/File:Aconcagua_south_wall_2020.jpg`
- Wikimedia Commons - Aconcagua SouthSummit2007: ridge/south face detail. `https://commons.wikimedia.org/wiki/File:Aconcagua_SouthSummit2007.jpg`

### Mount Everest

- China SCIO report on the 2020 Nepal-China height: canonical 8,848.86 m. `https://english.scio.gov.cn/in-depth/2020-12/24/content_77046507.htm`
- Kathmandu Post report on joint announcement: cross-check of 8,848.86 m and 29,031.69 ft conversion. `https://kathmandupost.com/national/2020/12/08/it-s-official-mount-everest-is-8-848-86-metres-tall`
- Wikimedia Commons Mount Everest category: summit/ridge visual range. `https://commons.wikimedia.org/wiki/Category:Mount_Everest`
- Wikimedia Commons - Everest North Face toward Base Camp Tibet, Luca Galuzzi: north face and approach context. `https://commons.wikimedia.org/wiki/File:Everest_North_Face_toward_Base_Camp_Tibet_Luca_Galuzzi_2006.jpg`
- Wikimedia Commons - Mount Everest North Face: summit/ridge profile. `https://commons.wikimedia.org/wiki/File:Mount_Everest_North_Face.jpg`

### Mauna Kea

- USGS Hawaiian volcano size FAQ: ocean-floor-to-summit definition and total height. `https://www.usgs.gov/faqs/how-big-are-hawaiian-volcanoes`
- USGS Hawaiian Volcano Observatory science page: same HVO measurement context. `https://www.usgs.gov/observatories/hvo/science`
- Wikimedia Commons Mauna Kea gallery: shield volcano and summit context. `https://commons.wikimedia.org/wiki/Mauna_Kea`
- Wikimedia Commons - Mauna Kea from Mauna Loa Observatory: broad shield silhouette. `https://commons.wikimedia.org/wiki/File:Mauna_Kea_from_Mauna_Loa_Observatory,_Hawaii_-_20100913.jpg`
- Wikimedia Commons Mauna Kea Observatory category: summit area/observatory context used sparingly. `https://commons.wikimedia.org/wiki/Category:Mauna_Kea_Observatory`

### Ascraeus Mons

- NASA/JPL PIA24141: 18,225 m datum value and southwestern flank. `https://www.jpl.nasa.gov/images/pia24141-ascraeus-mons/`
- NASA Photojournal Ascraeus Mons: same measurement and image metadata. `https://science.nasa.gov/photojournal/pj-ascraeus-mon-11/`
- NASA/JPL PIA26021: summit caldera features. `https://www.jpl.nasa.gov/images/pia26021-ascraeus-mons-summit/`
- NASA/JPL PIA01214: flank texture at 18 m/pixel. `https://www.jpl.nasa.gov/images/pia01214-ascraeus-mons/`
- USGS Planetary Nomenclature Ascraeus Mons: official feature identity and dimensions. `https://planetarynames.wr.usgs.gov/Feature/417`

### Olympus Mons

- NASA Mars facts: over 40 km base-to-summit concept. `https://science.nasa.gov/mars/facts/`
- NASA/JPL PIA25230: caldera and over-40-km base-to-summit language. `https://www.jpl.nasa.gov/images/pia25230-olympus-mons-caldera/`
- NASA/JPL Viking 1 Olympus Mons mosaic: 27 km / base/scarp/caldera context. `https://science.nasa.gov/resource/viking-1-orbiter-image-olympus-mons/`
- NASA SVS Olympus Mons flyover: MOLA/Viking visualization and Mars datum context. `https://svs.gsfc.nasa.gov/1094`
- USGS Planetary Nomenclature Olympus Mons: official feature identity. `https://planetarynames.wr.usgs.gov/Feature/4453`

## Implementation Notes For The Next Step

- Add this family as a new achievement category or sub-family under the existing achievement hub.
- Use stored `CompletedActivity.metrics.elevationGainMeters`; exclude missing elevation and avoid treadmill/manual inferred elevation unless the source is explicit and canonical.
- Recompute from canonical activity history on edits/deletes/imports to prevent double-counting.
- Store thresholds in canonical meters where possible, with `sourceUnit` and `sourceValue` retained for provenance.
- Use centralized unit formatting for display.
- Share cards must remain privacy-safe and must not include routes, private notes, symptoms, readiness, or health details.
- Final bitmap cards should be produced from controlled layouts, because generated previews can drift in typography.
