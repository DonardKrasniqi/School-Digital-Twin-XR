/* School Digital Twin — single classroom tour */

const loadingScreen = document.getElementById("loading-screen");
const loadingBar = document.getElementById("loading-bar");
const loadingText = document.getElementById("loading-text");
const scene = document.getElementById("scene");
const player = document.getElementById("player");
const cameraRig = document.getElementById("camera-rig");
const schoolScan = document.getElementById("school-scan");
const helperFloor = document.getElementById("helper-floor");
const roomWallsEl = document.getElementById("room-walls");
const teleportPadsEl = document.getElementById("teleport-pads");
const infoPanel = document.getElementById("info-panel");
const toastEl = document.getElementById("toast");
const compassNeedle = document.getElementById("compass-needle");
const ambienceAudio = document.getElementById("hallway-audio");
let moveForward = null;
let moveRight = null;
let worldUp = null;

function ensureMovementVectors() {
  if (moveForward || typeof THREE === "undefined") return;
  moveForward = new THREE.Vector3();
  moveRight = new THREE.Vector3();
  worldUp = new THREE.Vector3(0, 1, 0);
}

/** Horizontal walk basis from the real Three.js camera (matches where you look). */
function fillHorizontalCameraBasis(cameraRigEl) {
  const threeCam = cameraRigEl?.components?.camera?.camera;
  if (threeCam) {
    threeCam.getWorldDirection(moveForward);
    moveForward.y = 0;
    if (moveForward.lengthSq() >= 1e-10) {
      moveForward.normalize();
      moveRight.crossVectors(moveForward, worldUp).normalize();
      return true;
    }
  }

  const lookControls = cameraRigEl?.components?.["look-controls"];
  if (lookControls?.yawObject) {
    const yaw =
      lookControls.yawObject.rotation.y + (lookControls.magicWindowDeltaEuler?.y || 0);
    moveForward.set(Math.sin(yaw), 0, -Math.cos(yaw));
    moveRight.set(Math.cos(yaw), 0, -Math.sin(yaw));
    return true;
  }

  const yaw = cameraRigEl.object3D.rotation.y;
  moveForward.set(Math.sin(yaw), 0, -Math.cos(yaw));
  moveRight.set(Math.cos(yaw), 0, -Math.sin(yaw));
  return true;
}

function onTourMovementTick(time, timeDelta, speed) {
  if (!document.body.classList.contains("tour-started")) return;
  if (!timeDelta || !player || !cameraRig) return;

  const { forward, right } = getMoveInput();
  if (!forward && !right) return;

  ensureMovementVectors();
  if (!fillHorizontalCameraBasis(cameraRig)) return;

  const dt = Math.min(timeDelta / 1000, 0.05);
  const step = (speed || 2.4) * dt;

  const dx = (moveForward.x * forward + moveRight.x * right) * step;
  const dz = (moveForward.z * forward + moveRight.z * right) * step;

  const pos = player.getAttribute("position");
  player.setAttribute("position", {
    x: pos.x + dx,
    y: pos.y,
    z: pos.z + dz
  });
}

const DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const MODEL_URL = "assets/models/school.glb";

/**
 * Classroom video URL — direct MP4/WebM file only (not Instagram/YouTube page links).
 * Local:  "assets/video/classroom.mp4"  (run `npm start`, open http://localhost:3000)
 * Remote: "https://example.com/video.mp4"  (server must allow cross-origin access)
 * Leave empty ("") for a black placeholder screen.
 */
const CLASSROOM_VIDEO_URL = "assets/video/classroom.mp4";

const VIDEO_SCREEN_MAX_WIDTH = 2.4;
const VIDEO_SCREEN_Y = 1.65;
const VIDEO_SEEK_STEP = 10;
const VIDEO_PAGE_HOSTS =
  /(?:^|\.)instagram\.com|(?:^|\.)youtube\.com|(?:^|\.)youtu\.be|(?:^|\.)tiktok\.com|(?:^|\.)facebook\.com|(?:^|\.)twitter\.com|(?:^|\.)x\.com/i;

let videoPlaying = false;
let videoMuted = false;
let videoVisible = true;
let videoWasPlayingBeforeHide = false;
let classroomVideoEl = null;
let classroomVideoScreen = null;
let videoScreenSize = { width: VIDEO_SCREEN_MAX_WIDTH, height: (VIDEO_SCREEN_MAX_WIDTH * 9) / 16 };
let videoReady = !CLASSROOM_VIDEO_URL;
let modelReady = false;
let progress = 0;
let loadingInterval = null;
let loadTimeoutId = null;
let toastTimeout = null;
let campusBounds = null;
let roomLimits = null;
let teleportPoints = [];

function isMobileDevice() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/* ——— Video texture (keeps frames updating on the 3D screen while playing) ——— */

AFRAME.registerComponent("video-texture", {
  tick: function () {
    const map = this.el.getObject3D("mesh")?.material?.map;
    if (map) map.needsUpdate = true;
  }
});

/* ——— Billboard (screen always faces the user, position stays fixed) ——— */

AFRAME.registerComponent("billboard", {
  schema: {
    lockY: { type: "boolean", default: true }
  },

  tick: function () {
    const camera = this.el.sceneEl.camera;
    if (!camera || typeof THREE === "undefined") return;

    const camWorld = new THREE.Vector3();
    camera.getWorldPosition(camWorld);
    const elWorld = new THREE.Vector3();
    this.el.object3D.getWorldPosition(elWorld);

    if (this.data.lockY) {
      const dx = camWorld.x - elWorld.x;
      const dz = camWorld.z - elWorld.z;
      if (dx * dx + dz * dz < 1e-8) return;
      this.el.object3D.rotation.y = Math.atan2(dx, dz);
    } else {
      this.el.object3D.lookAt(camWorld);
    }
  }
});

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

  /* Tock runs after look-controls tick + render, so facing matches movement. */
  tock: function (time, timeDelta) {
    onTourMovementTick(time, timeDelta, this.data.speed);
    updateCompass();
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

function startHallwayAmbience() {
  if (!ambienceAudio) return;

  ambienceAudio.loop = true;
  ambienceAudio.volume = 0.4;
  ambienceAudio.play().catch(() => {});
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

/* ——— Classroom video screen (center spawn, billboards toward camera) ——— */

function classifyVideoUrl(url) {
  if (!url) return { ok: false, reason: "empty" };

  if (!/^https?:\/\//i.test(url)) {
    return { ok: true, remote: false };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "invalid", message: "Video URL is not valid." };
  }

  if (VIDEO_PAGE_HOSTS.test(parsed.hostname + parsed.pathname)) {
    return {
      ok: false,
      reason: "page",
      message:
        "That link opens a web page, not a video file. Save the MP4 to assets/video/ or use a direct .mp4 URL."
    };
  }

  return { ok: true, remote: true };
}

function getVideoScreenDimensions(videoWidth, videoHeight) {
  if (!videoWidth || !videoHeight) {
    return { width: VIDEO_SCREEN_MAX_WIDTH, height: (VIDEO_SCREEN_MAX_WIDTH * 9) / 16 };
  }

  const aspect = videoWidth / videoHeight;
  return {
    width: VIDEO_SCREEN_MAX_WIDTH,
    height: VIDEO_SCREEN_MAX_WIDTH / aspect
  };
}

function applyVideoScreenDimensions() {
  const videoPlane = classroomVideoScreen?.querySelector("a-video");
  if (!videoPlane) return;

  const { width, height } = videoScreenSize;
  videoPlane.setAttribute("width", width);
  videoPlane.setAttribute("height", height);
}

function configureVideoElement(video, remote) {
  video.setAttribute("preload", "auto");
  video.setAttribute("loop", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.style.position = "fixed";
  video.style.left = "-9999px";
  video.style.width = "1px";
  video.style.height = "1px";
  video.style.opacity = "0";
  video.style.pointerEvents = "none";

  if (remote) {
    video.crossOrigin = "anonymous";
  }
}

function preloadClassroomVideo() {
  if (!CLASSROOM_VIDEO_URL) {
    videoReady = true;
    return Promise.resolve(false);
  }

  if (classroomVideoEl) {
    videoReady = true;
    return Promise.resolve(true);
  }

  const urlInfo = classifyVideoUrl(CLASSROOM_VIDEO_URL);
  if (!urlInfo.ok) {
    videoReady = true;
    if (urlInfo.message) showToast(urlInfo.message);
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    setLoadingProgress(Math.max(progress, 8), "Loading classroom video…");

    const video = document.createElement("video");
    video.id = "classroom-video-asset";
    configureVideoElement(video, urlInfo.remote);

    let settled = false;
    const finish = (ok, message) => {
      if (settled) return;
      settled = true;
      if (!ok) {
        video.remove();
        classroomVideoEl = null;
        if (message) showToast(message);
      } else {
        classroomVideoEl = video;
        classroomVideoEl.muted = videoMuted;
        videoScreenSize = getVideoScreenDimensions(video.videoWidth, video.videoHeight);
      }
      videoReady = true;
      resolve(ok);
    };

    video.addEventListener(
      "loadedmetadata",
      () => {
        videoScreenSize = getVideoScreenDimensions(video.videoWidth, video.videoHeight);
        applyVideoScreenDimensions();
      },
      { once: true }
    );

    video.addEventListener(
      "progress",
      () => {
        if (!video.buffered.length) return;
        const buffered = video.buffered.end(video.buffered.length - 1);
        const duration = video.duration;
        if (!duration || !Number.isFinite(duration)) return;
        const pct = 8 + Math.round((buffered / duration) * 22);
        setLoadingProgress(pct, "Loading classroom video… " + pct + "%");
      },
      { passive: true }
    );

    video.addEventListener("canplay", () => finish(true), { once: true });
    video.addEventListener(
      "error",
      () => {
        console.error("Classroom video failed to load", CLASSROOM_VIDEO_URL);
        const remoteHelp = urlInfo.remote
          ? " Remote videos need a direct .mp4 link with cross-origin (CORS) enabled on the host."
          : "";
        finish(false, "Video failed to load." + remoteHelp);
      },
      { once: true }
    );

    document.body.appendChild(video);
    video.src = CLASSROOM_VIDEO_URL;
    video.load();

    setTimeout(() => {
      if (!settled && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        finish(true);
      }
    }, 45000);
  });
}

function setupClassroomVideo() {
  if (classroomVideoScreen) return;

  const screen = document.createElement("a-entity");
  screen.id = "classroom-video-screen";
  screen.setAttribute("position", `0 ${VIDEO_SCREEN_Y} 0`);
  screen.setAttribute("billboard", "");

  if (CLASSROOM_VIDEO_URL && classroomVideoEl) {
    const { width, height } = videoScreenSize;
    const videoPlane = document.createElement("a-video");
    videoPlane.setAttribute("width", width);
    videoPlane.setAttribute("height", height);
    videoPlane.setAttribute("src", "#classroom-video-asset");
    videoPlane.setAttribute("material", "shader: flat; side: double");
    videoPlane.setAttribute("video-texture", "");
    screen.appendChild(videoPlane);
  } else {
    const plane = document.createElement("a-plane");
    plane.setAttribute("width", videoScreenSize.width);
    plane.setAttribute("height", videoScreenSize.height);
    plane.setAttribute("color", "#000000");
    plane.setAttribute("material", "shader: flat; side: double");
    screen.appendChild(plane);
  }

  scene.appendChild(screen);
  classroomVideoScreen = screen;
}

function tryCompleteLoading() {
  if (modelReady || !modelHasGeometry() || !videoReady) return false;
  finishLoading(true);
  return true;
}

function refreshVideoScreenMaterial() {
  const videoPlane = classroomVideoScreen?.querySelector("a-video");
  if (!videoPlane || !classroomVideoEl) return;
  videoPlane.setAttribute("material", "shader: flat; src: #classroom-video-asset; side: double");
}

function updateVideoPlayButton() {
  const btn = document.getElementById("video-play-btn");
  if (btn) btn.textContent = videoPlaying ? "Pause video" : "Play video";
}

function updateVideoMuteButton() {
  const btn = document.getElementById("video-mute-btn");
  if (btn) btn.textContent = videoMuted ? "Unmute video" : "Mute video";
}

function updateVideoHideButton() {
  const btn = document.getElementById("video-hide-btn");
  if (btn) btn.textContent = videoVisible ? "Hide video" : "Show video";
}

function toggleVideoPlay() {
  if (!classroomVideoEl) {
    showToast("Add a video link in CLASSROOM_VIDEO_URL (src/main.js).");
    return;
  }

  if (videoPlaying) {
    classroomVideoEl.pause();
    videoPlaying = false;
    updateVideoPlayButton();
  } else {
    classroomVideoEl
      .play()
      .then(() => {
        videoPlaying = true;
        updateVideoPlayButton();
        refreshVideoScreenMaterial();
      })
      .catch(() => showToast("Could not play video. Click Play video again."));
  }
}

function toggleVideoMute() {
  if (!classroomVideoEl) {
    showToast("Add a video link in CLASSROOM_VIDEO_URL (src/main.js).");
    return;
  }

  videoMuted = !videoMuted;
  classroomVideoEl.muted = videoMuted;
  updateVideoMuteButton();
}

function toggleVideoVisibility() {
  if (!classroomVideoScreen) return;

  if (videoVisible) {
    videoWasPlayingBeforeHide = videoPlaying;
    if (classroomVideoEl && videoPlaying) {
      classroomVideoEl.pause();
      videoPlaying = false;
      updateVideoPlayButton();
    }
    videoVisible = false;
    classroomVideoScreen.setAttribute("visible", false);
  } else {
    videoVisible = true;
    classroomVideoScreen.setAttribute("visible", true);
    if (classroomVideoEl && videoWasPlayingBeforeHide) {
      classroomVideoEl
        .play()
        .then(() => {
          videoPlaying = true;
          updateVideoPlayButton();
          refreshVideoScreenMaterial();
        })
        .catch(() => showToast("Could not resume video."));
    }
  }

  updateVideoHideButton();
}

function seekVideo(deltaSeconds) {
  if (!classroomVideoEl) {
    showToast("Add a video link in CLASSROOM_VIDEO_URL (src/main.js).");
    return;
  }

  const duration = classroomVideoEl.duration;
  let target = classroomVideoEl.currentTime + deltaSeconds;

  if (Number.isFinite(duration)) {
    target = Math.max(0, Math.min(duration, target));
  } else {
    target = Math.max(0, target);
  }

  classroomVideoEl.currentTime = target;
  refreshVideoScreenMaterial();
}

function setupVideoControls() {
  document.getElementById("video-play-btn")?.addEventListener("click", toggleVideoPlay);
  document.getElementById("video-back-btn")?.addEventListener("click", () => seekVideo(-VIDEO_SEEK_STEP));
  document.getElementById("video-forward-btn")?.addEventListener("click", () => seekVideo(VIDEO_SEEK_STEP));
  document.getElementById("video-mute-btn")?.addEventListener("click", toggleVideoMute);
  document.getElementById("video-hide-btn")?.addEventListener("click", toggleVideoVisibility);
  updateVideoPlayButton();
  updateVideoMuteButton();
  updateVideoHideButton();
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

    loadingText.textContent = "Classroom ready.";
    scene.setAttribute("vr-mode-ui", "enabled", true);
    startHallwayAmbience();
    requestAnimationFrame(() => startTour());
  } else {
    loadingText.textContent = detail || "Could not load assets/models/school.glb";
  }
}

function tryClaimModelLoaded() {
  return tryCompleteLoading();
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
  const videoPreloadPromise = preloadClassroomVideo();

  schoolScan.addEventListener("model-loaded", onModelLoadedEvent);
  schoolScan.addEventListener("model-error", (e) => {
    console.error("school.glb failed", e);
    finishLoading(false, "3D model failed to open on this device. Try Wi‑Fi or a desktop browser.");
  });

  scene.addEventListener("loaded", () => {
    setupMovementListeners();
    applyMobileSceneTuning();
    startHallwayAmbience();
    setupVideoControls();
    videoPreloadPromise.then((ok) => {
      if (!ok && CLASSROOM_VIDEO_URL) {
        showToast("Video failed to load — showing black screen. Check assets/video/classroom.mp4.");
      }
      setupClassroomVideo();
      tryCompleteLoading();
    });
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

function startTour() {
  if (!modelReady || document.body.classList.contains("tour-started")) return;

  document.body.classList.add("tour-started");
  loadingScreen.style.display = "none";
  startHallwayAmbience();

  requestOrientationOnTap().then((granted) => startLookControls(granted));
}

initLoading();

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

/* ——— Panel buttons ——— */

const showPanelBtn = document.getElementById("show-panel-btn");

function setPanelVisible(visible) {
  infoPanel.style.display = visible ? "" : "none";
  showPanelBtn?.classList.toggle("visible", !visible);
}

document.getElementById("close-info").addEventListener("click", () => {
  setPanelVisible(false);
});

showPanelBtn?.addEventListener("click", () => {
  setPanelVisible(true);
});

window.addEventListener("load", () => {
  setTimeout(() => {
    const renderer = scene.renderer;
    if (!renderer || isMobileDevice()) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  }, 800);
});
