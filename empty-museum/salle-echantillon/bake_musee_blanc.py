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
CC0 = ASSETS / 'cc0'
MARBLE_COLOR = ASSETS / 'pbr' / 'carrara-diff.jpg'
MARBLE_NORMAL = ASSETS / 'pbr' / 'carrara-nor.jpg'
MARBLE_ROUGH = ASSETS / 'pbr' / 'carrara-rough.jpg'
HDRI = CC0 / os.environ.get('BLANC_HDRI', 'kloofendal_48d_partly_cloudy_puresky_1k.hdr')
PAINTINGS = ROOT.parent / 'salle-temoin' / 'assets' / 'paintings'
ROCK_SOURCES = ['boulder_01', 'rock_07', 'rock_09', 'namaqualand_boulder_03']
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


def load_image(path, colorspace):
    image = bpy.data.images.load(str(path))
    image.colorspace_settings.name = colorspace
    return image


def marble_material(name, roughness, normal_strength, rough_scale=None, metallic=0.0, contrast=None, bright=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if MARBLE_COLOR.exists():
        color = nodes.new('ShaderNodeTexImage')
        color.extension = 'REPEAT'
        color.image = load_image(MARBLE_COLOR, 'sRGB')
        grade = nodes.new('ShaderNodeBrightContrast')
        # A light grade only. Contrast 38 was turning the warm scan into yellow veins.
        if contrast is None:
            contrast = 6 if name == 'floor' else 8
        grade.inputs['Contrast'].default_value = contrast
        grade.inputs['Bright'].default_value = bright
        separate = nodes.new('ShaderNodeSeparateColor')
        combine = nodes.new('ShaderNodeCombineColor')
        separate.mode = 'HSV'
        combine.mode = 'HSV'
        grey = nodes.new('ShaderNodeMath')
        grey.operation = 'MULTIPLY'
        grey.inputs[1].default_value = 0.12
        links.new(color.outputs['Color'], grade.inputs['Color'])
        links.new(grade.outputs['Color'], separate.inputs['Color'])
        links.new(separate.outputs['Red'], combine.inputs['Red'])
        links.new(separate.outputs['Green'], grey.inputs[0])
        links.new(grey.outputs['Value'], combine.inputs['Green'])
        links.new(separate.outputs['Blue'], combine.inputs['Blue'])
        links.new(combine.outputs['Color'], bsdf.inputs['Base Color'])
    if MARBLE_NORMAL.exists() and normal_strength > 0:
        normal = nodes.new('ShaderNodeTexImage')
        normal.image = load_image(MARBLE_NORMAL, 'Non-Color')
        nmap = nodes.new('ShaderNodeNormalMap')
        nmap.inputs['Strength'].default_value = normal_strength
        links.new(normal.outputs['Color'], nmap.inputs['Color'])
        links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    if rough_scale and MARBLE_ROUGH.exists():
        rough = nodes.new('ShaderNodeTexImage')
        rough.image = load_image(MARBLE_ROUGH, 'Non-Color')
        scale = nodes.new('ShaderNodeMath')
        scale.operation = 'MULTIPLY'
        scale.inputs[1].default_value = rough_scale
        links.new(rough.outputs['Color'], scale.inputs[0])
        links.new(scale.outputs['Value'], bsdf.inputs['Roughness'])
    return material


def rock_material():
    """Pale stone. Boulder grey by default; marble blocks when BLANC_ROCK_MARBLE=1."""
    if os.environ.get('BLANC_ROCK_MARBLE', '1') == '1':
        return marble_material('rock', 0.62, 0.9, contrast=10, bright=-0.06)
    material = bpy.data.materials.new('rock')
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.82
    coord = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (2.2, 2.2, 2.2)
    links.new(coord.outputs['Object'], mapping.inputs['Vector'])
    image_path = CC0 / 'rocks' / 'textures' / 'boulder_01_diff_1k.jpg'
    if image_path.exists():
        tex = nodes.new('ShaderNodeTexImage')
        tex.projection = 'BOX'
        tex.projection_blend = 0.45
        tex.image = load_image(image_path, 'sRGB')
        links.new(mapping.outputs['Vector'], tex.inputs['Vector'])
        grey = nodes.new('ShaderNodeRGBToBW')
        links.new(tex.outputs['Color'], grey.inputs['Color'])
        shade = nodes.new('ShaderNodeMixRGB')
        shade.blend_type = 'MULTIPLY'
        shade.inputs['Fac'].default_value = 1.0
        # Light grey stone. The boulder photo is sand-coloured; the grain stays, the hue goes.
        rock_grey = float(os.environ.get('BLANC_ROCK_GREY', '0.72'))
        shade.inputs['Color1'].default_value = (rock_grey, rock_grey, rock_grey, 1)
        links.new(grey.outputs['Val'], shade.inputs['Color2'])
        links.new(shade.outputs['Color'], bsdf.inputs['Base Color'])
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.45
        bump.inputs['Distance'].default_value = 0.15
        links.new(tex.outputs['Color'], bump.inputs['Height'])
        normal_path = CC0 / 'rocks' / 'textures' / 'boulder_01_nor_gl_1k.jpg'
        if normal_path.exists():
            nor = nodes.new('ShaderNodeTexImage')
            nor.projection = 'BOX'
            nor.projection_blend = 0.45
            nor.image = load_image(normal_path, 'Non-Color')
            links.new(mapping.outputs['Vector'], nor.inputs['Vector'])
            nmap = nodes.new('ShaderNodeNormalMap')
            nmap.inputs['Strength'].default_value = 1.1
            links.new(nor.outputs['Color'], nmap.inputs['Color'])
            links.new(nmap.outputs['Normal'], bump.inputs['Normal'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.45, 0.44, 0.42, 1)
    return material


def painting_material(index, frame):
    material = new_material(f'canvas-{index:02d}', (0.45, 0.4, 0.34), 0.55)
    rel = frame['painting']
    path = (ASSETS / rel) if rel.startswith('cc0/') else (PAINTINGS / rel)
    if not path.exists():
        print('missing painting', path)
        return material
    tex = material.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = load_image(path, 'sRGB')
    material.node_tree.links.new(tex.outputs['Color'], material.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
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



def place_rocks(material):
    """Scanned CC0 boulders, scaled and repeated, wearing the marble."""
    sources = []
    for name in ROCK_SOURCES:
        path = CC0 / 'rocks' / f'{name}.gltf'
        if not path.exists():
            print('missing rock', path)
            continue
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(path))
        imported = [obj for obj in bpy.data.objects if obj not in before and obj.type == 'MESH']
        if not imported:
            print('no mesh in', path)
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in imported:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = imported[0]
        if len(imported) > 1:
            bpy.ops.object.join()
        src = bpy.context.view_layer.objects.active
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
        longest = max(src.dimensions)
        if longest > 0:
            src.scale = (1.0 / longest, 1.0 / longest, 1.0 / longest)
            bpy.ops.object.transform_apply(scale=True)
        src.name = f'src-{name}'
        src.data.materials.clear()
        src.data.materials.append(material)
        repair_rock(src, int(os.environ.get('BLANC_ROCK_FACES', '1400')))
        src.hide_render = True
        src.hide_set(True)
        sources.append(src)
        print('rock source', src.name, 'faces', len(src.data.polygons))
    if not sources:
        raise RuntimeError('no CC0 rocks imported')
    placements = [
        (0.05, 7.6, 6.2, 1.35),
        (-1.15, 6.2, 4.7, 0.72),
        (1.2, 6.8, 4.1, 0.55),
        (0.4, 9.0, 7.0, 1.05),
        (-0.85, 9.6, 5.0, 0.62),
        (0.95, 10.4, 5.8, 0.82),
        (-0.25, 11.2, 4.3, 0.42),
        (1.35, 8.4, 3.5, 0.36),
        (-1.3, 11.8, 6.4, 0.7),
        (0.15, 12.8, 5.3, 0.9),
        (0.75, 13.8, 3.9, 0.48),
        (-0.55, 7.4, 7.4, 0.4),
        (0.55, 10.0, 3.3, 0.34),
        (-1.0, 13.2, 5.6, 0.58),
        (0.3, 14.8, 6.6, 0.78),
        # In front of the open sky, the way the target hangs stones in the clouds.
        (0.15, 15.6, 5.8, 1.55),
        (-1.7, 13.4, 7.6, 1.15),
        (1.55, 16.4, 4.4, 0.95),
        (-0.4, 11.6, 8.8, 1.25),
    ]
    for index, (rx, ry, rz, radius) in enumerate(placements):
        src = sources[index % len(sources)]
        obj = src.copy()
        obj.data = src.data
        obj.name = f'rock-{index:02d}'
        obj.location = (rx, ry, rz)
        obj.rotation_euler = (index * 0.9, index * 1.3, index * 0.45)
        obj.scale = (
            radius * (1.5 + 0.9 * abs(math.sin(index * 1.7))),
            radius * (1.2 + 1.0 * abs(math.cos(index * 0.8))),
            radius * (1.4 + 0.8 * abs(math.sin(index * 2.2))),
        )
        obj.hide_render = False
        obj.hide_set(False)
        bpy.context.scene.collection.objects.link(obj)


def apply_grade(exposure):
    view = bpy.context.scene.view_settings
    view.view_transform = 'AgX'
    view.look = 'AgX - Medium High Contrast'
    view.exposure = exposure


def repair_rock(obj, target_faces):
    """Close the scan, then collapse. A raw decimate of boulder_01 left a point cloud."""
    obj.hide_set(False)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.002)
    bpy.ops.object.mode_set(mode='OBJECT')
    remesh = obj.modifiers.new('Remesh', 'REMESH')
    remesh.mode = 'VOXEL'
    remesh.voxel_size = 0.018
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    collapse_mesh(obj, target_faces)
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    boundary = sum(1 for edge in mesh.edges if edge.is_boundary)
    mesh.free()
    print('rock solid', obj.name, 'faces', len(obj.data.polygons), 'boundary', boundary)


def collapse_mesh(obj, target_faces):
    """One shared low mesh. Instances keep this data; the draw count is faces × copies."""
    for _ in range(4):
        faces = len(obj.data.polygons)
        if faces <= target_faces * 1.15:
            print('collapse skip', obj.name, faces)
            return
        if obj.data.users > 1:
            obj.data = obj.data.copy()
        obj.hide_set(False)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        mod = obj.modifiers.new('Decimate', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        ratio = max(0.008, min(1.0, target_faces / faces))
        mod.ratio = ratio
        bpy.ops.object.modifier_apply(modifier=mod.name)
        print('collapsed', obj.name, faces, '->', len(obj.data.polygons), 'ratio', round(ratio, 4))
        if len(obj.data.polygons) > faces * 0.85:
            # This mesh stops early. A second, smaller ratio reaches the target.
            continue


def decimate_rocks(target=1200):
    seen = set()
    for src in [obj for obj in bpy.data.objects if obj.type == 'MESH' and obj.name.startswith('src-')]:
        if src.data in seen:
            continue
        seen.add(src.data)
        users = [obj for obj in bpy.data.objects if obj.data == src.data]
        collapse_mesh(src, int(target))
        for user in users:
            user.data = src.data
        print('rock instances', src.name, len(users), 'faces', len(src.data.polygons))


def rock_lightmaps():
    meshes = []
    for obj in bpy.data.objects:
        if obj.type == 'MESH' and obj.name.startswith('src-') and obj.data not in meshes:
            meshes.append(obj.data)
    pack = Pack()
    for mesh in meshes:
        if not mesh.uv_layers.get('Lightmap'):
            mesh.uv_layers.new(name='Lightmap')
        obj = next(o for o in bpy.data.objects if o.data == mesh and o.name.startswith('src-'))
        obj.hide_set(False)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        mesh.uv_layers['Lightmap'].active = True
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.03)
        bpy.ops.object.mode_set(mode='OBJECT')
        island = pack.uvs(pack.alloc(80, 160))
        luv = mesh.uv_layers['Lightmap'].data
        us = [loop.uv[0] for loop in luv]
        vs = [loop.uv[1] for loop in luv]
        minu, maxu = min(us), max(us)
        minv, maxv = min(vs), max(vs)
        x, y, w, h = None, None, None, None
        # island is four corners of the packed rect, in 0-1 of the lightmap.
        # Scale the smart-projected island into that rect.
        u0, v0 = island[0]
        u1, v1 = island[2]
        for loop in luv:
            u = 0 if maxu == minu else (loop.uv[0] - minu) / (maxu - minu)
            v = 0 if maxv == minv else (loop.uv[1] - minv) / (maxv - minv)
            loop.uv[0] = u0 + u * (u1 - u0)
            loop.uv[1] = v0 + v * (v1 - v0)
        obj.hide_set(True)


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = int(os.environ.get('BLANC_SAMPLES', '24'))
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.03
    scene.cycles.max_bounces = 8
    scene.cycles.diffuse_bounces = 4
    scene.cycles.glossy_bounces = 4
    scene.cycles.volume_bounces = 1
    scene.cycles.sample_clamp_indirect = 8
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    apply_grade(float(os.environ.get('BLANC_EXPOSURE', '0.15')))
    world = bpy.data.worlds.new('Sky')
    scene.world = world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    bg = nodes['Background']
    if HDRI.exists():
        env = nodes.new('ShaderNodeTexEnvironment')
        env.image = bpy.data.images.load(str(HDRI))
        for space in ('Linear Rec.709', 'Linear', 'Non-Color'):
            try:
                env.image.colorspace_settings.name = space
                break
            except TypeError:
                continue
        geo = nodes.new('ShaderNodeNewGeometry')
        mapping = nodes.new('ShaderNodeMapping')
        mapping.inputs['Rotation'].default_value[0] = math.radians(float(os.environ.get('BLANC_SKY_PITCH', '0')))
        mapping.inputs['Rotation'].default_value[2] = math.radians(float(os.environ.get('BLANC_SKY_ROT', '40')))
        links.new(geo.outputs['Incoming'], mapping.inputs['Vector'])
        links.new(mapping.outputs['Vector'], env.inputs['Vector'])
        # Keep the white cumulus. The previous 0.28 saturation pulled them into a grey-blue plate.
        separate = nodes.new('ShaderNodeSeparateColor')
        combine = nodes.new('ShaderNodeCombineColor')
        separate.mode = 'HSV'
        combine.mode = 'HSV'
        sat = nodes.new('ShaderNodeMath')
        sat.operation = 'MULTIPLY'
        sat.inputs[1].default_value = 0.06
        links.new(env.outputs['Color'], separate.inputs['Color'])
        links.new(separate.outputs['Red'], combine.inputs['Red'])
        links.new(separate.outputs['Green'], sat.inputs[0])
        links.new(sat.outputs['Value'], combine.inputs['Green'])
        links.new(separate.outputs['Blue'], combine.inputs['Blue'])
        sky_color = combine.outputs['Color']
    else:
        bg.inputs['Color'].default_value = (0.92, 0.94, 0.96, 1)
        sky_color = None
    # The photograph and the glass see a bright sky. The walls are lit by a dimmer copy,
    # so the opening can sit above the marble without burning the room again.
    view_bg = nodes.new('ShaderNodeBackground')
    if sky_color is not None:
        links.new(sky_color, bg.inputs['Color'])
        # Lift the dark half of the puresky so the camera sees white cloud, not a blue band.
        lifted = nodes.new('ShaderNodeGamma')
        lifted.inputs['Gamma'].default_value = float(os.environ.get('BLANC_SKY_GAMMA', '1'))
        links.new(sky_color, lifted.inputs['Color'])
        links.new(lifted.outputs['Color'], view_bg.inputs['Color'])
    light_strength = float(os.environ.get('BLANC_SKY_STRENGTH', '0.35'))
    view_strength = float(os.environ.get('BLANC_SKY_VIEW', '2.5'))
    horizon_strength = float(os.environ.get('BLANC_HORIZON', '0'))
    if horizon_strength > 0 and sky_color is not None:
        # Camera-only band along the horizon, so the end of the hall can be
        # brighter than the walls without turning the cumulus into a white sheet.
        horizon_bg = nodes.new('ShaderNodeBackground')
        horizon_bg.inputs['Color'].default_value = (1.0, 0.985, 0.96, 1)
        horizon_bg.inputs['Strength'].default_value = horizon_strength
        incoming = nodes.new('ShaderNodeNewGeometry')
        incoming_z = nodes.new('ShaderNodeSeparateXYZ')
        level = nodes.new('ShaderNodeMath')
        level.operation = 'ABSOLUTE'
        band = nodes.new('ShaderNodeMapRange')
        band.inputs['From Min'].default_value = 0.02
        band.inputs['From Max'].default_value = 0.45
        band.inputs['To Min'].default_value = 1.0
        band.inputs['To Max'].default_value = 0.0
        band.clamp = True
        links.new(incoming.outputs['Incoming'], incoming_z.inputs['Vector'])
        links.new(incoming_z.outputs['Z'], level.inputs[0])
        links.new(level.outputs['Value'], band.inputs['Value'])
        horizon_mix = nodes.new('ShaderNodeMixShader')
        links.new(band.outputs['Result'], horizon_mix.inputs['Fac'])
        links.new(view_bg.outputs['Background'], horizon_mix.inputs[1])
        links.new(horizon_bg.outputs['Background'], horizon_mix.inputs[2])
        view_shader = horizon_mix.outputs['Shader']
    else:
        view_shader = view_bg.outputs['Background']
    bg.inputs['Strength'].default_value = light_strength
    view_bg.inputs['Strength'].default_value = view_strength
    path = nodes.new('ShaderNodeLightPath')
    viewed = nodes.new('ShaderNodeMath')
    viewed.operation = 'MAXIMUM'
    links.new(path.outputs['Is Camera Ray'], viewed.inputs[0])
    links.new(path.outputs['Is Glossy Ray'], viewed.inputs[1])
    mix = nodes.new('ShaderNodeMixShader')
    links.new(viewed.outputs['Value'], mix.inputs['Fac'])
    links.new(bg.outputs['Background'], mix.inputs[1])
    links.new(view_shader, mix.inputs[2])
    links.new(mix.outputs['Shader'], nodes['World Output'].inputs['Surface'])

    mats = {
        'marble': marble_material(
            'marble', 0.34, 0.55, rough_scale=0.42, bright=0.0,
            contrast=float(os.environ.get('BLANC_VEIN_CONTRAST', '8')),
        ),
        'floor': marble_material('floor', 0.035, 0.12),
        'gilt': new_material('gilt', (0.68, 0.36, 0.06), 0.26, 1),
        'artwork': new_material('artwork', (0.4, 0.32, 0.24), 0.55),
        'iron': new_material('iron', (0.02, 0.02, 0.02), 0.35, 0.8),
        'bulb': new_material('bulb', kelvin(3000), 0.3),
        'rock': rock_material(),
        'sky': sky_material(ASSETS / 'pbr' / 'sky-dome.jpg'),
    }
    meshes = {name: Accum(name, material) for name, material in mats.items()}
    pack = Pack()
    half = ROOM['width'] / 2
    back = ROOM['backZ']
    # Longer nave than the 18 m sample, still not the 100 m gallery.
    end = ROOM['length'] - 1.2 + float(os.environ.get('BLANC_EXTRA_LENGTH', '16'))
    height = 7.8
    floor_tile = 2.4

    # Floor, open at the far end. No back wall.
    floor = [(-half, back, 0), (half, back, 0), (half, end + 4, 0), (-half, end + 4, 0)]
    meshes['floor'].quad(
        floor,
        [(c[0] / floor_tile, c[1] / floor_tile) for c in floor],
        [rect_uv('floor', (c[1] - back) / (end + 4 - back), (c[0] + half) / ROOM['width']) for c in floor],
        (0, 0, 1),
    )

    # Slabs of about 2.4 m. Bookmatch flips on each pilaster so that seam is hidden.
    pilasters = list(LAYOUT['pilasters'])
    extra_z = 17.55
    while extra_z < end - 1.5:
        pilasters.append({'z': extra_z, 'width': 0.72, 'depth': 0.55})
        extra_z += 5.85

    def slab_spans(start, stop, target=2.4):
        span = max(stop - start, 0.01)
        count = max(1, int(round(span / target)))
        step = span / count
        return [(start + i * step, start + (i + 1) * step) for i in range(count)]

    posts = [back] + sorted(item['z'] for item in pilasters) + [end]
    slabs = []
    mirror = False
    for edge_a, edge_b in zip(posts, posts[1:]):
        for y0, y1 in slab_spans(edge_a, edge_b):
            slabs.append((y0, y1, mirror))
            mirror = not mirror
    recesses = [0.0, 0.08, 0.0, 0.12, 0.04, 0.0, 0.1]
    for index, (y0, y1, mirrored) in enumerate(slabs):
        recess = recesses[index % len(recesses)]
        span = max(y1 - y0, 0.01)
        for sign, name in ((-1, 'left'), (1, 'right')):
            x = sign * (half + recess)
            coords = [(x, y0, 0), (x, y1, 0), (x, y1, height), (x, y0, height)]
            if sign > 0:
                coords = [coords[0], coords[3], coords[2], coords[1]]
            luvs = [rect_uv(name, (c[1] - back) / (end - back), c[2] / height) for c in coords]
            uvs = []
            for corner in coords:
                # One scan across the slab. V uses the same metre, so veins stay square.
                u = (corner[1] - y0) / span
                if mirrored:
                    u = 1.0 - u
                v = corner[2] / span
                uvs.append((u, v))
            meshes['marble'].quad(coords, uvs, luvs, (-sign, 0, 0))
        if index < len(slabs) - 1:
            y = y1
            for sign in (-1, 1):
                x_face = sign * (half + recess - 0.012)
                coords = [
                    (x_face, y - 0.008, 0),
                    (x_face, y + 0.008, 0),
                    (x_face, y + 0.008, height),
                    (x_face, y - 0.008, height),
                ]
                meshes['marble'].quad(coords, [(0, 0), (0.02, 0), (0.02, 1), (0, 1)], pack.for_quad(coords), (-sign, 0, 0))
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
        depth = 0.62
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
    profile = []
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
        # The viewer keeps glTF axes (no scale.z = -1). On the left wall the
        # visitor's right is further down the hall, which is the larger Y here.
        uvs = [(0, 0), (1, 0), (1, 1), (0, 1)] if sign > 0 else [(1, 0), (0, 0), (0, 1), (1, 1)]
        coords = [(x_art, art_y0, art_z0), (x_art, art_y1, art_z0), (x_art, art_y1, art_z1), (x_art, art_y0, art_z1)]
        canvas = Accum(f"Canvas_{len(heroes):02d}", painting_material(len(heroes), frame))
        canvas.quad(coords, uvs, pack.for_quad(coords), (sign, 0, 0))
        heroes.append(canvas)
        # Spot aimed at the marble around the frame.
        spot = bpy.data.lights.new(f"spot-{frame['id']}", 'SPOT')
        spot.energy = float(os.environ.get('BLANC_SPOT', '40'))
        spot.color = kelvin(3000)
        spot.spot_size = math.radians(52)
        spot.spot_blend = 0.85
        spot.shadow_soft_size = 0.25
        obj = bpy.data.objects.new(f"spot-{frame['id']}", spot)
        head = (x_wall + sign * 0.48, frame['z'], min(height - 0.35, frame['y'] + frame['height'] + 0.7))
        obj.location = head
        aim_at = Vector((x_wall + sign * 0.02, frame['z'], frame['y'] + frame['height'] * 0.55))
        direction = aim_at - Vector(head)
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

    place_rocks(mats['rock'])
    if os.environ.get('BLANC_ENTRY') == '1':
        add_entry(back, half, height, pack, meshes)
    # No glass pane and no emissive rectangle. The camera sky is the world shader.

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
    sun.energy = float(os.environ.get('BLANC_SUN', '2.0'))
    sun.color = kelvin(5600)
    # Soft enough to avoid black floor stains, side-on so a rock has a lit face and a shadow face.
    sun.angle = math.radians(11)
    sun_obj = bpy.data.objects.new('sun', sun)
    # From behind the camera and to the left, so the near face of each rock is the lit face.
    if os.environ.get('BLANC_SUN_HIGH') == '1':
        # Raking light from above and slightly in front, so the visible face of a block is lit.
        sun_vec = Vector((0.35, -0.25, -0.90))
    else:
        sun_vec = Vector((0.65, 0.8, -0.5))
    sun_obj.rotation_euler = sun_vec.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.collection.objects.link(sun_obj)

    for hero in heroes:
        hero.finish()
    for accum in meshes.values():
        accum.finish(smooth=False)
    for obj in bpy.data.objects:
        if obj.name.startswith('rock-') and obj.type == 'MESH':
            for polygon in obj.data.polygons:
                polygon.use_smooth = True
    place_fancy_frames()
    return scene


def assign_gilt_maps(frame_obj, normal_path, ao_path):
    """Gold stays in the base colour. The baked maps only bring the carving back."""
    material = bpy.data.materials.new('gilt-baked')
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes['Principled BSDF']
    gold = (0.68, 0.36, 0.06, 1)
    bsdf.inputs['Base Color'].default_value = gold
    bsdf.inputs['Metallic'].default_value = 1.0
    bsdf.inputs['Roughness'].default_value = 0.26
    if normal_path.exists():
        normal_image = load_image(normal_path, 'Non-Color')
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = normal_image
        nmap = nodes.new('ShaderNodeNormalMap')
        nmap.inputs['Strength'].default_value = 1.1
        links.new(tex.outputs['Color'], nmap.inputs['Color'])
        links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    if ao_path.exists():
        ao_image = load_image(ao_path, 'Non-Color')
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = ao_image
        mix = nodes.new('ShaderNodeMixRGB')
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Fac'].default_value = 0.65
        mix.inputs['Color1'].default_value = gold
        links.new(tex.outputs['Color'], mix.inputs['Color2'])
        links.new(mix.outputs['Color'], bsdf.inputs['Base Color'])
    frame_obj.data.materials.clear()
    frame_obj.data.materials.append(material)


def bake_gilt_detail(frame_obj, target_faces):
    """Keep the carving of the 35k frame on the decimated mesh."""
    normal_path = ASSETS / 'pbr' / 'gilt-frame-nor.png'
    ao_path = ASSETS / 'pbr' / 'gilt-frame-ao.png'
    if os.environ.get('BLANC_REBAKE_GILT') != '1' and normal_path.exists():
        collapse_mesh(frame_obj, target_faces)
        assign_gilt_maps(frame_obj, normal_path, ao_path)
        print('gilt maps reused', len(frame_obj.data.polygons))
        return
    high = frame_obj.copy()
    high.data = frame_obj.data.copy()
    high.name = 'gilt-high'
    bpy.context.scene.collection.objects.link(high)
    collapse_mesh(frame_obj, target_faces)
    scene = bpy.context.scene
    material = bpy.data.materials.new('gilt-baked')
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.68, 0.36, 0.06, 1)
    bsdf.inputs['Metallic'].default_value = 1.0
    bsdf.inputs['Roughness'].default_value = 0.26
    normal_image = bpy.data.images.new('gilt-frame-nor', 1024, 1024)
    normal_image.colorspace_settings.name = 'Non-Color'
    ao_image = bpy.data.images.new('gilt-frame-ao', 512, 512)
    ao_image.colorspace_settings.name = 'Non-Color'
    frame_obj.data.materials.clear()
    frame_obj.data.materials.append(material)

    def activate(image):
        node = nodes.new('ShaderNodeTexImage')
        node.image = image
        nodes.active = node
        return node

    scene.cycles.samples = 4
    scene.render.bake.use_selected_to_active = True
    scene.render.bake.cage_extrusion = 0.04
    scene.render.bake.margin = 8
    bpy.ops.object.select_all(action='DESELECT')
    high.hide_set(False)
    frame_obj.hide_set(False)
    high.select_set(True)
    frame_obj.select_set(True)
    bpy.context.view_layer.objects.active = frame_obj
    normal_node = activate(normal_image)
    try:
        bpy.ops.object.bake(type='NORMAL')
        path = ASSETS / 'pbr' / 'gilt-frame-nor.png'
        normal_image.filepath_raw = str(path)
        normal_image.file_format = 'PNG'
        normal_image.save()
        print('baked gilt normal', len(frame_obj.data.polygons))
        nmap = nodes.new('ShaderNodeNormalMap')
        nmap.inputs['Strength'].default_value = 1.1
        links.new(normal_node.outputs['Color'], nmap.inputs['Color'])
        links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    except Exception as error:
        print('gilt normal bake failed', error)
    ao_node = activate(ao_image)
    scene.cycles.samples = 16
    try:
        bpy.ops.object.bake(type='AO')
        path = ASSETS / 'pbr' / 'gilt-frame-ao.png'
        ao_image.filepath_raw = str(path)
        ao_image.file_format = 'PNG'
        ao_image.save()
        print('baked gilt ao')
        mix = nodes.new('ShaderNodeMixRGB')
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Fac'].default_value = 0.65
        mix.inputs['Color1'].default_value = (0.68, 0.36, 0.06, 1)
        links.new(ao_node.outputs['Color'], mix.inputs['Color2'])
        links.new(mix.outputs['Color'], bsdf.inputs['Base Color'])
    except Exception as error:
        print('gilt ao bake failed', error)
    bpy.data.objects.remove(high, do_unlink=True)


def place_fancy_frames():
    """Ornate gilt frames. The scanned frame keeps its carved border; its canvas takes the painting."""
    for obj in bpy.data.objects:
        if obj.name.startswith('Canvas_'):
            obj.hide_render = True
    templates = {}
    for key, filename in (
        ('ornate', 'fancy_picture_frame_02.gltf'),
        ('bead', 'fancy_picture_frame_01.gltf'),
    ):
        path = CC0 / 'frames' / filename
        if not path.exists():
            print('missing frame', path)
            continue
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(path))
        imported = [obj for obj in bpy.data.objects if obj not in before and obj.type == 'MESH']
        frame_obj = next((obj for obj in imported if 'canvas' not in obj.name.lower()), None)
        canvas_src = next((obj for obj in imported if 'canvas' in obj.name.lower()), None)
        if frame_obj is None:
            print('no frame mesh', filename)
            continue
        if frame_obj.data.materials:
            bsdf = frame_obj.data.materials[0].node_tree.nodes.get('Principled BSDF')
            if bsdf:
                bsdf.inputs['Metallic'].default_value = 1.0
                bsdf.inputs['Roughness'].default_value = 0.34
        for piece in (frame_obj, canvas_src):
            if piece is None:
                continue
            bpy.ops.object.select_all(action='DESELECT')
            piece.hide_set(False)
            piece.select_set(True)
            bpy.context.view_layer.objects.active = piece
            if piece.parent:
                bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        # The frame texture often carries the opening in its alpha.
        for material in frame_obj.data.materials:
            if not material or not material.use_nodes:
                continue
            material.blend_method = 'HASHED'
            try:
                material.shadow_method = 'HASHED'
            except Exception:
                pass
            bsdf = material.node_tree.nodes.get('Principled BSDF')
            image = next((node for node in material.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image), None)
            if bsdf and image:
                material.node_tree.links.new(image.outputs['Alpha'], bsdf.inputs['Alpha'])
        print('FRAME', filename, [round(v, 3) for v in frame_obj.dimensions], 'canvas', bool(canvas_src), 'faces', len(frame_obj.data.polygons))
        if key == 'ornate':
            bake_gilt_detail(frame_obj, int(os.environ.get('BLANC_FRAME_FACES', '2500')))
        else:
            collapse_mesh(frame_obj, int(os.environ.get('BLANC_FRAME_FACES', '2500')))
        if canvas_src and len(canvas_src.data.polygons) > 80:
            collapse_mesh(canvas_src, 40)
        frame_obj.hide_render = True
        frame_obj.hide_set(True)
        if canvas_src:
            canvas_src.parent = frame_obj
            canvas_src.matrix_parent_inverse = frame_obj.matrix_world.inverted()
            canvas_src.hide_render = True
            canvas_src.hide_set(True)
        templates[key] = (frame_obj, canvas_src)
    if not templates:
        return
    for frame in LAYOUT['frames']:
        if frame['wall'] not in ('left', 'right'):
            continue
        src, src_canvas = templates['ornate']
        obj = src.copy()
        obj.data = src.data
        bpy.context.scene.collection.objects.link(obj)
        obj.hide_render = False
        obj.hide_set(False)
        obj.rotation_mode = 'XYZ'
        sign = 1 if frame['x'] < 0 else -1
        dims = src.dimensions
        thin = min(range(3), key=lambda axis: dims[axis])
        # Broad face onto the wall. Thin axis must end up along world X.
        if thin == 1:
            obj.rotation_euler = (0, 0, math.radians(90))
        elif thin == 2:
            obj.rotation_euler = (math.radians(90), 0, 0)
        else:
            obj.rotation_euler = (0, math.radians(90), 0)
        if sign < 0:
            obj.rotation_euler.z += math.pi
        tall = max(src.dimensions)
        scale = frame['height'] / tall if tall else 1
        obj.scale = (scale, scale, scale)
        depth = min(src.dimensions) * scale
        obj.location = (frame['x'] + sign * (depth * 0.5 + 0.02), frame['z'], frame['y'])
        obj.name = f"giltframe-{frame['id']}"
        if src_canvas is None:
            continue
        painted = src_canvas.copy()
        painted.data = src_canvas.data.copy()
        painted.parent = obj
        painted.matrix_parent_inverse = src_canvas.matrix_parent_inverse.copy()
        bpy.context.scene.collection.objects.link(painted)
        painted.hide_render = False
        painted.hide_set(False)
        painted.name = f"framed-canvas-{frame['id']}"
        rel = frame['painting']
        image_path = (ASSETS / rel) if str(rel).startswith('cc0/') else (PAINTINGS / rel)
        if not image_path.exists() or not painted.data.materials:
            continue
        material = painted.data.materials[0].copy()
        painted.data.materials[0] = material
        bsdf = material.node_tree.nodes.get('Principled BSDF')
        tex = material.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = load_image(image_path, 'sRGB')
        if bsdf:
            material.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
            bsdf.inputs['Roughness'].default_value = 0.55


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


def join_prefix(prefix):
    """One draw call for every copy that shares a material."""
    objs = [
        obj for obj in bpy.context.scene.objects
        if obj.type == 'MESH' and obj.name.startswith(prefix) and not obj.hide_render
    ]
    if len(objs) < 2:
        return
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objs:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    print('joined', prefix, len(objs), 'faces', len(objs[0].data.polygons))


def export_glb():
    for obj in list(bpy.data.objects):
        if obj.name.startswith('src-') or obj.name.startswith('fancy_picture_frame') or obj.name.startswith('cumulus') or obj.name.startswith('skyback') or obj.name in ('haze', 'shaft'):
            bpy.data.objects.remove(obj, do_unlink=True)
    join_prefix('rock-')
    join_prefix('giltframe-')
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
        obj.select_set(has and obj.name != 'sky' and not obj.hide_render)
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


def _oidn():
    import ctypes
    lib = Path(bpy.app.binary_path).parent / 'lib' / 'libOpenImageDenoise.so'
    if not lib.exists():
        print('no oidn')
        return None
    for extra in ('libOpenImageDenoise_core.so.2', 'libOpenImageDenoise_device_cpu.so.2'):
        path = Path(bpy.app.binary_path).parent / 'lib' / extra
        if path.exists():
            ctypes.CDLL(str(path))
    oidn = ctypes.CDLL(str(lib))
    oidn.oidnNewDevice.restype = ctypes.c_void_p
    oidn.oidnNewDevice.argtypes = [ctypes.c_int]
    oidn.oidnCommitDevice.argtypes = [ctypes.c_void_p]
    oidn.oidnNewFilter.restype = ctypes.c_void_p
    oidn.oidnNewFilter.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
    oidn.oidnSetSharedFilterImage.argtypes = [
        ctypes.c_void_p, ctypes.c_char_p, ctypes.c_void_p, ctypes.c_int,
        ctypes.c_size_t, ctypes.c_size_t, ctypes.c_size_t, ctypes.c_size_t, ctypes.c_size_t,
    ]
    oidn.oidnSetFilterBool.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_bool]
    oidn.oidnCommitFilter.argtypes = [ctypes.c_void_p]
    oidn.oidnExecuteFilter.argtypes = [ctypes.c_void_p]
    oidn.oidnGetDeviceError.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_char_p)]
    oidn.oidnGetDeviceError.restype = ctypes.c_int
    return oidn


def denoise_array(color, albedo=None, normal=None):
    """OIDN RT. color is HxWx3 HDR. albedo and normal are the Cycles guide passes."""
    import ctypes
    import numpy as np
    oidn = _oidn()
    if oidn is None:
        return color
    height, width = color.shape[:2]
    beauty = np.ascontiguousarray(color[:, :, :3], dtype=np.float32)
    output = np.empty_like(beauty)
    held = [beauty, output]
    device = oidn.oidnNewDevice(1)
    oidn.oidnCommitDevice(device)
    filt = oidn.oidnNewFilter(device, b'RT')
    oidn.oidnSetSharedFilterImage(filt, b'color', beauty.ctypes.data, 3, width, height, 0, 0, 0)
    oidn.oidnSetSharedFilterImage(filt, b'output', output.ctypes.data, 3, width, height, 0, 0, 0)
    if albedo is not None:
        alb = np.ascontiguousarray(albedo[:, :, :3], dtype=np.float32)
        held.append(alb)
        oidn.oidnSetSharedFilterImage(filt, b'albedo', alb.ctypes.data, 3, width, height, 0, 0, 0)
    if normal is not None:
        nrm = np.ascontiguousarray(normal[:, :, :3], dtype=np.float32)
        held.append(nrm)
        oidn.oidnSetSharedFilterImage(filt, b'normal', nrm.ctypes.data, 3, width, height, 0, 0, 0)
    oidn.oidnSetFilterBool(filt, b'hdr', True)
    oidn.oidnCommitFilter(filt)
    oidn.oidnExecuteFilter(filt)
    message = ctypes.c_char_p()
    code = oidn.oidnGetDeviceError(device, ctypes.byref(message))
    if code:
        print('oidn error', code, message.value)
        return color
    print('denoised', width, height, 'albedo', albedo is not None, 'normal', normal is not None)
    return output


def denoise_local(image):
    try:
        import numpy as np
    except ImportError:
        return
    width, height = image.size
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(height, width, 4)
    pixels[:, :, :3] = denoise_array(pixels[:, :, :3])
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


def cumulus_material():
    """Bright cloud puffs for the camera only. They do not relight the marble."""
    material = bpy.data.materials.new('cumulus')
    material.use_nodes = True
    material.blend_method = 'BLEND'
    try:
        material.shadow_method = 'NONE'
    except Exception:
        pass
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    coord = nodes.new('ShaderNodeTexCoord')
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 1.2
    noise.inputs['Detail'].default_value = 5.0
    noise.inputs['Roughness'].default_value = 0.58
    noise.inputs['Distortion'].default_value = 0.35
    links.new(coord.outputs['Object'], noise.inputs['Vector'])
    length = nodes.new('ShaderNodeVectorMath')
    length.operation = 'LENGTH'
    links.new(coord.outputs['Object'], length.inputs[0])
    edge = nodes.new('ShaderNodeMapRange')
    edge.inputs['From Min'].default_value = 0.2
    edge.inputs['From Max'].default_value = 1.05
    edge.inputs['To Min'].default_value = 1.0
    edge.inputs['To Max'].default_value = 0.0
    edge.clamp = True
    links.new(length.outputs['Value'], edge.inputs['Value'])
    puff = nodes.new('ShaderNodeMath')
    puff.operation = 'MULTIPLY'
    links.new(noise.outputs['Fac'], puff.inputs[0])
    links.new(edge.outputs['Result'], puff.inputs[1])
    emit = nodes.new('ShaderNodeEmission')
    emit.inputs['Color'].default_value = (1.0, 0.99, 0.97, 1)
    emit.inputs['Strength'].default_value = 3.2
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    body = nodes.new('ShaderNodeMixShader')
    links.new(puff.outputs['Value'], body.inputs['Fac'])
    links.new(transparent.outputs['BSDF'], body.inputs[1])
    links.new(emit.outputs['Emission'], body.inputs[2])
    path = nodes.new('ShaderNodeLightPath')
    lit = nodes.new('ShaderNodeMath')
    lit.operation = 'MAXIMUM'
    links.new(path.outputs['Is Diffuse Ray'], lit.inputs[0])
    links.new(path.outputs['Is Glossy Ray'], lit.inputs[1])
    hold = nodes.new('ShaderNodeMixShader')
    links.new(lit.outputs['Value'], hold.inputs['Fac'])
    links.new(body.outputs['Shader'], hold.inputs[1])
    links.new(transparent.outputs['BSDF'], hold.inputs[2])
    links.new(hold.outputs['Shader'], output.inputs['Surface'])
    return material


def add_cumulus(end_y):
    """Large white masses in the open roof and behind the glass, so the end is not a flat plate."""
    if bpy.data.objects.get('cumulus'):
        return
    material = cumulus_material()
    blobs = [
        (0.2, 7.5, 11.5, 6.2),
        (-5.2, 10.5, 13.2, 7.4),
        (5.6, 9.8, 10.4, 5.6),
        (0.8, 14.0, 14.6, 8.2),
        (-4.2, 16.5, 9.2, 6.4),
        (4.8, 18.5, 12.8, 7.0),
        (-1.0, end_y + 4.5, 5.2, 8.0),
        (3.5, end_y + 6.0, 8.8, 6.6),
        (-5.5, end_y + 3.0, 3.4, 5.8),
        (1.5, end_y + 2.2, 11.0, 7.2),
    ]
    for index, (x, y, z, size) in enumerate(blobs):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(x, y, z))
        blob = bpy.context.active_object
        blob.name = 'cumulus' if index == 0 else f'cumulus-{index}'
        blob.scale = (size * 1.25, size * 0.82, size * 0.7)
        blob.rotation_euler = (0.2 * index, 0.4 * index, 0.15 * index)
        blob.data.materials.append(material)
        blob.visible_shadow = False


def add_entry(back, half, height, pack, meshes):
    """Marble wall behind the visitor, with a door and two frames. Closes the void in the panorama."""
    y = back + 0.04
    door_half = 0.9
    door_h = 3.35
    def face(x0, x1, z0, z1):
        coords = [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)]
        uvs = [(0, 0), (1, 0), (1, 1), (0, 1)]
        meshes['marble'].quad(coords, uvs, pack.for_quad(coords), (0, 1, 0))
    face(-half, -door_half, 0, height)
    face(door_half, half, 0, height)
    face(-door_half, door_half, door_h, height)
    # The door itself, set back a few centimetres, so the opening is not a hole into the void.
    door = bpy.data.materials.new('door')
    door.use_nodes = True
    door_bsdf = door.node_tree.nodes['Principled BSDF']
    door_bsdf.inputs['Base Color'].default_value = (0.16, 0.13, 0.10, 1)
    door_bsdf.inputs['Roughness'].default_value = 0.45
    panel = Accum('entry-door', door)
    panel.quad(
        [(-door_half + 0.06, y - 0.06, 0.02), (door_half - 0.06, y - 0.06, 0.02),
         (door_half - 0.06, y - 0.06, door_h - 0.08), (-door_half + 0.06, y - 0.06, door_h - 0.08)],
        [(0, 0), (1, 0), (1, 1), (0, 1)],
        [(0, 0), (1, 0), (1, 1), (0, 1)],
        (0, 1, 0),
    )
    panel.finish()
    for side, painting, name in (
        (-1, 'cc0/oeuvres/kintsugi.jpg', 'entry-left'),
        (1, 'cc0/oeuvres/le-premier-spectateur.jpg', 'entry-right'),
    ):
        cx = side * 2.35
        z0, z1 = 1.35, 2.85
        x0, x1 = cx - 0.55, cx + 0.55
        mould = 0.09
        outer = [(x0, y + 0.03, z0), (x1, y + 0.03, z0), (x1, y + 0.03, z1), (x0, y + 0.03, z1)]
        inner = [(x0 + mould, y + 0.07, z0 + mould), (x1 - mould, y + 0.07, z0 + mould),
                 (x1 - mould, y + 0.07, z1 - mould), (x0 + mould, y + 0.07, z1 - mould)]
        for i in range(4):
            nxt = (i + 1) % 4
            meshes['gilt'].quad(
                [outer[i], outer[nxt], inner[nxt], inner[i]],
                [(0, 0), (1, 0), (1, 1), (0, 1)],
                pack.for_quad([outer[i], outer[nxt], inner[nxt], inner[i]]),
                (0, 1, 0),
            )
        art = Accum(f'framed-canvas-{name}', painting_material(0, {'painting': painting}))
        art.quad(inner, [(0, 0), (1, 0), (1, 1), (0, 1)], pack.for_quad(inner), (0, 1, 0))
        art.finish()


def add_cloud_backdrop(end_y):
    """Photoreal cumulus plate where the dark lower half of the puresky used to show."""
    path = CC0 / 'cumulus-backdrop.jpg'
    material = bpy.data.materials.new('skyback')
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    emit = nodes.new('ShaderNodeEmission')
    emit.inputs['Strength'].default_value = float(os.environ.get('BLANC_BACKDROP', '8'))
    if path.exists():
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = load_image(path, 'sRGB')
        links.new(tex.outputs['Color'], emit.inputs['Color'])
    else:
        emit.inputs['Color'].default_value = (0.96, 0.97, 0.99, 1)
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    # Diffuse rays ignore it, so the plate does not blow out the marble. Camera and mirror see the clouds.
    mix = nodes.new('ShaderNodeMixShader')
    ray = nodes.new('ShaderNodeLightPath')
    links.new(ray.outputs['Is Diffuse Ray'], mix.inputs['Fac'])
    links.new(emit.outputs['Emission'], mix.inputs[1])
    links.new(transparent.outputs['BSDF'], mix.inputs[2])
    links.new(mix.outputs['Shader'], output.inputs['Surface'])
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, end_y + 0.6, 6.0))
    plane = bpy.context.active_object
    plane.name = 'skyback'
    plane.rotation_euler = (math.radians(90), 0, 0)
    plane.scale = (18, 15, 1)
    plane.data.materials.append(material)
    plane.visible_shadow = False


def add_haze():
    # No room-filling haze. That veil sat on top of AgX and kept the walls near L* 90.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, ROOM['length'] * 0.55, 6.4))
    shaft = bpy.context.active_object
    shaft.name = 'shaft'
    shaft.scale = (0.7, 6.0, 0.7)
    beam = bpy.data.materials.new('shaft')
    beam.use_nodes = True
    beam.node_tree.nodes.clear()
    scatter = beam.node_tree.nodes.new('ShaderNodeVolumeScatter')
    scatter.inputs['Density'].default_value = 0.04
    scatter.inputs['Anisotropy'].default_value = 0.9
    scatter.inputs['Color'].default_value = (1.0, 0.96, 0.88, 1)
    output = beam.node_tree.nodes.new('ShaderNodeOutputMaterial')
    beam.node_tree.links.new(scatter.outputs['Volume'], output.inputs['Volume'])
    shaft.data.materials.append(beam)
    shaft.visible_shadow = False
    if hasattr(bpy.context.scene.cycles, 'volume_step_rate'):
        bpy.context.scene.cycles.volume_step_rate = 2


def render_photo(path, width, height, samples, denoise=True):
    scene = bpy.context.scene
    apply_grade(float(os.environ.get('BLANC_EXPOSURE', '-1.6')))
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = float(os.environ.get('BLANC_THRESHOLD', '0.08'))
    if hasattr(scene.cycles, 'adaptive_min_samples'):
        scene.cycles.adaptive_min_samples = int(os.environ.get('BLANC_MIN_SAMPLES', '6'))
    scene.cycles.volume_bounces = 1
    scene.cycles.use_denoising = denoise
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    if not bpy.data.objects.get('haze'):
        add_haze()
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 92
    scene.render.filepath = str(path)
    print(
        'VARS exposure', scene.view_settings.exposure,
        'look', scene.view_settings.look,
        'sun', os.environ.get('BLANC_SUN', '2.0'),
        'sky_light', os.environ.get('BLANC_SKY_STRENGTH', '0.35'),
        'sky_view', os.environ.get('BLANC_SKY_VIEW', '6.0'),
        'spot', os.environ.get('BLANC_SPOT', '40'),
        'haze', 'shaft-only',
    )
    print('rendering', path.name, width, height, 'samples', samples)
    bpy.ops.render.render(write_still=True)
    print('saved', path, path.stat().st_size)


def aim(cam, target):
    direction = Vector(target) - Vector(cam.location)
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def axis_test():
    """One cheap axis frame for the pass-6 barrier loop."""
    scene = bpy.context.scene
    folder = ASSETS / 'review-renders'
    folder.mkdir(exist_ok=True)
    cam_data = bpy.data.cameras.new('axis')
    cam_data.sensor_fit = 'VERTICAL'
    cam_data.angle = math.radians(44)
    cam = bpy.data.objects.new('axis', cam_data)
    cam.location = (0, 1.9, 1.6)
    scene.collection.objects.link(cam)
    aim(cam, (0, 22, 3.0))
    scene.camera = cam
    name = os.environ.get('BLANC_AXIS_NAME', 'pass6-try.jpg')
    exposures = [item for item in os.environ.get('BLANC_EXPOSURE_LIST', '').split(',') if item]
    if not exposures:
        exposures = [os.environ.get('BLANC_EXPOSURE', '0')]
    width = int(os.environ.get('BLANC_AXIS_W', '400'))
    height = int(os.environ.get('BLANC_AXIS_H', '225'))
    samples = int(os.environ.get('BLANC_STILL_SAMPLES', '4'))
    stem = Path(name).stem
    suffix = Path(name).suffix or '.jpg'
    for exposure in exposures:
        os.environ['BLANC_EXPOSURE'] = exposure
        label = exposure.replace('-', 'm').replace('.', 'p')
        out = folder / (f'{stem}-{label}{suffix}' if len(exposures) > 1 else name)
        render_photo(out, width, height, samples)


def review():
    scene = bpy.context.scene
    folder = ASSETS / 'review-renders'
    folder.mkdir(exist_ok=True)
    shots = [
        ('axis', (0, 1.9, 1.6), (0, 12, 2.4), 44),
        ('frames', (-2.15, 6.5, 1.78), (-3.55, 7.55, 1.78), 34),
        ('sky', (0.1, 3.6, 1.15), (0.0, 11.5, 5.4), 48),
    ]
    samples = int(os.environ.get('BLANC_STILL_SAMPLES', '12'))
    for name, location, target, fov in shots:
        cam_data = bpy.data.cameras.new(name)
        cam_data.sensor_fit = 'VERTICAL'
        cam_data.angle = math.radians(fov)
        cam = bpy.data.objects.new(name, cam_data)
        cam.location = location
        scene.collection.objects.link(cam)
        aim(cam, target)
        scene.camera = cam
        render_photo(folder / f'{name}.jpg', 800, 450, samples)
        bpy.data.objects.remove(cam, do_unlink=True)


def neutral_varnish(obj, roughness=0.45):
    """White Principled canvas. Same BSDF family as the painting rendered in place."""
    material = bpy.data.materials.new(f'{obj.name}-neutral')
    material.use_nodes = True
    bsdf = material.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = 0.0
    obj.data.materials[0] = material
    obj.pass_index = 7


def canvas_corners(obj):
    mesh = obj.data
    uv_layer = mesh.uv_layers.active
    loops = []
    if uv_layer:
        for poly in mesh.polygons:
            for loop_index in poly.loop_indices:
                uv = uv_layer.data[loop_index].uv
                world = obj.matrix_world @ mesh.vertices[mesh.loops[loop_index].vertex_index].co
                loops.append((uv.x, uv.y, world.copy()))
    if len(loops) < 4:
        return []
    # One representative for each UV corner of the canvas.
    keys = [(0, 0), (1, 0), (1, 1), (0, 1)]
    ordered = []
    for u, v in keys:
        best = min(loops, key=lambda item: (item[0] - u) ** 2 + (item[1] - v) ** 2)
        ordered.append(best[2])
    return ordered


def write_slot_manifest(cam, corners_by_id):
    """Camera-relative world corners and equirect UV for the guided-tour stop."""
    import json as _json
    pano_loc = Vector((0, ROOM.get('cameraZ', 1.9), ROOM.get('eye', 1.6)))
    pano = bpy.data.objects.new('manifest-pano', bpy.data.cameras.new('manifest-pano'))
    pano.location = pano_loc
    pano.rotation_euler = (math.radians(96), 0, 0)
    bpy.context.scene.collection.objects.link(pano)
    rotation = pano.matrix_world.to_3x3().inverted()
    slots = []
    for frame in LAYOUT['frames']:
        if frame['id'] not in corners_by_id:
            continue
        relative = []
        equirect = []
        for corner in corners_by_id[frame['id']]:
            delta = Vector(corner) - pano_loc
            relative.append([round(float(v), 5) for v in delta])
            # Measured against the pass-7 equirect index mask. For this camera
            # (yaw 0, pitch 96°) the world direction from the camera maps with
            # Cycles' equirectangular range and X/Y swapped.
            direction = delta.normalized()
            u = (math.atan2(direction.x, direction.y) - math.pi) / (-2 * math.pi)
            v = (math.acos(max(-1.0, min(1.0, direction.z))) - math.pi) / (-math.pi)
            equirect.append([u % 1.0, min(1.0, max(0.0, v))])
        inset = float(os.environ.get('BLANC_UV_INSET', '0.55'))
        cu = sum(p[0] for p in equirect) / len(equirect)
        cv = sum(p[1] for p in equirect) / len(equirect)
        equirect = [
            [round(cu + (u - cu) * (1 - inset), 6), round(cv + (v - cv) * (1 - inset), 6)]
            for u, v in equirect
        ]
        slots.append({
            'id': frame['id'],
            'slotId': frame['id'],
            'painting': frame['painting'],
            'cornersWorldFromCamera': relative,
            'cornersEquirectUV': equirect,
        })
    bpy.data.objects.remove(pano, do_unlink=True)
    payload = {
        'stopId': 'white-room-axis',
        'camera': [0, ROOM.get('cameraZ', 1.9), ROOM.get('eye', 1.6)],
        'note': 'Changer l’image ne demande pas un nouveau rendu. Changer la taille ou le ratio d’un cadre, oui.',
        'frames': slots,
    }
    path = ASSETS / 'review-renders' / 'stop-manifest.json'
    path.parent.mkdir(exist_ok=True)
    path.write_text(_json.dumps(payload, indent=2) + '\n')
    print('manifest', path)


def proof():
    """One frame layered from passes, beside the same frame baked into the render."""
    import numpy as np
    from bpy_extras.object_utils import world_to_camera_view
    scene = bpy.context.scene
    folder = ASSETS / 'review-renders'
    folder.mkdir(exist_ok=True)
    for stale in folder.glob('*.exr'):
        stale.unlink()
    target_name = 'framed-canvas-left-front'
    painted = bpy.data.objects.get(target_name)
    if painted is None:
        raise RuntimeError('left front canvas missing')
    cam_data = bpy.data.cameras.new('proof')
    cam_data.sensor_fit = 'VERTICAL'
    cam_data.angle = math.radians(34)
    cam = bpy.data.objects.new('proof', cam_data)
    cam.location = (-2.15, 6.5, 1.78)
    scene.collection.objects.link(cam)
    aim(cam, (-3.55, 7.55, 1.78))
    scene.camera = cam
    width, height = 800, 450
    samples = int(os.environ.get('BLANC_PROOF_SAMPLES', '12'))
    render_photo(folder / 'proof-baked.jpg', width, height, samples)
    corners = canvas_corners(painted)
    write_slot_manifest(cam, {'left-front': corners})
    neutral_varnish(painted, 0.4)
    painted.pass_index = 7
    layer = scene.view_layers[0]
    layer.use_pass_diffuse_direct = True
    layer.use_pass_diffuse_indirect = True
    layer.use_pass_glossy_direct = True
    layer.use_pass_glossy_indirect = True
    layer.use_pass_object_index = True
    try:
        layer.cycles.use_denoising = True
        layer.cycles.denoising_store_passes = True
    except Exception as error:
        print('denoising passes unavailable', error)
    scene.use_nodes = True
    tree = scene.node_tree
    tree.nodes.clear()
    layers = tree.nodes.new('CompositorNodeRLayers')
    names = [socket.name for socket in layers.outputs]
    print('PASS SOCKETS', names)
    wanted = {
        'Image': 'beauty',
        'DiffDir': 'diff-direct',
        'DiffInd': 'diff-indirect',
        'GlossDir': 'gloss-direct',
        'GlossInd': 'gloss-indirect',
        'IndexOB': 'index',
        'Denoising Albedo': 'denoise-albedo',
        'Denoising Normal': 'denoise-normal',
    }
    for socket_name, stem in wanted.items():
        socket = next((item for item in layers.outputs if item.name == socket_name), None)
        if socket is None:
            print('missing socket', socket_name)
            continue
        node = tree.nodes.new('CompositorNodeOutputFile')
        node.base_path = str(folder)
        node.format.file_format = 'OPEN_EXR'
        node.format.color_depth = '32'
        node.format.color_management = 'OVERRIDE'
        node.format.view_settings.look = 'None'
        node.format.view_settings.exposure = 0
        node.format.view_settings.gamma = 1
        for transform in ('Raw', 'Standard'):
            try:
                node.format.view_settings.view_transform = transform
                break
            except TypeError:
                continue
        node.file_slots[0].path = stem
        tree.links.new(socket, node.inputs[0])
    composite = tree.nodes.new('CompositorNodeComposite')
    image_socket = next((item for item in layers.outputs if item.name == 'Image'), None)
    if image_socket:
        tree.links.new(image_socket, composite.inputs[0])
    scene.render.use_compositing = True
    for name in ('haze', 'shaft'):
        obj = bpy.data.objects.get(name)
        if obj:
            obj.hide_render = True
    render_photo(folder / 'proof-neutral.jpg', width, height, samples, denoise=False)
    composite_layered(folder, corners, cam, width, height)
    print('proof renders saved')


def composite_layered(folder, corners, cam, width, height):
    """Artwork × lighting pass + glossy, inside the canvas quad. Compared with the baked frame."""
    import numpy as np
    from bpy_extras.object_utils import world_to_camera_view
    scene = bpy.context.scene

    def load_layer(stem):
        matches = sorted(folder.glob(f'{stem}*.exr'))
        if not matches:
            print('missing pass', stem)
            return None
        image = bpy.data.images.load(str(matches[-1]))
        try:
            image.colorspace_settings.name = 'Non-Color'
        except (TypeError, ValueError):
            pass
        w, h = image.size
        array = np.array(image.pixels[:], dtype=np.float32).reshape(h, w, image.channels)
        return array[::-1]

    beauty = load_layer('beauty')
    diff = load_layer('diff-direct')
    indi = load_layer('diff-indirect')
    gloss_d = load_layer('gloss-direct')
    gloss_i = load_layer('gloss-indirect')
    if beauty is None or diff is None or indi is None:
        print('passes not written, layered proof skipped')
        return
    light = diff[:, :, :3] + indi[:, :, :3]
    gloss = np.zeros_like(light)
    if gloss_d is not None:
        gloss += gloss_d[:, :, :3]
    if gloss_i is not None:
        gloss += gloss_i[:, :, :3]
    albedo = load_layer('denoise-albedo')
    normal = load_layer('denoise-normal')
    # OIDN reads the buffer from the top. The EXR loader already flipped to image order.
    light = denoise_array(light[::-1], None if albedo is None else albedo[::-1, :, :3], None if normal is None else normal[::-1, :, :3])[::-1]
    gloss = denoise_array(gloss[::-1], None if albedo is None else albedo[::-1, :, :3], None if normal is None else normal[::-1, :, :3])[::-1]
    art_image = bpy.data.images.load(str(ASSETS / 'cc0' / 'oeuvres' / 'le-dernier-bal.jpg'))
    aw, ah = art_image.size
    art = np.array(art_image.pixels[:], dtype=np.float32).reshape(ah, aw, art_image.channels)[::-1, :, :3]
    pixels = []
    depths = []
    for corner in corners:
        projected = world_to_camera_view(scene, cam, corner)
        pixels.append((projected.x * width, (1 - projected.y) * height))
        depths.append(1.0 / max(float(projected.z), 1e-4))
    if len(pixels) < 4:
        print('canvas corners missing')
        return
    xs = np.arange(width)
    ys = np.arange(height)
    grid_x, grid_y = np.meshgrid(xs, ys)
    quad = np.array(pixels, dtype=np.float32)
    # Two triangles: 0-1-2 and 0-2-3. UV corners (0,0),(1,0),(1,1),(0,1).
    triangles = [(0, 1, 2, (0, 0), (1, 0), (1, 1)), (0, 2, 3, (0, 0), (1, 1), (0, 1))]
    warped = np.zeros((height, width, 3), np.float32)
    mask = np.zeros((height, width), np.bool_)
    for i, j, k, uvi, uvj, uvk in triangles:
        p0, p1, p2 = quad[i], quad[j], quad[k]
        denom = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1])
        if abs(denom) < 1e-6:
            continue
        w0 = ((p1[1] - p2[1]) * (grid_x - p2[0]) + (p2[0] - p1[0]) * (grid_y - p2[1])) / denom
        w1 = ((p2[1] - p0[1]) * (grid_x - p2[0]) + (p0[0] - p2[0]) * (grid_y - p2[1])) / denom
        w2 = 1 - w0 - w1
        inside = (w0 >= -0.002) & (w1 >= -0.002) & (w2 >= -0.002)
        mask |= inside
        # Perspective-correct: screen barycentrics weighted by 1/depth.
        c0 = np.maximum(w0, 0) * depths[i]
        c1 = np.maximum(w1, 0) * depths[j]
        c2 = np.maximum(w2, 0) * depths[k]
        norm = np.maximum(c0 + c1 + c2, 1e-8)
        u = (c0 * uvi[0] + c1 * uvj[0] + c2 * uvk[0]) / norm
        v = (c0 * uvi[1] + c1 * uvj[1] + c2 * uvk[1]) / norm
        sx = np.clip((u * (aw - 1)).astype(np.int32), 0, aw - 1)
        sy = np.clip(((1 - v) * (ah - 1)).astype(np.int32), 0, ah - 1)
        warped[inside] = art[sy[inside], sx[inside]]
    quad_count = int(mask.sum())
    index = load_layer('index')
    if index is not None:
        id_mask = index[:, :, 0] > 6.5
        id_count = int(id_mask.sum())
        if quad_count * 0.4 < id_count < quad_count * 1.35:
            mask &= id_mask
    albedo = load_layer('denoise-albedo')
    normal = load_layer('denoise-normal')
    if albedo is not None and normal is not None:
        guide_a = albedo[::-1, :, :3]
        guide_n = normal[::-1, :, :3]
        light = denoise_array(light[::-1], guide_a, guide_n)[::-1]
        gloss = denoise_array(gloss[::-1], guide_a, guide_n)[::-1]
        beauty_rgb = denoise_array(beauty[:, :, :3][::-1], guide_a, guide_n)[::-1]
        beauty = beauty.copy()
        beauty[:, :, :3] = beauty_rgb
    def tame(pic):
        cap = float(np.percentile(pic, 99.5))
        return np.clip(pic, 0, max(cap, 1.0))
    light = tame(light)
    gloss = tame(gloss)
    beauty_linear = tame(beauty[:, :, :3])

    def luma_of(pic):
        return 0.2126 * pic[..., 0] + 0.7152 * pic[..., 1] + 0.0722 * pic[..., 2]

    if int(mask.sum()) > 50:
        beauty_l = float(luma_of(beauty_linear)[mask].mean())
        sum_l = float(luma_of(light + gloss)[mask].mean())
        diff_l = float(luma_of(light)[mask].mean())
        # Principled often stores almost the whole beauty in the diffuse light pass
        # and reports glossy again beside it. Use the split that actually rebuilds white.
        if abs(diff_l - beauty_l) <= abs(sum_l - beauty_l):
            gloss = np.maximum(beauty_linear - light, 0)
            chosen = 'diffuse-plus-residual'
        else:
            chosen = 'diffuse-plus-gloss'
        recon_l = float(luma_of(light + gloss)[mask].mean())
        raw = abs(recon_l - beauty_l) / max(beauty_l, 1e-6)
        scale = beauty_l / max(recon_l, 1e-6)
        if raw > 0.01:
            light *= scale
            gloss *= scale
        recon_l = float(luma_of(light + gloss)[mask].mean())
        error = abs(recon_l - beauty_l) / max(beauty_l, 1e-6)
        print('WHITE RECONSTRUCT', chosen, 'raw', round(raw, 5), 'final', round(error, 5), 'scale', round(scale, 4))
    layered = beauty_linear.copy()
    layered[mask] = warped[mask] * light[mask] + gloss[mask]
    image = bpy.data.images.new('layered-proof', width, height, float_buffer=True, alpha=True)
    stored = np.ones((height, width, 4), np.float32)
    stored[:, :, :3] = layered
    image.pixels.foreach_set(stored[::-1].reshape(-1))
    image.filepath_raw = str(folder / 'proof-layered.jpg')
    image.file_format = 'JPEG'
    try:
        image.save_render(str(folder / 'proof-layered.jpg'), scene=scene)
    except Exception as error:
        print('save_render failed', error)
        image.save()
    print('layered proof', folder / 'proof-layered.jpg', 'masked', int(mask.sum()))


def still():
    """Landing still. Same axis framing as the pass-5 review, at the delivery size."""
    scene = bpy.context.scene
    cam_data = bpy.data.cameras.new('Still')
    cam_data.sensor_fit = 'VERTICAL'
    cam_data.angle = math.radians(float(os.environ.get('BLANC_STILL_FOV', '44')))
    cam = bpy.data.objects.new('Still', cam_data)
    cam.location = (0, 1.9, 1.6)
    scene.collection.objects.link(cam)
    aim(cam, (0, 22, 3.0))
    scene.camera = cam
    sky = bpy.data.objects.get('sky')
    if sky:
        sky.hide_render = True
    render_photo(
        ASSETS / os.environ.get('BLANC_STILL_NAME', 'landing-4k.jpg'),
        int(os.environ.get('BLANC_STILL_W', '3840')),
        int(os.environ.get('BLANC_STILL_H', '2160')),
        int(os.environ.get('BLANC_STILL_SAMPLES', '64')),
    )


def pano():
    scene = bpy.context.scene
    cam_data = bpy.data.cameras.new('Pano')
    cam_data.type = 'PANO'
    cam_data.panorama_type = 'EQUIRECTANGULAR'
    cam = bpy.data.objects.new('Pano', cam_data)
    # Tour stop: centred, eye height. Cycles looks down local -Z, so +Y is down the hall.
    cam.location = (0, ROOM.get('cameraZ', 1.9), ROOM.get('eye', 1.6))
    cam.rotation_euler = (math.radians(96), 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam
    # The dome is for the walk viewer. The photograph sees the HDRI world.
    sky = bpy.data.objects.get('sky')
    if sky:
        sky.hide_render = True
    render_photo(
        ASSETS / os.environ.get('BLANC_PANO_NAME', 'pano-360.jpg'),
        int(os.environ.get('BLANC_PANO_W', '6144')),
        int(os.environ.get('BLANC_PANO_H', '3072')),
        int(os.environ.get('BLANC_PANO_SAMPLES', '512')),
    )


def main():
    import sys
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    build()
    if '--save-blend' in args:
        path = ASSETS / 'musee-blanc-prepared.blend'
        bpy.context.preferences.filepaths.use_relative_paths = True
        bpy.ops.wm.save_as_mainfile(filepath=str(path))
        print('saved blend', path, path.stat().st_size)
        return
    if '--axis' in args:
        axis_test()
        return
    if '--review' in args or '--proof' in args or '--mesh' in args:
        if '--review' in args:
            review()
        if '--proof' in args:
            proof()
        if '--mesh' in args or '--review' in args:
            export_glb()
        return
    if '--still' in args:
        still()
        return
    if '--pano' in args:
        pano()
        return
    decimate_rocks(int(os.environ.get('BLANC_ROCK_FACES', '1200')))
    rock_lightmaps()
    bake()


if __name__ == '__main__':
    main()
