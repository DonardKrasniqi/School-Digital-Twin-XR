const loadingScreen = document.getElementById("loading-screen");
const loadingBar = document.getElementById("loading-bar");
const loadingText = document.getElementById("loading-text");
const scene = document.getElementById("scene");
const player = document.getElementById("player");
const camera = document.getElementById("camera");
const schoolScan = document.getElementById("school-scan");
const closeInfoButton = document.getElementById("close-info");
const infoPanel = document.getElementById("info-panel");

const overviewButton = document.getElementById("overview-mode");
const walkButton = document.getElementById("walk-mode");

/* -------------------------------------------------------
   Simple Boundary System
------------------------------------------------------- */
AFRAME.registerComponent("simple-collision", {
  schema: {
    minX: { default: -40 },
    maxX: { default: 40 },
    minZ: { default: -40 },
    maxZ: { default: 40 }
  },

  tick: function () {
    const position = this.el.object3D.position;

    if (position.x < this.data.minX) position.x = this.data.minX;
    if (position.x > this.data.maxX) position.x = this.data.maxX;
    if (position.z < this.data.minZ) position.z = this.data.minZ;
    if (position.z > this.data.maxZ) position.z = this.data.maxZ;
  }
});

/* -------------------------------------------------------
   Loading Screen
------------------------------------------------------- */
let progress = 0;

const loadingInterval = setInterval(() => {
  if (progress < 90) {
    progress += 5;
    loadingBar.style.width = progress + "%";
    loadingText.textContent = "Loading scanned school model... " + progress + "%";
  }
}, 250);

/* -------------------------------------------------------
   Load GLB Model
------------------------------------------------------- */
schoolScan.addEventListener("model-loaded", () => {
  clearInterval(loadingInterval);

  loadingBar.style.width = "100%";
  loadingText.textContent = "School model loaded successfully.";

  schoolScan.setAttribute("visible", "true");

  setTimeout(() => {
    loadingScreen.style.display = "none";
  }, 700);

  console.log("School scan loaded successfully.");
});

schoolScan.addEventListener("model-error", () => {
  clearInterval(loadingInterval);

  loadingText.textContent = "Error: school.glb was not found or could not load.";
  loadingBar.style.width = "100%";

  console.log("Model loading failed. Check if the file is inside assets/school.glb");
});

/* -------------------------------------------------------
   Function to reset camera properly
------------------------------------------------------- */
function resetCamera() {
  camera.setAttribute("position", "0 0 0");
  camera.setAttribute("rotation", "0 0 0");

  player.object3D.rotation.set(0, 0, 0);
  camera.object3D.rotation.set(0, 0, 0);
}

/* -------------------------------------------------------
   Overview Mode
------------------------------------------------------- */
function goOverview() {
  loadingScreen.style.display = "flex";
  loadingText.textContent = "Switching to overview mode...";
  loadingBar.style.width = "100%";

  setTimeout(() => {
    resetCamera();

    player.setAttribute("position", {
      x: 0,
      y: 7.5,
      z: 8
    });

    player.setAttribute("rotation", {
      x: -35,
      y: 0,
      z: 0
    });

    loadingScreen.style.display = "none";
  }, 300);
}

/* -------------------------------------------------------
   Walk Inside Mode
   This places the camera lower, inside the classroom.
------------------------------------------------------- */
function goWalkInside() {
  loadingScreen.style.display = "flex";
  loadingText.textContent = "Entering walk mode...";
  loadingBar.style.width = "100%";

  setTimeout(() => {
    resetCamera();

    player.setAttribute("position", {
      x: 0,
      y: 1.2,
      z: -1.5
    });

    player.setAttribute("rotation", {
      x: 0,
      y: 180,
      z: 0
    });

    loadingScreen.style.display = "none";
  }, 300);
}

/* -------------------------------------------------------
   Button Controls
------------------------------------------------------- */
overviewButton.addEventListener("click", goOverview);
walkButton.addEventListener("click", goWalkInside);

/* -------------------------------------------------------
   Keyboard Shortcuts
   1 = overview
   2 = walk inside
------------------------------------------------------- */
window.addEventListener("keydown", (event) => {
  if (event.key === "1") {
    goOverview();
  }

  if (event.key === "2") {
    goWalkInside();
  }
});

/* -------------------------------------------------------
   Teleport System
------------------------------------------------------- */
const teleportPoints = document.querySelectorAll(".teleport-point");

teleportPoints.forEach((point) => {
  point.addEventListener("click", () => {
    const position = point.getAttribute("position");

    loadingScreen.style.display = "flex";
    loadingText.textContent = "Teleporting...";
    loadingBar.style.width = "100%";

    setTimeout(() => {
      resetCamera();

      player.setAttribute("position", {
        x: position.x,
        y: 1.2,
        z: position.z
      });

      player.setAttribute("rotation", {
        x: 0,
        y: 180,
        z: 0
      });

      loadingScreen.style.display = "none";
    }, 250);
  });

  point.addEventListener("mouseenter", () => {
    point.setAttribute("color", "#00ccff");
    point.setAttribute("scale", "1.2 1.2 1.2");
  });

  point.addEventListener("mouseleave", () => {
    point.setAttribute("color", "#0066ff");
    point.setAttribute("scale", "1 1 1");
  });
});

/* -------------------------------------------------------
   Hide Info Panel
------------------------------------------------------- */
closeInfoButton.addEventListener("click", () => {
  infoPanel.style.display = "none";
});

/* -------------------------------------------------------
   Device Performance Scaling
------------------------------------------------------- */
window.addEventListener("load", () => {
  setTimeout(() => {
    const renderer = scene.renderer;

    if (!renderer) return;

    if (window.innerWidth < 768) {
      renderer.setPixelRatio(0.75);
    } else {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    }
  }, 1000);
});

console.log("School WebXR Virtual Tour is running.");
console.log("Press 1 for Overview View.");
console.log("Press 2 for Walk Inside.");