#!/usr/bin/env python3
"""Model and bake the lighting sample room in Blender 4.2.

Architecture is mesh, not a painted relief: cornice profile, pilasters,
cove, skylight mullions, track spots and mitred gilt frames. The diffuse
bake is direct + indirect with the colour pass off, then reduced to
luminance so a coloured bounce cannot crimson the walls.

    blender --background --python bake_salle_echantillon.py -- --check
    blender --background --python bake_salle_echantillon.py -- --preview
    blender --background --python bake_salle_echantillon.py -- --bake
"""
from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / 'assets'
LAYOUT_PATH = ROOT / 'layout.json'

# Lightmap atlas inside a square. Gaps keep the extend-margin off the next island.
REGIONS = {
    'floor': (8, 8, 1200, 480),
    'ceiling': (8, 500, 1200, 420),
    'left': (8, 940, 1200, 360),
    'right': (8, 1320, 1200, 360),
    'portal': (8, 1700, 700, 330),
    'endL': (720, 1700, 280, 330),
    'endR': (1020, 1700, 280, 330),
    'far': (1320, 1700, 700, 330),
    'pack': (1220, 8, 810, 1680),
}

CORNICE = [
    (0.000, 0.000),
    (0.010, 0.016),
    (0.026, 0.024),
    (0.038, 0.052),
    (0.062, 0.060),
    (0.074, 0.096),
    (0.112, 0.108),
    (0.132, 0.148),
    (0.176, 0.160),
    (0.206, 0.214),
    (0.150, 0.252),
    (0.018, 0.278),
]

# inset fraction of the moulding width, depth in metres from the wall.
FRAME_PROFILE = [
    (0.00, 0.014),
    (0.07, 0.032),
    (0.15, 0.058),
    (0.26, 0.034),
    (0.40, 0.074),
    (0.54, 0.042),
    (0.68, 0.062),
    (0.82, 0.030),
    (0.93, 0.018),
    (1.00, 0.012),
]


def argv_after_double_dash():
    if '--' in sys.argv:
        return sys.argv[sys.argv.index('--') + 1:]
    return []


def srgb_to_linear(channel):
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def hex_color(value):
    value = value.lstrip('#')
    return tuple(srgb_to_linear(int(value[i:i + 2], 16) / 255) for i in (0, 2, 4))


def kelvin(temperature):
    t = temperature / 100
    if t <= 66:
        red = 255
        green = 99.4708025861 * math.log(t) - 161.1195681661
    else:
        red = 329.698727446 * ((t - 60) ** -0.1332047592)
        green = 288.1221695283 * ((t - 60) ** -0.0755148492)
    blue = 255 if t >= 66 else (0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307)
    rgb = [min(255, max(0, c)) / 255 for c in (red, green, blue)]
    return tuple(srgb_to_linear(c) for c in rgb)


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def mul(a, s):
    return (a[0] * s, a[1] * s, a[2] * s)


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a, b):
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def norm(a):
    length = math.sqrt(max(1e-12, dot(a, a)))
    return mul(a, 1 / length)


def dist(a, b):
    return math.sqrt(max(0.0, dot(sub(a, b), sub(a, b))))


def geom_normal(coords):
    return norm(cross(sub(coords[1], coords[0]), sub(coords[2], coords[0])))


def wind(coords, uvs, luvs, normal):
    if dot(geom_normal(coords), normal) < 0:
        return coords[::-1], uvs[::-1], luvs[::-1]
    return coords, uvs, luvs


def wind_out(coords, uvs, luvs, center):
    mid = mul(add(add(coords[0], coords[1]), add(coords[2], coords[3])), 0.25)
    if dot(geom_normal(coords), sub(mid, center)) < 0:
        return coords[::-1], uvs[::-1], luvs[::-1]
    return coords, uvs, luvs


def region(name):
    x, y, w, h = REGIONS[name]
    return {'x': x, 'y': y, 'w': w, 'h': h}


class Packer:
    def __init__(self, size):
        self.size = size
        self.rect = region('pack')
        self.cx = self.rect['x']
        self.cy = self.rect['y']
        self.row_h = 0
        self.count = 0
        self.pixels = 0
        self._shared = {}

    def alloc(self, pixels_w, pixels_h):
        pw = max(7, min(96, int(math.ceil(pixels_w)) + 4))
        ph = max(7, min(96, int(math.ceil(pixels_h)) + 4))
        if self.cx + pw > self.rect['x'] + self.rect['w']:
            self.cy += self.row_h + 4
            self.cx = self.rect['x']
            self.row_h = 0
        if self.cy + ph > self.rect['y'] + self.rect['h']:
            raise RuntimeError(f'Lightmap packer is full ({pw}×{ph} at {self.cx},{self.cy}).')
        rect = (self.cx, self.cy, pw, ph)
        self.cx += pw + 3
        self.row_h = max(self.row_h, ph)
        self.count += 1
        self.pixels += pw * ph
        if pw >= 100 or ph >= 100:
            print(f'pack {pw}x{ph} n={self.count} px={self.pixels} y={self.cy}')
        return rect

    def uvs(self, rect):
        x, y, w, h = rect
        inset = 2

        def uv(a, b):
            return (
                (x + inset + a * (w - 2 * inset)) / self.size,
                (y + inset + b * (h - 2 * inset)) / self.size,
            )

        return [uv(0, 0), uv(1, 0), uv(1, 1), uv(0, 1)]

    def shared(self, key, pw=16, ph=16):
        if key not in self._shared:
            self._shared[key] = self.uvs(self.alloc(pw, ph))
        return self._shared[key]

    def for_quad(self, coords):
        span_u = max(dist(coords[0], coords[1]), dist(coords[3], coords[2]), 0.02)
        span_v = max(dist(coords[0], coords[3]), dist(coords[1], coords[2]), 0.02)
        return self.uvs(self.alloc(span_u * 28, span_v * 28))


def rect_uv(name, u, v, size):
    rect = region(name)
    inset = 3
    return (
        (rect['x'] + inset + u * (rect['w'] - 2 * inset)) / size,
        (rect['y'] + inset + v * (rect['h'] - 2 * inset)) / size,
    )


class Accum:
    def __init__(self, name, material):
        self.name = name
        self.material = material
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new('UVMap')
        self.light = self.bm.loops.layers.uv.new('Lightmap')

    def quad(self, coords, uvs, light_uvs, normal=None, center=None):
        area = Vector(cross(sub(coords[1], coords[0]), sub(coords[2], coords[0]))).length
        if area < 1e-8:
            return
        if center is not None:
            coords, uvs, light_uvs = wind_out(coords, uvs, light_uvs, center)
        elif normal is not None:
            coords, uvs, light_uvs = wind(coords, uvs, light_uvs, normal)
        try:
            verts = [self.bm.verts.new(c) for c in coords]
            face = self.bm.faces.new(verts)
        except ValueError:
            return
        for loop, uv, luv in zip(face.loops, uvs, light_uvs):
            loop[self.uv].uv = uv
            loop[self.light].uv = luv

    def finish(self, smooth=False):
        if not self.bm.faces:
            self.bm.free()
            return None
        self.bm.normal_update()
        mesh = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        mesh.materials.append(self.material)
        for polygon in mesh.polygons:
            polygon.use_smooth = smooth
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        return obj


def new_material(name, base, roughness=0.6, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*base, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    return material


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def configure_world():
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.025
    scene.cycles.adaptive_min_samples = 8
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 3
    scene.cycles.glossy_bounces = 1
    scene.cycles.transmission_bounces = 0
    scene.cycles.sample_clamp_indirect = 8.0
    scene.cycles.sample_clamp_direct = 0.0
    scene.cycles.use_light_tree = True
    world = bpy.data.worlds.new('Dark')
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes['Background']
    background.inputs[0].default_value = (0, 0, 0, 1)
    background.inputs[1].default_value = 0.0
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Base Contrast'


class Room:
    def __init__(self, layout):
        self.layout = layout
        self.room = layout['room']
        self.size = self.room['lightmapSize']
        self.pack = Packer(self.size)
        self.half = self.room['width'] / 2
        self.back = self.room['backZ']
        self.hall = self.room['hallLength']
        self.length = self.room['length']
        self.cornice = self.room['corniceY']
        colors = self.room
        self.mat = {
            'parquet': new_material('parquet', hex_color('#A07850'), 0.42),
            'bordeaux': new_material('bordeaux', hex_color(colors['wallColor']), 0.9),
            'stone': new_material('stone', hex_color(colors['stoneColor']), 0.72),
            'plaster': new_material('plaster', hex_color(colors['endColor']), 0.84),
            'gilt': new_material('gilt', hex_color('#C6A15A'), 0.38, 1.0),
            'liner': new_material('liner', hex_color('#E6D3B4'), 0.7),
            'artwork': new_material('artwork', hex_color('#6E5844'), 0.62),
            'iron': new_material('iron', hex_color('#241F1C'), 0.34, 0.9),
            'bulb': new_material('bulb', kelvin(3000), 0.4),
            'laylight': new_material('laylight', hex_color('#F4EFE4'), 0.6),
        }
        self.mesh = {name: Accum(name, material) for name, material in self.mat.items()}
        self.mat['ceiling'] = new_material('ceiling', hex_color(self.room.get('ceilingColor', '#E7D3B8')), 0.78)
        self.cornice_mesh = Accum('cornice', self.mat['ceiling'])
        self.heroes = []
        self.nonhero = 0
        self.tile = self.room['floorTileM']

    def span(self):
        return self.length - self.back

    def floor_luv(self, x, depth):
        u = (depth - self.back) / self.span()
        v = (x + self.half) / self.room['width']
        return rect_uv('floor', u, v, self.size)

    def floor_muv(self, x, depth):
        # Axis-aligned so the long herringbone runs down the nave, not as a rotated chevron.
        return (x / self.tile + 0.5, depth / self.tile)

    def wall_luv(self, name, along, up, along0, along1, up1):
        u = (along - along0) / max(1e-4, along1 - along0)
        v = up / max(1e-4, up1)
        return rect_uv(name, min(1, max(0, u)), min(1, max(0, v)), self.size)

    def art_uvs(self, hero, facing):
        if hero:
            return facing
        columns = 4
        index = self.nonhero
        self.nonhero += 1
        column, row = index % columns, index // columns
        pad = 0.012 / columns
        step = 1 / columns
        u0, v0 = column * step + pad, row * step + pad
        u1, v1 = (column + 1) * step - pad, (row + 1) * step - pad
        return [(u0 + u * (u1 - u0), v0 + v * (v1 - v0)) for u, v in facing]

    def q(self, name, coords, uvs, luvs, normal=None, center=None, smooth_mesh=False):
        target = self.cornice_mesh if smooth_mesh else self.mesh[name]
        target.quad(coords, uvs, luvs, normal, center)

    def add_floor(self):
        x0, x1 = -self.half, self.half
        y0, y1 = self.back, self.length
        coords = [(x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0)]
        uvs = [self.floor_muv(x, y) for x, y, _z in coords]
        luvs = [self.floor_luv(x, y) for x, y, _z in coords]
        self.q('parquet', coords, uvs, luvs, (0, 0, 1))

    def surface_uv(self, coords, normal, scale=1.35):
        ax = (abs(normal[0]), abs(normal[1]), abs(normal[2]))
        if ax[2] >= ax[0] and ax[2] >= ax[1]:
            project = lambda c: (c[0] / scale, c[1] / scale)
        elif ax[0] >= ax[1]:
            project = lambda c: (c[1] / scale, c[2] / scale)
        else:
            project = lambda c: (c[0] / scale, c[2] / scale)
        return [project(c) for c in coords]

    def add_wall_quad(self, material, coords, luvs, normal):
        self.q(material, coords, self.surface_uv(coords, normal), luvs, normal)

    def add_hall_walls(self):
        z1 = self.cornice
        for x, name, normal in ((-self.half, 'left', (1, 0, 0)), (self.half, 'right', (-1, 0, 0))):
            coords = [(x, self.back, 0.0), (x, self.hall, 0.0), (x, self.hall, z1), (x, self.back, z1)]
            if name == 'right':
                coords = [coords[0], coords[3], coords[2], coords[1]]
            luvs = [self.wall_luv(name, y, z, self.back, self.length, z1) for _x, y, z in coords]
            self.add_wall_quad('bordeaux', coords, luvs, normal)
        # Portal wall with a hole. Faces the camera (-Y).
        ph = self.room['portalHalf']
        pz = self.room['portalHeight']
        y = self.hall
        pieces = [
            [(-self.half, y, 0), (-ph, y, 0), (-ph, y, z1), (-self.half, y, z1)],
            [(ph, y, 0), (self.half, y, 0), (self.half, y, z1), (ph, y, z1)],
            [(-ph, y, pz), (ph, y, pz), (ph, y, z1), (-ph, y, z1)],
        ]
        for coords in pieces:
            luvs = [self.wall_luv('portal', px, z, -self.half, self.half, z1) for px, _y, z in coords]
            self.add_wall_quad('bordeaux', coords, luvs, (0, -1, 0))
        # Closed entrance behind the camera.
        yb = self.back
        coords = [(-self.half, yb, 0), (-self.half, yb, z1), (self.half, yb, z1), (self.half, yb, 0)]
        luvs = self.pack.for_quad(coords)
        self.add_wall_quad('bordeaux', coords, luvs, (0, 1, 0))

    def add_end_room(self):
        ph = self.room['portalHalf']
        top = 4.05
        y0, y1 = self.hall, self.length
        # Side walls of the bright room.
        for x, name, normal in ((-ph, 'endL', (1, 0, 0)), (ph, 'endR', (-1, 0, 0))):
            coords = [(x, y0, 0), (x, y1, 0), (x, y1, top), (x, y0, top)]
            if name == 'endR':
                coords = [coords[0], coords[3], coords[2], coords[1]]
            luvs = [self.wall_luv(name, y, z, y0, y1, top) for _x, y, z in coords]
            self.add_wall_quad('plaster', coords, luvs, normal)
        coords = [(-ph, y1, 0), (-ph, y1, top), (ph, y1, top), (ph, y1, 0)]
        luvs = [self.wall_luv('far', x, z, -ph, ph, top) for x, _y, z in coords]
        self.add_wall_quad('plaster', coords, luvs, (0, -1, 0))
        # Flat ceiling, slightly below the hall cornice so the opening reads as a room.
        coords = [(-ph, y0, top), (ph, y0, top), (ph, y1, top), (-ph, y1, top)]
        luvs = [rect_uv('ceiling', (x + self.half) / self.room['width'], (y - self.back) / self.span(), self.size) for x, y, _z in coords]
        self.add_wall_quad('plaster', coords, luvs, (0, 0, -1))
        # Stone jamb, 28 cm deep, so the portal has thickness.
        depth = 0.28
        for x, sign in ((-ph, 1), (ph, -1)):
            outer = x
            inner = x + sign * 0.02
            coords = [
                (inner, y0, 0), (inner, y0 + depth, 0), (inner, y0 + depth, self.room['portalHeight']), (inner, y0, self.room['portalHeight']),
            ]
            normal = (sign, 0, 0)
            luvs = self.pack.for_quad(coords)
            self.q('stone', coords, [(0, 0), (1, 0), (1, 1), (0, 1)], luvs, normal)
        # Lintel soffit.
        z = self.room['portalHeight']
        coords = [(-ph, y0, z), (ph, y0, z), (ph, y0 + depth, z), (-ph, y0 + depth, z)]
        luvs = self.pack.for_quad(coords)
        self.q('stone', coords, [(0, 0), (1, 0), (1, 1), (0, 1)], luvs, (0, 0, -1))

    def sweep_profile(self, y0, y1, x_wall, inward, z_base, profile, steps):
        ys = [y0 + (y1 - y0) * i / steps for i in range(steps + 1)]
        rings = []
        for y in ys:
            rings.append([(x_wall + inward * px, y, z_base + pz) for px, pz in profile])
        for i in range(len(rings) - 1):
            for k in range(len(profile) - 1):
                din = profile[k + 1][0] - profile[k][0]
                dup = profile[k + 1][1] - profile[k][1]
                # Rotate the profile tangent so the normal points into the room.
                normal = norm((inward * dup, 0, -din))
                coords = [rings[i][k], rings[i + 1][k], rings[i + 1][k + 1], rings[i][k + 1]]
                luvs = self.pack.for_quad(coords)
                u0, u1 = i / steps, (i + 1) / steps
                v0, v1 = k / (len(profile) - 1), (k + 1) / (len(profile) - 1)
                self.cornice_mesh.quad(coords, self.surface_uv(coords, normal, 1.1), luvs, normal)

    def add_cornice(self):
        self.sweep_profile(self.back, self.hall, -self.half, 1, self.cornice, CORNICE, 28)
        self.sweep_profile(self.back, self.hall, self.half, -1, self.cornice, CORNICE, 28)
        # Return cornice across the portal wall, inward is -Y.
        profile = CORNICE
        xs = [ -self.half + (self.half * 2) * i / 24 for i in range(25)]
        y_wall = self.hall
        rings = []
        for x in xs:
            rings.append([(x, y_wall - pz, self.cornice + py) for pz, py in [(p[0], p[1]) for p in profile]])
        # profile (inward, up) with inward toward -Y: point (x, y_wall - p[0], cornice + p[1])
        rings = [[(x, y_wall - p[0], self.cornice + p[1]) for p in profile] for x in xs]
        for i in range(len(rings) - 1):
            for k in range(len(profile) - 1):
                din = profile[k + 1][0] - profile[k][0]
                dup = profile[k + 1][1] - profile[k][1]
                normal = norm((0, -dup, -din))
                coords = [rings[i][k], rings[i + 1][k], rings[i + 1][k + 1], rings[i][k + 1]]
                luvs = self.pack.for_quad(coords)
                self.cornice_mesh.quad(coords, self.surface_uv(coords, normal, 1.1), luvs, normal)
        # Dentils under the corona, both walls.
        y = self.back + 0.3
        while y < self.hall - 0.2:
            for x_wall, inward in ((-self.half, 1), (self.half, -1)):
                x0 = x_wall + inward * 0.08
                x1 = x_wall + inward * 0.15
                coords_box = self.box_coords(min(x0, x1), max(x0, x1), y, y + 0.07, self.cornice + 0.07, self.cornice + 0.13)
                for coords, normal in coords_box:
                    self.q('stone', coords, [(0, 0), (1, 0), (1, 1), (0, 1)], self.pack.shared('dentil', 20, 20), normal)
            y += 0.18

    def box_coords(self, x0, x1, y0, y1, z0, z1):
        return [
            ([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], (0, 0, 1)),
            ([(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)], (0, 0, -1)),
            ([(x0, y0, z0), (x0, y1, z0), (x0, y1, z1), (x0, y0, z1)], (-1, 0, 0)),
            ([(x1, y1, z0), (x1, y0, z0), (x1, y0, z1), (x1, y1, z1)], (1, 0, 0)),
            ([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], (0, -1, 0)),
            ([(x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)], (0, 1, 0)),
        ]

    def add_box(self, material, x0, x1, y0, y1, z0, z1, skip=()):
        for coords, normal in self.box_coords(x0, x1, y0, y1, z0, z1):
            if normal in skip:
                continue
            if material in ('iron', 'bulb'):
                luvs = self.pack.shared(material, 12, 12)
            else:
                luvs = self.pack.for_quad(coords)
            self.q(material, coords, self.surface_uv(coords, normal), luvs, normal)

    def add_pilasters(self):
        for pilaster in self.layout['pilasters']:
            for x_wall, inward in ((-self.half, 1), (self.half, -1)):
                width = pilaster['width']
                y0 = pilaster['z'] - width / 2
                y1 = pilaster['z'] + width / 2
                depth = pilaster['depth']
                # Plinth.
                self.add_box('stone', x_wall + inward * 0.004, x_wall + inward * (depth + 0.08), y0 - 0.06, y1 + 0.06, 0.008, 0.28)
                self.add_box('stone', x_wall + inward * 0.004, x_wall + inward * depth, y0, y1, 0.28, self.cornice - 0.42)
                base = self.cornice - 0.42
                courses = [(0.06, 0.10, 0.04), (0.08, 0.16, 0.08), (0.05, 0.22, 0.12)]
                z = base
                for height, extra_w, extra_d in courses:
                    self.add_box(
                        'stone',
                        x_wall + inward * 0.004,
                        x_wall + inward * (depth + extra_d),
                        y0 - extra_w / 2,
                        y1 + extra_w / 2,
                        z,
                        z + height,
                    )
                    z += height

    def add_benches(self):
        for bench in self.layout['benches']:
            depth = bench['depth']
            if bench['wall'] == 'left':
                x0 = -self.half + 0.03
                x1 = x0 + depth
            else:
                x1 = self.half - 0.03
                x0 = x1 - depth
            y0, y1 = bench['z0'], bench['z1']
            h = bench['height']
            self.add_box('stone', x0, x1, y0, y1, 0.018, h - 0.07)
            self.add_box('stone', x0 + 0.035, x1 - 0.035, y0 + 0.04, y1 - 0.04, h - 0.07, h)
            self.add_box('stone', x0 + 0.02, x1 - 0.02, y0 + 0.025, y1 - 0.025, 0.004, 0.018)

    def ceiling_luv(self, coords):
        return [
            rect_uv('ceiling', (c[0] + self.half) / self.room['width'], (c[1] - self.back) / self.span(), self.size)
            for c in coords
        ]

    def add_skylight(self):
        hx = self.room['skylightHalf']
        y0 = self.room['skylightZ0']
        y1 = self.room['skylightZ1']
        flat = self.room['soffitY']
        glass_z = self.room['skylightY']
        cove_inner = self.half - 0.92
        steps_y = 32
        steps_t = 6
        y_start, y_end = self.back, self.hall
        for sign in (-1, 1):
            rings = []
            for i in range(steps_y + 1):
                y = y_start + (y_end - y_start) * i / steps_y
                ring = []
                for t in range(steps_t + 1):
                    ang = (t / steps_t) * math.pi / 2
                    x = sign * (self.half - 0.02 - (self.half - 0.02 - cove_inner) * math.sin(ang))
                    z = self.cornice + (flat - self.cornice) * (1 - math.cos(ang))
                    ring.append((x, y, z))
                rings.append(ring)
            for i in range(len(rings) - 1):
                for t in range(steps_t):
                    coords = [rings[i][t], rings[i + 1][t], rings[i + 1][t + 1], rings[i][t + 1]]
                    mid = mul(add(add(coords[0], coords[1]), add(coords[2], coords[3])), 0.25)
                    normal = norm((0 if abs(mid[0]) < 0.01 else -mid[0], 0, -1))
                    self.cornice_mesh.quad(coords, [(0, 0), (1, 0), (1, 1), (0, 1)], self.ceiling_luv(coords), normal)
            # Broad flat ceiling from the cove to the lantern, full length.
            x_outer = sign * cove_inner
            x_inner = sign * (hx + 0.03)
            coords = [(x_outer, y_start, flat), (x_inner, y_start, flat), (x_inner, y_end, flat), (x_outer, y_end, flat)]
            self.cornice_mesh.quad(coords, [(0, 0), (1, 0), (1, 1), (0, 1)], self.ceiling_luv(coords), (0, 0, -1))
        # Flat ceiling across the centre, in front of and beyond the lantern.
        for ya, yb in ((y_start, y0), (y1, y_end)):
            coords = [(-hx - 0.03, ya, flat), (hx + 0.03, ya, flat), (hx + 0.03, yb, flat), (-hx - 0.03, yb, flat)]
            self.cornice_mesh.quad(coords, [(0, 0), (1, 0), (1, 1), (0, 1)], self.ceiling_luv(coords), (0, 0, -1))
        # Curb around the opening, then glass above it so the mullions read against the sky.
        curb = 0.42
        for sign in (-1, 1):
            x = sign * hx
            coords = [(x, y0, flat), (x, y1, flat), (x, y1, flat + curb), (x, y0, flat + curb)]
            self.q('stone', coords, [(0, 0), (1, 0), (1, 1), (0, 1)], self.pack.for_quad(coords), (-sign, 0, 0))
        for y, ny in ((y0, 1), (y1, -1)):
            coords = [(-hx, y, flat), (hx, y, flat), (hx, y, flat + curb), (-hx, y, flat + curb)]
            if ny < 0:
                coords = [coords[0], coords[3], coords[2], coords[1]]
            self.q('stone', coords, [(0, 0), (1, 0), (1, 1), (0, 1)], self.pack.for_quad(coords), (0, ny, 0))
        gz = max(glass_z, flat + curb + 0.02)
        coords = [(-hx, y0, gz), (hx, y0, gz), (hx, y1, gz), (-hx, y1, gz)]
        self.q('laylight', coords, [(0, 0), (1, 0), (1, 1), (0, 1)], self.pack.for_quad(coords), (0, 0, -1))
        cols, rows = 4, 8
        mz0 = gz - 0.16
        mz1 = gz - 0.02
        for c in range(cols + 1):
            x = -hx + (2 * hx) * c / cols
            self.add_box('iron', x - 0.015, x + 0.015, y0, y1, mz0, mz1)
        for r in range(rows + 1):
            y = y0 + (y1 - y0) * r / rows
            self.add_box('iron', -hx, hx, y - 0.015, y + 0.015, mz0, mz1)

    def add_tracks_and_spots(self):
        for frame in self.layout['frames']:
            self.add_spot(frame)
        # Rails only along the hall, where the photograph shows them.
        z = self.room['soffitY'] - 0.055
        y0 = 1.4
        y1 = self.hall - 0.45
        for sign in (-1, 1):
            x = sign * (self.room['skylightHalf'] + 0.58)
            self.add_box('iron', x - 0.018, x + 0.018, y0, y1, z, z + 0.028)

    def add_spot(self, frame):
        end_room = frame['wall'] in ('endLeft', 'endRight', 'north')
        if frame['wall'] in ('left', 'endLeft'):
            x_wall = frame['x']
            aim = (x_wall + 0.02, frame['z'], frame['y'])
            rail_x = (x_wall + 0.55) if end_room else (self.room['skylightHalf'] + 0.58) * (-1 if x_wall < 0 else 1)
            if frame['wall'] == 'left':
                rail_x = -(self.room['skylightHalf'] + 0.58)
            else:
                rail_x = x_wall + 0.48
        elif frame['wall'] in ('right', 'endRight'):
            x_wall = frame['x']
            aim = (x_wall - 0.02, frame['z'], frame['y'])
            rail_x = (self.room['skylightHalf'] + 0.58) if frame['wall'] == 'right' else x_wall - 0.48
        else:
            aim = (0.0, frame['z'] - 0.35, frame['y'])
            rail_x = 0.0
        rail_z = 3.78 if end_room else self.room['soffitY'] - 0.1
        head = (rail_x, frame['z'], rail_z - 0.18)
        direction = norm(sub(aim, head))
        # Stem.
        self.add_box('iron', rail_x - 0.012, rail_x + 0.012, frame['z'] - 0.012, frame['z'] + 0.012, head[2], rail_z)
        self.cylinder('iron', head, direction, 0.045, 0.16, 8)
        bulb_at = add(head, mul(direction, 0.15))
        self.cylinder('bulb', bulb_at, direction, 0.028, 0.02, 8)
        # The lamp sits in front of the housing so the housing does not eclipse it.
        lamp_at = add(head, mul(direction, 0.2))
        light_data = bpy.data.lights.new(f"spot-{frame['id']}", 'SPOT')
        light_data.energy = self.room['spotPower']
        light_data.color = kelvin(self.room['pictureK'])
        light_data.spot_size = math.radians(64)
        light_data.spot_blend = 0.82
        light_data.shadow_soft_size = 0.18
        light = bpy.data.objects.new(f"spot-{frame['id']}", light_data)
        light.location = lamp_at
        light.rotation_euler = Vector(direction).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.scene.collection.objects.link(light)

    def cylinder(self, material, origin, axis, radius, length, sides):
        axis = norm(axis)
        helper = (1, 0, 0) if abs(axis[0]) < 0.9 else (0, 1, 0)
        side = norm(cross(axis, helper))
        up = norm(cross(axis, side))
        rings = []
        for end in (0.0, length):
            center = add(origin, mul(axis, end))
            ring = []
            for i in range(sides):
                ang = 2 * math.pi * i / sides
                ring.append(add(center, add(mul(side, math.cos(ang) * radius), mul(up, math.sin(ang) * radius))))
            rings.append(ring)
        for i in range(sides):
            j = (i + 1) % sides
            coords = [rings[0][i], rings[0][j], rings[1][j], rings[1][i]]
            luvs = self.pack.shared(material, 12, 12)
            mid = mul(add(add(coords[0], coords[1]), add(coords[2], coords[3])), 0.25)
            normal = norm(sub(mid, add(origin, mul(axis, length * 0.5))))
            self.q(material, coords, [(0, 0), (1, 0), (1, 1), (0, 1)], luvs, normal)
        for end, ring, direction in ((0, rings[0], mul(axis, -1)), (1, rings[1], axis)):
            center = add(origin, mul(axis, 0 if end == 0 else length))
            for i in range(0, sides, 2):
                j = (i + 1) % sides
                k = (i + 2) % sides
                coords = [center, ring[i], ring[j], ring[k]]
                self.q(material, coords, [(0.5, 0.5), (0, 0), (1, 0), (1, 1)], self.pack.shared(material, 12, 12), direction)

    def add_frame_side(self, frame):
        normal_x = 1 if frame['wall'] in ('left', 'endLeft') else -1
        x = frame['x']
        mould = frame['moulding']
        y0 = frame['z'] - frame['width'] / 2
        y1 = frame['z'] + frame['width'] / 2
        z0 = frame['y'] - frame['height'] / 2
        z1 = frame['y'] + frame['height'] / 2
        center = (x + normal_x * 0.04, frame['z'], frame['y'])
        rings = []
        for inset_k, depth_k in FRAME_PROFILE:
            inset = mould * inset_k
            depth = 0.01 + depth_k
            rings.append([
                (x + normal_x * depth, y0 + inset, z0 + inset),
                (x + normal_x * depth, y1 - inset, z0 + inset),
                (x + normal_x * depth, y1 - inset, z1 - inset),
                (x + normal_x * depth, y0 + inset, z1 - inset),
            ])
        for i in range(len(rings) - 1):
            for k in range(4):
                nxt = (k + 1) % 4
                coords = [rings[i][k], rings[i][nxt], rings[i + 1][nxt], rings[i + 1][k]]
                length = dist(coords[0], coords[1])
                uvs = [(0, i / 9), (length / 0.12, i / 9), (length / 0.12, (i + 1) / 9), (0, (i + 1) / 9)]
                luvs = self.pack.for_quad(coords)
                self.mesh['gilt'].quad(coords, uvs, luvs, center=center)
        # Liner border just proud of the canvas.
        art_y0, art_y1 = y0 + mould, y1 - mould
        art_z0, art_z1 = z0 + mould, z1 - mould
        lip = mould * 0.78
        depth = 0.02
        x1 = x + normal_x * depth
        borders = [
            [(x1, y0 + lip, art_z0), (x1, y1 - lip, art_z0), (x1, y1 - lip, z0 + lip), (x1, y0 + lip, z0 + lip)],
            [(x1, y0 + lip, z1 - lip), (x1, y1 - lip, z1 - lip), (x1, y1 - lip, art_z1), (x1, y0 + lip, art_z1)],
            [(x1, y0 + lip, z0 + lip), (x1, y0 + mould, z0 + lip), (x1, y0 + mould, z1 - lip), (x1, y0 + lip, z1 - lip)],
            [(x1, y1 - mould, z0 + lip), (x1, y1 - lip, z0 + lip), (x1, y1 - lip, z1 - lip), (x1, y1 - mould, z1 - lip)],
        ]
        for coords in borders:
            luvs = self.pack.for_quad(coords)
            self.mesh['liner'].quad(coords, [(0, 0), (1, 0), (1, 1), (0, 1)], luvs, (normal_x, 0, 0))
        x_art = x + normal_x * 0.014
        # Visitor on the left wall looks toward -X and their right is -Y.
        if normal_x > 0:
            uvs = [(1, 0), (0, 0), (0, 1), (1, 1)]
        else:
            uvs = [(0, 0), (1, 0), (1, 1), (0, 1)]
        uvs = self.art_uvs(frame['hero'], uvs)
        coords = [(x_art, art_y0, art_z0), (x_art, art_y1, art_z0), (x_art, art_y1, art_z1), (x_art, art_y0, art_z1)]
        luvs = self.pack.for_quad(coords)
        target = 'artwork'
        if frame['hero']:
            hero = Accum(f"Hero_{len(self.heroes):02d}", self.mat['artwork'])
            hero.quad(coords, uvs, luvs, (normal_x, 0, 0))
            self.heroes.append(hero)
        else:
            self.mesh['artwork'].quad(coords, uvs, luvs, (normal_x, 0, 0))

    def add_frame_far(self, frame):
        mould = frame['moulding']
        y = frame['z']
        x0 = frame['x'] - frame['width'] / 2
        x1 = frame['x'] + frame['width'] / 2
        z0 = frame['y'] - frame['height'] / 2
        z1 = frame['y'] + frame['height'] / 2
        center = (frame['x'], y - 0.04, frame['y'])
        rings = []
        for inset_k, depth_k in FRAME_PROFILE:
            inset = mould * inset_k
            depth = 0.01 + depth_k
            rings.append([
                (x0 + inset, y - depth, z0 + inset),
                (x1 - inset, y - depth, z0 + inset),
                (x1 - inset, y - depth, z1 - inset),
                (x0 + inset, y - depth, z1 - inset),
            ])
        for i in range(len(rings) - 1):
            for k in range(4):
                nxt = (k + 1) % 4
                coords = [rings[i][k], rings[i][nxt], rings[i + 1][nxt], rings[i + 1][k]]
                luvs = self.pack.for_quad(coords)
                self.mesh['gilt'].quad(coords, [(0, 0), (1, 0), (1, 1), (0, 1)], luvs, center=center)
        art_x0, art_x1 = x0 + mould, x1 - mould
        art_z0, art_z1 = z0 + mould, z1 - mould
        y_art = y - 0.014
        # Visitor looking toward +Y has their right along +X? The test room's north
        # wall (normal -Y) uses u running from +X to -X because the viewer's Z flip
        # mirrors the hall. Match that contract: normal -Y, u = 1 on the smaller X.
        uvs = self.art_uvs(frame['hero'], [(1, 0), (0, 0), (0, 1), (1, 1)])
        coords = [(art_x0, y_art, art_z0), (art_x1, y_art, art_z0), (art_x1, y_art, art_z1), (art_x0, y_art, art_z1)]
        luvs = self.pack.for_quad(coords)
        if frame['hero']:
            hero = Accum(f"Hero_{len(self.heroes):02d}", self.mat['artwork'])
            hero.quad(coords, uvs, luvs, (0, -1, 0))
            self.heroes.append(hero)
        else:
            self.mesh['artwork'].quad(coords, uvs, luvs, (0, -1, 0))

    def add_frames(self):
        for frame in self.layout['frames']:
            if frame['wall'] == 'north':
                self.add_frame_far(frame)
            else:
                self.add_frame_side(frame)

    def add_lights(self):
        data = bpy.data.lights.new('skylight', 'AREA')
        data.shape = 'RECTANGLE'
        data.size = self.room['skylightHalf'] * 2 * 0.9
        data.size_y = (self.room['skylightZ1'] - self.room['skylightZ0']) * 0.9
        data.energy = self.room['skylightPower']
        data.color = kelvin(self.room['daylightK'])
        light = bpy.data.objects.new('skylight', data)
        light.location = (
            0,
            (self.room['skylightZ0'] + self.room['skylightZ1']) / 2,
            self.room['skylightY'] - 0.28,
        )
        bpy.context.scene.collection.objects.link(light)
        end = bpy.data.lights.new('endroom', 'AREA')
        end.shape = 'RECTANGLE'
        end.size = self.room['portalHalf'] * 1.6
        end.size_y = self.room['endDepth'] * 0.7
        end.energy = self.room['endPower']
        end.color = kelvin(5200)
        end_light = bpy.data.objects.new('endroom', end)
        end_light.location = (0, self.hall + self.room['endDepth'] * 0.55, 3.85)
        bpy.context.scene.collection.objects.link(end_light)

    def build(self):
        self.add_floor()
        self.add_hall_walls()
        self.add_end_room()
        self.add_cornice()
        self.add_pilasters()
        self.add_benches()
        self.add_skylight()
        self.add_frames()
        self.add_tracks_and_spots()
        self.add_lights()
        for hero in self.heroes:
            hero.finish(smooth=False)
        self.mesh['gilt'].finish(smooth=True)
        self.cornice_mesh.finish(smooth=True)
        for name, accum in self.mesh.items():
            if name == 'gilt':
                continue
            accum.finish(smooth=False)
        print('packer cursor', self.pack.cx, self.pack.cy)


def attach_bake_target(material, image):
    node = material.node_tree.nodes.new('ShaderNodeTexImage')
    node.name = 'BAKE'
    node.image = image
    material.node_tree.nodes.active = node


def look_camera(location, target, lens):
    camera_data = bpy.data.cameras.new('Cam')
    camera_data.lens = lens
    camera_data.sensor_width = 36
    camera = bpy.data.objects.new('Cam', camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = location
    direction = Vector(target) - Vector(location)
    camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = camera


def render_to(path, samples, width, height):
    scene = bpy.context.scene
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print('rendered', path)


def denoise_image(image):
    try:
        import numpy as np
    except ImportError:
        print('numpy missing, bake left raw')
        return False
    lib = Path(bpy.app.binary_path).parent / 'lib' / 'libOpenImageDenoise.so'
    if not lib.exists():
        print('OIDN missing, bake left raw')
        return False
    import ctypes
    for extra in ('libOpenImageDenoise_core.so.2', 'libOpenImageDenoise_device_cpu.so.2'):
        extra_path = Path(bpy.app.binary_path).parent / 'lib' / extra
        if extra_path.exists():
            ctypes.CDLL(str(extra_path))
    oidn = ctypes.CDLL(str(lib))
    width, height = image.size
    import numpy as np
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
    oidn.oidnSetSharedFilterImage.argtypes = [
        ctypes.c_void_p, ctypes.c_char_p, ctypes.c_void_p, ctypes.c_int,
        ctypes.c_size_t, ctypes.c_size_t, ctypes.c_size_t, ctypes.c_size_t, ctypes.c_size_t,
    ]
    oidn.oidnSetSharedFilterImage(filt, b'color', color.ctypes.data, 3, width, height, 0, 0, 0)
    oidn.oidnSetSharedFilterImage(filt, b'output', output.ctypes.data, 3, width, height, 0, 0, 0)
    oidn.oidnSetFilterBool.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_bool]
    oidn.oidnSetFilterBool(filt, b'hdr', True)
    oidn.oidnCommitFilter.argtypes = [ctypes.c_void_p]
    oidn.oidnCommitFilter(filt)
    oidn.oidnExecuteFilter.argtypes = [ctypes.c_void_p]
    oidn.oidnExecuteFilter(filt)
    pixels[:, :, :3] = output
    image.pixels.foreach_set(pixels.reshape(-1))
    print('OIDN denoise complete')
    return True


def neutralize_and_scale(image):
    """Luminance only, then a global scale so the bright floor sits near 1."""
    import numpy as np
    flat = np.array(image.pixels[:], dtype=np.float32).reshape(-1, 4)
    luma = 0.2126 * flat[:, 0] + 0.7152 * flat[:, 1] + 0.0722 * flat[:, 2]
    height, width = image.size[1], image.size[0]
    pic = luma.reshape(height, width)
    fx, fy, fw, fh = REGIONS['floor']
    floor = pic[fy + 12:fy + fh - 12, fx + 12:fx + fw - 12]
    lit_floor = floor[floor > 0.004]
    p90 = float(np.percentile(lit_floor, 90)) if lit_floor.size else 1.0
    scale = 1.15 / max(p90, 1e-4)
    luma *= scale
    luma = np.minimum(luma, 3.2)
    flat[:, 0] = luma
    flat[:, 1] = luma
    flat[:, 2] = luma
    image.pixels.foreach_set(flat.reshape(-1))
    print('lightmap luminance', float(luma.min()), float(np.median(luma[luma > 0.002])), float(luma.max()), 'scale', scale)
    return scale


def probe_region(image, name):
    import numpy as np
    x, y, w, h = REGIONS[name]
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(image.size[1], image.size[0], 4)
    # Blender pixel rows are bottom-up.
    crop = pixels[y + 8:y + h - 8, x + 8:x + w - 8, 0]
    if crop.size == 0:
        print(name, 'empty')
        return
    print(f'{name} luma min/p50/p95', float(crop.min()), float(np.median(crop)), float(np.percentile(crop, 95)))


def bake(layout):
    scene = bpy.context.scene
    samples = int(os.environ.get('SAMPLE_BAKE_SAMPLES', '32'))
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    size = layout['room']['lightmapSize']
    image = bpy.data.images.new('Lightmap', size, size, float_buffer=True, alpha=True)
    image.colorspace_settings.name = 'Non-Color'
    for material in bpy.data.materials:
        if material.use_nodes and material.name not in ('laylight', 'bulb'):
            attach_bake_target(material, image)
    for obj in scene.objects:
        if obj.type != 'MESH':
            continue
        has_light = obj.data.uv_layers.get('Lightmap') is not None and len(obj.data.polygons)
        obj.select_set(has_light and obj.name not in ('laylight', 'bulb'))
        if has_light:
            obj.data.uv_layers['Lightmap'].active = True
            obj.data.uv_layers['Lightmap'].active_render = True
    bpy.context.view_layer.objects.active = bpy.data.objects['bordeaux']
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = False
    scene.render.bake.margin = 6
    if hasattr(scene.render.bake, 'margin_type'):
        scene.render.bake.margin_type = 'EXTEND'
    scene.render.bake.target = 'IMAGE_TEXTURES'
    scene.render.bake.use_clear = True
    print('baking diffuse GI…')
    bpy.ops.object.bake(type='DIFFUSE')
    denoise_image(image)
    scale = neutralize_and_scale(image)
    for name in ('floor', 'ceiling', 'left', 'right', 'portal', 'far'):
        probe_region(image, name)
    hdr = ASSETS / 'lightmap.hdr'
    image.filepath_raw = str(hdr)
    image.file_format = 'HDR'
    image.save()
    print('saved', hdr, hdr.stat().st_size)
    mobile = image.copy()
    mobile.scale(1024, 1024)
    mobile_path = ASSETS / 'lightmap-mobile.hdr'
    mobile.filepath_raw = str(mobile_path)
    mobile.file_format = 'HDR'
    mobile.save()
    for obj in scene.objects:
        if obj.type == 'MESH' and obj.data.uv_layers.get('UVMap'):
            obj.data.uv_layers['UVMap'].active = True
    glb = ASSETS / 'salle-echantillon.glb'
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
        'mesh': 'salle-echantillon.glb',
        'lightmapSize': [size, size],
        'samples': samples,
        'denoiser': 'openimagedenoise',
        'lightmapMode': 'luminance',
        'scale': scale,
        'daylightK': layout['room']['daylightK'],
        'pictureK': layout['room']['pictureK'],
        'exposure': layout['room']['exposure'],
        'wallColor': layout['room']['wallColor'],
        'sun': False,
        'worldStrength': 0,
    }
    (ASSETS / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    print('exported', glb, glb.stat().st_size)


def report_check():
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    tris = 0
    for obj in meshes:
        tris += sum(len(poly.vertices) - 2 for poly in obj.data.polygons)
        downs = sum(1 for poly in obj.data.polygons if poly.normal.z < -0.2)
        if obj.name in ('cornice', 'parquet', 'laylight'):
            print(f'{obj.name} faces {len(obj.data.polygons)} downward {downs}')
    lights = [obj.name for obj in bpy.context.scene.objects if obj.type == 'LIGHT']
    print(f'meshes {len(meshes)} tris {tris} lights {len(lights)}')
    floor = bpy.data.objects['parquet']
    xs = [v.co.x for v in floor.data.vertices]
    ys = [v.co.y for v in floor.data.vertices]
    print(f'floor x {min(xs):.2f}..{max(xs):.2f} y {min(ys):.2f}..{max(ys):.2f}')


def main():
    args = argv_after_double_dash()
    layout = json.loads(LAYOUT_PATH.read_text())
    clear_scene()
    configure_world()
    ASSETS.mkdir(parents=True, exist_ok=True)
    Room(layout).build()
    if '--check' in args:
        report_check()
        return
    if '--mesh' in args:
        for obj in bpy.context.scene.objects:
            if obj.type == 'MESH' and obj.data.uv_layers.get('UVMap'):
                obj.data.uv_layers['UVMap'].active = True
        bpy.ops.export_scene.gltf(
            filepath=str(ASSETS / 'salle-echantillon.glb'),
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
        print('mesh exported')
        return
    if '--bake' in args:
        bake(layout)
        return
    look_camera((0, 0.5, 1.58), (0, 14.2, 1.9), 21)
    render_to(Path('/tmp/salle-echantillon-preview/axis.png'), 12, 960, 540)
    look_camera((-2.4, 4.7, 1.7), (-3.55, 4.7, 1.7), 32)
    render_to(Path('/tmp/salle-echantillon-preview/frame.png'), 12, 800, 800)
    look_camera((0, 4.2, 1.5), (0, 8.0, 5.4), 24)
    render_to(Path('/tmp/salle-echantillon-preview/ceiling.png'), 10, 800, 600)


if __name__ == '__main__':
    main()
