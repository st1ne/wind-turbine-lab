/**
 * Ducted fan: the wind source (TECH_SPEC §4.1, §11). A lathed shroud with a bellmouth inlet,
 * a glowing honeycomb straightener and ring at the outlet, a 7-blade rotor whose speed follows
 * the mean wind, and an amber LED readout ("08.0 m/s" / "STORM 30.0").
 */
import {
  AdditiveBlending,
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ENVIRONMENT } from '@/config/environment';
import { PALETTE, THEME } from '@/config/theme';
import { fixed } from '@/physics/format';
import { createCanvasTexture, MONO_FONT } from '@/scene/canvasTexture';
import { makeMaterial } from '@/scene/materials';
import type { SceneModule } from '@/scene/module';

const F = ENVIRONMENT.fan;
/** visual fan speed per m/s of mean wind, rev/s, capped to avoid strobing */
const REV_PER_MS = 0.09;
const MAX_REV_S = 2.2;

function honeycombTexture(): ReturnType<typeof createCanvasTexture> {
  const tex = createCanvasTexture(1024, 1024);
  const { ctx } = tex;
  ctx.clearRect(0, 0, 1024, 1024);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  const r = 30;
  const w = Math.sqrt(3) * r;
  for (let row = -1; row < 1024 / (1.5 * r) + 1; row++) {
    for (let col = -1; col < 1024 / w + 1; col++) {
      const cx = col * w + (row % 2 ? w / 2 : 0);
      const cy = row * 1.5 * r;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  // fade toward the rim so the ring reads as the brightest part
  const g = ctx.createRadialGradient(512, 512, 120, 512, 512, 512);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 1024);
  tex.texture.needsUpdate = true;
  return tex;
}

export function createFan(): SceneModule<Group> {
  const group = new Group();
  group.name = 'fan';
  group.position.set(F.x, F.y, 0);
  const geos: BufferGeometry[] = [];
  const track = <G extends BufferGeometry>(g: G): G => {
    geos.push(g);
    return g;
  };

  // Everything inside `rig` is built along +y and rotated so +y points downstream (+x).
  const rig = new Group();
  rig.rotation.z = -Math.PI / 2;
  group.add(rig);

  const L = F.length;
  const ri = F.radius;
  const profile = [
    new Vector2(ri, L / 2),
    new Vector2(ri, -L / 2 + 0.05),
    new Vector2(ri + 0.035, -L / 2),
    new Vector2(ri + 0.065, -L / 2 + 0.004),
    new Vector2(ri + 0.045, -L / 2 + 0.05),
    new Vector2(ri + 0.04, L / 2),
    new Vector2(ri, L / 2),
  ];
  const shroud = new Mesh(
    track(new LatheGeometry(profile, 72)),
    makeMaterial(
      { color: PALETTE.fanShroud, roughness: 0.45, metalness: 0.7, side: DoubleSide },
      'environment',
    ),
  );
  shroud.castShadow = true;
  shroud.receiveShadow = true;
  rig.add(shroud);

  const ringGeo = track(new TorusGeometry(ri + 0.02, 0.007, 8, 96));
  ringGeo.rotateX(Math.PI / 2);
  const ring = new Mesh(ringGeo, new MeshBasicMaterial({ color: new Color(THEME.wind).multiplyScalar(3.2) }));
  ring.position.y = L / 2 + 0.002;
  rig.add(ring);

  const comb = honeycombTexture();
  const combGeo = track(new CircleGeometry(ri, 72));
  combGeo.rotateX(-Math.PI / 2);
  const combMesh = new Mesh(
    combGeo,
    new MeshBasicMaterial({
      map: comb.texture,
      color: new Color(THEME.wind).multiplyScalar(1.1),
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    }),
  );
  combMesh.position.y = L / 2 - 0.015;
  rig.add(combMesh);

  // Rotor: hub + 7 twisted blades merged into one mesh.
  const bladeParts: BufferGeometry[] = [];
  const hubGeo = new CylinderGeometry(0.065, 0.07, 0.09, 32);
  bladeParts.push(hubGeo);
  for (let k = 0; k < F.blades; k++) {
    const b = new BoxGeometry(ri - 0.08, 0.008, 0.11);
    b.translate((ri - 0.08) / 2 + 0.06, 0, 0);
    b.rotateX(0.5); // blade pitch
    b.rotateY((k * 2 * Math.PI) / F.blades);
    bladeParts.push(b);
  }
  const rotorGeo = track(mergeGeometries(bladeParts));
  bladeParts.forEach((g) => g.dispose());
  const rotor = new Mesh(
    rotorGeo,
    makeMaterial({ color: PALETTE.fanBlade, roughness: 0.4, metalness: 0.6 }, 'environment'),
  );
  rotor.position.y = -0.02;
  rotor.castShadow = true;
  rig.add(rotor);

  const motorParts: BufferGeometry[] = [];
  const motor = new CylinderGeometry(0.09, 0.1, 0.17, 32);
  motor.translate(0, -0.14, 0);
  motorParts.push(motor);
  for (let k = 0; k < 3; k++) {
    const s = new BoxGeometry(ri - 0.09, 0.012, 0.02);
    s.translate((ri - 0.09) / 2 + 0.09, -0.14, 0);
    s.rotateY((k * 2 * Math.PI) / 3 + Math.PI / 6);
    motorParts.push(s);
  }
  const motorMesh = new Mesh(
    track(mergeGeometries(motorParts)),
    makeMaterial({ color: '#1c212b', roughness: 0.5, metalness: 0.6 }, 'environment'),
  );
  motorParts.forEach((g) => g.dispose());
  motorMesh.castShadow = true;
  rig.add(motorMesh);

  // Cradle down to the bench.
  const benchTop = ENVIRONMENT.bench.topY;
  const cradleH = F.y - (ri + 0.04) - benchTop + 0.03;
  const cradleGeo = track(new BoxGeometry(0.22, cradleH, 0.5));
  const cradle = new Mesh(
    cradleGeo,
    makeMaterial({ color: PALETTE.benchLeg, roughness: 0.6, metalness: 0.5 }, 'environment'),
  );
  cradle.position.set(0, benchTop + cradleH / 2 - F.y, 0);
  cradle.castShadow = true;
  group.add(cradle);

  // LED display on top of the shroud, facing the viewer (+z).
  const led = createCanvasTexture(512, 144);
  const housingGeo = track(new BoxGeometry(0.2, 0.065, 0.05));
  const housing = new Mesh(
    housingGeo,
    makeMaterial({ color: '#12151c', roughness: 0.5, metalness: 0.4 }, 'environment'),
  );
  housing.position.set(0, ri + 0.07, 0.12);
  housing.rotation.x = -0.35;
  group.add(housing);
  const screenGeo = track(new PlaneGeometry(0.18, 0.05));
  const screen = new Mesh(
    screenGeo,
    new MeshBasicMaterial({ map: led.texture, color: new Color(1.6, 1.6, 1.6) }),
  );
  screen.position.set(0, 0, 0.0255);
  housing.add(screen);
  let ledText = '';

  function drawLed(text: string): void {
    const { ctx } = led;
    ctx.fillStyle = PALETTE.ledBg;
    ctx.fillRect(0, 0, 512, 144);
    ctx.fillStyle = THEME.power;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 76px ${MONO_FONT}`;
    ctx.shadowColor = THEME.power;
    ctx.shadowBlur = 12;
    ctx.fillText(text, 256, 76);
    ctx.shadowBlur = 0;
    led.texture.needsUpdate = true;
  }

  return {
    object3d: group,
    update(s, _ui, dt) {
      const rev = Math.min(REV_PER_MS * Math.max(s.Vmean, 0), MAX_REV_S);
      rotor.rotation.y += rev * 2 * Math.PI * dt;
      const v = fixed(s.Vmean, 1).padStart(4, '0');
      const text = s.stormLevel > 0.5 ? `STORM ${v}` : `${v} m/s`;
      if (text !== ledText) {
        ledText = text;
        drawLed(text);
      }
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      comb.texture.dispose();
      led.texture.dispose();
    },
  };
}
