// tiny helper
const $ = (sel) => document.querySelector(sel);
let TOTAL = 0;
let TRASH = [];

/* ---------- Level data (unchanged UI text / stats) ---------- */
const BOARD_DATA = [
  {
    depthName: "Oppervlak (0–200 m)",
    wasteInfo: "Plastic drijvers, visserijmateriaal en microplastics.",
    lifespan: [
      "Plastic tas — ~20 jaar",
      "Plastic rietje — ~200 jaar",
      "6-pack ringen — ~400 jaar",
    ],
    animals: ["Zeemeeuw", "Zeepaardje", "Schildpad (oppervlak)"],
    animalsInfo:
      "Veel dieren raken hier verstrikt in drijvend plastic of slikken microplastics in.",
    types: ["bottle", "straw", "bag", "can"],
  },
  {
    depthName: "Waterkolom (200–1000 m)",
    wasteInfo:
      "Zinkend plastic, textielvezels, metaal, glas, “marine snow” + microplastics.",
    lifespan: ["Plastic beker — ~450 jaar", "Koffiecup — ~500 jaar"],
    animals: ["Makreel", "Kwal", "Inktvis"],
    animalsInfo: "Dieren nemen microplastics op; spooknetten drijven mee.",
    types: ["bottle", "bag", "can", "straw"],
  },
  {
    depthName: "Diepe zee (1000–4000 m)",
    wasteInfo:
      "Metaal en glas, plastic zakken, verroeste visnetten, rubber/autobanden.",
    lifespan: ["Plastic flesje — ~450 jaar", "Autoband/rubber — heel lang"],
    animals: ["Diepzeevissen", "Zeekomkommer"],
    animalsInfo: "Weinig licht; afval blijft liggen.",
    types: ["bottle", "bag", "can", "straw"],
  },
  {
    depthName: "Abyssale vlaktes en troggen (4000–11.000 m)",
    wasteInfo:
      "Plastic zakken + microplastics, oude metalen objecten, militair/industrieel afval.",
    lifespan: ["Wegwerpluier — ~500 jaar", "Tandenborstel — ~500 jaar"],
    animals: ["Diepzeevissen", "Spons", "Kreeftachtigen"],
    animalsInfo: "Extreem diep; bijna geen afbraak.",
    types: ["bottle", "bag", "can", "straw"],
  },
];

const TYPE_META = {
  bottle: { label: "Fles", icon: "🧴" },
  straw: { label: "Rietje", icon: "🥤" },
  bag: { label: "Plastic zak", icon: "🛍️" },
  can: { label: "Blikje", icon: "🥫" },
  metal: { label: "Metaal/glas", icon: "🔩" },
  textile: { label: "Textiel", icon: "🧵" },
  net: { label: "Visnet", icon: "🪢" },
  rubber: { label: "Rubber/band", icon: "🛞" },
  micro: { label: "Microplastics", icon: "•" },
};

/* ---------- MODEL meta (scale + collectable + gentle motions) ---------- */
const MODEL_META = {
  // TRASH (collectable)
  bottle: { model: "#mdlBottle", scale: "0.65 0.65 0.65", collect: true },
  can: { model: "#mdlCan", scale: "0.30 0.30 0.30", collect: true }, // smaller soda can
  bag: {
    model: "#mdlBag",
    scale: "0.9 0.9 0.9",
    collect: true,
    bob: true,
    spin: true,
  }, // bigger white bag

  // AMBIENT (not collectable)
  jelly: {
    model: "#mdlJelly",
    scale: "0.8 0.8 0.8",
    collect: false,
    bob: true,
    slowSpin: true,
  },
  fish: { model: "#mdlFish", scale: "0.7 0.7 0.7", collect: false, swim: true },
  plant: {
    model: "#mdlPlant",
    scale: "1.0 1.0 1.0",
    collect: false,
    sway: true,
  },
  turtle: {
    model: "#mdlSeaTurtle",
    scale: "0.35 0.35 0.35",
    collect: false,
    swim: true,
  },
};
const AMBIENT_KEYS = ["jelly", "fish", "plant"];

/* ------------- SPAWNER: GLB trash + ambient ------------- */
AFRAME.registerComponent("simple-trash-spawner", {
  schema: {
    count: { default: 25 }, // TRASH items
    ambientCount: { default: 20 }, // AMBIENT items
    types: { default: "bottle,straw,bag,can" },
  },

  init: function () {
    const trashTypes = this.data.types
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // TRASH near the player (mid-water)
    for (let i = 0; i < this.data.count; i++) {
      const key = trashTypes[Math.floor(Math.random() * trashTypes.length)];
      this.spawnModel(key, { near: true, collect: true });
    }

    // AMBIENT deterministic mix: lots of plants, all low
    const total = this.data.ambientCount;
    const nPlants = Math.max(6, Math.round(total * 2)); // 60% plants
    const nFish = Math.max(2, Math.round(total * 1)); // 25% fish
    const nJelly = Math.max(1, Math.round(total * 0.75)); // rest jelly

    for (let i = 0; i < nPlants; i++)
      this.spawnModel("plant", { near: false, collect: false });
    for (let i = 0; i < nFish; i++)
      this.spawnModel("fish", { near: false, collect: false });
    for (let i = 0; i < nJelly; i++)
      this.spawnModel("jelly", { near: false, collect: false });

    // Optional: a turtle sometimes
    if (Math.random() < 0.4)
      this.spawnModel("turtle", { near: false, collect: false });
  }, // ← IMPORTANT COMMA

  spawnModel: function (key, opts) {
    const meta = MODEL_META[key];
    if (!meta) return;

    const e = document.createElement("a-entity");
    e.setAttribute("gltf-model", meta.model);
    e.setAttribute("scale", meta.scale);
    e.setAttribute("shadow", "cast:false; receive:false");

    // ----- Position -----
    let x, y, z;
    if (opts.near) {
      // TRASH: mid-water near player
      x = Math.random() * 10 - 5;
      z = -2 - Math.random() * 10;
      y = 0.8 + Math.random() * 1.8; // ~0.8–2.6
    } else {
      // AMBIENT baseline
      x = Math.random() * 30 - 15;
      z = -6 - Math.random() * 30;
      y = 0.3 + Math.random() * 1.0; // ~0.3–1.3
    }
    // Plants even lower (just above seabed)
    if (key === "plant") y = 0.15 + Math.random() * -9; // ~0.15–0.40

    e.setAttribute(
      "position",
      `${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`
    );

    // ----- Motions -----
    if (meta.bob) {
      const toY = y + 0.6 + Math.random() * 0.6;
      e.setAttribute(
        "animation__bob",
        `property: position; dir: alternate; loop: true; dur: ${
          3200 + Math.random() * 1800
        }; to: ${x.toFixed(2)} ${toY.toFixed(2)} ${z.toFixed(2)}`
      );
    }
    if (meta.spin)
      e.setAttribute(
        "animation__spin",
        "property: rotation; loop:true; dir:alternate; dur: 4000; to: 0 180 0"
      );
    if (meta.slowSpin)
      e.setAttribute(
        "animation__sls",
        "property: rotation; loop:true; dur: 9000; to: 0 360 0"
      );
    if (meta.sway)
      e.setAttribute(
        "animation__sway",
        "property: rotation; loop:true; dir:alternate; dur: 4500; to: 10 5 0"
      );

    if (meta.swim) {
      const toX = x + (Math.random() * 4 - 2);
      const toZ = z - (3 + Math.random() * 5);
      e.setAttribute(
        "animation__swim",
        `property: position; loop:true; dir:alternate; dur: ${
          6000 + Math.random() * 3000
        }; to: ${toX.toFixed(2)} ${y.toFixed(2)} ${toZ.toFixed(2)}`
      );
    }

    // mark collectable vs ambient
    if (meta.collect) {
      e.classList.add("trash");
      e.setAttribute("data-type", key);
      TRASH.push(e);
    } else {
      e.classList.add("ambient");
    }

    this.el.appendChild(e);
  },
});

/* ------------- NET collector ------------- */
AFRAME.registerComponent("net-collector", {
  schema: { radius: { default: 0.45 }, score3D: { type: "selector" } },
  init: function () {
    this.score = 0;
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
    this.sync();
  },
  sync: function () {
    const t = "Trash: " + this.score;
    if (this.data.score3D) this.data.score3D.setAttribute("text", "value", t);
    const lbl = $("#totalScoreLabel");
    if (lbl) lbl.textContent = "Total collected: " + TOTAL;
  },
  tick: function () {
    const netPos = this.el.object3D.getWorldPosition(this.tmp);
    for (let i = TRASH.length - 1; i >= 0; i--) {
      const e = TRASH[i];
      if (!e.parentNode) {
        TRASH.splice(i, 1);
        continue;
      }
      const p = e.object3D.getWorldPosition(this.tmp2);
      if (p.distanceTo(netPos) < this.data.radius) {
        const t = e.getAttribute("data-type") || "unknown";
        this.el.sceneEl.emit("trashcollected", { type: t }, true);
        e.parentNode.removeChild(e);
        TRASH.splice(i, 1);
        this.score++;
        TOTAL++;
        this.sync();

        const rightHand = $("#rightHand");
        if (rightHand) {
          rightHand.removeAttribute("animation__swing");
          rightHand.setAttribute(
            "animation__swing",
            "property: rotation; from: 0 0 0; to: -25 0 0; dur: 120; dir: alternate; easing: easeInOutSine; loop: 2"
          );
        }
      }
    }
  },
});

/* ------------- desktop boost ------------- */
AFRAME.registerComponent("net-boost", {
  schema: { base: { default: 0.45 }, boosted: { default: 0.8 } },
  init: function () {
    const net = this.el.components["net-collector"];
    if (!net) return;
    const setBase = () => (net.data.radius = this.data.base);
    const setBoost = () => (net.data.radius = this.data.boosted);
    window.addEventListener("mousedown", setBoost);
    window.addEventListener("mouseup", setBase);
    window.addEventListener("blur", setBase);
  },
});

/* ------------- QUEST movement ------------- */
AFRAME.registerComponent("quest-move", {
  schema: { moveSpeed: { default: 2.4 }, verticalSpeed: { default: 1.4 } },
  init: function () {
    this.tmpForward = new THREE.Vector3();
    this.tmpRight = new THREE.Vector3();
    this.isVR = false;
    const scene = this.el.sceneEl;
    scene.addEventListener("enter-vr", () => (this.isVR = true));
    scene.addEventListener("exit-vr", () => (this.isVR = false));
  },
  tick: function (time, dt) {
    if (!this.isVR) return;
    const rig = this.el.object3D;
    const dts = dt / 1000;

    const xr = this.el.sceneEl.renderer.xr;
    const session = xr && xr.getSession ? xr.getSession() : null;
    if (!session) return;

    let moveX = 0,
      moveY = 0,
      goUp = false,
      goDown = false;

    for (const source of session.inputSources) {
      if (!source.gamepad) continue;
      const gp = source.gamepad;
      const isRight = source.handedness === "right";
      const isLeft = source.handedness === "left";
      const ax = gp.axes[2] !== undefined ? gp.axes[2] : gp.axes[0] || 0;
      const ay = gp.axes[3] !== undefined ? gp.axes[3] : gp.axes[1] || 0;
      if (isRight) {
        moveX = ax;
        moveY = ay;
        if (gp.buttons[0]?.pressed) goUp = true;
      }
      if (isLeft) {
        if (gp.buttons[0]?.pressed) goDown = true;
      }
    }

    const cam = $("#camera").object3D;
    const forward = this.tmpForward.set(0, 0, -1);
    cam.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = this.tmpRight
      .crossVectors(forward, new THREE.Vector3(0, 1, 0))
      .negate();

    rig.position.addScaledVector(forward, -moveY * this.data.moveSpeed * dts);
    rig.position.addScaledVector(right, moveX * this.data.moveSpeed * dts);
    if (goUp) rig.position.y += this.data.verticalSpeed * dts;
    if (goDown) rig.position.y -= this.data.verticalSpeed * dts;
    rig.position.y = THREE.MathUtils.clamp(rig.position.y, 0.5, 5);
  },
});

/* ------------- attach hands to real controllers in VR ------------- */
AFRAME.registerComponent("hand-vr-sync", {
  init: function () {
    this.scene = this.el.sceneEl;
    this.rig = this.el;
    this.leftRigHand = $("#leftHand");
    this.rightRigHand = $("#rightHand");
    this.net = $("#net");
    this.leftCtrl = $("#leftController");
    this.rightCtrl = $("#rightController");
    this.scene.addEventListener("enter-vr", () => this.toVR());
    this.scene.addEventListener("exit-vr", () => this.toDesktop());
  },
  toVR: function () {
    if (this.leftCtrl && this.leftRigHand) {
      this.leftCtrl.appendChild(this.leftRigHand);
      this.leftRigHand.object3D.position.set(0, 0, 0);
    }
    if (this.rightCtrl && this.rightRigHand) {
      this.rightCtrl.appendChild(this.rightRigHand);
      this.rightRigHand.object3D.position.set(0, 0, 0);
      if (this.net) {
        this.rightRigHand.appendChild(this.net);
        this.net.object3D.position.set(0, -0.02, -0.25);
      }
    }
  },
  toDesktop: function () {
    if (this.rig && this.leftRigHand) {
      this.rig.appendChild(this.leftRigHand);
      this.leftRigHand.object3D.position.set(-0.25, -0.15, -0.5);
    }
    if (this.rig && this.rightRigHand) {
      this.rig.appendChild(this.rightRigHand);
      this.rightRigHand.object3D.position.set(0.25, -0.15, -0.5);
    }
  },
});

/* ------------- GAME MANAGER ------------- */
AFRAME.registerComponent("game-manager", {
  init: function () {
    this.scene = $("#scene");
    this.sky = $("#sky");
    this.beach = $("#beachEnv");
    this.under = $("#underwaterEnv");
    this.rig = $("#rig");
    this.spawner = $("#spawner");
    this.startPanel = $("#startPanel");
    this.vrHud = $("#vrHud");

    this.info = $("#info");
    this.infoBtn = $("#infoBtn");
    this.levelTitle = $("#levelTitle");
    this.timerLabel = $("#timerLabel");

    this.levels = [
      { name: "Level 1 – Oppervlak", time: 90, sky: "#6cacbb", fog: 0.045 },
      { name: "Level 2 – Waterkolom", time: 60, sky: "#2e7991", fog: 0.055 },
      { name: "Level 3 – Diepe zee", time: 45, sky: "#0b4960", fog: 0.065 },
      {
        name: "Level 4 – Abyssale vlaktes",
        time: 30,
        sky: "#052e42",
        fog: 0.075,
      },
    ];
    this.i = -1;
    this.stats = {};
    this.timer = 0;

    // stats listener
    this.scene.addEventListener("trashcollected", (ev) => {
      const t = ev.detail && ev.detail.type ? ev.detail.type : "unknown";
      this.stats[t] = (this.stats[t] || 0) + 1;
      if (this.vrHud.getAttribute("visible")) {
        const totalLevel = Object.values(this.stats).reduce((a, b) => a + b, 0);
        this.vrHud.setAttribute("text", "value", "Trash: " + totalLevel);
      }
    });

    // start by click/trigger anywhere or on the button
    this.startPanel.addEventListener("click", () => this.startLevel(0));
    this.scene.addEventListener("click", () => {
      if (this.i === -1) this.startLevel(0);
    });
  },

  startLevel: function (idx) {
    this.i = idx;
    const L = this.levels[idx];
    const content = BOARD_DATA[idx];

    // env on
    this.beach.setAttribute("visible", "false");
    this.under.setAttribute("visible", "true");

    // water look
    this.scene.setAttribute(
      "fog",
      `type: exponential; color: ${L.sky}; density: ${L.fog}`
    );
    this.sky.setAttribute("color", L.sky);

    // HUD
    this.vrHud.setAttribute("visible", true);
    this.vrHud.setAttribute("text", "value", L.name);

    // hide start
    this.startPanel.setAttribute("visible", false);

    // spawn GLB trash + ambient
    this.spawner.innerHTML = "";
    TRASH.length = 0;
    const sp = document.createElement("a-entity");
    sp.setAttribute(
      "simple-trash-spawner",
      `count: 25; ambientCount: 20; types: ${content.types.join(",")}`
    );
    this.spawner.appendChild(sp);

    // reset counters
    this.stats = {};
    this.timer = L.time;
    this.levelTitle.textContent = L.name;
    this.updateTimer();

    // show hands
    $("#leftHand").setAttribute("visible", true);
    $("#rightHand").setAttribute("visible", true);
  },

  endLevel: function () {
    if (this.i < this.levels.length - 1) {
      this.startLevel(this.i + 1);
    } else {
      this.vrHud.setAttribute("text", "value", "Bedankt! totaal: " + TOTAL);
      this.startPanel.setAttribute("visible", true);
      this.startPanel
        .querySelector("#startText")
        .setAttribute("text", "value", "Speel opnieuw?\nTrigger / click");
      this.i = -1;
    }
  },

  updateTimer: function () {
    const m = Math.floor(this.timer / 60);
    const s = ("0" + Math.floor(this.timer % 60)).slice(-2);
    this.timerLabel.textContent = m + ":" + s;
  },

  tick: function (t, dt) {
    if (this.i < 0) return;
    this.timer -= dt / 1000;
    if (this.timer <= 0) {
      this.timer = 0;
      this.updateTimer();
      this.endLevel();
    } else {
      this.updateTimer();
    }
  },
});

// attach manager to scene
document.addEventListener("DOMContentLoaded", () => {
  $("#scene").setAttribute("game-manager", "");
});
