#!/usr/bin/env python3
"""Regenerate Firsts typography only; never writes artwork, glyphs or assets."""

import argparse
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET

from fontTools.pens.boundsPen import BoundsPen
from fontTools.svgLib.path import parse_path
from fontTools.ttLib import TTFont

from pango_outline import Outliner

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
SOURCE = ROOT / "docs/handoff/badge-review/firsts-complete"
TARGET = ROOT / "src/achievements/firsts/firstsTypography.ts"
NS = "{http://www.w3.org/2000/svg}"
FONTS = {
    "Arial Narrow": Path("/System/Library/Fonts/Supplemental/Arial Narrow.ttf"),
    "Arial": Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
}
IDS = (
    "first_activity", "first_run", "first_walk", "first_run_walk", "first_ride",
    "first_mobility_workout", "first_5k", "first_10k", "first_half_marathon",
    "first_marathon", "first_route_completed", "first_structured_workout",
    "first_adapted_workout", "first_strength_workout", "first_movement_lab_analysis",
)
SHIELDS = ("5K", "10K", "13.1", "21.1", "26.2", "42.2")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font_provenance():
    result = {}
    for family, path in FONTS.items():
        with TTFont(path) as font:
            names = font["name"]
            result[family] = {
                "path": str(path), "sha256": digest(path),
                "family": names.getDebugName(1), "style": names.getDebugName(2),
                "postScriptName": names.getDebugName(6), "version": names.getDebugName(5),
            }
            if names.getDebugName(1) != family or names.getDebugName(2) != "Regular":
                raise ValueError(f"Unexpected font face: {path}")
    return result


def text_spec(element):
    attributes = dict(element.attrib)
    if attributes.get("font-weight") != "400" or attributes.get("text-anchor") != "middle":
        raise ValueError(f"Unexpected approved text attributes: {attributes}")
    allowed = {"x", "y", "text-anchor", "font-family", "font-size", "letter-spacing", "font-weight", "fill"}
    if set(attributes) - allowed:
        raise ValueError(f"Unimplemented text attributes: {set(attributes) - allowed}")
    text = "".join(element.itertext())
    if list(element) or not text:
        raise ValueError("Expected a plain, nonempty text line")
    return {"attributes": attributes, "text": text}


def generate():
    provenance = font_provenance()
    cmaps = {}
    for family, path in FONTS.items():
        with TTFont(path) as font:
            cmaps[family] = font.getBestCmap()
    outliner = Outliner(FONTS)
    titles, shields, wordmark = {}, {}, None
    entries, sources = [], []
    for achievement_id in IDS:
        stem = achievement_id.replace("_", "-")
        names = [f"{stem}-unlocked.svg"]
        if achievement_id in ("first_half_marathon", "first_marathon"):
            names.append(f"{stem}-unlocked-metric.svg")
        for name in names:
            source = SOURCE / name
            root = ET.parse(source).getroot()
            if root.get("viewBox") != "0 0 100 100":
                raise ValueError(f"Unexpected viewBox: {source}")
            source_titles = []
            text_elements = list(root.iter(f"{NS}text"))
            parents = {child: parent for parent in root.iter() for child in parent}
            for element in text_elements:
                spec = text_spec(element)
                text, attrs = spec["text"], spec["attributes"]
                role = "wordmark" if text == "STRIDEOS" else "shield" if text in SHIELDS else "title"
                expected_y = (76.6,) if role == "wordmark" else (42.8,) if role == "shield" else (61.3, 69.1, 66.7)
                expected_font = "Arial" if role == "wordmark" else "Arial Narrow"
                if float(attrs["x"]) != 50 or float(attrs["y"]) not in expected_y or attrs["font-family"].split(",")[0].strip() != expected_font:
                    raise ValueError(f"Unexpected approved text placement: {spec}")
                if any(ord(char) not in cmaps[expected_font] for char in text):
                    raise ValueError(f"Missing glyph in {expected_font}: {text}")
                parent = parents[element]
                if role == "shield":
                    if parent.get("transform") != "translate(0 -3)":
                        raise ValueError(f"Unexpected shield transform: {source}")
                    if float(attrs["font-size"]) != (15.5 if text in ("5K", "10K") else 14.4):
                        raise ValueError(f"Unexpected shield font size: {source}")
                elif parent is not root:
                    raise ValueError(f"Unexpected nested title or wordmark: {source}")
                if role == "wordmark" and (float(attrs["font-size"]) != 4.35 or float(attrs.get("letter-spacing", 0)) != 0.65):
                    raise ValueError(f"Unexpected wordmark metrics: {source}")
                path = outliner.outline(attrs, text)
                pen = BoundsPen(None)
                parse_path(path, pen)
                bounds = list(pen.bounds)
                if not all(0 < n < 100 for n in bounds):
                    raise ValueError(f"Clipped text: {text} {bounds}")
                markup = f'<path data-text="{text}" fill="currentColor" stroke="none" d="{path}"/>'
                entry = {"source": str(source.relative_to(ROOT)), "id": achievement_id, "role": role, **spec, "markup": markup, "bounds": bounds}
                if role == "shield":
                    entry["containerPath"] = parent.find(f"{NS}path").get("d")
                    entry["parentTransform"] = parent.get("transform")
                entries.append(entry)
                if role == "title":
                    source_titles.append(markup)
                elif role == "shield":
                    if text in shields and shields[text] != markup:
                        raise ValueError(f"Conflicting shield label: {text}")
                    shields[text] = markup
                elif wordmark is not None and wordmark != markup:
                    raise ValueError(f"Conflicting wordmark: {source}")
                else:
                    wordmark = markup
            title = "".join(source_titles)
            if achievement_id in titles and titles[achievement_id] != title:
                raise ValueError(f"Metric title changed: {achievement_id}")
            if not title:
                raise ValueError(f"No title: {achievement_id}")
            titles[achievement_id] = title
            sources.append({"path": str(source.relative_to(ROOT)), "sha256": digest(source), "containerPath": root.find(f"{NS}path").get("d")})
    if set(shields) != set(SHIELDS) or wordmark is None:
        raise ValueError("Missing shield label or wordmark")
    header = [
        "// Generated by scripts/firsts-typography/generate.py. Do not hand-edit.",
        "// Approved SVG text outlined with Pango/Cairo; no runtime fonts required.",
        "// Coordinates use the 100-unit badge viewBox. Shield parent translation stays in the renderer.",
        "// Paths explicitly disable inherited strokes. Replace currentColor to apply the state palette.",
    ]
    for family, details in provenance.items():
        header.append(f'// {family} Regular: {details["path"]}; SHA-256 {details["sha256"]}')
    lines = header + ["", "import type { FirstAchievementId } from './firstsDefinitions';", "", "export const FIRSTS_TITLE_PATHS = {"]
    lines.extend(f"  {key}: {json.dumps(titles[key])}," for key in IDS)
    lines.extend(["} as const satisfies Readonly<Record<FirstAchievementId, string>>;", "", f"export const FIRSTS_WORDMARK_PATH = {json.dumps(wordmark)};", "", "export const FIRSTS_SHIELD_TEXT_PATHS = {"])
    lines.extend(f"  {json.dumps(key)}: {json.dumps(shields[key])}," for key in SHIELDS)
    lines.extend(["} as const;", ""])
    output = "\n".join(lines)
    manifest = {
        "fonts": provenance, "resolvedFonts": outliner.resolved_fonts,
        "engine": {"pango": outliner.lib.pango_version_string().decode(), "librarySha256": digest(outliner.library), "scale": outliner.SCALE, "hintStyle": "none", "hintMetrics": "off"},
        "sources": sources, "entries": entries,
    }
    return output, json.dumps(manifest, indent=2) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify determinism without writing files")
    args = parser.parse_args()
    output, manifest = generate()
    targets = ((TARGET, output), (HERE / "manifest.json", manifest))
    for path, contents in targets:
        if args.check:
            if not path.exists() or path.read_text() != contents:
                raise SystemExit(f"Stale generated file: {path}")
        else:
            path.write_text(contents)
    print(f'{"Checked" if args.check else "Generated"} 15 titles, one wordmark and six shield labels; 17 approved SVGs; verified regular font files.')


if __name__ == "__main__":
    main()
