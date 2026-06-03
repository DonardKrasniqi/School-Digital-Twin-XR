/* School Digital Twin — single classroom tour */

const loadingScreen = document.getElementById("loading-screen");
const loadingBar = document.getElementById("loading-bar");
const loadingText = document.getElementById("loading-text");
const startTourBtn = document.getElementById("start-tour");
const scene = document.getElementById("scene");
const player = document.getElementById("player");
const cameraRig = document.getElementById("camera-rig");
const schoolScan = document.getElementById("school-scan");
const helperFloor = document.getElementById("helper-floor");
const roomWallsEl = document.getElementById("room-walls");
const teleportPadsEl = document.getElementById("teleport-pads");
const ambienceAudio = document.getElementById("hallway-audio");
const infoPanel = document.getElementById("info-panel");
const toastEl = document.getElementById("toast");
const compassNeedle = document.getElementById("compass-needle");
const minimapCanvas = document.getElementById("minimap");
const minimapCtx = minimapCanvas.getContext("2d");
const ambienceBtn = document.getElementById("ambience-btn");

let ambienceOn = true;
let modelReady = false;
let progress = 0;
let loadingInterval = null;
let loadTimeoutId = null;
let toastTimeout = null;
let campusBounds = null;
let roomLimits = null;
let teleportPoints = [];

const DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const MAP_SCALE = 5;
const MAP_CENTER = 70;

/* ——— Room wall collision (keeps player inside scan bounds) ——— */

AFRAME.registerComponent("room-bounds", {
  schema: {
    padding: { type: "number", default: 0.45 },
    minX: { default: -3 },
    maxX: { default: 3 },
    minZ: { default: -3 },
    maxZ: { default: 3 },
    minY: { default: 0.9 },
    maxY: { default: 3.5 }
  },

  tick: function () {
    if (!roomLimits) return;

    const rig = document.getElementById("camera-rig");
    if (rig) {
      const rigPos = rig.object3D.position;
      if (rigPos.lengthSq() > 0.0001) {
        const worldPos = new THREE.Vector3();
        rig.object3D.getWorldPosition(worldPos);
        this.el.object3D.position.copy(worldPos);
        rig.object3D.position.set(0, 0, 0);
        rig.setAttribute("position", "0 0 0");
      }
    }

    const pos = this.el.object3D.position;
    const { minX, maxX, minZ, maxZ, minY, maxY } = roomLimits;

    if (pos.x < minX) pos.x = minX;
    if (pos.x > maxX) pos.x = maxX;
    if (pos.z < minZ) pos.z = minZ;
    if (pos.z > maxZ) pos.z = maxZ;
    if (pos.y < minY) pos.y = minY;
    if (pos.y > maxY) pos.y = maxY;
  }
});

/* ——— UI ——— */

function showToast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.hidden = true;
  }, 2800);
}

function playEffect(audioId) {
  const el = document.getElementById(audioId);
  if (!el) return;
  el.currentTime = 0;
  el.play().catch(() => showToast("Click Enter classroom first, then try again."));
}

function setAmbience(on) {
  ambienceOn = on;
  ambienceBtn.textContent = on ? "Hallway sound: On" : "Hallway sound: Off";
  if (!ambienceAudio) return;

  ambienceAudio.loop = true;
  ambienceAudio.volume = 0.4;

  if (on) {
    ambienceAudio.play().catch(() => {
      showToast("Click Enter classroom to enable hallway sound.");
    });
  } else {
    ambienceAudio.pause();
  }
}

function unlockAudio() {
  [ambienceAudio, document.getElementById("bell-audio")].forEach((a) => {
    if (!a) return;
    a.play()
      .then(() => {
        a.pause();
        a.currentTime = 0;
      })
      .catch(() => {});
  });
}

function resetCameraRotation() {
  if (!cameraRig) return;
  cameraRig.setAttribute("position", "0 0 0");
  cameraRig.setAttribute("rotation", "0 0 0");
  cameraRig.object3D.rotation.set(0, 0, 0);
}

/* ——— Room layout from scanned model ——— */

function getCampusMesh() {
  return schoolScan.getObject3D("mesh");
}

function alignCampusToFloor() {
  const mesh = getCampusMesh();
  if (!mesh || typeof THREE === "undefined") return null;

  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  if (size.length() < 0.01) return null;

  schoolScan.object3D.position.x -= center.x;
  schoolScan.object3D.position.z -= center.z;
  schoolScan.object3D.position.y -= box.min.y;

  const aligned = new THREE.Box3().setFromObject(schoolScan.object3D);
  campusBounds = {
    size: aligned.getSize(new THREE.Vector3()),
    center: aligned.getCenter(new THREE.Vector3())
  };
  return campusBounds;
}

function applyRoomLimits() {
  if (!campusBounds) return;

  const pad = 0.55;
  const { size } = campusBounds;
  const halfX = size.x / 2 - pad;
  const halfZ = size.z / 2 - pad;

  roomLimits = {
    minX: -halfX,
    maxX: halfX,
    minZ: -halfZ,
    maxZ: halfZ,
    minY: 0.9,
    maxY: Math.max(size.y - 0.25, 2.2)
  };

  player.setAttribute("room-bounds", {
    padding: pad,
    minX: roomLimits.minX,
    maxX: roomLimits.maxX,
    minZ: roomLimits.minZ,
    maxZ: roomLimits.maxZ,
    minY: roomLimits.minY,
    maxY: roomLimits.maxY
  });

  buildInvisibleWalls();
  layoutHelperFloor();
  layoutTeleportPads();
}

function buildInvisibleWalls() {
  roomWallsEl.innerHTML = "";
  if (!roomLimits || !campusBounds) return;

  const { minX, maxX, minZ, maxZ } = roomLimits;
  const height = campusBounds.size.y;
  const thick = 0.12;
  const midY = height / 2;

  const walls = [
    { pos: `${(minX + maxX) / 2} ${midY} ${minZ}`, size: `${maxX - minX + thick} ${height} ${thick}` },
    { pos: `${(minX + maxX) / 2} ${midY} ${maxZ}`, size: `${maxX - minX + thick} ${height} ${thick}` },
    { pos: `${minX} ${midY} ${(minZ + maxZ) / 2}`, size: `${thick} ${height} ${maxZ - minZ + thick}` },
    { pos: `${maxX} ${midY} ${(minZ + maxZ) / 2}`, size: `${thick} ${height} ${maxZ - minZ + thick}` }
  ];

  walls.forEach((w) => {
    const [width, wallHeight, depth] = w.size.split(" ").map(Number);
    const box = document.createElement("a-box");
    box.setAttribute("position", w.pos);
    box.setAttribute("width", width);
    box.setAttribute("height", wallHeight);
    box.setAttribute("depth", depth);
    box.setAttribute("visible", "false");
    box.setAttribute("class", "room-wall");
    roomWallsEl.appendChild(box);
  });
}

function layoutHelperFloor() {
  if (!campusBounds || !helperFloor) return;
  const { size } = campusBounds;
  helperFloor.setAttribute("width", size.x);
  helperFloor.setAttribute("height", size.z);
}

function layoutTeleportPads() {
  teleportPadsEl.innerHTML = "";
  teleportPoints = [];
  if (!roomLimits) return;

  const { minX, maxX, minZ, maxZ } = roomLimits;
  const spots = [
    { x: 0, z: 0 },
    { x: (minX + maxX) * 0.25, z: (minZ + maxZ) * 0.25 },
    { x: (minX + maxX) * 0.25, z: (minZ + maxZ) * 0.75 },
    { x: (minX + maxX) * 0.75, z: (minZ + maxZ) * 0.5 }
  ];

  spots.forEach((spot) => {
    teleportPoints.push(spot);
    const pad = document.createElement("a-cylinder");
    pad.setAttribute("class", "teleport-point");
    pad.setAttribute("position", `${spot.x} 0.05 ${spot.z}`);
    pad.setAttribute("radius", "0.35");
    pad.setAttribute("height", "0.04");
    pad.setAttribute("color", "#0066ff");
    pad.setAttribute("opacity", "0.85");
    teleportPadsEl.appendChild(pad);
  });

  bindTeleportPads();
}

function framePlayerInRoom() {
  if (!campusBounds) {
    player.setAttribute("position", { x: 0, y: 1.6, z: 0 });
    return;
  }
  const { size } = campusBounds;
  const eye = Math.max(1.5, size.y * 0.08);
  player.setAttribute("position", { x: 0, y: eye, z: 0 });
  if (cameraRig) cameraRig.setAttribute("rotation", "0 0 0");
}

/* ——— Loading ——— */

function isFileProtocol() {
  return window.location.protocol === "file:";
}

function startLoadingProgress() {
  loadingInterval = setInterval(() => {
    if (!modelReady && progress < 85) {
      progress += 3;
      loadingBar.style.width = progress + "%";
      loadingText.textContent = "Loading classroom model… " + progress + "%";
    }
  }, 220);
}

function finishLoading(success, detail) {
  if (modelReady && success) return;
  clearInterval(loadingInterval);
  clearTimeout(loadTimeoutId);
  loadingBar.style.width = "100%";

  if (success) {
    modelReady = true;
    alignCampusToFloor();
    applyRoomLimits();
    framePlayerInRoom();

    loadingScreen.classList.add("is-ready");
    loadingText.textContent = "Classroom ready — click Enter classroom.";
    startTourBtn.hidden = false;
    startTourBtn.disabled = false;
    scene.setAttribute("vr-mode-ui", "enabled", true);
  } else {
    loadingText.textContent = detail || "Could not load assets/models/school.glb";
    startTourBtn.hidden = true;
  }
}

function tryClaimModelLoaded() {
  if (modelReady) return true;
  const mesh = getCampusMesh();
  if (!mesh || !mesh.children.length) return false;
  finishLoading(true);
  return true;
}

function initLoading() {
  if (isFileProtocol()) {
    finishLoading(
      false,
      "Cannot load 3D from disk. Run npm start and open the http://localhost URL."
    );
    return;
  }

  startLoadingProgress();

  schoolScan.addEventListener("model-loaded", () => {
    requestAnimationFrame(() => requestAnimationFrame(() => tryClaimModelLoaded()));
  });

  schoolScan.addEventListener("model-error", (e) => {
    console.error("school.glb failed", e);
    finishLoading(false);
  });

  scene.addEventListener("loaded", () => {
    const poll = setInterval(() => {
      if (tryClaimModelLoaded()) clearInterval(poll);
    }, 200);
    setTimeout(() => clearInterval(poll), 60000);
  });

  loadTimeoutId = setTimeout(() => {
    if (!modelReady) {
      finishLoading(false, "Load timed out — use npm start and check assets/models/school.glb");
    }
  }, 90000);
}

initLoading();

startTourBtn.addEventListener("click", () => {
  if (!modelReady) return;
  unlockAudio();
  document.body.classList.add("tour-started");
  loadingScreen.style.display = "none";
  setAmbience(true);
});

/* ——— Teleport pads ——— */

function bindTeleportPads() {
  teleportPadsEl.querySelectorAll(".teleport-point").forEach((point) => {
    point.addEventListener("click", () => {
      if (!modelReady || !roomLimits) return;
      const pos = point.getAttribute("position");
      resetCameraRotation();
      const eye = Math.max(roomLimits.minY, campusBounds.size.y * 0.08);
      player.setAttribute("position", { x: pos.x, y: eye, z: pos.z });
    });

    point.addEventListener("mouseenter", () => {
      point.setAttribute("color", "#00ccff");
      point.setAttribute("scale", "1.12 1.12 1.12");
    });
    point.addEventListener("mouseleave", () => {
      point.setAttribute("color", "#0066ff");
      point.setAttribute("scale", "1 1 1");
    });
  });
}

/* ——— Minimap + compass ——— */

function yawToCompass(degrees) {
  const idx = Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
  return DIRECTIONS[idx];
}

function drawMinimap() {
  if (!player || !minimapCtx) return;
  const w = minimapCanvas.width;
  const h = minimapCanvas.height;
  const pos = player.object3D.position;

  minimapCtx.fillStyle = "rgba(15, 23, 42, 0.92)";
  minimapCtx.fillRect(0, 0, w, h);

  if (roomLimits) {
    const x1 = MAP_CENTER + roomLimits.minX * MAP_SCALE;
    const y1 = MAP_CENTER + roomLimits.minZ * MAP_SCALE;
    const x2 = MAP_CENTER + roomLimits.maxX * MAP_SCALE;
    const y2 = MAP_CENTER + roomLimits.maxZ * MAP_SCALE;
    minimapCtx.strokeStyle = "#38bdf8";
    minimapCtx.lineWidth = 2;
    minimapCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }

  teleportPoints.forEach((p) => {
    minimapCtx.beginPath();
    minimapCtx.fillStyle = "#0066ff";
    minimapCtx.arc(MAP_CENTER + p.x * MAP_SCALE, MAP_CENTER + p.z * MAP_SCALE, 3, 0, Math.PI * 2);
    minimapCtx.fill();
  });

  const px = MAP_CENTER + pos.x * MAP_SCALE;
  const py = MAP_CENTER + pos.z * MAP_SCALE;
  const yaw = cameraRig ? cameraRig.object3D.rotation.y : player.object3D.rotation.y;

  minimapCtx.beginPath();
  minimapCtx.fillStyle = "#22c55e";
  minimapCtx.arc(px, py, 5, 0, Math.PI * 2);
  minimapCtx.fill();

  minimapCtx.strokeStyle = "#fbbf24";
  minimapCtx.lineWidth = 2;
  minimapCtx.beginPath();
  minimapCtx.moveTo(px, py);
  minimapCtx.lineTo(px + Math.sin(yaw) * 14, py + Math.cos(yaw) * 14);
  minimapCtx.stroke();

  compassNeedle.textContent = yawToCompass(-(yaw * 180) / Math.PI);
}

scene.addEventListener("tick", drawMinimap);

/* ——— Panel buttons ——— */

document.getElementById("bell-btn").addEventListener("click", () => playEffect("bell-audio"));

ambienceBtn.addEventListener("click", () => {
  ambienceOn = !ambienceOn;
  setAmbience(ambienceOn);
  showToast(ambienceOn ? "Hallway sound on." : "Hallway sound off.");
});

document.getElementById("close-info").addEventListener("click", () => {
  infoPanel.style.display = "none";
});

window.addEventListener("keydown", (event) => {
  if (event.key === "m" || event.key === "M") {
    document.getElementById("hud").classList.toggle("hud-hidden");
  }
  if (event.key === "b" || event.key === "B") playEffect("bell-audio");
});

window.addEventListener("load", () => {
  setTimeout(() => {
    const renderer = scene.renderer;
    if (!renderer) return;
    renderer.setPixelRatio(
      window.innerWidth < 768 ? 0.8 : Math.min(window.devicePixelRatio, 1.5)
    );
  }, 800);
});
