#!/usr/bin/env python3
"""Bake the isolated salle témoin in Blender 4.2.

Blender 4.2 removed the glTF `export_colors` argument (it raises TypeError).
Vertex colours are exported with `export_vertex_color` instead.

The bake is indoor only: a 5000 K laylight and hidden 3000 K picture spots.
There is no sun and no world light, so nothing casts a shadow through the vault.
Run inside Blender:
  blender --background --python bake_salle_temoin.py -- --preview
  blender --background --python bake_salle_temoin.py -- --bake
"""
from __future__ import annotations

import json
import math
import os
import random
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / 'assets'
LAYOUT_PATH = ROOT / 'layout.json'


def argv_after_double_dash():
    if '--' in sys.argv:
        return sys.argv[sys.argv.index('--') + 1:]
    return []


def srgb_to_linear(channel: float) -> float:
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def hex_color(value: str):
    value = value.lstrip('#')
    return tuple(srgb_to_linear(int(value[i:i + 2], 16) / 255) for i in (0, 2, 4))


def kelvin(temperature: float):
    t = temperature / 100
    if t <= 66:
        red = 255
        green = 99.4708025861 * math.log(t) - 161.1195681661
    else:
        red = 329.698727446 * ((t - 60) ** -0.1332047592)
        green = 288.1221695283 * ((t - 60) ** -0.0755148492)
    if t >= 66:
        blue = 255
    elif t <= 19:
        blue = 0
    else:
        blue = 138.5177312231 * math.log(t - 10) - 305.0447927307
    rgb = [min(255, max(0, c)) / 255 for c in (red, green, blue)]
    return tuple(srgb_to_linear(c) for c in rgb)


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def cross(a, b):
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def order_outward(coords, uvs, light_uvs, normal):
    n = cross(sub(coords[1], coords[0]), sub(coords[2], coords[0]))
    if dot(n, normal) < 0:
        return coords[::-1], uvs[::-1], light_uvs[::-1]
    return coords, uvs, light_uvs


class Atlas:
    def __init__(self, size, bins):
        self.size = size
        self.bins = [{'x': x, 'y': y, 'w': w, 'h': h, 'cx': x, 'cy': y, 'rh': 0} for x, y, w, h in bins]
        self.used = 0

    def alloc(self, pixels_w, pixels_h):
        pw = max(4, int(math.ceil(pixels_w)) + 4)
        ph = max(4, int(math.ceil(pixels_h)) + 4)
        for bin_ in self.bins:
            if bin_['cx'] + pw > bin_['x'] + bin_['w']:
                bin_['cy'] += bin_['rh'] + 3
                bin_['cx'] = bin_['x']
                bin_['rh'] = 0
            if bin_['cy'] + ph <= bin_['y'] + bin_['h'] and bin_['cx'] + pw <= bin_['x'] + bin_['w']:
                rect = (bin_['cx'], bin_['cy'], pw, ph)
                bin_['cx'] += pw + 2
                bin_['rh'] = max(bin_['rh'], ph)
                self.used += pw * ph
                return rect
        raise RuntimeError(f'Lightmap atlas is full ({pw}×{ph}).')

    def uvs(self, rect):
        x, y, w, h = rect
        inset = 2
        def uv(a, b):
            return (
                (x + inset + a * (w - 2 * inset)) / self.size,
                (y + inset + b * (h - 2 * inset)) / self.size,
            )
        return [uv(0, 0), uv(1, 0), uv(1, 1), uv(0, 1)]


class Accum:
    def __init__(self, name, material):
        self.name = name
        self.material = material
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new('UVMap')
        self.light = self.bm.loops.layers.uv.new('Lightmap')
        self.color = self.bm.loops.layers.color.new('Color')

    def quad(self, coords, uvs, light_uvs, normal, tint=(1, 1, 1, 1)):
        area = Vector(cross(sub(coords[1], coords[0]), sub(coords[2], coords[0]))).length
        if area < 1e-7:
            return None
        coords, uvs, light_uvs = order_outward(coords, uvs, light_uvs, normal)
        verts = [self.bm.verts.new(c) for c in coords]
        face = self.bm.faces.new(verts)
        for loop, uv, luv in zip(face.loops, uvs, light_uvs):
            loop[self.uv].uv = uv
            loop[self.light].uv = luv
            loop[self.color] = tint
        return face

    def finish(self, smooth=False):
        if not self.bm.faces:
            self.bm.free()
            return None
        self.bm.normal_update()
        mesh = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        mesh.materials.append(self.material)
        if mesh.color_attributes:
            mesh.color_attributes.active_color = mesh.color_attributes[0]
        for polygon in mesh.polygons:
            polygon.use_smooth = smooth
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        return obj


def load_image(path: Path, linear=False):
    image = bpy.data.images.load(str(path))
    image.colorspace_settings.name = 'Non-Color' if linear else 'sRGB'
    return image


def new_material(name, base, roughness=0.55, metallic=0.0, albedo=None, rough_map=None, normal=None, coat=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Specular IOR Level'].default_value = 0.42
    if coat and 'Coat Weight' in bsdf.inputs:
        bsdf.inputs['Coat Weight'].default_value = coat
        bsdf.inputs['Coat Roughness'].default_value = 0.32
    mix = nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs[0].default_value = 1.0
    vertex = nodes.new('ShaderNodeVertexColor')
    vertex.layer_name = 'Color'
    if albedo:
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = load_image(albedo, linear=False)
        links.new(tex.outputs['Color'], mix.inputs[6])
    else:
        rgb = nodes.new('ShaderNodeRGB')
        rgb.outputs[0].default_value = (*base, 1)
        links.new(rgb.outputs[0], mix.inputs[6])
    links.new(vertex.outputs['Color'], mix.inputs[7])
    links.new(mix.outputs[2], bsdf.inputs['Base Color'])
    if rough_map:
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = load_image(rough_map, linear=True)
        links.new(tex.outputs['Color'], bsdf.inputs['Roughness'])
    if normal:
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = load_image(normal, linear=True)
        bump = nodes.new('ShaderNodeNormalMap')
        bump.inputs['Strength'].default_value = 0.8
        links.new(tex.outputs['Color'], bump.inputs['Color'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return material


def emission_material(name, color, strength):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Emission Color'].default_value = (*color, 1)
    bsdf.inputs['Emission Strength'].default_value = strength
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    return material


def attach_bake_target(material, image):
    node = material.node_tree.nodes.new('ShaderNodeTexImage')
    node.name = 'BAKE'
    node.image = image
    material.node_tree.nodes.active = node


def wall_uv(z_along, y_up, rect, length, height, size):
    return (
        (rect['x'] + (z_along / length) * rect['w']) / size,
        (rect['y'] + (y_up / height) * rect['h']) / size,
    )


def floor_uv(x, z_along, rect, width, length, size, origin_x):
    return (
        (rect['x'] + (z_along / length) * rect['w']) / size,
        (rect['y'] + ((x - origin_x) / width) * rect['h']) / size,
    )


def planar_uv(coords, scale=1.85):
    """World-scale UVs so a scanned 2 m texture tiles instead of stretching."""
    spans = []
    for axis in range(3):
        values = [c[axis] for c in coords]
        spans.append(max(values) - min(values))
    order = sorted(range(3), key=lambda i: spans[i])
    u_axis, v_axis = order[2], order[1]
    if spans[u_axis] < 1e-6:
        u_axis, v_axis = 0, 2
    return [(c[u_axis] / scale, c[v_axis] / scale) for c in coords]


def shrink(coords, amount):
    cx = sum(p[0] for p in coords) / len(coords)
    cy = sum(p[1] for p in coords) / len(coords)
    out = []
    for x, y in coords:
        dx, dy = x - cx, y - cy
        length = math.hypot(dx, dy) or 1
        scale = max(0.2, length - amount) / length
        out.append((cx + dx * scale, cy + dy * scale))
    return out


def polygon_area(points):
    total = 0
    for index, (x, y) in enumerate(points):
        nx, ny = points[(index + 1) % len(points)]
        total += x * ny - nx * y
    return abs(total) * 0.5


def clip_rect(poly, x0, y0, x1, y1):
    def clip(points, inside, hit):
        if not points:
            return []
        output = []
        previous = points[-1]
        for current in points:
            if inside(current):
                if not inside(previous):
                    output.append(hit(previous, current))
                output.append(current)
            elif inside(previous):
                output.append(hit(previous, current))
            previous = current
        return output

    def at_x(a, b, x):
        denom = b[0] - a[0]
        t = 0 if abs(denom) < 1e-9 else (x - a[0]) / denom
        return (x, a[1] + t * (b[1] - a[1]))

    def at_y(a, b, y):
        denom = b[1] - a[1]
        t = 0 if abs(denom) < 1e-9 else (y - a[1]) / denom
        return (a[0] + t * (b[0] - a[0]), y)

    poly = clip(poly, lambda p: p[0] >= x0 - 1e-8, lambda a, b: at_x(a, b, x0))
    poly = clip(poly, lambda p: p[0] <= x1 + 1e-8, lambda a, b: at_x(a, b, x1))
    poly = clip(poly, lambda p: p[1] >= y0 - 1e-8, lambda a, b: at_y(a, b, y0))
    poly = clip(poly, lambda p: p[1] <= y1 + 1e-8, lambda a, b: at_y(a, b, y1))
    return poly


def board_tint(seed):
    random.seed(seed)
    warmth = random.uniform(0.78, 1.14)
    if random.random() < 0.09:
        warmth *= random.uniform(0.55, 0.72)
    red = warmth * random.uniform(0.96, 1.08)
    blue = warmth * random.uniform(0.86, 1.0)
    return (red, warmth * 0.98, blue, 1)


class RoomBuilder:
    def __init__(self, layout):
        self.layout = layout
        self.room = layout['room']
        self.size = layout['lightmap']['size']
        self.floor_rect = layout['lightmap']['floor']
        self.wall_rects = {
            'left': layout['lightmap']['left'],
            'right': layout['lightmap']['right'],
            'north': layout['lightmap']['north'],
            'south': layout['lightmap']['south'],
        }
        light = layout['lightmap']
        # Free space around the reserved floor, wall and vault islands.
        # Trim, frames and mullions land here. Contact shadows stay on the
        # wall islands, which keep the high texel density.
        self.atlas = Atlas(self.size, [
            (2816, 8, 1264, 1664),
            (3608, 1712, 472, 2368),
            (2184, 2536, 1408, 760),
            (2216, 3344, 1864, 736),
        ])
        gold = hex_color('#E8C56B')
        pbr = ASSETS / 'pbr'
        self.mat = {
            'parquet': new_material('parquet', hex_color('#C4A882'), 0.42, 0.0,
                                    pbr / 'oak-diff.jpg', pbr / 'oak-rough.jpg', pbr / 'oak-nor.jpg', coat=0.2),
            'stone': new_material('stone', hex_color('#E4DCCE'), 0.78, 0.0,
                                  pbr / 'plaster-diff.jpg', pbr / 'plaster-rough.jpg', pbr / 'plaster-nor.jpg'),
            'pompeian': new_material('pompeian', hex_color('#FFFFFF'), 0.86, 0.0,
                                     pbr / 'pompeian-diff.jpg', pbr / 'plaster-rough.jpg', pbr / 'plaster-nor.jpg'),
            'gilt': new_material('gilt', gold, 0.24, 1.0),
            'liner': new_material('liner', hex_color('#E7D5BA'), 0.72, 0.0),
            'artwork': new_material('artwork', hex_color('#6E5844'), 0.62, 0.0),
            'cartel': new_material('cartel', hex_color('#C8B48A'), 0.42, 0.35),
            'mullion': new_material('mullion', hex_color('#E7E1D6'), 0.45, 0.15,
                                    pbr / 'plaster-diff.jpg', pbr / 'plaster-rough.jpg', pbr / 'plaster-nor.jpg'),
            'benchWood': new_material('benchWood', hex_color('#8A6240'), 0.5, 0.0,
                                      pbr / 'oak-diff.jpg', pbr / 'oak-rough.jpg', pbr / 'oak-nor.jpg'),
            'benchSeat': new_material('benchSeat', hex_color('#FFFFFF'), 0.48, 0.0,
                                      pbr / 'leather-diff.jpg', pbr / 'leather-rough.jpg', pbr / 'leather-nor.jpg'),
            'marble': new_material('marble', hex_color('#FFFFFF'), 0.2, 0.02,
                                   pbr / 'marble-diff.jpg', pbr / 'marble-rough.jpg', pbr / 'marble-nor.jpg'),
            'door': new_material('door', hex_color('#6A4A30'), 0.46, 0.0,
                                 pbr / 'oak-diff.jpg', pbr / 'oak-rough.jpg', pbr / 'oak-nor.jpg'),
            'brass': new_material('brass', hex_color('#C4A36A'), 0.28, 1.0),
            'laylight': emission_material('laylight', kelvin(5000), 1.4),
        }
        self.mesh = {name: Accum(name, material) for name, material in self.mat.items() if name != 'laylight'}
        self.mesh['vaultRib'] = Accum('vaultRib', self.mat['stone'])
        self.mesh['parquetEdge'] = Accum('parquetEdge', self.mat['parquet'])
        self.laylight_mat = self.mat['laylight']
        self.heroes = []
        self.nonhero = 0

    def art_uvs(self, hero, facing):
        if hero:
            return facing
        columns = 8
        index = self.nonhero
        self.nonhero += 1
        column, row = index % columns, index // columns
        pad = 0.015 / columns
        step = 1 / columns
        u0, v0 = column * step + pad, row * step + pad
        u1, v1 = (column + 1) * step - pad, (row + 1) * step - pad
        return [(u0 + u * (u1 - u0), v0 + v * (v1 - v0)) for u, v in facing]

    def light_uvs_floor(self, points):
        origin = -self.room['width'] / 2
        return [
            floor_uv(x, z, self.floor_rect, self.room['width'], self.room['length'], self.size, origin)
            for x, z in points
        ]

    def light_uvs_wall(self, wall, points):
        rect = self.wall_rects[wall]
        height = self.room['corniceY']
        span = self.room['length'] if wall in ('left', 'right') else self.room['width']
        uvs = []
        for along, up in points:
            uvs.append(wall_uv(along, up, rect, span, height, self.size))
        return uvs

    def plank_uvs(self, pts, tint):
        """One straight-grain island per board: length along the scan's grain, random offset."""
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        along_x = (max(xs) - min(xs)) >= (max(ys) - min(ys))
        rng = random.Random((int(min(xs) * 137) * 13 + int(min(ys) * 91)) ^ int(tint[0] * 1000))
        u_off = rng.random() * 8
        v_off = rng.random() * 8
        flip = 1 if rng.random() > 0.5 else -1
        grain = 1.8
        uvs = []
        for x, y in pts:
            along, across = (x, y) if along_x else (y, x)
            uvs.append((across / grain + u_off, along / grain * flip + v_off))
        return uvs

    def packed(self, width_m, height_m, density=100):
        return self.atlas.uvs(self.atlas.alloc(width_m * density, height_m * density))

    def floor_quad(self, pts, tint, along_is_x):
        pts = shrink(pts, 0.00035)
        coords = [(x, y, 0.0) for x, y in pts]
        uvs = self.plank_uvs(pts, tint)
        self.mesh['parquet'].quad(coords, uvs, self.light_uvs_floor(pts), (0, 0, 1), tint)
        self._board_edge(coords, tint)
    def _board_edge(self, coords, tint):
        # A few millimetres of real edge so a grazing view sees wood, not a slot.
        origin = -self.room['width'] / 2
        center_uv = floor_uv(0, self.room['length'] / 2, self.floor_rect, self.room['width'], self.room['length'], self.size, origin)
        bottom = [(x, y, -0.0015) for x, y, _z in coords]
        for index in range(4):
            a, b = coords[index], coords[(index + 1) % 4]
            d, c = bottom[index], bottom[(index + 1) % 4]
            dx, dy = b[0] - a[0], b[1] - a[1]
            self.mesh['parquetEdge'].quad(
                [a, b, c, d],
                [(0, 0), (1, 0), (1, 0.15), (0, 0.15)],
                [center_uv, center_uv, center_uv, center_uv],
                (dy, -dx, 0),
                tint,
            )

    def add_floor_shell(self):
        """Continuous floor used only for the bake, so joints are not painted into the lightmap."""
        half = self.room['width'] / 2
        length = self.room['length']
        pts = [(-half, 0.0), (half, 0.0), (half, length), (-half, length)]
        coords = [(x, y, -0.001) for x, y in pts]
        shell = Accum('floorShell', self.mat['stone'])
        shell.quad(coords, [(0, 0), (1, 0), (1, 1), (0, 1)], self.light_uvs_floor(pts), (0, 0, 1))
        self.mesh['floorShell'] = shell

    def add_versailles(self):
        panel = self.room['panel']
        nx = int(round(self.room['width'] / panel))
        nz = int(round(self.room['length'] / panel))
        origin_x = -self.room['width'] / 2
        seed = 0
        for ix in range(nx):
            for iz in range(nz):
                self.panel(origin_x + ix * panel, iz * panel, panel, (ix + iz) % 2 == 0, seed)
                seed += 1
        self.add_floor_shell()
        under = bpy.data.materials.new('underlay')
        # The crack mesh is not baked; a flat dark joint reads through the real gaps.
        under.use_nodes = True
        bsdf = under.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = (*hex_color('#241810'), 1)
        bsdf.inputs['Roughness'].default_value = 0.92
        mesh = bpy.data.meshes.new('underlay')
        bm = bmesh.new()
        w, h = self.room['width'] / 2, self.room['length']
        coords = [(-w, 0, -0.008), (w, 0, -0.008), (w, h, -0.008), (-w, h, -0.008)]
        bm.faces.new([bm.verts.new(c) for c in coords])
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(under)
        obj = bpy.data.objects.new('underlay', mesh)
        bpy.context.scene.collection.objects.link(obj)

    def miter(self, x, y, size, inner, outer, seed):
        rings = [
            ((0, 0), (size, 0), (size - outer, outer), (outer, outer)),
            ((outer, size - outer), (size - outer, size - outer), (size, size), (0, size)),
            ((0, 0), (outer, outer), (outer, size - outer), (0, size)),
            ((size - outer, outer), (size, 0), (size, size), (size - outer, size - outer)),
        ]
        for index, ring in enumerate(rings):
            absolute = [(x + px, y + py) for px, py in ring]
            # Split long borders so neighbouring boards are not the same plank.
            self.floor_quad(absolute, board_tint(seed + index * 19), True)

    def panel(self, x, y, size, horizontal, seed):
        outer = 0.058
        inner = 0.104
        self.miter(x, y, size, outer, outer, seed)
        self.miter(x + outer, y + outer, size - 2 * outer, inner - outer, inner - outer, seed + 50)
        # Compartment parquet: a mitered frame, then a field of real boards
        # whose grain turns 90° from one panel to the next.
        self.fill_versailles(x + inner, y + inner, size - 2 * inner, seed + 80)

    def fill_versailles(self, x, y, size, seed):
        """Diamond on the midpoints of the inner square, plus the four corner triangles.

        Each piece is sliced into boards that share the diamond edge exactly,
        so the panel has no hole between the diamond and the corners.
        """
        m = size * 0.5
        strip = 0.048

        def boards_between(y0, y1, left_fn, right_fn, salt):
            cursor = y0
            index = 0
            while cursor < y1 - 1e-4:
                nxt = min(cursor + strip, y1)
                pts = [
                    (x + left_fn(cursor), y + cursor),
                    (x + right_fn(cursor), y + cursor),
                    (x + right_fn(nxt), y + nxt),
                    (x + left_fn(nxt), y + nxt),
                ]
                if abs(pts[1][0] - pts[0][0]) > 0.008 or abs(pts[2][0] - pts[3][0]) > 0.008:
                    self.floor_ngon(shrink(pts, 0.0008), board_tint(seed + salt + index))
                cursor = nxt
                index += 1

        # Diamond. At height h the half-width is the distance to the nearer point.
        def half_width(h):
            return min(h, size - h)

        boards_between(0, size, lambda h: m - half_width(h), lambda h: m + half_width(h), 0)
        # SW and SE sit outside the diamond on the lower half; NW and NE on the upper half.
        boards_between(0, m, lambda h: 0.0, lambda h: m - h, 80)
        boards_between(0, m, lambda h: m + h, lambda h: size, 120)
        boards_between(m, size, lambda h: 0.0, lambda h: h - m, 160)
        boards_between(m, size, lambda h: size - (h - m), lambda h: size, 200)

    def fill_field(self, x, y, size, seed, horizontal):
        strip = 0.056
        piece = 0.31

        def cuts(start, end):
            points = [start]
            cursor = start + piece
            while cursor < end - piece * 0.45:
                points.append(cursor)
                cursor += piece
            points.append(end)
            return points

        index = 0
        if horizontal:
            cursor = y
            xs = cuts(x, x + size)
            while cursor < y + size - 0.002:
                nxt = min(cursor + strip, y + size)
                for left, right in zip(xs, xs[1:]):
                    self.floor_quad([
                        (left, cursor), (right - 0.00045, cursor),
                        (right - 0.00045, nxt - 0.00045), (left, nxt - 0.00045),
                    ], board_tint(seed + index), True)
                    index += 1
                cursor += strip
        else:
            cursor = x
            ys = cuts(y, y + size)
            while cursor < x + size - 0.002:
                nxt = min(cursor + strip, x + size)
                for bottom, top in zip(ys, ys[1:]):
                    self.floor_quad([
                        (cursor, bottom), (nxt - 0.00045, bottom),
                        (nxt - 0.00045, top - 0.00045), (cursor, top - 0.00045),
                    ], board_tint(seed + index), False)
                    index += 1
                cursor += strip

    def corners(self, x, y, b, center, edge, seed):
        """Four right triangles around the centre diamond. edge = size - b."""
        strip = 0.046
        def band(y0, y1, x_at):
            cursor = y0
            index = 0
            while cursor < y1 - 0.003:
                nxt = min(cursor + strip, y1)
                mid = (cursor + nxt) * 0.5
                xa, xb = x_at(mid)
                if xb - xa > 0.012:
                    self.floor_quad([
                        (xa, cursor), (xb, cursor), (xb, nxt - 0.001), (xa, nxt - 0.001),
                    ], board_tint(seed + index + int(y0 * 10)), True)
                cursor = nxt
                index += 1
        # Local coordinates, then translated by the panel origin.
        def place(y0, y1, x_at):
            band_fn = lambda yy0, yy1, fn: band(yy0, yy1, lambda mid: (x + fn(mid)[0], x + fn(mid)[1]))
            # The helper above mixes spaces. Do it directly.
        def run(y0, y1, left_right):
            cursor = y0
            index = 0
            while cursor < y1 - 0.003:
                nxt = min(cursor + strip, y1)
                mid = (cursor + nxt) * 0.5
                xa, xb = left_right(mid)
                if xb - xa > 0.012:
                    self.floor_quad([
                        (x + xa, y + cursor),
                        (x + xb, y + cursor),
                        (x + xb, y + nxt - 0.001),
                        (x + xa, y + nxt - 0.001),
                    ], board_tint(seed + index + int((y0 + 3) * 17)), True)
                cursor = nxt
                index += 1
        run(b, center, lambda mid: (b, center - (mid - b)))
        run(b, center, lambda mid: (center + (mid - b), edge))
        run(center, edge, lambda mid: (b, b + (mid - center)))
        run(center, edge, lambda mid: (edge - (mid - center), edge))

    def fill_herringbone(self, x, y, size, seed, flip):
        """Gapless 90° herringbone clipped to the panel, so the field is wood, not holes."""
        pw, pl = 0.058, 0.30
        x0, y0, x1, y1 = x, y, x + size, y + size
        rects = []
        cursor = x0 - pl
        column = 0
        while cursor < x1 + pl:
            if (column % 2 == 0) ^ flip:
                step = y0 - pl
                while step < y1 + pl:
                    rects.append([(cursor, step), (cursor + pw, step), (cursor + pw, step + pl), (cursor, step + pl)])
                    step += pl
                cursor += pw
            else:
                step = y0 - pl
                while step < y1 + pl:
                    rects.append([(cursor, step), (cursor + pl, step), (cursor + pl, step + pw), (cursor, step + pw)])
                    step += pw
                cursor += pl
            column += 1
        index = 0
        for rect in rects:
            clipped = clip_rect(rect, x0, y0, x1, y1)
            if len(clipped) < 3:
                continue
            clipped = shrink(clipped, 0.0003)
            if polygon_area(clipped) < 2.5e-4:
                continue
            self.floor_ngon(clipped, board_tint(seed + index))
            index += 1

    def floor_ngon(self, pts, tint):
        clean = []
        for point in pts:
            if not clean or math.hypot(point[0] - clean[-1][0], point[1] - clean[-1][1]) > 1e-5:
                clean.append(point)
        if len(clean) >= 2 and math.hypot(clean[0][0] - clean[-1][0], clean[0][1] - clean[-1][1]) < 1e-5:
            clean.pop()
        pts = clean
        if len(pts) < 3:
            return
        coords = [(x, y, 0.0) for x, y in pts]
        uvs = self.plank_uvs(pts, tint)
        light = self.light_uvs_floor(pts)
        normal = (0, 0, 1)
        coords, uvs, light = order_outward(coords, uvs, light, normal)
        if Vector(cross(sub(coords[1], coords[0]), sub(coords[2], coords[0]))).length < 1e-7:
            return
        verts = [self.mesh['parquet'].bm.verts.new(c) for c in coords]
        face = self.mesh['parquet'].bm.faces.new(verts)
        for loop, uv, luv in zip(face.loops, uvs, light):
            loop[self.mesh['parquet'].uv].uv = uv
            loop[self.mesh['parquet'].light].uv = luv
            loop[self.mesh['parquet'].color] = tint

    def diamond_strips_h(self, x, y, b, center, half, seed):
        strip = 0.052
        z = b
        index = 0
        while z < b + half * 2 - 0.004:
            z2 = min(z + strip, b + half * 2)
            mid = (z + z2) / 2
            reach = half - abs(mid - center)
            if reach > 0.012:
                self.floor_quad([
                    (x + center - reach, y + z),
                    (x + center + reach, y + z),
                    (x + center + reach, y + z2 - 0.0012),
                    (x + center - reach, y + z2 - 0.0012),
                ], board_tint(seed + index), True)
            z += strip
            index += 1

    def diamond_strips_v(self, x, y, b, center, half, seed):
        strip = 0.052
        cursor = b
        index = 0
        while cursor < b + half * 2 - 0.004:
            cursor2 = min(cursor + strip, b + half * 2)
            mid = (cursor + cursor2) / 2
            reach = half - abs(mid - center)
            if reach > 0.012:
                self.floor_quad([
                    (x + cursor, y + center - reach),
                    (x + cursor2 - 0.0012, y + center - reach),
                    (x + cursor2 - 0.0012, y + center + reach),
                    (x + cursor, y + center + reach),
                ], board_tint(seed + index), False)
            cursor += strip
            index += 1

    def corner(self, x, y, b, center, half, seed, which):
        # Right triangle between the inner square's corner and the diamond.
        if which == 'sw':
            bounds = [(b, b), (center, b), (b, center)]
        elif which == 'se':
            bounds = [(size_offset(center), b), (b + half * 2, b), (b + half * 2, center)]
        elif which == 'nw':
            bounds = [(b, center), (b, b + half * 2), (center, b + half * 2)]
        else:
            bounds = [(center, b + half * 2), (b + half * 2, center), (b + half * 2, b + half * 2)]
        # Fill with short horizontal slivers clipped to the triangle.
        ys = [p[1] for p in bounds]
        y0, y1 = min(ys), max(ys)
        strip = 0.05
        cursor = y0
        index = 0
        while cursor < y1 - 0.004:
            cursor2 = min(cursor + strip, y1)
            mid = (cursor + cursor2) / 2
            xs = []
            for i in range(3):
                a = bounds[i]
                c = bounds[(i + 1) % 3]
                if (a[1] <= mid <= c[1]) or (c[1] <= mid <= a[1]):
                    if abs(c[1] - a[1]) < 1e-6:
                        xs.extend((a[0], c[0]))
                    else:
                        t = (mid - a[1]) / (c[1] - a[1])
                        xs.append(a[0] + t * (c[0] - a[0]))
            if len(xs) >= 2:
                xa, xb = min(xs), max(xs)
                if xb - xa > 0.012:
                    self.floor_quad([
                        (x + xa, y + cursor),
                        (x + xb, y + cursor),
                        (x + xb, y + cursor2 - 0.0011),
                        (x + xa, y + cursor2 - 0.0011),
                    ], board_tint(seed + index), True)
            cursor += strip
            index += 1


def size_offset(center):
    return center


def build(layout):
    clear_scene()
    room = RoomBuilder(layout)
    room.add_versailles()
    add_shell(room)
    add_frames(room)
    add_props(room)
    add_laylight(room)
    add_lights(room, layout)
    print(f'Atlas used {room.atlas.used / 1e6:.2f} Mpx')
    # Smooth normals across the cornice and the vault ribs read as dark bands.
    objects = []
    for accum in room.mesh.values():
        obj = accum.finish(smooth=False)
        if obj is not None:
            objects.append(obj)
    for hero in room.heroes:
        obj = hero.finish(smooth=False)
        if obj is not None:
            objects.append(obj)
    return objects


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.images, bpy.data.cameras):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def add_shell(room: RoomBuilder):
    r = room.room
    half = r['width'] / 2
    length = r['length']
    # Dado under the canvases, limewash to a short frieze, then the cornice.
    # The previous upper band was two metres of flat grey and read as a false clerestory.
    dado, frieze = 0.56, r['corniceY'] - 0.68
    for bay in room.layout['bays']:
        z0, z1 = bay['field']['minZ'], bay['field']['maxZ']
        for wall, x, normal in (('left', -half, (1, 0, 0)), ('right', half, (-1, 0, 0))):
            bands = [(0.0, dado, 'stone'), (dado, frieze, 'pompeian'), (frieze, r['corniceY'], 'stone')]
            for y0, y1, material in bands:
                coords = [(x, z0, y0), (x, z1, y0), (x, z1, y1), (x, z0, y1)]
                light = room.light_uvs_wall(wall, [(z0, y0), (z1, y0), (z1, y1), (z0, y1)])
                scale = 0.55 if material == 'pompeian' else 1.85
                room.mesh[material].quad(coords, planar_uv(coords, scale), light, normal)
        add_base_and_cornice(room, z0, z1, -half, 1)
        add_base_and_cornice(room, z0, z1, half, -1)
    for bay in room.layout['bays']:
        for wall, x, sign in (('left', -half, 1), ('right', half, -1)):
            add_pilaster(room, x, sign, bay['pilaster']['minZ'], bay['pilaster']['maxZ'], 'y')
    for bay in room.layout['ends']:
        x0, x1 = bay['field']['minX'], bay['field']['maxX']
        # South is the entrance wall: stone, with the door cut out of the centre bay.
        if bay['index'] == 1:
            add_south_with_door(room, x0, x1)
        else:
            wall_quad(room, 'south', x0, x1, 0.0, r['corniceY'], 0.0, (0, 1, 0), 'stone')
        dado, frieze = 0.56, r['corniceY'] - 0.68
        hanging = 'pompeian' if bay['index'] == 1 else 'stone'
        wall_quad(room, 'north', x0, x1, 0.0, dado, length, (0, -1, 0), 'stone')
        wall_quad(room, 'north', x0, x1, dado, frieze, length, (0, -1, 0), hanging)
        wall_quad(room, 'north', x0, x1, frieze, r['corniceY'], length, (0, -1, 0), 'stone')
        add_pilaster_x(room, bay['pilaster']['minX'], bay['pilaster']['maxX'], 0.0, 1)
        add_pilaster_x(room, bay['pilaster']['minX'], bay['pilaster']['maxX'], length, -1)
    add_vault(room)


def wall_quad(room, wall, a0, a1, y0, y1, plane, normal, material):
    if wall in ('north', 'south'):
        coords = [(a0, plane, y0), (a1, plane, y0), (a1, plane, y1), (a0, plane, y1)]
        light = room.light_uvs_wall(wall, [(a0 - (-room.room['width'] / 2), y0), (a1 - (-room.room['width'] / 2), y0), (a1 - (-room.room['width'] / 2), y1), (a0 - (-room.room['width'] / 2), y1)])
    else:
        coords = [(plane, a0, y0), (plane, a1, y0), (plane, a1, y1), (plane, a0, y1)]
        light = room.light_uvs_wall(wall, [(a0, y0), (a1, y0), (a1, y1), (a0, y1)])
    scale = 0.55 if material == 'pompeian' else 1.85
    room.mesh[material].quad(coords, planar_uv(coords, scale), light, normal)


def add_base_and_cornice(room, z0, z1, x, sign):
    r = room.room
    # Moulded stone plinth: toe, scotia, torus.
    box_along_y(room, 'stone', x, sign, z0, z1, 0.0, 0.07, 0.08, density=40)
    box_along_y(room, 'stone', x, sign, z0, z1, 0.07, 0.13, 0.045, density=36)
    box_along_y(room, 'stone', x, sign, z0, z1, 0.13, 0.2, 0.065, density=36)
    # Dado cap, under the lowest canvas (0.74 m).
    box_along_y(room, 'stone', x, sign, z0, z1, 0.46, 0.54, 0.055, density=40)
    box_along_y(room, 'gilt', x, sign, z0, z1, 0.525, 0.548, 0.07, density=28)
    courses = [
        (r['corniceY'] - 0.5, r['corniceY'] - 0.36, 0.08),
        (r['corniceY'] - 0.36, r['corniceY'] - 0.22, 0.16),
        (r['corniceY'] - 0.22, r['corniceY'] - 0.08, 0.24),
        (r['corniceY'] - 0.08, r['corniceY'] + 0.02, 0.32),
    ]
    for y_a, y_b, projection in courses:
        box_along_y(room, 'stone', x, sign, z0, z1, y_a, y_b, projection, density=40)
    box_along_y(room, 'gilt', x, sign, z0, z1, r['corniceY'] - 0.12, r['corniceY'] - 0.07, 0.27, density=28)
    cursor = z0 + 0.06
    while cursor < z1 - 0.14:
        box_along_y(room, 'gilt', x, sign, cursor, min(cursor + 0.1, z1 - 0.04), r['corniceY'] - 0.34, r['corniceY'] - 0.2, 0.23, density=22)
        cursor += 0.28


def box_along_y(room, material, x, sign, z0, z1, y0, y1, depth, density):
    x1 = x + sign * depth
    # Front
    w, h = abs(z1 - z0), abs(y1 - y0)
    front = [(x1, z0, y0), (x1, z1, y0), (x1, z1, y1), (x1, z0, y1)]
    room.mesh[material].quad(front, planar_uv(front), room.packed(w, h, density), (sign, 0, 0))
    soffit = [(x, z0, y0), (x, z1, y0), (x1, z1, y0), (x1, z0, y0)]
    room.mesh[material].quad(soffit, planar_uv(soffit), room.packed(w, depth, density), (0, 0, -1))
    top = [(x, z0, y1), (x1, z0, y1), (x1, z1, y1), (x, z1, y1)]
    room.mesh[material].quad(top, planar_uv(top), room.packed(w, depth, density), (0, 0, 1))


def add_pilaster(room, x, sign, z0, z1, _axis):
    depth = room.room['pilasterDepth']
    x1 = x + sign * depth
    cap0, cap1 = room.room['corniceY'] - 0.42, room.room['corniceY'] - 0.08
    # Shaft, slightly narrower than the full 0.50 m pier.
    inset = 0.04
    a0, a1 = z0 + inset, z1 - inset
    shaft = [(x1, a0, 0.18), (x1, a1, 0.18), (x1, a1, cap0), (x1, a0, cap0)]
    room.mesh['stone'].quad(shaft, planar_uv(shaft), room.packed(a1 - a0, cap0 - 0.18, 70), (sign, 0, 0))
    for z, normal in ((a0, (0, -1, 0)), (a1, (0, 1, 0))):
        room.mesh['stone'].quad(
            [(x, z, 0.18), (x1, z, 0.18), (x1, z, cap0), (x, z, cap0)],
            [(0, 0), (1, 0), (1, 1), (0, 1)],
            room.packed(depth, cap0 - 0.18, 70),
            normal,
        )
    # Base and capital spread to the full pier width so the bay rhythm stays 0.50 m.
    for y0, y1, flare in ((0.0, 0.18, 0.0), (cap0, cap1, 0.0)):
        room.mesh['stone'].quad(
            [(x1 + sign * 0.02, z0 - flare, y0), (x1 + sign * 0.02, z1 + flare, y0), (x1 + sign * 0.02, z1 + flare, y1), (x1 + sign * 0.02, z0 - flare, y1)],
            [(0, 0), (1, 0), (1, 1), (0, 1)],
            room.packed(z1 - z0, y1 - y0, 80),
            (sign, 0, 0),
        )
    # Abacus and a gilt necking so the capital is not a flat stop.
    room.mesh['stone'].quad(
        [(x1 + sign * 0.045, z0 - 0.02, cap1 - 0.05), (x1 + sign * 0.045, z1 + 0.02, cap1 - 0.05), (x1 + sign * 0.045, z1 + 0.02, cap1), (x1 + sign * 0.045, z0 - 0.02, cap1)],
        [(0, 0), (1, 0), (1, 1), (0, 1)],
        room.packed(z1 - z0, 0.05, 50),
        (sign, 0, 0),
    )
    room.mesh['gilt'].quad(
        [(x1 + sign * 0.03, z0, cap0 + 0.015), (x1 + sign * 0.03, z1, cap0 + 0.015), (x1 + sign * 0.03, z1, cap0 + 0.045), (x1 + sign * 0.03, z0, cap0 + 0.045)],
        [(0, 0), (1, 0), (1, 1), (0, 1)],
        room.packed(z1 - z0, 0.03, 60),
        (sign, 0, 0),
    )
    room.mesh['gilt'].quad(
        [(x1 + sign * 0.05, z0 - 0.015, cap1 - 0.02), (x1 + sign * 0.05, z1 + 0.015, cap1 - 0.02), (x1 + sign * 0.05, z1 + 0.015, cap1 - 0.004), (x1 + sign * 0.05, z0 - 0.015, cap1 - 0.004)],
        [(0, 0), (1, 0), (1, 1), (0, 1)],
        room.packed(z1 - z0, 0.02, 40),
        (sign, 0, 0),
    )


def add_pilaster_x(room, x0, x1, plane, sign):
    depth = room.room['endPilasterDepth']
    y1 = plane + sign * depth
    cap0 = room.room['corniceY'] - 0.42
    room.mesh['stone'].quad(
        [(x0, y1, 0.0), (x1, y1, 0.0), (x1, y1, room.room['corniceY']), (x0, y1, room.room['corniceY'])],
        [(0, 0), (1, 0), (1, 1), (0, 1)],
        room.packed(x1 - x0, room.room['corniceY'], 70),
        (0, sign, 0),
    )
    room.mesh['gilt'].quad(
        [(x0, y1 + sign * 0.004, cap0), (x1, y1 + sign * 0.004, cap0), (x1, y1 + sign * 0.004, cap0 + 0.04), (x0, y1 + sign * 0.004, cap0 + 0.04)],
        [(0, 0), (1, 0), (1, 1), (0, 1)],
        room.packed(x1 - x0, 0.04, 60),
        (0, sign, 0),
    )


def add_south_with_door(room, x0, x1):
    # The centre field keeps its 3.00 m width. The door and its stone
    # architrave sit inside that field and never enter a pilaster.
    r = room.room
    door_w, door_h = 1.7, 3.2
    left, right = -door_w / 2, door_w / 2
    wall_quad(room, 'south', x0, left - 0.16, 0.0, r['corniceY'], 0.0, (0, 1, 0), 'stone')
    wall_quad(room, 'south', right + 0.16, x1, 0.0, r['corniceY'], 0.0, (0, 1, 0), 'stone')
    wall_quad(room, 'south', left - 0.16, right + 0.16, door_h, r['corniceY'], 0.0, (0, 1, 0), 'stone')
    # Architrave and closed leaves, projecting 8 cm into the room.
    leaf = room.mesh['door']
    surround = 0.14
    y = 0.06
    leaf.quad(
        [(left, y, 0.0), (right, y, 0.0), (right, y, door_h), (left, y, door_h)],
        [(0, 0), (2, 0), (2, 4), (0, 4)],
        room.packed(door_w, door_h, 70),
        (0, 1, 0),
        board_tint(9),
    )
    # Two recessed panels per leaf.
    for side in (-0.42, 0.42):
        for bottom, top in ((0.35, 1.35), (1.55, 2.85)):
            room.mesh['door'].quad(
                [(side - 0.28, y + 0.012, bottom), (side + 0.28, y + 0.012, bottom), (side + 0.28, y + 0.012, top), (side - 0.28, y + 0.012, top)],
                [(0, 0), (1, 0), (1, 1), (0, 1)],
                room.packed(0.56, top - bottom, 60),
                (0, 1, 0),
                board_tint(bottom + side),
            )
    # Architrave is a frame, not a slab in front of the leaves.
    bars = [
        (left - surround, right + surround, door_h, door_h + 0.18),
        (left - surround, left, 0.0, door_h),
        (right, right + surround, 0.0, door_h),
    ]
    for xa, xb, za, zb in bars:
        room.mesh['stone'].quad(
            [(xa, 0.1, za), (xb, 0.1, za), (xb, 0.1, zb), (xa, 0.1, zb)],
            [(0, 0), (1, 0), (1, 1), (0, 1)],
            room.packed(max(0.05, xb - xa), max(0.05, zb - za), 50),
            (0, 1, 0),
        )


def add_coffer(room, a, b, z0, z1, rect, r, side, step, steps):
    """One recessed coffer: a frame on the vault surface and a panel set back into it."""
    p = [(a[0], z0, a[1]), (a[0], z1, a[1]), (b[0], z1, b[1]), (b[0], z0, b[1])]
    center = tuple(sum(point[i] for point in p) / 4 for i in range(3))

    def inset(point):
        return tuple(point[i] + (center[i] - point[i]) * 0.22 for i in range(3))

    inner = [inset(point) for point in p]
    lifted = [(point[0], point[1], point[2] + 0.07) for point in inner]

    def vault_uv(point, along):
        u = rect['x'] + (along / r['length']) * rect['w']
        v = rect['y'] + ((step + 0.5) / steps) * (rect['h'] * 0.48) + (0 if side < 0 else rect['h'] * 0.5)
        return (u / room.size, v / room.size)

    light = [vault_uv(point, point[1]) for point in p]
    borders = [
        [p[0], p[1], inner[1], inner[0]],
        [p[1], p[2], inner[2], inner[1]],
        [p[2], p[3], inner[3], inner[2]],
        [p[3], p[0], inner[0], inner[3]],
    ]
    for quad in borders:
        room.mesh['stone'].quad(quad, planar_uv(quad, 2.2), light, (0, 0, -1))
    room.mesh['stone'].quad(lifted, planar_uv(lifted, 2.2), light, (0, 0, -1))
    for i in range(4):
        j = (i + 1) % 4
        reveal = [inner[i], inner[j], lifted[j], lifted[i]]
        room.mesh['stone'].quad(reveal, planar_uv(reveal, 2.2), light, (0, 0, -1))


def add_vault(room: RoomBuilder):
    r = room.room
    half_light = r['laylightHalfWidth']
    springs = []
    steps = 4
    for side in (-1, 1):
        arc = []
        for step in range(steps + 1):
            t = step / steps
            x = (5.02 + (half_light - 5.02) * t) * side
            y = r['vaultSpringY'] + (r['laylightY'] - r['vaultSpringY']) * t + 0.42 * math.sin(math.pi * t)
            arc.append((x, y))
        springs.append(arc)
    cuts = [0.0]
    for bay in room.layout['bays']:
        cuts.append((bay['pilaster']['minZ'] + bay['pilaster']['maxZ']) / 2)
    cuts.append(r['length'])
    cuts = sorted(set(round(c, 5) for c in cuts))
    rect = room.layout['lightmap']['vault']
    for side, arc in zip((-1, 1), springs):
        for index in range(len(cuts) - 1):
            z0, z1 = cuts[index], cuts[index + 1]
            if z1 - z0 < 0.2:
                continue
            # Leave the pier width for the transverse arch.
            if index not in (0, len(cuts) - 2):
                z0 += 0.2
                z1 -= 0.2
            for step in range(steps):
                a, b = arc[step], arc[step + 1]
                add_coffer(room, a, b, z0, z1, rect, r, side, step, steps)
    # Transverse arches, aligned with the pilasters.
    for bay in room.layout['bays']:
        center = (bay['pilaster']['minZ'] + bay['pilaster']['maxZ']) / 2
        for side, arc in zip((-1, 1), springs):
            for step in range(steps):
                a, b = arc[step], arc[step + 1]
                z0, z1 = center - 0.19, center + 0.19
                room.mesh['stone'].quad(
                    [(a[0], z0, a[1] - 0.16), (a[0], z1, a[1] - 0.16), (b[0], z1, b[1] - 0.16), (b[0], z0, b[1] - 0.16)],
                    [(0, 0), (1, 0), (1, 1), (0, 1)],
                    room.packed(0.5, 0.4, 60),
                    (0, 0, -1),
                )
    add_mullions(room, cuts)
    # Close the barrel. Without these lunettes the near end of the vault is a
    # hole onto the black world, which reads as a missing ceiling.
    half = r['width'] / 2
    for plane, normal in ((0.02, (0, 1, 0)), (r['length'] - 0.02, (0, -1, 0))):
        room.mesh['stone'].quad(
            [(-half, plane, r['corniceY']), (half, plane, r['corniceY']),
             (half, plane, r['laylightY'] + 0.35), (-half, plane, r['laylightY'] + 0.35)],
            [(0, 0), (1, 0), (1, 1), (0, 1)],
            room.packed(r['width'], r['laylightY'] - r['corniceY'], 40),
            normal,
        )


def add_mullions(room, cuts):
    """Plaster frame around the laylight, plus one rib per bay. Not a window grid."""
    r = room.room
    half = r['laylightHalfWidth']
    y = r['laylightY'] - 0.1
    z0, z1 = 0.4, r['length'] - 0.4
    for x in (-half - 0.02, half - 0.16):
        bottom = [(x, z0, y), (x + 0.18, z0, y), (x + 0.18, z1, y), (x, z1, y)]
        room.mesh['vaultRib'].quad(bottom, planar_uv(bottom, 2.0), room.packed(z1 - z0, 0.18, 28), (0, 0, -1))
        cheek = [(x, z0, y), (x, z1, y), (x, z1, y + 0.2), (x, z0, y + 0.2)]
        room.mesh['vaultRib'].quad(cheek, planar_uv(cheek, 2.0), room.packed(z1 - z0, 0.2, 24), (-1 if x < 0 else 1, 0, 0))
    for bay in room.layout['bays']:
        center = (bay['pilaster']['minZ'] + bay['pilaster']['maxZ']) / 2
        a, b = center - 0.08, center + 0.08
        rib = [(-half + 0.02, a, y - 0.03), (half - 0.02, a, y - 0.03), (half - 0.02, b, y - 0.03), (-half + 0.02, b, y - 0.03)]
        room.mesh['vaultRib'].quad(rib, planar_uv(rib, 2.0), room.packed(half * 2, 0.16, 28), (0, 0, -1))


def add_laylight(room):
    r = room.room
    half = r['laylightHalfWidth']
    mesh = bpy.data.meshes.new('laylight')
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    light = bm.loops.layers.uv.new('Lightmap')
    color = bm.loops.layers.color.new('Color')
    z0, z1 = 0.4, r['length'] - 0.4
    y = r['laylightY']
    coords = [(-half, z0, y), (half, z0, y), (half, z1, y), (-half, z1, y)]
    face = bm.faces.new([bm.verts.new(c) for c in coords])
    for loop, uv_xy in zip(face.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        loop[uv].uv = uv_xy
        loop[light].uv = uv_xy
        loop[color] = (1, 1, 1, 1)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(room.laylight_mat)
    obj = bpy.data.objects.new('laylight', mesh)
    # The glowing glass is what the camera sees. The area light above it
    # does the illumination, so this plane must not cast a sun-like shadow.
    obj.visible_diffuse = False
    obj.visible_glossy = False
    obj.visible_transmission = False
    obj.visible_shadow = False
    bpy.context.scene.collection.objects.link(obj)


def add_frames(room: RoomBuilder):
    hero_index = 0
    nonhero = 0
    for frame in room.layout['frames']:
        axis = 'x' if frame['wall'] in ('left', 'right') else 'y'
        sign = frame['normal']
        if axis == 'x':
            add_frame_x(room, frame, sign)
        else:
            add_frame_y(room, frame, sign)
        if frame['hero']:
            hero_index += 1
        else:
            nonhero += 1
    for index, cartel in enumerate(room.layout['cartels']):
        add_cartel(room, cartel, index)


def frame_bars(room, x, y0, y1, z0, z1, normal, tint):
    mould = min(y1 - y0, z1 - z0) * 0.5
    # Three gilt steps, proud of the wall, plus a linen liner and the canvas.
    steps = [(0.0, 0.55, 0.03), (0.42, 0.78, 0.055), (0.72, 1.0, 0.04)]
    for start, end, depth in steps:
        inset0 = mould * start
        inset1 = mould * end
        outer = (y0 + inset0, y1 - inset0, z0 + inset0, z1 - inset0)
        inner = (y0 + inset1, y1 - inset1, z0 + inset1, z1 - inset1)
        ring(room, 'gilt', x, outer, inner, depth, normal, tint)
    liner = mould * 0.78
    art = mould
    ring(room, 'liner', x, (y0 + liner, y1 - liner, z0 + liner, z1 - liner), (y0 + art, y1 - art, z0 + art, z1 - art), 0.034, normal, (1, 1, 1, 1))
    return (y0 + art, y1 - art, z0 + art, z1 - art)


def ring(room, material, x, outer, inner, depth, normal, tint):
    oy0, oy1, oz0, oz1 = outer
    iy0, iy1, iz0, iz1 = inner
    x1 = x + normal[0] * depth + normal[1] * depth
    # Four front faces of the moulding.
    bars = [
        ([(x1, oy0, oz1), (x1, oy1, oz1), (x1, iy1, iz1), (x1, iy0, iz1)], (0, 0, 1)),
        ([(x1, oy0, oz0), (x1, iy0, iz0), (x1, iy1, iz0), (x1, oy1, oz0)], (0, 0, -1)),
        ([(x1, oy0, oz0), (x1, oy0, oz1), (x1, iy0, iz1), (x1, iy0, iz0)], normal),
        ([(x1, oy1, oz0), (x1, iy1, iz0), (x1, iy1, iz1), (x1, oy1, oz1)], normal),
    ]
    # The two long sides use the wall normal so the gilt face points into the room.
    faces = [
        ([(x1, oy0, iz1), (x1, oy1, iz1), (x1, oy1, oz1), (x1, oy0, oz1)], normal),
        ([(x1, oy0, oz0), (x1, oy1, oz0), (x1, oy1, iz0), (x1, oy0, iz0)], normal),
        ([(x1, oy0, oz0), (x1, oy0, oz1), (x1, iy0, iz1), (x1, iy0, iz0)], normal),
        ([(x1, oy1, oz0), (x1, iy1, iz0), (x1, iy1, iz1), (x1, oy1, oz1)], normal),
    ]
    for coords, want in faces:
        width = math.dist(coords[0], coords[1])
        height = math.dist(coords[1], coords[2])
        room.mesh[material].quad(coords, [(0, 0), (1, 0), (1, 1), (0, 1)], room.packed(max(width, 0.02), max(height, 0.01), 110), want, tint)


def add_frame_x(room, frame, sign):
    x = frame['x']
    y0, y1 = frame['z'] - frame['width'] / 2, frame['z'] + frame['width'] / 2
    z0, z1 = frame['y'] - frame['height'] / 2, frame['y'] + frame['height'] / 2
    mould = frame['moulding']
    opening = place_moulding(room, x, (sign, 0, 0), y0, y1, z0, z1, mould)
    add_art_and_light(room, frame, x, (sign, 0, 0), opening)


def add_frame_y(room, frame, sign):
    y = frame['z']
    x0, x1 = frame['x'] - frame['width'] / 2, frame['x'] + frame['width'] / 2
    z0, z1 = frame['y'] - frame['height'] / 2, frame['y'] + frame['height'] / 2
    opening = place_moulding_ns(room, y, (0, sign, 0), x0, x1, z0, z1, frame['moulding'])
    add_art_and_light_ns(room, frame, y, (0, sign, 0), opening)


def gilt_steps(samples=14):
    """Smooth profile: bead, deep cove, second bead, sight edge. Sampled, not flat stripes."""
    keys = [(0.00, 0.18), (0.08, 0.62), (0.16, 1.00), (0.28, 0.48), (0.40, 0.08), (0.52, 0.70), (0.64, 0.22), (0.78, 0.92), (0.90, 0.40), (1.00, 0.16)]

    def at(t):
        for (a, da), (b, db) in zip(keys, keys[1:]):
            if a <= t <= b + 1e-6:
                u = 0 if b == a else (t - a) / (b - a)
                u = u * u * (3 - 2 * u)
                return da + (db - da) * u
        return keys[-1][1]

    steps = []
    for index in range(samples):
        t0, t1 = index / samples, (index + 1) / samples
        depth_k = at((t0 + t1) * 0.5)
        shade = 0.55 + 0.45 * depth_k
        steps.append((t0, t1, depth_k, (shade, shade * 0.8, shade * 0.45, 1)))
    return steps


def gilt_face_uv(coords, t0, t1):
    length = math.dist(coords[0], coords[1])
    return [(0, t0), (length / 0.08, t0), (length / 0.08, t1), (0, t1)]


def place_moulding(room, x, normal, y0, y1, z0, z1, mould):
    for start, end, depth_k, tint in gilt_steps():
        a0, a1 = mould * start, mould * end
        depth = 0.012 + 0.13 * depth_k
        oy0, oy1, oz0, oz1 = y0 + a0, y1 - a0, z0 + a0, z1 - a0
        iy0, iy1, iz0, iz1 = y0 + a1, y1 - a1, z0 + a1, z1 - a1
        x1 = x + normal[0] * depth
        quads = [
            [(x1, oy0, oz1), (x1, oy1, oz1), (x1, iy1, iz1), (x1, iy0, iz1)],
            [(x1, oy0, oz0), (x1, iy0, iz0), (x1, iy1, iz0), (x1, oy1, oz0)],
            [(x1, oy0, oz0), (x1, oy0, oz1), (x1, iy0, iz1), (x1, iy0, iz0)],
            [(x1, oy1, oz0), (x1, iy1, iz0), (x1, iy1, iz1), (x1, oy1, oz1)],
        ]
        for coords in quads:
            room.mesh['gilt'].quad(coords, gilt_face_uv(coords, start, end), room.packed(max(0.05, abs(y1 - y0)), max(0.02, a1 - a0), 36), normal, tint)
    liner_a, art_a = mould * 0.82, mould
    x1 = x + normal[0] * 0.03
    room.mesh['liner'].quad(
        [(x1, y0 + liner_a, z0 + art_a), (x1, y1 - liner_a, z0 + art_a), (x1, y1 - liner_a, z1 - art_a), (x1, y0 + liner_a, z1 - art_a)],
        [(0, 0), (1, 0), (1, 1), (0, 1)],
        room.packed(max(0.08, y1 - y0 - 2 * mould), max(0.08, z1 - z0 - 2 * mould), 36),
        normal,
    )
    return (y0 + art_a, y1 - art_a, z0 + art_a, z1 - art_a)


def add_art_and_light(room, frame, x, normal, opening):
    y0, y1, z0, z1 = opening
    depth = 0.024
    x1 = x + normal[0] * depth
    # UV 0–1, viewed from inside the room. For a +X normal the visitor looks
    # toward -X, and their right is -Y, so u runs from y1 to y0.
    if normal[0] > 0:
        uvs = [(1, 0), (0, 0), (0, 1), (1, 1)]
    else:
        uvs = [(0, 0), (1, 0), (1, 1), (0, 1)]
    target = 'artwork'
    # Heroes stay separate objects so the close view can use a larger texture.
    uvs = room.art_uvs(frame['hero'], uvs)
    if frame['hero']:
        hero = Accum(f"Hero_{len(room.heroes)}", room.mat['artwork'])
        hero.quad([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], uvs, room.packed(y1 - y0, z1 - z0, 40), normal)
        room.heroes.append(hero)
    else:
        room.mesh['artwork'].quad(
            [(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)],
            uvs, room.packed(y1 - y0, z1 - z0, 36), normal,
        )
    if frame['pictureLight']:
        width = min(0.46, (y1 - y0) * 0.34)
        cy = (y0 + y1) / 2
        z = z1 - 0.01
        x2 = x + normal[0] * 0.09
        room.mesh['brass'].quad(
            [(x2, cy - width / 2, z), (x2, cy + width / 2, z), (x2, cy + width / 2, z + 0.035), (x2, cy - width / 2, z + 0.035)],
            [(0, 0), (1, 0), (1, 1), (0, 1)],
            room.packed(width, 0.035, 80),
            normal,
        )


def place_moulding_ns(room, y, normal, x0, x1, z0, z1, mould):
    for start, end, depth_k, tint in gilt_steps():
        a0, a1 = mould * start, mould * end
        depth = 0.012 + 0.13 * depth_k
        y1 = y + normal[1] * depth
        quads = [
            [(x0 + a1, y1, z1 - a1), (x1 - a1, y1, z1 - a1), (x1 - a0, y1, z1 - a0), (x0 + a0, y1, z1 - a0)],
            [(x0 + a0, y1, z0 + a0), (x1 - a0, y1, z0 + a0), (x1 - a1, y1, z0 + a1), (x0 + a1, y1, z0 + a1)],
            [(x0 + a0, y1, z0 + a0), (x0 + a0, y1, z1 - a0), (x0 + a1, y1, z1 - a1), (x0 + a1, y1, z0 + a1)],
            [(x1 - a1, y1, z0 + a1), (x1 - a1, y1, z1 - a1), (x1 - a0, y1, z1 - a0), (x1 - a0, y1, z0 + a0)],
        ]
        for coords in quads:
            room.mesh['gilt'].quad(coords, gilt_face_uv(coords, start, end), room.packed(max(0.05, x1 - x0), max(0.02, a1 - a0), 36), normal, tint)
    y1 = y + normal[1] * 0.03
    room.mesh['liner'].quad(
        [(x0 + mould * 0.82, y1, z0 + mould), (x1 - mould * 0.82, y1, z0 + mould), (x1 - mould * 0.82, y1, z1 - mould), (x0 + mould * 0.82, y1, z1 - mould)],
        [(0, 0), (1, 0), (1, 1), (0, 1)],
        room.packed(max(0.08, x1 - x0), max(0.08, z1 - z0), 36),
        normal,
    )
    return (x0 + mould, x1 - mould, z0 + mould, z1 - mould)


def add_art_and_light_ns(room, frame, y, normal, opening):
    x0, x1, z0, z1 = opening
    y1 = y + normal[1] * 0.024
    # Visitor looking toward -Y (north wall) has their right along -X.
    uvs = [(1, 0), (0, 0), (0, 1), (1, 1)] if normal[1] < 0 else [(0, 0), (1, 0), (1, 1), (0, 1)]
    uvs = room.art_uvs(frame['hero'], uvs)
    if frame['hero']:
        hero = Accum(f"Hero_{len(room.heroes)}", room.mat['artwork'])
        hero.quad([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], uvs, room.packed(x1 - x0, z1 - z0, 40), normal)
        room.heroes.append(hero)
    else:
        room.mesh['artwork'].quad([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], uvs, room.packed(x1 - x0, z1 - z0, 36), normal)
    if frame['pictureLight']:
        width = min(0.46, (x1 - x0) * 0.34)
        cx = (x0 + x1) / 2
        y2 = y + normal[1] * 0.09
        room.mesh['brass'].quad(
            [(cx - width / 2, y2, z1 - 0.01), (cx + width / 2, y2, z1 - 0.01), (cx + width / 2, y2, z1 + 0.025), (cx - width / 2, y2, z1 + 0.025)],
            [(0, 0), (1, 0), (1, 1), (0, 1)],
            room.packed(width, 0.035, 80),
            normal,
        )


def add_cartel(room, cartel, index):
    columns = 8
    column, row = index % columns, index // columns
    pad = 0.008
    step = 1 / columns
    u0, v0 = column * step + pad, row * step + pad
    u1, v1 = (column + 1) * step - pad, (row + 1) * step - pad
    uvs = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    sign = 1 if cartel['wall'] == 'left' else (-1 if cartel['wall'] == 'right' else (-1 if cartel['wall'] == 'north' else 1))
    if cartel['wall'] in ('left', 'right'):
        x = cartel['x'] + sign * 0.016
        z0, z1 = cartel['z'] - cartel['w'] / 2, cartel['z'] + cartel['w'] / 2
        y0, y1 = cartel['y'] - cartel['h'] / 2, cartel['y'] + cartel['h'] / 2
        # Same handedness as the paintings on that wall.
        if sign > 0:
            uvs = [(u1, v0), (u0, v0), (u0, v1), (u1, v1)]
        room.mesh['cartel'].quad(
            [(x, z0, y0), (x, z1, y0), (x, z1, y1), (x, z0, y1)],
            uvs, room.packed(cartel['w'], cartel['h'], 80), (sign, 0, 0),
        )
    else:
        y = cartel['z'] + sign * 0.016
        x0, x1 = cartel['x'] - cartel['w'] / 2, cartel['x'] + cartel['w'] / 2
        z0, z1 = cartel['y'] - cartel['h'] / 2, cartel['y'] + cartel['h'] / 2
        uvs = [(u1, v0), (u0, v0), (u0, v1), (u1, v1)]
        room.mesh['cartel'].quad(
            [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)],
            uvs, room.packed(cartel['w'], cartel['h'], 80), (0, sign, 0),
        )


def add_props(room: RoomBuilder):
    plinth = room.layout['plinth']
    x, z = plinth['x'], plinth['z']
    w, l, h = plinth['width'] / 2, plinth['length'] / 2, plinth['height']
    marble_box(room, x - w, x + w, z - l, z + l, 0, h * 0.72)
    marble_box(room, x - w * 0.9, x + w * 0.9, z - l * 0.9, z + l * 0.9, h * 0.72, h)
    for bench in room.layout['benches']:
        add_bench(room, bench)


def marble_box(room, x0, x1, y0, y1, z0, z1):
    quads = [
        ([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], (0, 0, 1)),
        ([(x0, y0, z0), (x0, y1, z0), (x1, y1, z0), (x1, y0, z0)], (0, 0, -1)),
        ([(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)], (-1, 0, 0)),
        ([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], (1, 0, 0)),
        ([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], (0, 1, 0)),
        ([(x0, y0, z0), (x0, y0, z1), (x1, y0, z1), (x1, y0, z0)], (0, -1, 0)),
    ]
    for coords, normal in quads:
        room.mesh['marble'].quad(coords, planar_uv(coords, 3.2), room.packed(max(0.2, abs(x1 - x0)), max(0.2, abs(z1 - z0)), 70), normal)


def add_bench(room, bench):
    """Tufted leather banquette on brass feet. Stays inside the collision box."""
    x, z, w, l, h = bench['x'], bench['z'], bench['w'] / 2, bench['l'] / 2, bench['h']
    for side in (-1, 1):
        for end in (-1, 1):
            cx = x + side * (w - 0.055)
            cz = z + end * (l - 0.07)
            wood_box(room, cx - 0.03, cx + 0.03, cz - 0.03, cz + 0.03, 0.0, 0.035, 'brass', (1, 1, 1, 1))
            wood_box(room, cx - 0.018, cx + 0.018, cz - 0.018, cz + 0.018, 0.035, h - 0.14, 'benchWood', (1, 1, 1, 1))
    wood_box(room, x - w + 0.04, x + w - 0.04, z - l + 0.05, z - l + 0.09, 0.16, h - 0.12, 'benchWood', (1, 1, 1, 1))
    wood_box(room, x - w + 0.04, x + w - 0.04, z + l - 0.09, z + l - 0.05, 0.16, h - 0.12, 'benchWood', (1, 1, 1, 1))
    wood_box(room, x - w + 0.02, x - w + 0.055, z - l + 0.08, z + l - 0.08, 0.18, h - 0.12, 'benchWood', (1, 1, 1, 1))
    # Tufted cushion: a grid of raised cells with a lower button.
    cols, rows = 3, 8
    x0, x1 = x - w + 0.025, x + w - 0.025
    z0, z1 = z - l + 0.04, z + l - 0.04
    for col in range(cols):
        for row in range(rows):
            ax = x0 + (x1 - x0) * col / cols
            bx = x0 + (x1 - x0) * (col + 1) / cols
            az = z0 + (z1 - z0) * row / rows
            bz = z0 + (z1 - z0) * (row + 1) / rows
            pad = 0.008
            wood_box(room, ax + pad, bx - pad, az + pad, bz - pad, h - 0.11, h - 0.035, 'benchSeat', (0.92, 0.92, 0.92, 1))
            wood_box(room, (ax + bx) / 2 - 0.012, (ax + bx) / 2 + 0.012, (az + bz) / 2 - 0.012, (az + bz) / 2 + 0.012, h - 0.11, h - 0.055, 'brass', (0.7, 0.7, 0.7, 1))


def wood_box(room, x0, x1, y0, y1, z0, z1, material, tint=(1, 1, 1, 1)):
    quads = [
        ([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], (0, 0, 1)),
        ([(x0, y1, z0), (x0, y1, z1), (x1, y1, z1), (x1, y1, z0)], (0, 1, 0)),
        ([(x0, y0, z0), (x0, y0, z1), (x1, y0, z1), (x1, y0, z0)], (0, -1, 0)),
        ([(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)], (-1, 0, 0)),
        ([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], (1, 0, 0)),
    ]
    for coords, normal in quads:
        room.mesh[material].quad(coords, planar_uv(coords, 1.2), room.packed(max(0.05, abs(x1 - x0)), max(0.05, abs(z1 - z0)), 48), normal, tint)


def add_lights(room, layout):
    r = room.room
    lay = bpy.data.lights.new('LaylightKey', 'AREA')
    lay.shape = 'RECTANGLE'
    lay.size = r['laylightHalfWidth'] * 2 * 0.92
    lay.size_y = r['length'] - 1.2
    lay.energy = 700
    lay.color = kelvin(r['daylightK'])
    obj = bpy.data.objects.new('LaylightKey', lay)
    # Under the ribs, the size of the glass. Nothing between this panel and the floor.
    obj.location = (0, r['length'] / 2, r['laylightY'] - 0.42)
    obj.rotation_euler = (0, 0, 0)
    # Area lights emit along local -Z. The default rotation already looks down? 
    # In Blender an area light's emission is -Z, and default rotation points -Z, i.e. downward. Good.
    bpy.context.scene.collection.objects.link(obj)
    for frame in layout['frames']:
        if not frame['pictureLight']:
            continue
        spot = bpy.data.lights.new(f"Spot_{frame['id']}", 'AREA')
        spot.shape = 'RECTANGLE'
        spot.size = min(1.05, max(0.42, frame['width'] * 0.62))
        spot.size_y = 0.28
        spot.energy = 3.5
        spot.color = kelvin(r['pictureK'])
        light = bpy.data.objects.new(spot.name, spot)
        if frame['wall'] in ('left', 'right'):
            light.location = (frame['x'] + frame['normal'] * 0.34, frame['z'], frame['y'] + frame['height'] / 2 - 0.05)
            target = Vector((frame['x'] + frame['normal'] * 0.02, frame['z'], frame['y']))
        else:
            light.location = (frame['x'], frame['z'] + frame['normal'] * 0.34, frame['y'] + frame['height'] / 2 - 0.05)
            target = Vector((frame['x'], frame['z'] + frame['normal'] * 0.02, frame['y']))
        bpy.context.scene.collection.objects.link(light)
        direction = target - light.location
        light.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def configure_world():
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.02
    scene.cycles.adaptive_min_samples = 16
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 5
    scene.cycles.glossy_bounces = 2
    scene.cycles.transmission_bounces = 0
    scene.cycles.sample_clamp_indirect = 10
    scene.cycles.use_light_tree = True
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    world = bpy.data.worlds.new('Interior')
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes['Background']
    # A trace of warm ambient stops pure-black holes. It is not a sun.
    background.inputs[0].default_value = (*kelvin(5000), 1)
    background.inputs[1].default_value = 0.016
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = 0.0
    scene.render.film_transparent = False


def look_camera(location, target, lens=32):
    camera_data = bpy.data.cameras.new('Cam')
    camera_data.lens = lens
    camera = bpy.data.objects.new('Cam', camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = location
    direction = Vector(target) - Vector(location)
    camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = camera
    return camera


def render_to(path: Path, samples: int, width: int, height: int):
    scene = bpy.context.scene
    scene.cycles.samples = samples
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print('rendered', path)


def preview(layout):
    out = Path('/tmp/salle-preview')
    r = layout['room']
    hero = next(frame for frame in layout['frames'] if frame['wall'] == 'left' and frame['format'] == 'very_large')
    shots = {
        'entrance': ((0, 1.55, 1.62), (0, 14.2, 3.1), 24, 36),
        'floor': ((-0.15, 3.1, 0.42), (0.55, 4.6, 0.0), 38, 48),
        'frame': ((-3.15, 5.55, 1.72), (-5.2, 5.55, 1.72), 38, 40),
        'ceiling': ((0.1, 6.2, 1.62), (0.0, 8.0, 9.6), 28, 48),
        'perspective': ((0.15, 4.6, 1.62), (0.0, 16.2, 1.9), 30, 48),
    }
    requested = [item for item in argv_after_double_dash() if item in shots] or ['entrance', 'floor', 'frame']
    for name in requested:
        location, target, lens, samples = shots[name]
        look_camera(location, target, lens)
        render_to(out / f'{name}.png', min(samples, 20), 900, 560)


def denoise_image(image):
    try:
        import numpy as np
    except ImportError:
        print('numpy missing, bake left raw')
        return False
    lib = Path(bpy.app.binary_path).parent / 'lib' / 'libOpenImageDenoise.so'
    for extra in ('libOpenImageDenoise_core.so.2', 'libOpenImageDenoise_device_cpu.so.2'):
        ctypes_load = Path(bpy.app.binary_path).parent / 'lib' / extra
        if ctypes_load.exists():
            import ctypes
            ctypes.CDLL(str(ctypes_load))
    import ctypes
    oidn = ctypes.CDLL(str(lib))
    width, height = image.size
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(height, width, 4)
    color = np.ascontiguousarray(pixels[:, :, :3])
    output = np.empty_like(color)
    oidn.oidnNewDevice.restype = ctypes.c_void_p
    oidn.oidnNewDevice.argtypes = [ctypes.c_int]
    device = oidn.oidnNewDevice(1)
    oidn.oidnCommitDevice.argtypes = [ctypes.c_void_p]
    oidn.oidnCommitDevice(device)
    oidn.oidnNewFilter.restype = ctypes.c_void_p
    oidn.oidnNewFilter.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
    filt = oidn.oidnNewFilter(device, b'RT')
    oidn.oidnSetSharedFilterImage.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_void_p, ctypes.c_int, ctypes.c_size_t, ctypes.c_size_t, ctypes.c_size_t, ctypes.c_size_t, ctypes.c_size_t]
    oidn.oidnSetSharedFilterImage(filt, b'color', color.ctypes.data, 3, width, height, 0, 0, 0)
    oidn.oidnSetSharedFilterImage(filt, b'output', output.ctypes.data, 3, width, height, 0, 0, 0)
    oidn.oidnSetFilterBool.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_bool]
    oidn.oidnSetFilterBool(filt, b'hdr', True)
    oidn.oidnCommitFilter.argtypes = [ctypes.c_void_p]
    oidn.oidnCommitFilter(filt)
    oidn.oidnExecuteFilter.argtypes = [ctypes.c_void_p]
    oidn.oidnExecuteFilter(filt)
    pixels[:, :, :3] = output
    image.pixels = pixels.reshape(-1).tolist()
    print('OIDN denoise complete')
    return True


def bake(layout):
    scene = bpy.context.scene
    scene.cycles.samples = 48
    scene.cycles.use_denoising = False
    image = bpy.data.images.new('Lightmap', layout['lightmap']['size'], layout['lightmap']['size'], float_buffer=True, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    for material in bpy.data.materials:
        if material.use_nodes and material.name != 'laylight' and material.name != 'underlay':
            attach_bake_target(material, image)
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH' and obj.data.uv_layers.get('Lightmap') and len(obj.data.polygons):
            obj.data.uv_layers['Lightmap'].active = True
            obj.data.uv_layers['Lightmap'].active_render = True
            # Boards are hidden so their joints are not baked as a black grid.
            # floorShell carries the continuous floor lighting the boards will sample.
            # Boards stay out of the bake. Their joints were the shutter grid
            # written into the floor island, which the plinth then sampled.
            obj.select_set(obj.name not in ('laylight', 'underlay', 'parquetEdge', 'parquet'))
            if obj.name in ('parquet', 'parquetEdge'):
                obj.hide_render = True
            if obj.name == 'vaultRib':
                obj.visible_shadow = False
    bpy.context.view_layer.objects.active = bpy.data.objects['stone']
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = False
    scene.render.bake.margin = 16
    scene.render.bake.target = 'IMAGE_TEXTURES'
    print('baking diffuse GI…')
    bpy.ops.object.bake(type='DIFFUSE')
    denoise_image(image)
    try:
        import numpy as np
        samples = np.array(image.pixels[:], dtype=np.float32)
        rgb = samples.reshape(-1, 4)[:, :3]
        print('lightmap min/p50/p95/max', float(rgb.min()), float(np.median(rgb)), float(np.percentile(rgb, 95)), float(rgb.max()))
    except Exception as error:
        print('lightmap stats skipped', error)
    hdr = ASSETS / 'lightmap.hdr'
    image.filepath_raw = str(hdr)
    image.file_format = 'HDR'
    image.save()
    print('saved', hdr, hdr.stat().st_size)
    mobile = image.copy()
    mobile.scale(2048, 2048)
    mobile_path = ASSETS / 'lightmap-mobile.hdr'
    mobile.filepath_raw = str(mobile_path)
    mobile.file_format = 'HDR'
    mobile.save()
    print('saved', mobile_path, mobile_path.stat().st_size)
    shell = bpy.data.objects.get('floorShell')
    if shell:
        bpy.data.objects.remove(shell, do_unlink=True)
    for name in ('parquet', 'parquetEdge'):
        hidden = bpy.data.objects.get(name)
        if hidden:
            hidden.hide_render = False
    # Restore the first UV so glTF TEXCOORD_0 is the material UV.
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH' and obj.data.uv_layers.get('UVMap'):
            obj.data.uv_layers['UVMap'].active = True
    glb = ASSETS / 'salle-temoin.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(glb),
        export_format='GLB',
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_yup=True,
        export_image_format='NONE',
        export_vertex_color='ACTIVE',
        export_lights=False,
        export_cameras=False,
    )
    manifest = {
        'generator': 'blender-4.2.11-cycles',
        'export': 'export_vertex_color',
        'lightmap': 'lightmap.hdr',
        'mesh': 'salle-temoin.glb',
        'lightmapSize': [layout['lightmap']['size'], layout['lightmap']['size']],
        'floorPxPerM': layout['room']['floorPxPerM'],
        'wallPxPerM': layout['room']['wallPxPerM'],
        'samples': 48,
        'denoiser': 'openimagedenoise',
        'daylightK': layout['room']['daylightK'],
        'pictureK': layout['room']['pictureK'],
        'exposure': layout['room']['exposure'],
        'wallColor': layout['room']['wallColor'],
        'sun': False,
        'worldStrength': 0,
    }
    (ASSETS / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    print('exported', glb, glb.stat().st_size)


def main():
    args = argv_after_double_dash()
    layout = json.loads(LAYOUT_PATH.read_text())
    configure_world()
    build(layout)
    if '--pattern' in args:
        parquet = bpy.data.objects['parquet']
        bm = bmesh.new()
        bm.from_mesh(parquet.data)
        bm.normal_update()
        down = 0
        for face in bm.faces:
            if face.normal.z < 0:
                face.normal_flip()
                down += 1
        bm.to_mesh(parquet.data)
        bm.free()
        area = sum(polygon.area for polygon in parquet.data.polygons)
        print(f'parquet faces {len(parquet.data.polygons)} flipped {down} area {area:.2f} m²')
        zs = [polygon.normal.z for polygon in parquet.data.polygons]
        up = sum(1 for z in zs if z > 0.5)
        print(f'faces pointing up {up} of {len(zs)}')
        from mathutils.bvhtree import BVHTree
        tree = BVHTree.FromObject(parquet, bpy.context.evaluated_depsgraph_get())
        hits = 0
        total = 0
        for ix in range(30):
            for iy in range(30):
                total += 1
                origin = (-1.6 + ix * 0.11, 7.2 + iy * 0.11, 0.4)
                if tree.ray_cast(origin, (0, 0, -1))[0] is not None:
                    hits += 1
        print(f'floor coverage {hits}/{total}')
        for obj in bpy.context.scene.objects:
            obj.hide_render = obj.type != 'MESH' or obj.name not in ('parquet', 'underlay')
        background = bpy.context.scene.world.node_tree.nodes['Background']
        background.inputs[0].default_value = (1, 1, 1, 1)
        background.inputs[1].default_value = 1.4
        look_camera((0, layout['room']['length'] / 2, 8), (0, layout['room']['length'] / 2, 0), 28)
        bpy.context.scene.camera.data.type = 'ORTHO'
        bpy.context.scene.camera.data.ortho_scale = 4.2
        render_to(Path('/tmp/salle-preview/pattern.png'), 4, 480, 480)
        return
    if '--bake' in args:
        bake(layout)
        return
    preview(layout)


if __name__ == '__main__':
    main()
