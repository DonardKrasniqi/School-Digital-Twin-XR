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
const ambienceBtn = document.getElementById("ambience-btn");
let moveForward = null;
let moveRight = null;

function ensureMovementVectors() {
  if (moveForward || typeof THREE === "undefined") return;
  moveForward = new THREE.Vector3();
  moveRight = new THREE.Vector3();
}

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
const MODEL_URL = "assets/models/school.glb";

function isMobileDevice() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

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

    const pos = this.el.getAttribute("position");
    const { minX, maxX, minZ, maxZ, minY, maxY } = roomLimits;
    let { x, y, z } = pos;
    let changed = false;

    if (x < minX) {
      x = minX;
      changed = true;
    }
    if (x > maxX) {
      x = maxX;
      changed = true;
    }
    if (z < minZ) {
      z = minZ;
      changed = true;
    }
    if (z > maxZ) {
      z = maxZ;
      changed = true;
    }
    if (y < minY) {
      y = minY;
      changed = true;
    }
    if (y > maxY) {
      y = maxY;
      changed = true;
    }

    if (changed) {
      this.el.setAttribute("position", { x, y, z });
    }
  }
});

/* ——— Movement (keyboard + mobile pad) ——— */

const keysDown = new Set();
const mobileMove = { forward: 0, right: 0 };
let movementListenersReady = false;

function getMoveInput() {
  let forward = 0;
  let right = 0;

  if (isMobileDevice()) {
    forward = mobileMove.forward;
    right = mobileMove.right;
  } else {
    if (keysDown.has("w") || keysDown.has("arrowup")) forward += 1;
    if (keysDown.has("s") || keysDown.has("arrowdown")) forward -= 1;
    if (keysDown.has("d") || keysDown.has("arrowright")) right += 1;
    if (keysDown.has("a") || keysDown.has("arrowleft")) right -= 1;
  }

  return { forward, right };
}

function setupMovementListeners() {
  if (movementListenersReady) return;
  movementListenersReady = true;

  window.addEventListener("keydown", (event) => {
    if (!document.body.classList.contains("tour-started")) return;
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      event.preventDefault();
      keysDown.add(key);
    }
  });

  window.addEventListener("keyup", (event) => {
    keysDown.delete(event.key.toLowerCase());
  });

  window.addEventListener("blur", () => keysDown.clear());

  const mobileControls = document.getElementById("mobile-controls");
  if (!mobileControls) return;

  mobileControls.querySelectorAll(".move-btn").forEach((btn) => {
    const dir = btn.dataset.move;

    const press = (e) => {
      e.preventDefault();
      if (dir === "forward") mobileMove.forward = 1;
      if (dir === "back") mobileMove.forward = -1;
      if (dir === "left") mobileMove.right = -1;
      if (dir === "right") mobileMove.right = 1;
      btn.classList.add("is-active");
    };

    const release = () => {
      if (dir === "forward" || dir === "back") mobileMove.forward = 0;
      if (dir === "left" || dir === "right") mobileMove.right = 0;
      btn.classList.remove("is-active");
    };

    btn.addEventListener("pointerdown", press);
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("pointerleave", release);
  });
}

AFRAME.registerComponent("tour-movement", {
  schema: {
    speed: { type: "number", default: 2.4 }
  },

  init: function () {
    setupMovementListeners();
  },

  tick: function (time, timeDelta) {
    if (!document.body.classList.contains("tour-started")) return;
    if (!timeDelta) return;

    const camera = document.getElementById("camera-rig");
    if (!camera) return;

    const { forward, right } = getMoveInput();
    if (!forward && !right) return;

    const dt = Math.min(timeDelta / 1000, 0.05);
    const step = this.data.speed * dt;
    ensureMovementVectors();
    if (!moveForward) return;

    const yaw = camera.object3D.rotation.y;
    moveForward.set(Math.sin(yaw), 0, -Math.cos(yaw));
    moveRight.set(Math.cos(yaw), 0, -Math.sin(yaw));

    const dx = (moveForward.x * forward + moveRight.x * right) * step;
    const dz = (moveForward.z * forward + moveRight.z * right) * step;

    const pos = this.el.getAttribute("position");
    this.el.setAttribute("position", {
      x: pos.x + dx,
      y: pos.y,
      z: pos.z + dz
    });
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

function modelHasGeometry() {
  const root = getCampusMesh();
  if (!root) return false;
  let found = false;
  root.traverse((node) => {
    if (node.isMesh && node.geometry) found = true;
  });
  return found;
}

function setLoadingProgress(percent, message) {
  progress = percent;
  loadingBar.style.width = Math.min(100, percent) + "%";
  if (message) loadingText.textContent = message;
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

function getEyeHeight() {
  if (!campusBounds) return 1.6;
  const { size } = campusBounds;
  return Math.max(1.55, size.y * 0.08);
}

function setPlayerPosition(x, z) {
  resetCameraRotation();
  player.setAttribute("position", { x, y: getEyeHeight(), z });
}

function framePlayerInRoom() {
  if (!campusBounds) {
    player.setAttribute("position", { x: 0, y: 1.6, z: 0 });
    return;
  }
  setPlayerPosition(0, 0);
  if (cameraRig) cameraRig.setAttribute("rotation", "0 0 0");
}

/* ——— Loading ——— */

function isFileProtocol() {
  return window.location.protocol === "file:";
}

function startSlowLoadHint() {
  setTimeout(() => {
    if (!modelReady && progress >= 65) {
      loadingText.textContent = isMobileDevice()
        ? "Still loading on mobile — large 3D file, please wait…"
        : "Still loading classroom model…";
    }
  }, 12000);
}

function startLoadingProgress() {
  loadingInterval = setInterval(() => {
    if (!modelReady && progress < 62) {
      setLoadingProgress(progress + 2, "Starting download… " + progress + "%");
    }
  }, 280);
  startSlowLoadHint();
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
  if (!modelHasGeometry()) return false;
  finishLoading(true);
  return true;
}

let modelBlobUrl = null;

async function downloadModel() {
  setLoadingProgress(5, "Downloading classroom scan…");

  const response = await fetch(MODEL_URL, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error("HTTP " + response.status);
  }

  const total = Number(response.headers.get("content-length")) || 0;
  const reader = response.body?.getReader();

  if (!reader) {
    const blob = await response.blob();
    setLoadingProgress(68, "Download complete — building scene…");
    return blob;
  }

  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) {
      const pct = 5 + Math.round((received / total) * 63);
      setLoadingProgress(pct, "Downloading… " + pct + "%");
    } else if (received % 500000 < value.length) {
      setLoadingProgress(40, "Downloading… (" + Math.round(received / 1e6) + " MB)");
    }
  }

  setLoadingProgress(68, "Download complete — building scene…");
  return new Blob(chunks, { type: "model/gltf-binary" });
}

function attachModelToScene(blob) {
  if (modelBlobUrl) URL.revokeObjectURL(modelBlobUrl);
  modelBlobUrl = URL.createObjectURL(blob);
  schoolScan.setAttribute("gltf-model", modelBlobUrl);
}

function onModelLoadedEvent() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (tryClaimModelLoaded()) {
        setLoadingProgress(100, "Classroom ready.");
      }
    });
  });
}

async function beginModelLoad() {
  try {
    const blob = await downloadModel();
    attachModelToScene(blob);
    setLoadingProgress(72, "Processing 3D model…");

    const poll = setInterval(() => {
      if (tryClaimModelLoaded()) clearInterval(poll);
    }, 250);

    setTimeout(() => clearInterval(poll), 120000);
  } catch (err) {
    console.error("Model download failed", err);
    finishLoading(
      false,
      "Could not download the classroom model. Check your connection and refresh."
    );
  }
}

let desktopPointerLockReady = false;

function applyLookControls() {
  if (!cameraRig) return;

  if (isMobileDevice()) {
    cameraRig.setAttribute("look-controls", {
      pointerLockEnabled: false,
      touchEnabled: true,
      magicWindowTrackingEnabled: true,
      reverseMouseDrag: false
    });
    const cursor = document.getElementById("cursor");
    if (cursor) cursor.setAttribute("visible", "false");
    return;
  }

  cameraRig.setAttribute("look-controls", {
    pointerLockEnabled: true,
    touchEnabled: false,
    magicWindowTrackingEnabled: false,
    reverseMouseDrag: false
  });
  const cursor = document.getElementById("cursor");
  if (cursor) cursor.setAttribute("visible", "false");
}

function requestScenePointerLock() {
  if (isMobileDevice() || !scene?.canvas) return;
  if (document.pointerLockElement === scene.canvas) return;
  scene.canvas.requestPointerLock();
}

function setupDesktopPointerLock() {
  if (desktopPointerLockReady || isMobileDevice()) return;
  desktopPointerLockReady = true;

  const canvas = scene.canvas;
  if (!canvas) return;

  document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === canvas;
    document.body.classList.toggle("pointer-locked", locked);
    if (!locked && document.body.classList.contains("tour-started")) {
      showToast("Mouse released. Click the view to look again. WASD to move.");
    }
  });

  scene.addEventListener("click", (event) => {
    if (!document.body.classList.contains("tour-started")) return;
    if (event.target.closest("a, button, .btn")) return;
    requestScenePointerLock();
  });
}

function startLookControls(gyroGranted) {
  applyLookControls();
  setupDesktopPointerLock();
  const lookControls = cameraRig?.components?.["look-controls"];
  if (lookControls) lookControls.play();

  if (!isMobileDevice()) {
    showToast("Click the view to capture the mouse. Esc releases it. WASD to move.");
    return;
  }

  if (gyroGranted) {
    showToast("Move your phone to look around. Use the pad to walk.");
  } else {
    showToast("Drag with one finger to look, or allow motion access when prompted.");
  }
}

function requestOrientationOnTap() {
  const Orientation = window.DeviceOrientationEvent;
  if (!isMobileDevice() || !Orientation || typeof Orientation.requestPermission !== "function") {
    return Promise.resolve(true);
  }
  return Orientation.requestPermission().then((state) => state === "granted");
}

function applyMobileSceneTuning() {
  applyLookControls();

  if (!isMobileDevice()) return;

  scene.setAttribute("renderer", "antialias: false; colorManagement: true");
  if (scene.renderer) {
    scene.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  }
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

  schoolScan.addEventListener("model-loaded", onModelLoadedEvent);
  schoolScan.addEventListener("model-error", (e) => {
    console.error("school.glb failed", e);
    finishLoading(false, "3D model failed to open on this device. Try Wi‑Fi or a desktop browser.");
  });

  scene.addEventListener("loaded", () => {
    applyMobileSceneTuning();
    beginModelLoad();
  });

  loadTimeoutId = setTimeout(() => {
    if (!modelReady) {
      finishLoading(
        false,
        "Load timed out. On phones use Wi‑Fi, wait longer, or try desktop."
      );
    }
  }, 180000);
}

initLoading();

startTourBtn.addEventListener("click", () => {
  if (!modelReady) return;

  const gyroPromise = requestOrientationOnTap();

  unlockAudio();
  document.body.classList.add("tour-started");
  loadingScreen.style.display = "none";
  setAmbience(true);

  gyroPromise.then((granted) => startLookControls(granted));
});

/* ——— Teleport pads ——— */

function bindTeleportPads() {
  teleportPadsEl.querySelectorAll(".teleport-point").forEach((point) => {
    point.addEventListener("click", () => {
      if (!modelReady || !roomLimits) return;
      const pos = point.object3D.position;
      setPlayerPosition(pos.x, pos.z);
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

/* ——— Compass ——— */

function yawToCompass(degrees) {
  const idx = Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
  return DIRECTIONS[idx];
}

function updateCompass() {
  if (!compassNeedle || !cameraRig) return;
  const yaw = cameraRig.object3D.rotation.y;
  compassNeedle.textContent = yawToCompass(-(yaw * 180) / Math.PI);
}

scene.addEventListener("tick", updateCompass);

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
  if (event.key === "b" || event.key === "B") playEffect("bell-audio");
});

window.addEventListener("load", () => {
  setTimeout(() => {
    const renderer = scene.renderer;
    if (!renderer || isMobileDevice()) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  }, 800);
});
