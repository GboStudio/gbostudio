#!/usr/bin/env python3
"""White open-sky sample room. Blender 4.2, Cycles luminance bake.

No ceiling. Carrara walls, a mirror marble floor, gilded frames, benches,
track spots and rough floating blocks. The far end is open. Run:

  blender --background --python bake_musee_blanc.py -- --bake
  blender --background --python bake_musee_blanc.py -- --pano
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / 'assets'
LAYOUT = json.loads((ROOT / 'layout.json').read_text())
ROOM = LAYOUT['room']
SIZE = 2048

REGIONS = {
    'floor': (8, 8, 1500, 560),
    'left': (8, 590, 1500, 460),
    'right': (8, 1070, 1500, 460),
    'pack': (1520, 8, 500, 2000),
}


def srgb_to_linear(channel):
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def kelvin(temperature):
    t = temperature / 100
    if t <= 66:
        red, green = 255, 99.4708025861 * math.log(t) - 161.1195681661
    else:
        red = 329.698727446 * ((t - 60) ** -0.1332047592)
        green = 288.1221695283 * ((t - 60) ** -0.0755148492)
    blue = 255 if t >= 66 else (0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307)
    rgb = [min(255, max(0, c)) / 255 for c in (red, green, blue)]
    return tuple(srgb_to_linear(c) for c in rgb)


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


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
    return (a[0] / length, a[1] / length, a[2] / length)


def dist(a, b):
    return math.sqrt(max(0.0, dot(sub(a, b), sub(a, b))))


def wind(coords, uvs, luvs, normal):
    n = cross(sub(coords[1], coords[0]), sub(coords[2], coords[0]))
    if dot(n, normal) < 0:
        return coords[::-1], uvs[::-1], luvs[::-1]
    return coords, uvs, luvs


class Pack:
    def __init__(self):
        self.x, self.y, self.w, self.h = REGIONS['pack']
        self.cx, self.cy, self.rh = self.x, self.y, 0

    def alloc(self, pw, ph):
        pw = max(8, min(120, int(pw) + 4))
        ph = max(8, min(120, int(ph) + 4))
        if self.cx + pw > self.x + self.w:
            self.cy += self.rh + 4
            self.cx = self.x
            self.rh = 0
        if self.cy + ph > self.y + self.h:
            self.cx, self.cy, self.rh = self.x, self.y, 0
        rect = (self.cx, self.cy, pw, ph)
        self.cx += pw + 3
        self.rh = max(self.rh, ph)
        return rect

    def uvs(self, rect):
        x, y, w, h = rect
        def uv(a, b):
            return ((x + 2 + a * (w - 4)) / SIZE, (y + 2 + b * (h - 4)) / SIZE)
        return [uv(0, 0), uv(1, 0), uv(1, 1), uv(0, 1)]

    def for_quad(self, coords):
        span_u = max(dist(coords[0], coords[1]), 0.02)
        span_v = max(dist(coords[0], coords[3]), 0.02)
        return self.uvs(self.alloc(span_u * 36, span_v * 36))


def rect_uv(name, u, v):
    x, y, w, h = REGIONS[name]
    return ((x + 3 + u * (w - 6)) / SIZE, (y + 3 + v * (h - 6)) / SIZE)


class Accum:
    def __init__(self, name, material):
        self.name = name
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new('UVMap')
        self.light = self.bm.loops.layers.uv.new('Lightmap')
        self.material = material

    def quad(self, coords, uvs, luvs, normal):
        area = Vector(cross(sub(coords[1], coords[0]), sub(coords[2], coords[0]))).length
        if area < 1e-8:
            return
        coords, uvs, luvs = wind(coords, uvs, luvs, normal)
        try:
            face = self.bm.faces.new([self.bm.verts.new(c) for c in coords])
        except ValueError:
            return
        for loop, uv, luv in zip(face.loops, uvs, luvs):
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


def sky_material(sky_path):
    material = bpy.data.materials.new('sky')
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    emit = nodes.new('ShaderNodeEmission')
    emit.inputs['Strength'].default_value = 1.15
    if sky_path.exists():
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(str(sky_path))
        material.node_tree.links.new(tex.outputs['Color'], emit.inputs['Color'])
    else:
        emit.inputs['Color'].default_value = (0.9, 0.93, 0.97, 1)
    material.node_tree.links.new(emit.outputs['Emission'], output.inputs['Surface'])
    return material


def new_material(name, color, roughness=0.4, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    return material


def box(accum, pack, x0, x1, y0, y1, z0, z1, uv_scale=1.4):
    faces = [
        ([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], (0, 0, 1)),
        ([(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)], (0, 0, -1)),
        ([(x0, y0, z0), (x0, y1, z0), (x0, y1, z1), (x0, y0, z1)], (-1, 0, 0)),
        ([(x1, y1, z0), (x1, y0, z0), (x1, y0, z1), (x1, y1, z1)], (1, 0, 0)),
        ([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], (0, -1, 0)),
        ([(x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)], (0, 1, 0)),
    ]
    for coords, normal in faces:
        luvs = pack.for_quad(coords)
        if abs(normal[0]) > 0.5:
            uvs = [(c[1] / uv_scale, c[2] / uv_scale) for c in coords]
        elif abs(normal[1]) > 0.5:
            uvs = [(c[0] / uv_scale, c[2] / uv_scale) for c in coords]
        else:
            uvs = [(c[0] / uv_scale, c[1] / uv_scale) for c in coords]
        accum.quad(coords, uvs, luvs, normal)


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = int(os.environ.get('BLANC_SAMPLES', '24'))
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.03
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 3
    scene.cycles.sample_clamp_indirect = 6
    scene.view_settings.view_transform = 'AgX'
    world = bpy.data.worlds.new('Sky')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    sky_path = ASSETS / 'pbr' / 'sky-dome.jpg'
    if sky_path.exists():
        image = bpy.data.images.load(str(sky_path))
        tex = world.node_tree.nodes.new('ShaderNodeTexEnvironment')
        tex.image = image
        world.node_tree.links.new(tex.outputs['Color'], bg.inputs['Color'])
    else:
        bg.inputs['Color'].default_value = (0.85, 0.9, 0.95, 1)
    bg.inputs['Strength'].default_value = 0.72

    white = tuple(srgb_to_linear(c) for c in (0.90, 0.90, 0.88))
    mats = {
        'marble': new_material('marble', white, 0.32),
        'floor': new_material('floor', white, 0.08),
        'gilt': new_material('gilt', tuple(srgb_to_linear(c) for c in (0.86, 0.68, 0.32)), 0.3, 1),
        'artwork': new_material('artwork', (0.4, 0.32, 0.24), 0.6),
        'iron': new_material('iron', (0.02, 0.02, 0.02), 0.35, 0.8),
        'bulb': new_material('bulb', kelvin(3000), 0.3),
        'rock': new_material('rock', white, 0.72),
        'sky': sky_material(sky_path),
    }
    meshes = {name: Accum(name, material) for name, material in mats.items()}
    pack = Pack()
    half = ROOM['width'] / 2
    back = ROOM['backZ']
    end = ROOM['length'] - 1.2
    height = 6.4
    tile = 6.3

    # Floor, open at the far end. No back wall.
    floor = [(-half, back, 0), (half, back, 0), (half, end + 4, 0), (-half, end + 4, 0)]
    meshes['floor'].quad(
        floor,
        [(c[0] / tile, c[1] / tile) for c in floor],
        [rect_uv('floor', (c[1] - back) / (end + 4 - back), (c[0] + half) / ROOM['width']) for c in floor],
        (0, 0, 1),
    )

    # Stepped marble slabs. Adjacent bays sit deeper and mirror the vein, bookmatched.
    pilasters = LAYOUT['pilasters']
    cuts = [back, 3.4, 6.9, 10.4, end]
    for index in range(len(cuts) - 1):
        y0, y1 = cuts[index], cuts[index + 1]
        recess = 0.0 if index % 2 == 0 else 0.26
        for sign, name in ((-1, 'left'), (1, 'right')):
            x = sign * (half + recess)
            coords = [(x, y0, 0), (x, y1, 0), (x, y1, height), (x, y0, height)]
            if sign > 0:
                coords = [coords[0], coords[3], coords[2], coords[1]]
            luvs = [rect_uv(name, (c[1] - back) / (end - back), c[2] / height) for c in coords]
            uvs = [(c[1] / tile, c[2] / tile) for c in coords]
            if (sign > 0) != (index % 2 == 1):
                uvs = [(-u, v) for u, v in uvs]
            meshes['marble'].quad(coords, uvs, luvs, (-sign, 0, 0))
        # Return wall of the step, so the offset reads as a real slab.
        if recess:
            y = y0
            for sign in (-1, 1):
                x_in = sign * half
                x_out = sign * (half + recess)
                coords = [(x_in, y, 0), (x_out, y, 0), (x_out, y, height), (x_in, y, height)]
                meshes['marble'].quad(coords, [(0, 0), (1, 0), (1, 1), (0, 1)], pack.for_quad(coords), (0, 1 if index % 2 else -1, 0))

    # Pilasters: base, shaft, inner panel, capital. Wider than the bordeaux posts.
    for item in pilasters:
        width = max(item['width'], 0.72)
        depth = 0.34
        y0 = item['z'] - width / 2
        y1 = item['z'] + width / 2
        for sign in (-1, 1):
            x0 = sign * half
            x1 = sign * (half - depth) if sign > 0 else sign * half + depth
            xa, xb = (x0, x1) if x0 < x1 else (x1, x0)
            box(meshes['marble'], pack, xa, xb, y0 - 0.03, y1 + 0.03, 0.0, 0.22)
            box(meshes['marble'], pack, xa + 0.015 * sign, xb, y0 + 0.02, y1 - 0.02, 0.22, height - 0.42)
            box(meshes['marble'], pack, xa - 0.02 * sign, xb + 0.015 * sign, y0 - 0.05, y1 + 0.05, height - 0.42, height - 0.16)

    # Skirting in the same marble, slightly proud.
    for sign in (-1, 1):
        x0 = sign * half
        x1 = sign * (half - 0.06)
        xa, xb = (min(x0, x1), max(x0, x1))
        box(meshes['marble'], pack, xa, xb, back, end, 0.0, 0.14)

    # Benches, same places, white marble, bevelled top.
    for bench in LAYOUT['benches']:
        depth = bench['depth']
        if bench['wall'] == 'left':
            x0, x1 = -half + 0.08, -half + 0.08 + depth
        else:
            x1, x0 = half - 0.08, half - 0.08 - depth
        y0, y1, h = bench['z0'], bench['z1'], bench['height']
        box(meshes['marble'], pack, min(x0, x1), max(x0, x1), y0, y1, 0.02, h - 0.06)
        box(meshes['marble'], pack, min(x0, x1) + 0.04, max(x0, x1) - 0.04, y0 + 0.05, y1 - 0.05, h - 0.06, h)

    # Frames. Wider gilt profile. Layout is in Three.js space (x, up, depth).
    heroes = []
    nonhero = 0
    profile = [0.0, 0.018, 0.046, 0.028, 0.07, 0.04, 0.058, 0.02]
    for frame in LAYOUT['frames']:
        if frame['wall'] not in ('left', 'right'):
            continue
        mould = frame['moulding']
        sign = 1 if frame['x'] < 0 else -1
        x_wall = frame['x']
        y0 = frame['z'] - frame['width'] / 2
        y1 = frame['z'] + frame['width'] / 2
        z0 = frame['y'] - frame['height'] / 2
        z1 = frame['y'] + frame['height'] / 2
        rings = []
        for step, depth_k in enumerate(profile):
            inset = mould * step / (len(profile) - 1)
            depth = 0.012 + depth_k
            rings.append([
                (x_wall + sign * depth, y0 + inset, z0 + inset),
                (x_wall + sign * depth, y1 - inset, z0 + inset),
                (x_wall + sign * depth, y1 - inset, z1 - inset),
                (x_wall + sign * depth, y0 + inset, z1 - inset),
            ])
        for i in range(len(rings) - 1):
            for k in range(4):
                nxt = (k + 1) % 4
                coords = [rings[i][k], rings[i][nxt], rings[i + 1][nxt], rings[i + 1][k]]
                meshes['gilt'].quad(coords, [(0, i / 8), (1, i / 8), (1, (i + 1) / 8), (0, (i + 1) / 8)], pack.for_quad(coords), (sign, 0, 0))
        art_y0, art_y1 = y0 + mould, y1 - mould
        art_z0, art_z1 = z0 + mould, z1 - mould
        x_art = x_wall + sign * 0.016
        # Left wall (negative X, normal toward +X): visitor's right is -Y.
        uvs = [(1, 0), (0, 0), (0, 1), (1, 1)] if sign > 0 else [(0, 0), (1, 0), (1, 1), (0, 1)]
        coords = [(x_art, art_y0, art_z0), (x_art, art_y1, art_z0), (x_art, art_y1, art_z1), (x_art, art_y0, art_z1)]
        if frame['hero']:
            hero = Accum(f"Hero_{len(heroes):02d}", mats['artwork'])
            hero.quad(coords, uvs, pack.for_quad(coords), (sign, 0, 0))
            heroes.append(hero)
        else:
            columns = 4
            column, row = nonhero % columns, nonhero // columns
            nonhero += 1
            step = 1 / columns
            pad = 0.01
            u0, v0 = column * step + pad, row * step + pad
            u1, v1 = (column + 1) * step - pad, (row + 1) * step - pad
            mapped = [(u0 + u * (u1 - u0), v0 + v * (v1 - v0)) for u, v in uvs]
            meshes['artwork'].quad(coords, mapped, pack.for_quad(coords), (sign, 0, 0))
        # Spot aimed at the marble around the frame.
        spot = bpy.data.lights.new(f"spot-{frame['id']}", 'SPOT')
        spot.energy = 140
        spot.color = kelvin(3000)
        spot.spot_size = math.radians(58)
        spot.spot_blend = 0.85
        spot.shadow_soft_size = 0.25
        obj = bpy.data.objects.new(f"spot-{frame['id']}", spot)
        head = (x_wall + sign * 0.55, frame['z'], frame['y'] + frame['height'] * 0.85)
        obj.location = head
        direction = Vector((x_wall + sign * 0.02 - head[0], 0, frame['y'] - head[2]))
        obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
        bpy.context.scene.collection.objects.link(obj)

    # Tracks along the top inner edge, with a small black head above each frame.
    for sign in (-1, 1):
        x = sign * (half - 0.28)
        box(meshes['iron'], pack, x - 0.015, x + 0.015, back + 0.5, end - 0.4, height - 0.42, height - 0.38)
    for frame in LAYOUT['frames']:
        if frame['wall'] not in ('left', 'right'):
            continue
        sign = 1 if frame['x'] < 0 else -1
        hx = frame['x'] + sign * 0.42
        box(meshes['iron'], pack, hx - 0.045, hx + 0.045, frame['z'] - 0.04, frame['z'] + 0.04, height - 0.58, height - 0.36)

    # Rough floating blocks. Displaced, not smooth primitives.
    # (x, depth, height, radius) in Blender space. About fifteen, along the axis.
    rocks = [
        (0.15, 8.4, 7.6, 1.28),
        (-0.85, 6.1, 6.2, 0.82),
        (1.05, 6.8, 5.2, 0.66),
        (0.35, 10.6, 8.5, 1.12),
        (-1.15, 11.0, 4.6, 0.52),
        (0.95, 12.3, 7.0, 0.9),
        (-0.25, 9.1, 9.1, 0.58),
        (1.35, 5.2, 4.1, 0.42),
        (-0.7, 13.4, 6.6, 0.74),
        (0.45, 14.4, 5.0, 0.4),
        (-1.25, 7.8, 8.0, 0.48),
        (0.1, 15.6, 7.4, 1.02),
        (1.15, 16.1, 4.5, 0.55),
        (-0.4, 6.6, 9.3, 0.34),
        (0.65, 11.7, 3.7, 0.46),
    ]
    for index, (rx, ry, rz, radius) in enumerate(rocks):
        center = (rx, ry, rz)
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=center)
        rock = bpy.context.active_object
        rock.name = f'rock-{index:02d}'
        rock.scale = (
            radius * (1.25 + 0.4 * math.sin(index * 2.1)),
            radius * (0.8 + 0.45 * math.cos(index * 1.3)),
            radius * (1.1 + 0.5 * math.sin(index * 0.7)),
        )
        rock.rotation_euler = (index * 0.7, index * 1.1, index * 0.4)
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.subdivide(number_cuts=3)
        bpy.ops.object.mode_set(mode='OBJECT')
        mesh = rock.data
        rng = __import__('random').Random(20 + index)
        for vertex in mesh.vertices:
            vertex.co += vertex.normal * radius * rng.uniform(-0.05, 0.55)
            vertex.co.x += rng.uniform(-0.12, 0.12) * radius
            vertex.co.y += rng.uniform(-0.12, 0.12) * radius
            vertex.co.z += rng.uniform(-0.12, 0.12) * radius
        for polygon in mesh.polygons:
            polygon.use_smooth = False
        rock.data.materials.append(mats['rock'])
        if not mesh.uv_layers.get('UVMap'):
            mesh.uv_layers.new(name='UVMap')
        mesh.uv_layers.new(name='Lightmap')
        bm = bmesh.new()
        bm.from_mesh(mesh)
        uv = bm.loops.layers.uv[mesh.uv_layers['UVMap'].name]
        for face in bm.faces:
            for loop in face.loops:
                co = loop.vert.co
                axis = face.normal
                if abs(axis.z) >= abs(axis.x) and abs(axis.z) >= abs(axis.y):
                    loop[uv].uv = (co.x * 0.42, co.y * 0.42)
                elif abs(axis.x) >= abs(axis.y):
                    loop[uv].uv = (co.y * 0.42, co.z * 0.42)
                else:
                    loop[uv].uv = (co.x * 0.42, co.z * 0.42)
        bm.to_mesh(mesh)
        bm.free()
        luv = mesh.uv_layers['Lightmap'].data
        island = pack.uvs(pack.alloc(28, 28))
        for loop_index in range(len(luv)):
            luv[loop_index].uv = island[loop_index % 4]

    # Sky dome, emissive in the viewer, hidden from the bake.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=40, location=(0, end * 0.5, 2))
    dome = bpy.context.active_object
    dome.name = 'sky'
    dome.data.materials.append(mats['sky'])
    for polygon in dome.data.polygons:
        polygon.flip()
    if not dome.data.uv_layers.get('UVMap'):
        dome.data.uv_layers.new(name='UVMap')
    dome.data.uv_layers.new(name='Lightmap')
    # The photograph and the viewer show the dome. The bake uses the world, or the dome would seal the room.
    dome.hide_render = True

    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 2.2
    sun.color = kelvin(5600)
    sun.angle = math.radians(14)
    sun_obj = bpy.data.objects.new('sun', sun)
    sun_obj.rotation_euler = (math.radians(38), 0, math.radians(4))
    bpy.context.scene.collection.objects.link(sun_obj)

    for hero in heroes:
        hero.finish()
    for accum in meshes.values():
        accum.finish(smooth=False)
    return scene


def neutralize(image):
    import numpy as np
    flat = np.array(image.pixels[:], dtype=np.float32).reshape(-1, 4)
    luma = 0.2126 * flat[:, 0] + 0.7152 * flat[:, 1] + 0.0722 * flat[:, 2]
    pic = luma.reshape(image.size[1], image.size[0])
    x, y, w, h = REGIONS['floor']
    crop = pic[y + 8:y + h - 8, x + 8:x + w - 8]
    lit = crop[crop > 0.01]
    p90 = float(np.percentile(lit, 90)) if lit.size else 1
    scale = 0.82 / max(p90, 1e-4)
    luma = np.minimum(luma * scale, 1.35)
    flat[:, 0] = flat[:, 1] = flat[:, 2] = luma
    image.pixels.foreach_set(flat.reshape(-1))
    print('lightmap luminance', float(luma.min()), float(np.median(luma[luma > 0.01])), float(luma.max()), 'scale', scale)


def export_glb():
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH' and obj.data.uv_layers.get('UVMap'):
            obj.data.uv_layers['UVMap'].active = True
    path = ASSETS / 'salle-echantillon.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(path),
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
    print('exported', path, path.stat().st_size)


def bake():
    scene = bpy.context.scene
    image = bpy.data.images.new('Lightmap', SIZE, SIZE, float_buffer=True, alpha=True)
    image.colorspace_settings.name = 'Non-Color'
    for material in bpy.data.materials:
        if material.use_nodes and material.name not in ('sky', 'bulb'):
            node = material.node_tree.nodes.new('ShaderNodeTexImage')
            node.image = image
            material.node_tree.nodes.active = node
    for obj in scene.objects:
        if obj.type != 'MESH':
            continue
        has = obj.data.uv_layers.get('Lightmap') is not None and len(obj.data.polygons)
        obj.select_set(has and obj.name != 'sky')
        if has:
            obj.data.uv_layers['Lightmap'].active = True
    bpy.context.view_layer.objects.active = bpy.data.objects['marble']
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = False
    scene.render.bake.margin = 8
    if hasattr(scene.render.bake, 'margin_type'):
        scene.render.bake.margin_type = 'EXTEND'
    scene.render.bake.use_clear = True
    print('baking open-sky GI…')
    bpy.ops.object.bake(type='DIFFUSE')
    try:
        from bake_salle_temoin import denoise_image
    except Exception:
        denoise_image = None
    if denoise_image:
        # The helper lives next door and uses bpy. Reuse it if import works.
        pass
    # Inline OIDN is heavy to import across files. Denoise with the local copy.
    denoise_local(image)
    neutralize(image)
    hdr = ASSETS / 'lightmap.hdr'
    image.filepath_raw = str(hdr)
    image.file_format = 'HDR'
    image.save()
    mobile = image.copy()
    mobile.scale(1024, 1024)
    mobile.filepath_raw = str(ASSETS / 'lightmap-mobile.hdr')
    mobile.file_format = 'HDR'
    mobile.save()
    print('saved', hdr, hdr.stat().st_size)
    export_glb()
    manifest = {
        'generator': 'blender-4.2-cycles',
        'export': 'export_vertex_color',
        'lightmap': 'lightmap.hdr',
        'mesh': 'salle-echantillon.glb',
        'lightmapSize': [SIZE, SIZE],
        'samples': scene.cycles.samples,
        'denoiser': 'openimagedenoise',
        'lightmapMode': 'luminance',
        'pictureK': 3000,
        'daylightK': 5600,
        'exposure': ROOM.get('exposure', 1.06),
        'wallColor': ROOM.get('wallColor', '#E4E0DA'),
        'openSky': True,
        'sun': True,
        'worldStrength': 0.72,
        'pano': 'pano-360.jpg',
    }
    (ASSETS / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')


def denoise_local(image):
    try:
        import numpy as np
        import ctypes
    except ImportError:
        return
    lib = Path(bpy.app.binary_path).parent / 'lib' / 'libOpenImageDenoise.so'
    if not lib.exists():
        print('no oidn')
        return
    for extra in ('libOpenImageDenoise_core.so.2', 'libOpenImageDenoise_device_cpu.so.2'):
        path = Path(bpy.app.binary_path).parent / 'lib' / extra
        if path.exists():
            ctypes.CDLL(str(path))
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
    image.pixels.foreach_set(pixels.reshape(-1))
    print('denoised')


def dress_for_photo():
    """The walk viewer supplies the marble and the paintings. The photograph needs them too."""
    def attach(material_name, path, socket='Base Color', colorspace='sRGB'):
        material = bpy.data.materials.get(material_name)
        image_path = Path(path)
        if not material or not image_path.exists() or not material.node_tree.nodes.get('Principled BSDF'):
            print('photo texture skipped', material_name, image_path.exists())
            return
        tex = material.node_tree.nodes.new('ShaderNodeTexImage')
        image = bpy.data.images.load(str(image_path))
        image.colorspace_settings.name = colorspace
        tex.image = image
        material.node_tree.links.new(tex.outputs['Color'], material.node_tree.nodes['Principled BSDF'].inputs[socket])

    attach('marble', ASSETS / 'pbr' / 'carrara-diff.jpg')
    attach('floor', ASSETS / 'pbr' / 'carrara-diff.jpg')
    attach('rock', ASSETS / 'pbr' / 'carrara-diff.jpg')
    floor = bpy.data.materials.get('floor')
    if floor and floor.node_tree.nodes.get('Principled BSDF'):
        floor.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.14
    paintings = ROOT.parent / 'salle-temoin' / 'assets' / 'paintings'
    heroes = [frame for frame in LAYOUT['frames'] if frame.get('hero') and frame['wall'] in ('left', 'right')]
    for index, frame in enumerate(heroes):
        obj = bpy.data.objects.get(f'Hero_{index:02d}')
        image_path = paintings / frame['painting']
        if not obj or not image_path.exists():
            continue
        material = bpy.data.materials.new(f'hero-{index}')
        material.use_nodes = True
        bsdf = material.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Roughness'].default_value = 0.62
        tex = material.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(str(image_path))
        material.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        obj.data.materials[0] = material
    scene = bpy.context.scene
    scene.view_settings.exposure = float(os.environ.get('BLANC_PANO_EXPOSURE', '0.65'))
    background = scene.world.node_tree.nodes.get('Background')
    if background:
        background.inputs['Strength'].default_value = 1.15


def pano():
    scene = bpy.context.scene
    dress_for_photo()
    scene.cycles.samples = int(os.environ.get('BLANC_PANO_SAMPLES', '32'))
    cam_data = bpy.data.cameras.new('Pano')
    cam_data.type = 'PANO'
    cam_data.panorama_type = 'EQUIRECTANGULAR'
    cam = bpy.data.objects.new('Pano', cam_data)
    # Tour stop: the centred eye-height camera, Three.js z = cameraZ.
    cam.location = (0, ROOM.get('cameraZ', 1.15), ROOM.get('eye', 1.6))
    # Cycles looks down local -Z. This aims +Y (down the hall) with +Z up.
    cam.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.scene.collection.objects.link(cam)
    scene.camera = cam
    sky = bpy.data.objects.get('sky')
    if sky:
        sky.hide_render = False
    # A light volume so the shaft is in the photograph. Kept out of the bake.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, ROOM['length'] * 0.45, 4))
    cube = bpy.context.active_object
    cube.scale = (6, ROOM['length'] * 0.7, 8)
    vol = bpy.data.materials.new('volume')
    vol.use_nodes = True
    vol.node_tree.nodes.clear()
    scatter = vol.node_tree.nodes.new('ShaderNodeVolumeScatter')
    scatter.inputs['Density'].default_value = 0.012
    scatter.inputs['Anisotropy'].default_value = 0.55
    scatter.inputs['Color'].default_value = (1, 0.98, 0.94, 1)
    out = vol.node_tree.nodes.new('ShaderNodeOutputMaterial')
    vol.node_tree.links.new(scatter.outputs['Volume'], out.inputs['Volume'])
    cube.data.materials.append(vol)
    cube.display_type = 'WIRE'
    cube.visible_shadow = False
    if hasattr(scene.cycles, 'volume_step_rate'):
        scene.cycles.volume_step_rate = 4
    path = ASSETS / os.environ.get('BLANC_PANO_NAME', 'pano-360.jpg')
    scene.render.resolution_x = int(os.environ.get('BLANC_PANO_W', '6144'))
    scene.render.resolution_y = int(os.environ.get('BLANC_PANO_H', '3072'))
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 90
    scene.render.filepath = str(path)
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    print('rendering equirect…')
    bpy.ops.render.render(write_still=True)
    print('saved', path, path.stat().st_size)


def main():
    import sys
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    build()
    if '--mesh' in args:
        export_glb()
        return
    if '--pano' in args:
        pano()
        return
    bake()


if __name__ == '__main__':
    main()
