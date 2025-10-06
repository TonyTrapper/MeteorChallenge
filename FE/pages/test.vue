<template>
  <div class="relative bg-neutral-950 text-neutral-100">
    <section class="relative w-full h-[90vh]">
      <div ref="globeMount" class="absolute inset-0"></div>

      <!-- Overlay -->
      <div class="absolute left-4 top-4 z-20 space-y-3">
        <div class="rounded-xl border border-white/10 bg-black/70 backdrop-blur p-3 w-[340px] max-w-[92vw]">
          <div class="text-xs text-neutral-300 mb-2">
            Impacto: {{ impact.lat.toFixed(2) }}°, {{ impact.lon.toFixed(2) }}
          </div>

          <div class="flex gap-2 flex-wrap">
            <button class="px-3 py-2 rounded-lg border border-emerald-500/40 bg-emerald-600/20 hover:bg-emerald-600/40 text-sm"
                    @click="launchMeteor" :disabled="animActive">
              🚀 Lanzar
            </button>

            <button class="px-3 py-2 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 text-sm"
                    @click="resetSim">
              Reiniciar
            </button>

            <button class="px-3 py-2 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 text-sm"
                    @click="focusImpact(FOCUS_OFFSET_MEDIUM)" :disabled="animActive">
              Centrar (medio)
            </button>
            <button class="px-3 py-2 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 text-sm"
                    @click="focusImpact(FOCUS_OFFSET_CLOSE)" :disabled="animActive">
              Centrar (cerca)
            </button>
          </div>

          <!-- Controles mínimos -->
          <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
            <label class="block">
              <div class="text-neutral-300">Latitud</div>
              <input type="number" v-model.number="impact.lat" min="-90" max="90" step="0.1"
                     class="w-full rounded bg-neutral-900/80 border border-white/10 px-2 py-1"
                     :disabled="animActive"/>
            </label>
            <label class="block">
              <div class="text-neutral-300">Longitud</div>
              <input type="number" v-model.number="impact.lon" min="-180" max="180" step="0.1"
                     class="w-full rounded bg-neutral-900/80 border border-white/10 px-2 py-1"
                     :disabled="animActive"/>
            </label>
            <label class="col-span-2 block">
              <div class="text-neutral-300">Azimut (°): {{ entry.heading_deg }}</div>
              <input type="range" v-model.number="entry.heading_deg" min="0" max="359" step="1"
                     class="w-full accent-emerald-500" :disabled="animActive"/>
            </label>
            <label class="col-span-2 block">
              <div class="text-neutral-300">Distancia entrada (km): {{ entry.distance_km }}</div>
              <input type="range" v-model.number="entry.distance_km" min="1500" max="4500" step="100"
                     class="w-full accent-emerald-500" :disabled="animActive"/>
            </label>
            <label class="col-span-2 block">
              <div class="text-neutral-300">Altitud inicial (unid. mundo): {{ entry.alt_world }}</div>
              <input type="range" v-model.number="entry.alt_world" min="25" max="70" step="1"
                     class="w-full accent-emerald-500" :disabled="animActive"/>
            </label>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, watch } from 'vue'

/* ===== Estado ===== */
const impact   = reactive({ lat: -12.05, lon: -77.05 })
const entry    = reactive({ heading_deg: 60, distance_km: 3000, alt_world: 45 })
const animActive = ref(false)

/* ===== Unidades de MUNDO ===== (Radio Tierra = 100) */
const R_WORLD = 100
const R_EARTH_KM = 6371

/* Cámara (arranque LEJOS) */
const FOCUS_OFFSET_FAR    = 26
const FOCUS_OFFSET_MEDIUM = 16
const FOCUS_OFFSET_CLOSE  = 10
const START_OFFSET        = FOCUS_OFFSET_FAR

/* Meteoro */
const SPAWN_ALT = 35
const APEX_ALT  = 60
const ANIM_DURATION_MS = 5200

/* ===== THREE ===== */
const globeMount = ref<HTMLDivElement|null>(null)
let THREE:any, ThreeGlobe:any
let renderer:any, scene:any, camera:any, controls:any
let globeObj:any, stars:any = null
let impactMarker:any = null
let meteor:any, meteorGlow:any, trailLine:any
let curve:any, animStart=0
let raycaster:any, mouse:any, pickTarget:any

/* ===== Partículas & escombros (sin undefined) ===== */
type ParticleState = {
  count: number
  pos: Float32Array
  vel: Float32Array
  life: Float32Array
  geo: any
  points: any
}
let particles: ParticleState | null = null

type DebrisState = { group: any, pool: any[] }
let debris: DebrisState | null = null

const WHITE_PARTICLE_COUNT = 700
const BROWN_FRAGMENT_COUNT = 140
const shockRings: any[] = []

/* ===== Mount ===== */
onMounted(async () => {
  await nextTick()
  if (!import.meta.client || !globeMount.value) return

  const three = await import('three'); THREE = three
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
  ThreeGlobe = (await import('three-globe')).default

  const el = globeMount.value
  const w = el.clientWidth || window.innerWidth
  const h = el.clientHeight || Math.max(300, window.innerHeight - 64)

  renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(w, h)
  renderer.setClearColor(0x000000, 0)
  el.appendChild(renderer.domElement)

  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(28, w/h, 0.05, 5000)
  camera.position.set(0, 0, R_WORLD + 60)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = false
  controls.enableZoom = true
  controls.zoomSpeed = 1.0
  controls.rotateSpeed = 0.9
  controls.minDistance = 8
  controls.maxDistance = 70

  scene.add(new THREE.AmbientLight(0xffffff, 1.1))
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
  dirLight.position.set(-80, 110, 95)
  scene.add(dirLight)

  // Texturas globo
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin('')
  async function loadFirst(urls:string[]){
    for (const u of urls){ try{ return await new Promise((res,rej)=> loader.load(u,res,undefined,rej)) } catch{} }
    return null
  }
  const colorTex = await loadFirst([
    'https://cdn.jsdelivr.net/npm/three-globe@2.30.0/example/img/earth-dark.jpg',
    'https://unpkg.com/three-globe@2.30.0/example/img/earth-dark.jpg',
    '/earth.jpg'
  ])
  const bumpTex  = await loadFirst([
    'https://cdn.jsdelivr.net/npm/three-globe@2.30.0/example/img/earth-topology.png',
    'https://unpkg.com/three-globe@2.30.0/example/img/earth-topology.png',
    '/earth-topology.png'
  ])

  globeObj = new ThreeGlobe()
  globeObj.globeMaterial(
    colorTex
      ? new THREE.MeshPhongMaterial({ map: colorTex, bumpMap: bumpTex || null, bumpScale: bumpTex ? 0.35 : 0 })
      : new THREE.MeshPhongMaterial({ color: 0x0a0a0a })
  )
  scene.add(globeObj)

  buildStars()

  // Picking: esfera invisible de radio = R_WORLD
  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()
  pickTarget = new THREE.Mesh(
    new THREE.SphereGeometry(R_WORLD, 64, 64),
    new THREE.MeshBasicMaterial({ visible:false, depthWrite:false, depthTest:false })
  )
  scene.add(pickTarget)

  el.addEventListener('click', (ev:MouseEvent)=>{
    if (animActive.value) return
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect()
    mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(mouse, camera)
    const hit = raycaster.intersectObject(pickTarget, false)[0]
    if (!hit) return
    const p = hit.point.clone()
    const r = p.length()
    const lat = Math.asin(p.y / r) * 180 / Math.PI
    const lon = Math.atan2(p.z, p.x) * 180 / Math.PI
    impact.lat = lat
    impact.lon = ((lon + 540) % 360) - 180
    showImpactMarker()
  })

  /* ===== Partículas blancas ===== */
  {
    const count = WHITE_PARTICLE_COUNT
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    const life = new Float32Array(count)
    for (let i=0;i<count;i++) life[i] = -1

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({ size: 0.28, color: 0xffffff, transparent:true, opacity:0.95 })
    const points = new THREE.Points(geo, mat)
    scene.add(points)

    particles = { count, pos, vel, life, geo, points }
  }

  /* ===== Fragmentos marrones ===== */
  {
    const group = new THREE.Group(); scene.add(group)
    const pool:any[] = []
    for (let i=0;i<BROWN_FRAGMENT_COUNT;i++){
      const g = new THREE.BoxGeometry(0.35 + Math.random()*0.25, 0.22 + Math.random()*0.18, 0.22 + Math.random()*0.18)
      const m = new THREE.MeshStandardMaterial({ color: 0x8b5a3c, metalness: 0.12, roughness: 0.7 })
      const mesh = new THREE.Mesh(g,m); mesh.visible=false; mesh.userData={vel:new THREE.Vector3(), life:0}
      group.add(mesh); pool.push(mesh)
    }
    debris = { group, pool }
  }

  // Arranque lejos del punto de impacto
  focusImpact(START_OFFSET)

  window.addEventListener('resize', onResize)
  animate()
})

/* ===== Cámara ===== */
function focusImpact(surfaceOffset:number){
  if (!camera || !controls) return
  const p = latLonToVec3World(impact.lat, impact.lon, R_WORLD)
  controls.target.copy(p)
  const minOff = (controls.minDistance ?? 1) + 0.001
  const maxOff = (controls.maxDistance ?? 100) - 0.001
  const offset = Math.min(maxOff, Math.max(minOff, surfaceOffset))
  const dir = p.clone().normalize()
  camera.position.copy(p.clone().add(dir.multiplyScalar(offset)))
  controls.update()
}

/* ===== Resize & Loop ===== */
function onResize(){
  const el = globeMount.value; if(!el || !renderer || !camera) return
  const w = el.clientWidth || window.innerWidth
  const h = el.clientHeight || Math.max(300, window.innerHeight - 64)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

let prevTime = performance.now()
function animate(){
  requestAnimationFrame(animate)

  const now = performance.now()
  const dt = Math.min(0.05, (now - prevTime) / 1000)
  prevTime = now

  // meteoro
  if (animActive.value && curve && meteor){
    const t = Math.min(1, (now-animStart)/ANIM_DURATION_MS)
    const pos = curve.getPoint(t)
    meteor.position.copy(pos)
    updateTrail(curve, t)
    if (meteorGlow) meteorGlow.position.copy(pos)
    if (t >= 1){ animActive.value = false; explode() }
  }

  // partículas blancas
  if (particles){
    const { count, pos, vel, life, geo } = particles
    for (let i=0;i<count;i++){
      if (life[i] > 0){
        const idx = 3*i
        pos[idx]   += vel[idx]   * dt
        pos[idx+1] += vel[idx+1] * dt
        pos[idx+2] += vel[idx+2] * dt
        vel[idx+1] -= 1.8 * dt
        vel[idx  ] *= 0.995; vel[idx+1]*=0.995; vel[idx+2]*=0.995
        life[i] -= dt
        if (life[i] <= 0){
          pos[idx]=pos[idx+1]=pos[idx+2]=0
        }
      }
    }
    geo.attributes.position.needsUpdate = true
  }

  // fragmentos
  if (debris){
    debris.pool.forEach(b=>{
      if (!b.visible) return
      b.userData.life += dt
      b.userData.vel.y -= 2.0 * dt
      b.position.addScaledVector(b.userData.vel, dt)
      b.rotation.x += b.userData.vel.x * dt * 0.25
      b.rotation.y += b.userData.vel.z * dt * 0.25
      if (b.userData.life > 3.7) b.visible = false
    })
  }

  // anillos
  for (let i = shockRings.length - 1; i >= 0; i--){
    const r = shockRings[i]
    r.userData.life += dt
    r.scale.setScalar(r.userData.base + r.userData.speed * r.userData.life)
    r.material.opacity = Math.max(0, 0.95 - r.userData.life * 0.9)
    if (r.userData.life > 1.8){ scene.remove(r); shockRings.splice(i,1) }
  }

  controls?.update?.()
  renderer?.render?.(scene, camera)
}

/* ===== Estrellas ===== */
function buildStars(){
  if (stars) return
  const geom = new THREE.SphereGeometry(R_WORLD * 30, 64, 64)
  const mat = new THREE.MeshBasicMaterial({
    map: new THREE.TextureLoader().load('https://unpkg.com/three-globe@2.30.0/example/img/night-sky.png'),
    side: THREE.BackSide, transparent:true, opacity:0.55
  })
  stars = new THREE.Mesh(geom, mat)
  scene.add(stars)
}

/* ===== Utilidades ===== */
function latLonToVec3World(lat:number, lon:number, radius=R_WORLD){
  const φ = lat * Math.PI / 180, λ = lon * Math.PI / 180
  const cosφ = Math.cos(φ), sinφ = Math.sin(φ)
  const cosλ = Math.cos(λ), sinλ = Math.sin(λ)
  const x = radius * cosφ * cosλ
  const y = radius * sinφ
  const z = radius * cosφ * sinλ
  return new (THREE as any).Vector3(x, y, z)
}
function movePoint(latDeg:number, lonDeg:number, bearingDeg:number, distKm:number){
  const φ1 = latDeg*Math.PI/180, λ1 = lonDeg*Math.PI/180, θ = bearingDeg*Math.PI/180
  const δ = distKm / R_EARTH_KM
  const sinφ1=Math.sin(φ1), cosφ1=Math.cos(φ1), sinδ=Math.sin(δ), cosδ=Math.cos(δ)
  const sinφ2 = sinφ1*cosδ + cosφ1*sinδ*Math.cos(θ)
  const φ2 = Math.asin(Math.min(1, Math.max(-1, sinφ2)))
  const y = Math.sin(θ)*sinδ*cosφ1
  const x = cosδ - sinφ1*sinφ2
  const λ2 = λ1 + Math.atan2(y,x)
  return { lat: φ2*180/Math.PI, lon: (((λ2*180/Math.PI + 540)%360)-180) }
}

/* ===== Marcador (Sprite) ===== */
function showImpactMarker(){
  if (!THREE) return
  if (!impactMarker){
    const mat = new (THREE as any).SpriteMaterial({
      color: 0x72f5a1, transparent: true, opacity: 0.95,
      depthWrite:false, blending:(THREE as any).AdditiveBlending
    })
    impactMarker = new (THREE as any).Sprite(mat)
    impactMarker.scale.setScalar(2)
    scene.add(impactMarker)
  }
  impactMarker.position.copy(latLonToVec3World(impact.lat, impact.lon, R_WORLD + 0.2))
}

/* ===== Curva meteoro (MUNDO) ===== */
function makeCurve(){
  const groundKm = Math.max(1500, Math.min(4500, entry.distance_km))
  const start = movePoint(impact.lat, impact.lon, (entry.heading_deg+180)%360, groundKm)
  const p0 = latLonToVec3World(start.lat, start.lon, R_WORLD + SPAWN_ALT)
  const p1 = latLonToVec3World(impact.lat, impact.lon, R_WORLD)
  const mid = movePoint(impact.lat, impact.lon, (entry.heading_deg+180)%360, groundKm*0.5)
  const pMid = latLonToVec3World(mid.lat, mid.lon, R_WORLD + APEX_ALT)
  return new (THREE as any).QuadraticBezierCurve3(p0, pMid, p1)
}
function createMeteor(){
  const geom = new (THREE as any).SphereGeometry(1.2, 16, 16)
  const mat = new (THREE as any).MeshStandardMaterial({ color:0xff8a2a, emissive:0xff5a00, emissiveIntensity:0.9 })
  meteor = new (THREE as any).Mesh(geom, mat); scene.add(meteor)

  const pts = new Array(50).fill(0).map(()=>new (THREE as any).Vector3())
  const geo = new (THREE as any).BufferGeometry().setFromPoints(pts)
  const matLine = new (THREE as any).LineBasicMaterial({ color:0xffc266, transparent:true, opacity:0.9 })
  trailLine = new (THREE as any).Line(geo, matLine); scene.add(trailLine)

  const g2 = new (THREE as any).SphereGeometry(2.0, 16, 16)
  const m2 = new (THREE as any).MeshBasicMaterial({
    color:0xffcc66, transparent:true, opacity:0.35, depthWrite:false,
    blending:(THREE as any).AdditiveBlending
  })
  meteorGlow = new (THREE as any).Mesh(g2, m2); scene.add(meteorGlow)
}
function updateTrail(curve:any, t:number){
  if (!trailLine) return
  const N = 50
  const positions = (trailLine.geometry as any).attributes.position.array as Float32Array
  for (let i=0;i<N;i++){
    const tt = Math.max(0, t - (N-i)/(N*1.5))
    const p = curve.getPoint(tt)
    positions[i*3+0]=p.x; positions[i*3+1]=p.y; positions[i*3+2]=p.z
  }
  trailLine.geometry.attributes.position.needsUpdate = true
}
function clearMeteor(){
  ;[meteor, meteorGlow, trailLine].forEach(obj=>{
    if (obj){ scene.remove(obj); obj.geometry?.dispose?.(); obj.material?.dispose?.() }
  })
  meteor = meteorGlow = trailLine = null
}

/* ===== Choque (partículas + anillos) ===== */
function spawnShockRings(origin:any, normal:any, count=6){
  const ringGeo = new (THREE as any).RingGeometry(0.06, 0.21, 96)
  for (let i=0;i<count;i++){
    const mat = new (THREE as any).MeshBasicMaterial({
      color: 0xffd8b0, side: (THREE as any).DoubleSide, transparent:true, opacity:0.95,
      blending:(THREE as any).AdditiveBlending, depthWrite:false
    })
    const ring = new (THREE as any).Mesh(ringGeo, mat)
    ring.position.copy(origin)
    const q = new (THREE as any).Quaternion().setFromUnitVectors(
      new (THREE as any).Vector3(0,0,1), normal.clone().normalize()
    )
    ring.quaternion.copy(q)
    ring.userData = { life:0, speed: 2.2 + i*0.85, base: 0.35 }
    scene.add(ring); shockRings.push(ring)
  }
}
function emitDebris(origin:any, normal:any, intensity=1.0){
  if (particles){
    const { count, pos, vel, life } = particles
    for (let i=0;i<count;i++){
      if (life[i] <= 0 && Math.random() < 0.012 * intensity){
        life[i] = 1.5 + Math.random()*1.4
        const theta = Math.random()*Math.PI*2
        const phi = Math.acos(2*Math.random()-1)
        const r = 0.5 + Math.random()*1.2
        const x = Math.sin(phi)*Math.cos(theta)*r
        const y = Math.sin(phi)*Math.sin(theta)*r
        const z = Math.cos(phi)*r
        const idx = 3*i
        pos[idx]   = origin.x + x
        pos[idx+1] = origin.y + y
        pos[idx+2] = origin.z + z
        const v = normal.clone().multiplyScalar(2.0 + Math.random()*2.4)
          .add(new (THREE as any).Vector3(x,y,z).multiplyScalar(0.6))
        vel[idx]=v.x; vel[idx+1]=v.y; vel[idx+2]=v.z
      }
    }
  }
  if (debris){
    debris.pool.forEach(b=>{
      if (!b.visible && Math.random() < 0.06*intensity){
        b.visible = true
        b.position.copy(origin).add(new (THREE as any).Vector3(
          (Math.random()*2-1)*0.4, (Math.random()*2-1)*0.4, (Math.random()*2-1)*0.4))
        const forward = normal.clone().multiplyScalar(1).add(new (THREE as any).Vector3(
          (Math.random()*2-1)*0.4, (Math.random()*2-1)*0.3, (Math.random()*2-1)*0.4
        )).normalize()
        const speed = 3.0 + Math.random()*4.0
        b.userData.vel.copy(forward.multiplyScalar(speed)); b.userData.life = 0
      }
    })
  }
}
function explode(){
  const pos   = latLonToVec3World(impact.lat, impact.lon, R_WORLD + 0.2)
  const normal= pos.clone().normalize()
  // flash
  const mat = new (THREE as any).SpriteMaterial({
    color: 0xfff1a1, transparent:true, opacity:0.95,
    depthWrite:false, blending:(THREE as any).AdditiveBlending
  })
  const flash = new (THREE as any).Sprite(mat)
  flash.scale.setScalar(5)
  flash.position.copy(pos); scene.add(flash)
  const t0 = performance.now(), life = 420
  const tick = ()=>{
    const t = (performance.now()-t0)/life
    if (t>=1){ scene.remove(flash); (flash.material as any).dispose?.(); return }
    flash.scale.setScalar(3 + 6*t)
    ;(flash.material as any).opacity = 0.95*(1-t)
    requestAnimationFrame(tick)
  }
  tick()

  emitDebris(pos, normal, 1.4)
  spawnShockRings(pos, normal, 7)

  setTimeout(()=> clearMeteor(), 300)
}

/* ===== Animación meteoro ===== */
function startSimulation(){
  clearMeteor()
  curve = makeCurve()
  createMeteor()
  const p0 = curve.getPoint(0)
  meteor.position.copy(p0)
  meteorGlow.position.copy(p0)
  updateTrail(curve, 0)
  animActive.value = true
  animStart = performance.now()
}

/* ===== UI ===== */
function launchMeteor(){
  if (animActive.value) return
  startSimulation()
}
function resetSim(){
  animActive.value = false
  clearMeteor()
  showImpactMarker()
  // Limpia choque
  if (particles){
    for (let i=0;i<particles.count;i++) particles.life[i] = -1
    particles.geo.attributes.position.needsUpdate = true
  }
  if (debris){
    debris.pool.forEach(b=>{ b.visible=false; b.userData?.vel?.set(0,0,0); b.userData && (b.userData.life=0) })
  }
  if (shockRings.length){
    shockRings.forEach(r=> scene.remove(r))
    shockRings.length = 0
  }
  focusImpact(START_OFFSET)
}

/* ===== Watch ===== */
watch(() => [impact.lat, impact.lon], () => {
  if (impactMarker) showImpactMarker()
})
</script>
