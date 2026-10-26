import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ControlClient } from "./control.ts";
import { MAX_SPEED, motion } from "./protocol.ts";
import type { Pose, World } from "./protocol.ts";

type Props = { left: number; right: number; charging: boolean; firing: boolean; energy: number; shots: number; world: World | null };
type DistanceReading = { distance_cm: number | null; error: string | null; motion_status: string; moved_cm: number };

const WHEEL_RADIUS = 0.36, TRAIL = 900, SHOT_SPEED = 9, SHOT_LIFE = 1.6;
const BACKGROUND = 0x080b10, ACCENT = new THREE.Color(0x4cc2ff), CHARGE = new THREE.Color(0xffa63d);

const standard = (color: number, roughness = 0.5, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(x, y, z);
  item.castShadow = item.receiveShadow = true;
  return item;
}

/** Rounded tyre with tread blocks, a dark rim and five spokes; spins about its local X axis.
 *  Repeated blocks and spokes are merged so each wheel costs a handful of draw calls. */
function wheel(side: 1 | -1) {
  const group = new THREE.Group();
  const profile = [new THREE.Vector2(0.2, -0.13)];
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + Math.PI * i / 12;
    profile.push(new THREE.Vector2(WHEEL_RADIUS - 0.07 + Math.cos(a) * 0.07, Math.sin(a) * 0.13));
  }
  profile.push(new THREE.Vector2(0.2, 0.13));
  const tyre = mesh(new THREE.LatheGeometry(profile, 48), standard(0x15181c, 0.85));
  tyre.rotation.z = Math.PI / 2;
  group.add(tyre);
  group.add(mesh(mergeGeometries(Array.from({ length: 16 }, (_, i) => {
    const a = i / 16 * Math.PI * 2;
    return new THREE.BoxGeometry(0.24, 0.025, 0.06).rotateX(-a).translate(0, Math.cos(a) * WHEEL_RADIUS, Math.sin(a) * WHEEL_RADIUS);
  })), standard(0x0c0e11, 0.95)));
  group.add(mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.2, 32).rotateZ(Math.PI / 2), standard(0x2a323c, 0.4, 0.8)));
  group.add(mesh(mergeGeometries(Array.from({ length: 5 }, (_, i) =>
    new THREE.BoxGeometry(0.04, 0.36, 0.06).rotateX(i / 5 * Math.PI * 2).translate(side * 0.1, 0, 0))), standard(0xc9d3dd, 0.25, 1)));
  return group;
}

/** Third-person view of the car: wheel duties drive a differential-drive pose, the relays drive the coil gun. */
export function Car3D(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const reset = useRef(() => {});
  const overview = useRef(() => {});
  const [distance, setDistance] = useState("20");
  const requestedDistance = Number(distance);
  const [reading, setReading] = useState("");
  const control = useRef<ControlClient | null>(null);
  useEffect(() => {
    const client = control.current = new ControlClient("ws://127.0.0.1:8081/ws");
    return () => { control.current = null; client.close(); };
  }, []);
  async function request(path: string, params?: Record<string, string | number>) {
    try {
      if (!control.current) throw Error("遥控未连接");
      const result = await control.current.request<DistanceReading | true>(path, params);
      if (result === true) setReading("指令已接受，点击测距查看进度");
      else {
        const distance = result.distance_cm == null ? result.error : `${result.distance_cm.toFixed(1)} cm`;
        setReading(`${distance} · ${result.motion_status} · 已走 ${result.moved_cm.toFixed(1)} cm`);
      }
    } catch (error) { setReading(error instanceof Error ? error.message : String(error)); }
  }

  useEffect(() => {
    const element = host.current!;
    // Idle scenes stop redrawing; retain their last frame across compositor updates.
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    element.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BACKGROUND);
    scene.fog = new THREE.Fog(BACKGROUND, 140, 230);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.3;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    camera.position.set(63, 98, -84);
    const controls = new OrbitControls(camera, renderer.domElement);
    Object.assign(controls, { enableDamping: true, enablePan: false, minDistance: 3, maxDistance: 150, maxPolarAngle: 1.42 });

    const key = new THREE.DirectionalLight(0xfff4e6, 1.6);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
    const rim = new THREE.DirectionalLight(0x6fb8ff, 1.2);
    scene.add(key, key.target, rim, rim.target, new THREE.HemisphereLight(0x9cc8ff, 0x0b0f14, 0.3));

    const floor = mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), standard(0x0e131a, 0.92));
    floor.castShadow = false;
    scene.add(floor);
    const grid = new THREE.GridHelper(60, 60, 0x35577a, 0x223040);
    grid.position.y = 0.002;
    // Clip the grid to the rectangular floor; one scene unit is ten centimetres.
    grid.material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 0, 1), 20), new THREE.Plane(new THREE.Vector3(0, 0, -1), 20)];
    renderer.localClippingEnabled = true;
    scene.add(grid);
    const wallMaterial = standard(0x42617e, 0.7, 0.1);
    const walls = Array.from({ length: 4 }, () => mesh(new THREE.BoxGeometry(1, 1, 1), wallMaterial));
    scene.add(...walls);
    const ray = mesh(new THREE.BoxGeometry(0.025, 0.025, 1), new THREE.MeshBasicMaterial({ color: 0x4cc2ff }));
    scene.add(ray);

    const marking = new THREE.MeshBasicMaterial({ color: 0x3a4d63 });
    for (const radius of [2, 4, 6]) scene.add(mesh(new THREE.RingGeometry(radius - 0.025, radius + 0.025, 96).rotateX(-Math.PI / 2), marking, 0, 0.004, 0));
    scene.add(mesh(new THREE.RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4cc2ff }), 0, 0.005, 0));
    scene.add(mesh(new THREE.PlaneGeometry(0.12, 0.7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4cc2ff }), 0, 0.005, 1.3));

    // Trail is a flat ribbon (WebGL lines are always 1 px) that fades from the floor colour to the accent.
    const TRAIL_WIDTH = 0.14, FLOOR = new THREE.Color(0x0e131a);
    const trailPoints = new Float32Array(TRAIL * 6), trailColors = new Float32Array(TRAIL * 6);
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute("position", new THREE.BufferAttribute(trailPoints, 3));
    trailGeometry.setAttribute("color", new THREE.BufferAttribute(trailColors, 3));
    const trailIndex: number[] = [];
    for (let i = 0; i < TRAIL - 1; i++) trailIndex.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    trailGeometry.setIndex(trailIndex);
    trailGeometry.setDrawRange(0, 0);
    const trailColor = new THREE.Color();
    scene.add(new THREE.Mesh(trailGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));

    // The car faces +Z with its left side on +X, so a positive heading turns left.
    const car = new THREE.Group();
    scene.add(car);
    const shell = standard(0xb9c2cc, 0.4, 0.2);
    const graphite = standard(0x1d232b, 0.45, 0.6);
    car.add(mesh(new RoundedBoxGeometry(1.42, 0.3, 2.05, 4, 0.12), graphite, 0, 0.46, 0));
    car.add(mesh(new RoundedBoxGeometry(1.3, 0.1, 1.86, 4, 0.05), shell, 0, 0.66, 0));
    car.add(mesh(new THREE.CapsuleGeometry(0.08, 1.15, 6, 16).rotateZ(Math.PI / 2), standard(0x111418, 0.8), 0, 0.42, 1.05));

    // Electronics on the rear deck: ESP32-S3 board with its shield, and the OLED tilted up.
    car.add(mesh(new THREE.BoxGeometry(0.52, 0.04, 0.36), standard(0x14532d, 0.6), 0.26, 0.73, -0.55));
    car.add(mesh(new THREE.BoxGeometry(0.3, 0.05, 0.24), standard(0xb8c2cc, 0.3, 1), 0.3, 0.77, -0.55));
    const oled = new THREE.Group();
    oled.add(mesh(new RoundedBoxGeometry(0.46, 0.05, 0.28, 2, 0.02), standard(0x0a0c0f, 0.4)));
    oled.add(mesh(new THREE.PlaneGeometry(0.38, 0.19).rotateX(-Math.PI / 2), standard(0x000000, 0.3, 0, { emissive: 0x7fd3ff, emissiveIntensity: 0.9 }), 0, 0.027, 0));
    oled.position.set(-0.32, 0.8, -0.62);
    oled.rotation.x = -0.5;
    car.add(oled);

    // Coil gun: turret with an energy ring, barrel with four copper coils, and two storage capacitors.
    const turret = new THREE.Group();
    turret.position.set(0, 0.71, 0.15);
    car.add(turret);
    turret.add(mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.12, 40), graphite, 0, 0.06, 0));
    const ringMaterial = standard(0xffffff, 0.3, 0, { emissive: CHARGE, emissiveIntensity: 0 });
    const energyRing = mesh(new THREE.TorusGeometry(0.31, 0.015, 8, 64).rotateX(Math.PI / 2), ringMaterial, 0, 0.12, 0);
    turret.add(energyRing);
    const barrel = new THREE.Group();
    barrel.position.set(0, 0.26, 0.05);
    turret.add(barrel);
    barrel.add(mesh(new THREE.BoxGeometry(0.16, 0.14, 0.4), graphite, 0, -0.08, -0.1));
    barrel.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.25, 28).rotateX(Math.PI / 2), standard(0x22272e, 0.35, 0.5), 0, 0, 0.3));
    const coilMaterial = standard(0xb87333, 0.3, 1, { emissive: CHARGE, emissiveIntensity: 0 });
    for (const z of [0, 0.18, 0.36, 0.54]) barrel.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 28).rotateX(Math.PI / 2), coilMaterial, 0, 0, z));
    barrel.add(mesh(new THREE.TorusGeometry(0.085, 0.02, 10, 28), standard(0xc9d3dd, 0.2, 1), 0, 0, 0.93));
    const capacitorTop = standard(0x9aa4ae, 0.3, 1, { emissive: CHARGE, emissiveIntensity: 0 });
    for (const x of [0.42, -0.42]) {
      car.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.34, 24), standard(0x1f3f8f, 0.4, 0.2), x, 0.88, -0.05));
      car.add(mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.02, 24), capacitorTop, x, 1.06, -0.05));
    }

    const wheels = ([1, -1] as const).map(side => {
      const item = wheel(side);
      item.position.set(side * 0.86, WHEEL_RADIUS, 0.3);
      car.add(item);
      return item;
    });
    car.add(mesh(new THREE.SphereGeometry(0.12, 20, 14), standard(0xc9d3dd, 0.2, 1), 0, 0.12, -0.75));

    const muzzle = new THREE.PointLight(0xffb15c, 0, 8, 1.6);
    muzzle.position.set(0, 1.0, 1.25);
    car.add(muzzle);
    // Colours above 1.0 survive tone mapping as hot highlights.
    const shotGeometry = new THREE.SphereGeometry(0.09, 16, 12);
    const streakGeometry = new THREE.CylinderGeometry(0.06, 0.005, 0.7, 12).rotateX(-Math.PI / 2).translate(0, 0, -0.38);
    const ringGeometry = new THREE.RingGeometry(0.1, 0.16, 32);
    const shotMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc46b).multiplyScalar(6) });
    const streakMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8a3d).multiplyScalar(3), transparent: true, opacity: 0.7 });
    const shots: { group: THREE.Group; velocity: THREE.Vector3; age: number }[] = [];
    const blasts: { ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; age: number }[] = [];

    let pose: Pose = { x: 0, z: 0, heading: 0 };
    let trailCount = 0, firedShots = latest.current.shots, flash = 0, previous = performance.now(), frame = 0;
    // Draw only when the picture changes: a parked car with idle controls costs no GPU time.
    let dirty = true, visible = true, renderedEnergy = -1, lastRender = 0;
    const target = new THREE.Vector3(0, 0.6, 0), follow = new THREE.Vector3();
    let viewAll = true;
    reset.current = () => {
      viewAll = false;
      camera.position.set(pose.x + 3.6, 3.2, pose.z - 4.6);
      target.set(pose.x, 0.6, pose.z);
      controls.target.copy(target);
      dirty = true;
    };
    overview.current = () => {
      viewAll = true;
      camera.position.set(63, 98, -84);
      target.set(0, 0.6, 0);
      controls.target.copy(target);
      dirty = true;
    };

    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      dirty = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; dirty = true; });
    visibility.observe(element);

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - previous) / 1000);
      previous = now;
      const { left, right, charging, firing, energy, shots: count } = latest.current;
      const world = latest.current.world;
      const oldPose = pose;
      if (world) {
        pose = { x: world.x / 10, z: world.z / 10, heading: world.heading };
        const width = world.width_cm / 10, depth = world.depth_cm / 10;
        floor.scale.set(width, 1, depth);
        for (const i of [0, 1]) {
          walls[i].scale.set(width + 0.2, 1.2, 0.2);
          walls[i].position.set(0, 0.6, (i ? 1 : -1) * depth / 2);
          walls[i + 2].scale.set(0.2, 1.2, depth);
          walls[i + 2].position.set((i ? 1 : -1) * width / 2, 0.6, 0);
        }
        const length = world.distance_cm / 10;
        ray.scale.z = length;
        ray.rotation.y = pose.heading;
        ray.position.set(pose.x + Math.sin(pose.heading) * (1.05 + length / 2), 0.5, pose.z + Math.cos(pose.heading) * (1.05 + length / 2));
      }
      if (pose.x !== oldPose.x || pose.z !== oldPose.z || pose.heading !== oldPose.heading) dirty = true;
      car.position.set(pose.x, 0, pose.z);
      car.rotation.y = pose.heading;
      wheels[0].rotation.x += left * MAX_SPEED / WHEEL_RADIUS * dt;
      wheels[1].rotation.x += right * MAX_SPEED / WHEEL_RADIUS * dt;
      // A slight pitch and roll sells acceleration and cornering without a physics engine.
      const ease = 1 - Math.exp(-dt * 6), speed = (left + right) / 2;
      const pitch = -speed * 0.04, roll = -(right - left) * speed * 0.05;
      const settling = Math.abs(car.rotation.x - pitch) + Math.abs(car.rotation.z - roll) > 1e-4;
      car.rotation.x = THREE.MathUtils.lerp(car.rotation.x, pitch, ease);
      car.rotation.z = THREE.MathUtils.lerp(car.rotation.z, roll, ease);

      const last = (trailCount - 1) * 6;
      const endX = (trailPoints[last] + trailPoints[last + 3]) / 2, endZ = (trailPoints[last + 2] + trailPoints[last + 5]) / 2;
      if (!trailCount || Math.hypot(endX - pose.x, endZ - pose.z) > 0.06) {
        if (trailCount === TRAIL) { trailPoints.copyWithin(0, 6); trailCount--; }
        const dx = Math.cos(pose.heading) * TRAIL_WIDTH / 2, dz = -Math.sin(pose.heading) * TRAIL_WIDTH / 2;
        trailPoints.set([pose.x + dx, 0.008, pose.z + dz, pose.x - dx, 0.008, pose.z - dz], trailCount++ * 6);
        for (let i = 0; i < trailCount; i++) {
          trailColor.lerpColors(FLOOR, ACCENT, 0.25 + 0.75 * (i / Math.max(1, trailCount - 1)) ** 1.5).toArray(trailColors, i * 6);
          trailColor.toArray(trailColors, i * 6 + 3);
        }
        trailGeometry.setDrawRange(0, Math.max(0, trailCount - 1) * 6);
        trailGeometry.attributes.position.needsUpdate = trailGeometry.attributes.color.needsUpdate = true;
      }

      const pulse = charging ? 0.5 + 0.5 * Math.sin(now / 110) : 0;
      coilMaterial.emissiveIntensity = energy * 4 + pulse * 2;
      capacitorTop.emissiveIntensity = energy * 4;
      ringMaterial.emissiveIntensity = charging ? 3 + pulse * 4 : energy * 3;
      if (charging) energyRing.rotation.y += dt * 6;

      if (count > firedShots) {
        firedShots = count;
        flash = 1;
        car.updateMatrixWorld();
        const origin = barrel.localToWorld(new THREE.Vector3(0, 0, 0.95));
        const aim = barrel.localToWorld(new THREE.Vector3(0, 0, 2));
        const group = new THREE.Group();
        group.add(new THREE.Mesh(shotGeometry, shotMaterial), new THREE.Mesh(streakGeometry, streakMaterial));
        group.position.copy(origin);
        group.lookAt(aim);
        const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb15c).multiplyScalar(3), transparent: true, side: THREE.DoubleSide }));
        ring.position.copy(origin);
        ring.lookAt(aim);
        scene.add(group, ring);
        shots.push({ group, velocity: aim.sub(origin).normalize().multiplyScalar(SHOT_SPEED), age: 0 });
        blasts.push({ ring, age: 0 });
        barrel.position.z = -0.12;
      }
      const recoiling = Math.abs(barrel.position.z - 0.05) > 1e-3;
      barrel.position.z = THREE.MathUtils.lerp(barrel.position.z, 0.05, 1 - Math.exp(-dt * 10));
      flash = Math.max(firing ? 0.5 : 0, flash - dt * 3);
      muzzle.intensity = flash * 6;
      for (let i = shots.length - 1; i >= 0; i--) {
        const shot = shots[i];
        shot.age += dt;
        shot.velocity.y -= 1.2 * dt;
        shot.group.position.addScaledVector(shot.velocity, dt);
        if (shot.age > SHOT_LIFE || shot.group.position.y < 0.05) { scene.remove(shot.group); shots.splice(i, 1); }
      }
      for (let i = blasts.length - 1; i >= 0; i--) {
        const blast = blasts[i];
        blast.age += dt;
        blast.ring.scale.setScalar(1 + blast.age * 8);
        blast.ring.material.opacity = Math.max(0, 1 - blast.age * 3);
        if (blast.age > 0.35) { scene.remove(blast.ring); blast.ring.material.dispose(); blasts.splice(i, 1); }
      }

      // Carry the camera along with the car while keeping the viewer's orbit and zoom.
      follow.set(viewAll ? 0 : pose.x, 0.6, viewAll ? 0 : pose.z).sub(target);
      target.add(follow);
      camera.position.add(follow);
      controls.target.copy(target);
      const orbiting = controls.update();
      key.position.set(pose.x + 4, 8, pose.z + 3);
      key.target.position.set(pose.x, 0, pose.z);
      rim.position.set(pose.x - 5, 3, pose.z - 6);
      rim.target.position.set(pose.x, 0.5, pose.z);
      const animating = left !== 0 || right !== 0 || charging || firing || flash > 0 || shots.length > 0 || blasts.length > 0;
      if (!visible || !(dirty || animating || settling || recoiling || orbiting || energy !== renderedEnergy)) return;
      // 60 fps is plenty for this view; on 120 Hz displays it halves the GPU work.
      if (now - lastRender < 15) return;
      lastRender = now;
      renderer.render(scene, camera);
      dirty = false;
      renderedEnergy = energy;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
      controls.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const { left, right, charging, firing, energy } = props;
  const state = firing ? "发射" : charging ? "充能中" : energy > 0.99 ? "已充满" : "待命";
  return <div className="car3d-panel" role="group" aria-label={`小车 3D 视图：${motion(left, right)}，电磁炮${state}`}>
    <div ref={host} className="car3d">
    <div className="car3d-hud">
      <span className="car3d-motion">{motion(left, right)}</span>
      <span className="car3d-wheels"><i>L</i>{Math.round(left * 100)}% <i>R</i>{Math.round(right * 100)}%</span>
    </div>
    </div>
    <div className="car3d-controls">
    <div className={`car3d-energy ${firing ? "fire" : charging ? "charge" : ""}`}>
      <span>电磁炮 · {state}</span>
      <div className="bar"><div style={{ width: `${Math.round(energy * 100)}%` }} /></div>
      <b>{Math.round(energy * 100)}%</b>
    </div>
    <div className="car3d-ranging">
      <span>场地 6×4 m · 网格 10 cm · 前方 {props.world ? `${props.world.distance_cm.toFixed(1)} cm` : "—"}</span>
      <label>前进 <input aria-label="前进厘米数" type="number" min="1" max="390" value={distance} onChange={event => setDistance(event.target.value)} /> cm</label>
      <button disabled={!props.world || !Number.isInteger(requestedDistance) || requestedDistance < 1 || requestedDistance > 390} onClick={() => void request("/api/move_forward", { distance_cm: requestedDistance })}>前进</button>
      <button onClick={() => void request("/api/chassis", { action: "emergency_stop" })}>停止</button>
      <button onClick={() => void request("/api/distance")}>测距 / 进度</button>
      <output aria-live="polite">{reading}</output>
    </div>
    <div className="car3d-ranging"><a href="http://127.0.0.1:8081/" target="_blank" rel="noreferrer">方向遥控与运动校准</a></div>
    <div className="car3d-reset"><button className="small" onClick={() => overview.current()}>全场</button><button className="small" onClick={() => reset.current()}>跟车</button></div>
    </div>
  </div>;
}
