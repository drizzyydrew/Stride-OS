"""Outline the approved ASCII strings using the preview's Pango/Cairo stack."""

import ctypes as C
import os
from pathlib import Path


class Rectangle(C.Structure):
    _fields_ = [(name, C.c_int) for name in ("x", "y", "width", "height")]


class PathHeader(C.Structure):
    _fields_ = [("type", C.c_int), ("length", C.c_int)]


class Point(C.Structure):
    _fields_ = [("x", C.c_double), ("y", C.c_double)]


class PathData(C.Union):
    _fields_ = [("header", PathHeader), ("point", Point)]


class CairoPath(C.Structure):
    _fields_ = [("status", C.c_int), ("data", C.POINTER(PathData)), ("num_data", C.c_int)]


def library_path():
    override = os.environ.get("FIRSTS_PANGO_LIBRARY")
    if override:
        return Path(override).resolve(strict=True)
    root = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@img"
    matches = sorted(root.glob("sharp-libvips-*/lib/libvips-cpp.*.dylib"))
    if len(matches) != 1:
        raise RuntimeError("Set FIRSTS_PANGO_LIBRARY to the bundled Sharp libvips dylib")
    return matches[0]


class Outliner:
    SCALE = 8  # Approved preview width is 800, with a 100-unit viewBox.

    def __init__(self, fonts):
        os.environ["PANGOCAIRO_BACKEND"] = "fc"
        self.library = library_path()
        self.lib = C.CDLL(str(self.library))
        self.fonts = fonts
        self.resolved_fonts = {}
        declarations = {
            "FcConfigCreate": (C.c_void_p, []),
            "FcConfigAppFontAddFile": (C.c_int, [C.c_void_p, C.c_char_p]),
            "FcConfigSetCurrent": (C.c_int, [C.c_void_p]),
            "FcConfigDestroy": (None, [C.c_void_p]),
            "FcPatternGetString": (C.c_int, [C.c_void_p, C.c_char_p, C.c_int, C.POINTER(C.c_char_p)]),
            "pango_fc_font_get_pattern": (C.c_void_p, [C.c_void_p]),
            "pango_font_description_from_string": (C.c_void_p, [C.c_char_p]),
            "pango_font_description_set_absolute_size": (None, [C.c_void_p, C.c_double]),
            "pango_font_description_free": (None, [C.c_void_p]),
            "pango_cairo_create_layout": (C.c_void_p, [C.c_void_p]),
            "pango_layout_set_font_description": (None, [C.c_void_p, C.c_void_p]),
            "pango_layout_set_text": (None, [C.c_void_p, C.c_char_p, C.c_int]),
            "pango_layout_set_attributes": (None, [C.c_void_p, C.c_void_p]),
            "pango_layout_get_extents": (None, [C.c_void_p, C.POINTER(Rectangle), C.POINTER(Rectangle)]),
            "pango_layout_get_baseline": (C.c_int, [C.c_void_p]),
            "pango_layout_get_context": (C.c_void_p, [C.c_void_p]),
            "pango_context_set_round_glyph_positions": (None, [C.c_void_p, C.c_int]),
            "pango_context_load_font": (C.c_void_p, [C.c_void_p, C.c_void_p]),
            "pango_cairo_layout_path": (None, [C.c_void_p, C.c_void_p]),
            "pango_attr_list_new": (C.c_void_p, []),
            "pango_attr_list_insert": (None, [C.c_void_p, C.c_void_p]),
            "pango_attr_list_unref": (None, [C.c_void_p]),
            "pango_attr_letter_spacing_new": (C.c_void_p, [C.c_int]),
            "pango_attr_fallback_new": (C.c_void_p, [C.c_int]),
            "pango_version_string": (C.c_char_p, []),
            "cairo_image_surface_create": (C.c_void_p, [C.c_int, C.c_int, C.c_int]),
            "cairo_surface_destroy": (None, [C.c_void_p]),
            "cairo_create": (C.c_void_p, [C.c_void_p]),
            "cairo_destroy": (None, [C.c_void_p]),
            "cairo_font_options_create": (C.c_void_p, []),
            "cairo_font_options_set_hint_style": (None, [C.c_void_p, C.c_int]),
            "cairo_font_options_set_hint_metrics": (None, [C.c_void_p, C.c_int]),
            "cairo_set_font_options": (None, [C.c_void_p, C.c_void_p]),
            "cairo_font_options_destroy": (None, [C.c_void_p]),
            "cairo_move_to": (None, [C.c_void_p, C.c_double, C.c_double]),
            "cairo_copy_path": (C.POINTER(CairoPath), [C.c_void_p]),
            "cairo_path_destroy": (None, [C.POINTER(CairoPath)]),
            "g_object_unref": (None, [C.c_void_p]),
        }
        for name, (result, args) in declarations.items():
            function = getattr(self.lib, name)
            function.restype, function.argtypes = result, args
        config = self.lib.FcConfigCreate()
        try:
            for font in fonts.values():
                if not self.lib.FcConfigAppFontAddFile(config, str(font).encode()):
                    raise RuntimeError(f"Cannot register {font}")
            if not self.lib.FcConfigSetCurrent(config):
                raise RuntimeError("Cannot activate font configuration")
        finally:
            self.lib.FcConfigDestroy(config)

    def outline(self, attributes, text):
        if not text.isascii():
            raise ValueError("Only the approved ASCII labels are supported")
        l = self.lib
        surface = l.cairo_image_surface_create(0, 800, 800)
        cr = l.cairo_create(surface)
        options = l.cairo_font_options_create()
        l.cairo_font_options_set_hint_style(options, 1)  # NONE
        l.cairo_font_options_set_hint_metrics(options, 1)  # OFF
        l.cairo_set_font_options(cr, options)
        layout = l.pango_cairo_create_layout(cr)
        context = l.pango_layout_get_context(layout)
        l.pango_context_set_round_glyph_positions(context, 0)
        family = attributes["font-family"].split(",")[0].strip()
        description = l.pango_font_description_from_string(family.encode())
        l.pango_font_description_set_absolute_size(description, float(attributes["font-size"]) * self.SCALE * 1024)
        l.pango_layout_set_font_description(layout, description)
        resolved = l.pango_context_load_font(context, description)
        filename = C.c_char_p()
        pattern = l.pango_fc_font_get_pattern(resolved)
        if l.FcPatternGetString(pattern, b"file", 0, C.byref(filename)) != 0:
            raise RuntimeError(f"Cannot resolve actual font file for {family}")
        actual = Path(filename.value.decode()).resolve()
        if actual != self.fonts[family].resolve():
            raise RuntimeError(f"Font fallback: {family} resolved to {actual}")
        self.resolved_fonts[family] = str(actual)
        attrs = l.pango_attr_list_new()
        l.pango_attr_list_insert(attrs, l.pango_attr_fallback_new(0))
        tracking = float(attributes.get("letter-spacing", 0))
        if tracking:
            l.pango_attr_list_insert(attrs, l.pango_attr_letter_spacing_new(round(tracking * self.SCALE * 1024)))
        l.pango_layout_set_attributes(layout, attrs)
        l.pango_layout_set_text(layout, text.encode(), -1)
        ink, logical = Rectangle(), Rectangle()
        l.pango_layout_get_extents(layout, C.byref(ink), C.byref(logical))
        width = logical.width / 1024
        baseline = l.pango_layout_get_baseline(layout) / 1024
        x = float(attributes["x"]) * self.SCALE - width / 2
        y = float(attributes["y"]) * self.SCALE - baseline
        l.cairo_move_to(cr, x, y)
        l.pango_cairo_layout_path(cr, layout)
        path = l.cairo_copy_path(cr)
        try:
            if path.contents.status:
                raise RuntimeError(f"Cairo path status {path.contents.status}")
            commands = []
            cursor = 0
            while cursor < path.contents.num_data:
                data = path.contents.data
                header = data[cursor].header
                command = ["M", "L", "C", "Z"][header.type]
                numbers = []
                for index in range(1, header.length):
                    point = data[cursor + index].point
                    numbers.extend((point.x / self.SCALE, point.y / self.SCALE))
                commands.append(command + " ".join(f"{n:.6f}".rstrip("0").rstrip(".") for n in numbers))
                cursor += header.length
            return "".join(commands)
        finally:
            l.cairo_path_destroy(path)
            l.g_object_unref(resolved)
            l.pango_attr_list_unref(attrs)
            l.pango_font_description_free(description)
            l.g_object_unref(layout)
            l.cairo_font_options_destroy(options)
            l.cairo_destroy(cr)
            l.cairo_surface_destroy(surface)
