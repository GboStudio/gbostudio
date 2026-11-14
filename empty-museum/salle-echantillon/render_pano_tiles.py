#!/usr/bin/env python3
"""Tiled equirectangular render of the white room.

One tile per process, so a crash loses only that tile. A tile is skipped when
its .ok stamp exists. Passes stay in a multilayer EXR. Denoise only after
assembly.

    blender --background --python render_pano_tiles.py -- --tile 0
    blender --background --python render_pano_tiles.py -- --assemble
    blender --background --python render_pano_tiles.py -- --probe

Final settings (env overrides):
    BLANC_PANO_W=6144 BLANC_PANO_H=3072 BLANC_PANO_SAMPLES=512
    BLANC_THRESHOLD=0.01 BLANC_TILES=32
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from bake_musee_blanc import (  # noqa: E402
    ASSETS,
    ROOM,
    aim,
    apply_grade,
    build,
    canvas_corners,
    write_slot_manifest,
)

TILE_DIR = Path(os.environ.get('BLANC_TILE_DIR', str(ASSETS / 'pano-tiles')))
WIDTH = int(os.environ.get('BLANC_PANO_W', '6144'))
HEIGHT = int(os.environ.get('BLANC_PANO_H', '3072'))
SAMPLES = int(os.environ.get('BLANC_PANO_SAMPLES', '512'))
TILES = int(os.environ.get('BLANC_TILES', '16'))
THRESHOLD = float(os.environ.get('BLANC_THRESHOLD', '0.01'))


def args_after_double_dash():
    if '--' not in sys.argv:
        return []
    return sys.argv[sys.argv.index('--') + 1:]


def setup_passes(scene):
    layer = scene.view_layers[0]
    layer.use_pass_combined = True
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
    scene.cycles.use_denoising = False
    scene.cycles.samples = SAMPLES
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = THRESHOLD
    if hasattr(scene.cycles, 'adaptive_min_samples'):
        scene.cycles.adaptive_min_samples = int(os.environ.get('BLANC_MIN_SAMPLES', '16'))
    scene.cycles.volume_bounces = 1
    apply_grade(float(os.environ.get('BLANC_EXPOSURE', '-1.65')))
    scene.render.resolution_x = WIDTH
    scene.render.resolution_y = HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.use_border = True
    scene.render.use_crop_to_border = True
    scene.render.use_compositing = False
    scene.use_nodes = False
    scene.render.image_settings.file_format = 'OPEN_EXR_MULTILAYER'
    scene.render.image_settings.color_depth = '16'
    scene.render.image_settings.exr_codec = 'ZIP'
    try:
        scene.render.image_settings.color_management = 'OVERRIDE'
        scene.view_settings.view_transform = 'Raw'
        scene.view_settings.look = 'None'
        scene.view_settings.exposure = 0
        scene.view_settings.gamma = 1
    except TypeError as error:
        print('raw view settings', error)
    scene.render.film_transparent = False


def tag_masks():
    floor = bpy.data.objects.get('floor')
    if floor:
        floor.pass_index = 3
    for obj in bpy.data.objects:
        if obj.type == 'MESH' and (obj.name.startswith('framed-canvas-') or obj.name.startswith('Canvas_')):
            obj.pass_index = 7


def setup_camera(scene):
    cam_data = bpy.data.cameras.new('Pano')
    cam_data.type = 'PANO'
    cam_data.panorama_type = 'EQUIRECTANGULAR'
    cam = bpy.data.objects.new('Pano', cam_data)
    cam.location = (0, ROOM.get('cameraZ', 1.9), ROOM.get('eye', 1.6))
    # Cycles looks down local -Z. Pitch 96° puts the horizon level and +Y down the hall.
    cam.rotation_euler = (3.14159265 * 96 / 180, 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam
    sky = bpy.data.objects.get('sky')
    if sky:
        sky.hide_render = True
    return cam


def prepare():
    build()
    scene = bpy.context.scene
    cam = setup_camera(scene)
    setup_passes(scene)
    tag_masks()
    bpy.context.view_layer.update()
    corners = {}
    for obj in bpy.data.objects:
        if obj.name.startswith('framed-canvas-'):
            corners[obj.name.replace('framed-canvas-', '')] = canvas_corners(obj)
    TILE_DIR.mkdir(parents=True, exist_ok=True)
    write_slot_manifest(cam, corners)
    manifest = ASSETS / 'review-renders' / 'stop-manifest.json'
    if manifest.exists():
        target = TILE_DIR / 'stop-manifest.json'
        target.write_text(manifest.read_text())
        print('manifest', target)
    return scene


def tile_paths(index):
    stem = f'tile-{index:03d}'
    return TILE_DIR / f'{stem}.exr', TILE_DIR / f'{stem}.ok'


def tile_done(index):
    exr, stamp = tile_paths(index)
    if not stamp.exists() or not exr.exists() or exr.stat().st_size < 4096:
        return False
    head = exr.read_bytes()[:4]
    return head == b'\x76\x2f\x31\x01'


def render_one(scene, index, total):
    exr, stamp = tile_paths(index)
    if tile_done(index):
        print(f'SKIP tile {index + 1}/{total} {exr.name}')
        return
    if exr.exists():
        exr.unlink()
    # Blender's border Y grows upward. Tile 0 is the top of the equirect.
    scene.render.border_min_x = 0.0
    scene.render.border_max_x = 1.0
    scene.render.border_max_y = 1.0 - index / total
    scene.render.border_min_y = 1.0 - (index + 1) / total
    scene.render.filepath = str(exr)
    print(f'RENDER tile {index + 1}/{total} y {scene.render.border_min_y:.4f}-{scene.render.border_max_y:.4f} samples {SAMPLES} threshold {THRESHOLD}')
    bpy.ops.render.render(write_still=True)
    stamp.write_text(f'{exr.stat().st_size}\n')
    print(f'DONE tile {index + 1}/{total} bytes {exr.stat().st_size}')


def probe(scene):
    """A few minutes of the final sample settings, on a patch that sees the volume."""
    scene.render.resolution_x = int(os.environ.get('BLANC_PANO_W', '6144'))
    scene.render.resolution_y = int(os.environ.get('BLANC_PANO_H', '3072'))
    scene.cycles.samples = int(os.environ.get('BLANC_PANO_SAMPLES', '512'))
    scene.cycles.adaptive_threshold = float(os.environ.get('BLANC_THRESHOLD', '0.01'))
    # Default sits on a side wall and the volume, not on the emissive backdrop.
    origin_x = float(os.environ.get('BLANC_PROBE_X', '0.18'))
    origin_y = float(os.environ.get('BLANC_PROBE_Y', '0.58'))
    span_x = int(os.environ.get('BLANC_PROBE_W', '768')) / scene.render.resolution_x
    span_y = int(os.environ.get('BLANC_PROBE_H', '192')) / scene.render.resolution_y
    scene.render.border_min_x = origin_x
    scene.render.border_max_x = min(1.0, origin_x + span_x)
    scene.render.border_min_y = origin_y
    scene.render.border_max_y = min(1.0, origin_y + span_y)
    out = TILE_DIR / 'probe.exr'
    TILE_DIR.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(out)
    print(
        f'PROBE {scene.render.resolution_x}x{scene.render.resolution_y} '
        f'samples {scene.cycles.samples} threshold {scene.cycles.adaptive_threshold} '
        f'border {scene.render.border_min_x:.4f},{scene.render.border_min_y:.4f}'
    )
    bpy.ops.render.render(write_still=True)
    print('PROBE done', out, out.stat().st_size if out.exists() else 0)


def exr_layers(path):
    blob = path.read_bytes()[:200000]
    names = []
    for token in (b'Combined', b'DiffDir', b'DiffInd', b'GlossDir', b'GlossInd', b'IndexOB', b'Denoising Normal', b'Denoising Albedo', b'Denoising Depth'):
        if token in blob:
            names.append(token.decode())
    return names


def read_exr(path):
    import OpenImageIO as oiio
    import numpy as np
    image = oiio.ImageInput.open(str(path))
    spec = image.spec()
    data = image.read_image(0, 0, 0, spec.nchannels, 'float')
    image.close()
    array = np.asarray(data, dtype=np.float32).reshape(spec.height, spec.width, spec.nchannels)
    names = list(spec.channelnames)
    def take(suffix):
        if suffix not in names:
            return None
        return array[:, :, names.index(suffix)]
    beauty = np.stack([take('ViewLayer.Combined.R'), take('ViewLayer.Combined.G'), take('ViewLayer.Combined.B')], axis=2)
    albedo = None
    if 'ViewLayer.Denoising Albedo.R' in names:
        albedo = np.stack([
            take('ViewLayer.Denoising Albedo.R'),
            take('ViewLayer.Denoising Albedo.G'),
            take('ViewLayer.Denoising Albedo.B'),
        ], axis=2)
    normal = None
    if 'ViewLayer.Denoising Normal.X' in names:
        normal = np.stack([
            take('ViewLayer.Denoising Normal.X'),
            take('ViewLayer.Denoising Normal.Y'),
            take('ViewLayer.Denoising Normal.Z'),
        ], axis=2)
    index = take('ViewLayer.IndexOB.X')
    return beauty, albedo, normal, index


def assemble():
    """Stack the tiles top to bottom, denoise once, write a viewable JPEG."""
    import json
    import numpy as np
    from bake_musee_blanc import denoise_array

    paths = [TILE_DIR / f'tile-{index:03d}.exr' for index in range(TILES)]
    missing = [path.name for path in paths if not path.exists()]
    if missing:
        raise RuntimeError(f'missing tiles: {missing}')
    print('layers tile 0', exr_layers(paths[0]))
    beauties, albedos, normals, indexes = [], [], [], []
    for path in paths:
        beauty, albedo, normal, index = read_exr(path)
        beauties.append(beauty)
        albedos.append(albedo)
        normals.append(normal)
        indexes.append(index)
        print('loaded', path.name, beauty.shape, 'index>6', int((index > 6.5).sum()) if index is not None else None)
    frame = np.concatenate(beauties, axis=0)
    albedo = np.concatenate(albedos, axis=0) if all(item is not None for item in albedos) else None
    normal = np.concatenate(normals, axis=0) if all(item is not None for item in normals) else None
    index = np.concatenate(indexes, axis=0) if all(item is not None for item in indexes) else None
    # One denoise of the whole frame, so the tile cuts are not baked in.
    frame = denoise_array(frame, albedo, normal)
    height, width = frame.shape[:2]
    exposure = float(os.environ.get('BLANC_EXPOSURE', '-1.65'))
    shown = np.clip(frame * (2 ** exposure), 0, None)
    shown = shown / (1.0 + shown)
    shown = np.where(shown <= 0.0031308, shown * 12.92, 1.055 * np.power(np.clip(shown, 0, None), 1 / 2.4) - 0.055)
    import OpenImageIO as oiio
    jpg = Path(os.environ.get('BLANC_PANO_JPG', str(ASSETS / 'review-renders' / 'pano-test.jpg')))
    jpg.parent.mkdir(parents=True, exist_ok=True)
    output = oiio.ImageOutput.create(str(jpg))
    spec = oiio.ImageSpec(width, height, 3, oiio.UINT8)
    spec.attribute('CompressionQuality', 90)
    output.open(str(jpg), spec)
    output.write_image(np.clip(shown * 255, 0, 255).astype(np.uint8))
    output.close()
    print('assembled', jpg, jpg.stat().st_size, width, height)
    manifest_path = TILE_DIR / 'stop-manifest.json'
    if index is not None and manifest_path.exists():
        payload = json.loads(manifest_path.read_text())
        for slot in payload.get('frames', []):
            hits = 0
            for u, v in slot.get('cornersEquirectUV', []):
                x = int(np.clip(u, 0, 0.999) * width)
                y = int(np.clip(v, 0, 0.999) * height)
                if index[y, x] > 6.5:
                    hits += 1
            print('slot', slot['id'], 'canvas-index corners', hits, '/', len(slot.get('cornersEquirectUV', [])))


def main():
    argv = args_after_double_dash()
    if '--assemble' in argv:
        assemble()
        return
    if '--manifest' in argv:
        prepare()
        return
    scene = prepare()
    if '--probe' in argv:
        probe(scene)
        return
    if '--tile' in argv:
        index = int(argv[argv.index('--tile') + 1])
        render_one(scene, index, TILES)
        return
    for index in range(TILES):
        render_one(scene, index, TILES)


if __name__ == '__main__':
    main()
