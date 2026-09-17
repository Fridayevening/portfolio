"""laser card — Blender/Cycles scene (headless): blender -b -P laser_scene.py -- out.png [texdir]

Same recipe as the three.js prototype, path-traced: frosted glass shell with thin-film
interference whose THICKNESS is driven by noise (130-560nm flowing across the surface),
clean-lit card inside, aurora-gradient backdrop BEHIND the camera (the environment is
the aurora), colored strip lights, black void.

newboy-server private copy - source of truth lives in
skill-lab/HypeBoyImgTool/laser-card-blender/scene.py.
Invoked by the lab NestJS module with EXPORT=1; texdir points at the laser_textures.py
output for this job (default: script directory, the proto usage).
Do not hand-edit here without syncing the proto copy."""
import math
import os
import struct
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = f"{HERE}/out/laser-card.png"
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if argv:
    OUT = argv[0]
TEX = HERE if len(argv) < 2 else os.path.abspath(argv[1])

# ---------------------------------------------------------------- clean slate
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- world: void
scene.world = bpy.data.worlds.new("void")
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.0, 0.0, 0.0, 1.0)
bg.inputs[1].default_value = 0.0

# ---------------------------------------------------------------- helpers
def set_input(node, names, value):
    """Set the first existing socket among `names` (Blender renames sockets between versions)."""
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return n
    raise KeyError(f"{node.name}: none of {names} exist. inputs: {list(node.inputs)}")

def texture_material(name, path, emission=0.0, rough=0.55, unlit=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(path)
    tex.interpolation = "Smart"
    if unlit:
        # display material: the photo reads true no matter how hard the studio lights hit
        # (transparent where the texture has alpha, emissive where it does not)
        out = nt.nodes["Material Output"]
        nt.nodes.remove(nt.nodes["Principled BSDF"])
        emi = nt.nodes.new("ShaderNodeEmission")
        emi.inputs["Strength"].default_value = emission or 1.2   # frost-loss default 1.2
        trans = nt.nodes.new("ShaderNodeBsdfTransparent")
        mix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(tex.outputs["Color"], emi.inputs["Color"])
        nt.links.new(tex.outputs["Alpha"], mix.inputs["Fac"])
        nt.links.new(trans.outputs["BSDF"], mix.inputs[1])
        nt.links.new(emi.outputs["Emission"], mix.inputs[2])
        nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
        return mat
    bsdf = nt.nodes["Principled BSDF"]
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    set_input(bsdf, ["Roughness"], rough)
    set_input(bsdf, ["Specular IOR Level", "Specular"], 0.25)
    if emission:
        # the texture must drive Emission Color too - Emission Strength alone would emit
        # the socket's default WHITE (this exact mistake blew the card out to white once)
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
        set_input(bsdf, ["Emission Strength"], emission)
    return mat

def area_light(name, color, size, w, h, loc):
    l = bpy.data.lights.new(name, "AREA")
    l.color = color
    l.energy = size
    l.shape = "RECTANGLE"
    l.size, l.size_y = w, h
    ob = bpy.data.objects.new(name, l)
    ob.location = loc
    ob.rotation_euler = (-Vector(loc)).normalized().to_track_quat("-Z", "Y").to_euler()  # aim at origin
    scene.collection.objects.link(ob)
    return ob

# ---------------------------------------------------------------- the card
CARD_W, CARD_H = 1.0, 1.4
face_mat = texture_material("card_face", f"{TEX}/card_face.png", unlit=True)
back_mat = texture_material("card_back", f"{TEX}/card_back.png", unlit=True)

bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
card_ob = bpy.context.active_object
card_ob.name = "card"
card_ob.scale = (CARD_W, CARD_H, 1.0)
card_ob.rotation_euler = (math.radians(90), 0, 0)      # face -Y (toward the camera)
# bake rotation TOO: 5.2's transform_apply wipes the euler into the mesh even when only
# scale is asked for — a copy re-applying the pre-bake euler stands up vertical inside
# the card and looms through the glass as a black band (the "fixed many times" bug)
bpy.ops.object.transform_apply(rotation=True, scale=True)
card_ob.data.materials.append(face_mat)

back_ob = card_ob.copy()
back_ob.data = card_ob.data.copy()
back_ob.data.materials.clear()
back_ob.data.materials.append(back_mat)
# page-flip about the world VERTICAL (Z). After the X90 bake the plate's normal lives on
# world Y — a 180° there only spins the plate in its own plane and it keeps facing the
# camera (in the glb that shipped as a rear-viewed mirror of the FRONT photo). Flipping
# about Z turns the print away, and rear-viewing cancels the flip's mirror, so the shared
# front UVs read correctly from behind — no UV flip needed, like a physical card.
back_ob.rotation_euler = (0, 0, math.radians(180))
back_ob.location = (0, 0.002, 0)
scene.collection.objects.link(back_ob)

# ---------------------------------------------------------------- the shell
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
shell = bpy.context.active_object
shell.name = "shell"
shell.scale = (1.10, 0.11, 1.50)
bpy.ops.object.transform_apply(scale=True)
bevel = shell.modifiers.new("bevel", "BEVEL")
bevel.width = 0.05
bevel.segments = 6
bevel.limit_method = "ANGLE"
bpy.ops.object.shade_smooth()

shell_mat = bpy.data.materials.new("laser_glass")
shell_mat.use_nodes = True
nt = shell_mat.node_tree
bsdf = nt.nodes["Principled BSDF"]

set_input(bsdf, ["Base Color"], (1, 1, 1, 1))
set_input(bsdf, ["Transmission Weight", "Transmission"], 1.0)
set_input(bsdf, ["IOR"], 1.5)
set_input(bsdf, ["Roughness"], 0.26)
set_input(bsdf, ["Coat Weight", "Clearcoat"], 0.85)
set_input(bsdf, ["Coat Roughness", "Clearcoat Roughness"], 0.08)
set_input(bsdf, ["Specular IOR Level", "Specular"], 1.0)

# thin-film iridescence: thickness in nm, DRIVEN BY NOISE so hue pools and flows
# (a single constant thickness would be one flat color)
set_input(bsdf, ["Thin Film IOR"], 1.32)
coords = nt.nodes.new("ShaderNodeTexCoord")
mapping = nt.nodes.new("ShaderNodeMapping")
mapping.inputs["Scale"].default_value = (1.6, 2.2, 1.6)
pools = nt.nodes.new("ShaderNodeTexNoise")
set_input(pools, ["Scale"], 1.0)
set_input(pools, ["Detail"], 6.0)
set_input(pools, ["Roughness"], 0.45)
rng = nt.nodes.new("ShaderNodeMapRange")
rng.inputs["From Min"].default_value = 0.38
rng.inputs["From Max"].default_value = 0.62
rng.inputs["To Min"].default_value = 130.0
rng.inputs["To Max"].default_value = 560.0
nt.links.new(coords.outputs["Generated"], mapping.inputs["Vector"])
nt.links.new(mapping.outputs["Vector"], pools.inputs["Vector"])
nt.links.new(pools.outputs["Fac"], rng.inputs["Value"])
nt.links.new(rng.outputs["Result"], bsdf.inputs["Thin Film Thickness"])

# water ripple on the surface: wave-scale noise -> bump -> normal (wavy reflections)
ripple = nt.nodes.new("ShaderNodeTexNoise")
set_input(ripple, ["Scale"], 70.0)
set_input(ripple, ["Detail"], 4.0)
bump = nt.nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = 0.30
nt.links.new(ripple.outputs["Fac"], bump.inputs["Height"])
nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
shell.data.materials.append(shell_mat)

# ---------------------------------------------------------------- aurora studio
# aurora backdrop BEHIND the camera: a frontal face reflects what is behind the viewer
bpy.ops.mesh.primitive_plane_add(size=1, location=(0.2, -4.8, 0.3))
bgp = bpy.context.active_object
bgp.name = "aurora_bg"
bgp.scale = (16, 11, 1)   # stay in the matrix: no transform_apply — 5.2 also bakes and
# zeroes LOCATION, and aiming with (-Vector(ob.location)) then silently reads (0,0,0):
# the plane stays flat at z=0.3, slicing the card in half and shadowing every light
# below the midline (the tie-knot seam)
bgp.rotation_euler = (-Vector((0.2, -4.8, 0.3))).normalized().to_track_quat("-Z", "Y").to_euler()
bgp.data.materials.append(texture_material("aurora", f"{TEX}/aurora_bg.png", emission=7.0, rough=1.0))
# the backdrop must light NOTHING directly: diffuse off (it was blowing the card out),
# camera off (environment, not set dressing), glossy/transmission off (it smeared into a
# bright band through the frosted shell), and shadow off (it blacked out the lights below
# the card midline)
bgp.visible_diffuse = False
bgp.visible_camera = False
bgp.visible_glossy = False
bgp.visible_transmission = False
bgp.visible_shadow = False

# ---------------------------------------------------------------- light sweep backdrop
# the STILL's background: a lavender-gray pool BEHIND the card, camera-visible. On pure
# black the shell's silhouette half-vanishes (refracted black is black); this plane gives
# the frosted margins something to refract, like the web viewer's 亮毯 preset. It must not
# light anything, cast shadows, or pollute the shell's glossy reflections (the aurora
# behind the camera owns those) — transmission rays DO see it, that is the point.
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 4, 0))
bdp = bpy.context.active_object
bdp.name = "backdrop"
bdp.scale = (10, 10, 1)                    # stays in the matrix: never transform_apply here
bdp.rotation_euler = (math.radians(90), 0, 0)   # face -Y, toward the camera
# unlit: the plane sits in the lights' path — a diffuse sweep would be blown out by
# them regardless of its emission (measured: corners 217 at emission 0.3)
bdp.data.materials.append(texture_material("sweep", f"{TEX}/backdrop.png", emission=0.3, unlit=True))
bdp.visible_diffuse = False
bdp.visible_glossy = False
bdp.visible_shadow = False

# strip lights (color, W, w, h, loc) — each aims at the origin
area_light("pink",   (1.0, 0.62, 0.82), 900,  5.0, 0.55, (-3.2, -2.4, 1.6))
area_light("cyan",   (0.50, 0.91, 1.0), 700,  5.0, 0.45, (3.4, -1.8, 0.4))
area_light("violet", (0.70, 0.55, 1.0), 600,  4.0, 0.70, (0.6, 2.6, 3.6))
# sweep at (-0.4, -5.5, 3.4): higher and further out than (-0.4, -4.6, 2.2) — at the
# old spot its reflection washed +45 over the photo window's top third (where portrait
# heads live); from out here the highlight lands on the shell's top margin instead
# (measured: photo top 224→182 vs texture ~186, top margin 147→153)
area_light("sweep",  (1.0, 0.965, 0.935), 1200, 7.0, 0.28, (-0.4, -5.5, 3.4))

# ---------------------------------------------------------------- camera
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 57
cam_data.sensor_width = 36
cam_ob = bpy.data.objects.new("cam", cam_data)
# dolly-in, not lens zoom: at 1/1.15 the card reads 15% larger while the backdrop pool
# (6.6 units behind) grows only ~5% — a longer lens would blow the pool up with the card
FRONTAL_D = 3.35 / 1.15
cam_ob.location = (0, -FRONTAL_D, 0)      # dead-frontal product shot (no keystone)
# explicit aim - a TRACK_TO constraint silently did nothing in headless mode here and the
# camera kept its default straight-down orientation (the card read as a horizontal band)
cam_ob.rotation_euler = (-Vector(cam_ob.location)).normalized().to_track_quat("-Z", "Y").to_euler()
scene.collection.objects.link(cam_ob)
scene.camera = cam_ob

# ---------------------------------------------------------------- render
scene.render.engine = "CYCLES"
scene.cycles.samples = 192
scene.cycles.use_denoising = True
scene.cycles.transparent_max_bounces = 12
scene.render.resolution_x = 1080
scene.render.resolution_y = 1440
scene.render.film_transparent = False
# AgX (the 5.x default) flattens light grays to ~200-225: the backdrop ends up brighter
# than the card. VIEW=standard|filmic switches the tone map; the light sweep reads right
# under both, pick by taste.
scene.view_settings.view_transform = os.environ.get("VIEW", "AgX")

# Metal GPU if available, else CPU
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    scene.cycles.device = "GPU"
    print("cycles: METAL GPU")
except Exception as e:
    print("cycles: CPU fallback,", e)

scene.render.filepath = OUT
# debug isolation toggles: NO_SHELL / NO_BACK / NO_BG / NO_BD / NO_CARD hide objects
for var, ob in [("NO_SHELL", shell), ("NO_BACK", back_ob), ("NO_BG", bgp),
                ("NO_BD", bdp), ("NO_CARD", card_ob)]:
    if os.environ.get(var):
        ob.hide_render = True
        print("hidden:", var)

# stills FIRST, with the real Cycles materials — the EXPORT swap below replaces them
bpy.ops.render.render(write_still=True)
print("wrote", OUT)

# the angle still, per the user's reference mock: a SUBTLE yaw only — "把右下角往上翻
# 一点点". Camera slides 12° to the LEFT, level with the card: the card's right edge
# recedes (bottom-right lifts, top-right dips ~4°), the left edge shows a whisper of
# the block's side, and the photo stays dead-readable. Same distance as the frontal so
# the card fills the frame identically
OUT3D = os.path.splitext(OUT)[0] + "-3d.png"
yaw = math.radians(12)
cam_ob.location = (-FRONTAL_D * math.sin(yaw), -FRONTAL_D * math.cos(yaw), 0.0)
cam_ob.rotation_euler = (-Vector(cam_ob.location)).normalized().to_track_quat("-Z", "Y").to_euler()
scene.render.filepath = OUT3D
bpy.ops.render.render(write_still=True)
print("wrote", OUT3D)
cam_ob.location = (0, -FRONTAL_D, 0)   # restore, in case anything downstream re-renders
cam_ob.rotation_euler = (-Vector(cam_ob.location)).normalized().to_track_quat("-Z", "Y").to_euler()

# transparent cutout, frontal: for dropping the card into other designs. The sweep
# backdrop must stay visible to TRANSMISSION here: the frosted shell's whole read is
# refracting that bright sweep — hide_render blacks it out for every ray type and the
# margins collapse into a dark frame (measured RGB ~45 vs ~115 in the frontal still).
# visible_camera=False + film_transparent keeps the surround pure alpha while the
# glass margins keep the frontal still's brightness.
OUTALPHA = os.path.splitext(OUT)[0] + "-alpha.png"
bdp.visible_camera = False
scene.render.film_transparent = True
scene.render.filepath = OUTALPHA
bpy.ops.render.render(write_still=True)
print("wrote", OUTALPHA)
bdp.visible_camera = True
scene.render.film_transparent = False

if os.environ.get("EXPORT"):
    # glTF interchange: keep what survives the format, drop what can't.
    #   survives: geometry (bevels applied), print textures, frosted transmission,
    #             clearcoat, thin-film iridescence (as KHR_ extensions three.js loads)
    #   dropped:  noise-driven iridescence pools (glTF thickness is constant — angle
    #             rainbow remains, spatial pooling doesn't), ripple bump, area lights
    #             (glTF has none), aurora backdrop (the receiving scene's environment)
    # card print: rebuild as textured emissive — the emission+transparent mix node soup
    # does not translate, a plain emissive Principled does
    for name, tex in [("card_face_gltf", "card_face.png"), ("card_back_gltf", "card_back.png")]:
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        b = mat.node_tree.nodes["Principled BSDF"]
        t = mat.node_tree.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(f"{TEX}/{tex}")
        mat.node_tree.links.new(t.outputs["Color"], b.inputs["Emission Color"])
        mat.node_tree.links.new(t.outputs["Alpha"], b.inputs["Alpha"])
        set_input(b, ["Base Color"], (0, 0, 0, 1))   # no diffuse layer: the receiving
        # scene's environment would tint the photo through it (aurora = cyan-heavy wash)
        set_input(b, ["Emission Strength"], 1.0)
        set_input(b, ["Roughness"], 0.9)
        # NB: 5.2's exporter always writes alphaMode BLEND for alpha-linked materials
        # (blend_method is a dead stub — CLIP reads back HASHED), and BLEND makes loaders
        # skip depth (three.js r186 GLTFLoader forces depthWrite=false), so whichever
        # plate draws last paints over the other. Patched to MASK after export below.
        ob = card_ob if "face" in name else back_ob
        ob.data.materials.clear()
        ob.data.materials.append(mat)
    # shell: sever the procedural links so the exporter reads clean constant values
    sh_nt = shell_mat.node_tree
    for link in list(sh_nt.links):
        if link.to_socket.name in ("Thin Film Thickness", "Normal") or \
           link.from_node.name in ("ShaderNodeMapRange", "ShaderNodeBump"):
            sh_nt.links.remove(link)
    set_input(bsdf, ["Thin Film Thickness"], 340.0)   # mid of the 130-560nm pool range
    for ob in scene.objects:
        ob.select_set(ob.name in ("card", "card.001", "shell"))
    GLB = os.path.splitext(OUT)[0] + ".glb"    # sibling of the still, same basename
    bpy.ops.export_scene.gltf(
        filepath=GLB,
        export_format="GLB",
        use_selection=True,
        export_apply=True,            # bake the bevel modifier into the mesh
        export_yup=True,
    )
    print("wrote", GLB)

    # BLEND -> MASK on the print plates: same-length JSON rewrite ("MASK" is one char
    # shorter than "BLEND" — pad with one trailing space) so buffer offsets stay valid.
    # MASK + cutoff 0.5 is exactly what the plates want (cut rounded corners, keep the
    # 150-230 alpha text/bar) and keeps depth-writing in every conforming loader.
    with open(GLB, "rb+") as f:
        f.seek(12)
        (clen,) = struct.unpack("<I", f.read(4))
        head = f.read(clen).decode()
        patched = head.replace('"alphaMode":"BLEND"', '"alphaMode":"MASK" ')
        assert len(patched) == clen and patched != head, "BLEND patch failed"
        f.seek(12 + 4)
        f.write(patched.encode())
    print("patched alphaMode BLEND -> MASK")
