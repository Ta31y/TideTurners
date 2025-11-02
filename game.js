// tiny helper
const $ = (sel) => document.querySelector(sel);
let TOTAL = 0;
let TRASH = [];

// data per level (we keep it)
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
    types: ["bottle", "straw", "bag", "rings"],
  },
  {
    depthName: "Waterkolom (200–1000 m)",
    wasteInfo:
      "Zinkend plastic, textielvezels, metaal, glas, “marine snow” + microplastics.",
    lifespan: ["Plastic beker — ~450 jaar", "Koffiecup — ~500 jaar"],
    animals: ["Makreel", "Kwal", "Inktvis"],
    animalsInfo: "Dieren nemen microplastics op; spooknetten drijven mee.",
    types: ["bottle", "textile", "metal", "bag"],
  },
  {
    depthName: "Diepe zee (1000–4000 m)",
    wasteInfo:
      "Metaal en glas, plastic zakken, verroeste visnetten, rubber/autobanden.",
    lifespan: ["Plastic flesje — ~450 jaar", "Autoband/rubber — heel lang"],
    animals: ["Diepzeevissen", "Zeekomkommer"],
    animalsInfo: "Weinig licht; afval blijft liggen.",
    types: ["bottle", "bag", "net", "rubber"],
  },
  {
    depthName: "Abyssale vlaktes en troggen (4000–11.000 m)",
    wasteInfo:
      "Plastic zakken + microplastics, oude metalen objecten, militair/industrieel afval.",
    lifespan: ["Wegwerpluier — ~500 jaar", "Tandenborstel — ~500 jaar"],
    animals: ["Diepzeevissen", "Spons", "Kreeftachtigen"],
    animalsInfo: "Extreem diep; bijna geen afbraak.",
    types: ["bag", "metal", "micro", "rings"],
  },
];

const TYPE_META = {
  bottle: { label: "Fles", icon: "🧴" },
  straw: { label: "Rietje", icon: "🥤" },
  bag: { label: "Plastic zak", icon: "🛍️" },
  rings: { label: "6-pack ringen", icon: "⭕" },
  metal: { label: "Metaal/glas", icon: "🔩" },
  textile: { label: "Textiel", icon: "🧵" },
  net: { label: "Visnet", icon: "🪢" },
  rubber: { label: "Rubber/band", icon: "🛞" },
  micro: { label: "Microplastics", icon: "•" },
};

/* ------------- TRASH spawner: close to player, only float up/down ------------- */
AFRAME.registerComponent("simple-trash-spawner", {
  schema: {
    count: { default: 25 },
    types: { default: "bottle,straw,bag,rings" },
  },
  init: function () {
    const typeList = this.data.types.split(",").map((s) => s.trim());
    for (let i = 0; i < this.data.count; i++) {
      const e = document.createElement("a-entity");
      e.className = "trash";

      // type
      const t = typeList[Math.floor(Math.random() * typeList.length)];
      e.setAttribute("data-type", t);

      // small shape
      const shapes = ["box", "sphere", "cylinder"];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      if (shape === "box")
        e.setAttribute(
          "geometry",
          "primitive: box; depth:0.2; height:0.12; width:0.18"
        );
      if (shape === "sphere")
        e.setAttribute("geometry", "primitive: sphere; radius:0.13");
      if (shape === "cylinder")
        e.setAttribute(
          "geometry",
          "primitive: cylinder; radius:0.09; height:0.18"
        );

      // soft colors
      const colors = ["#c9e7ff", "#ffcc66", "#ff8888", "#a0ffb3", "#ffd1dc"];
      e.setAttribute(
        "material",
        "color:" + colors[Math.floor(Math.random() * colors.length)]
      );

      // CLOSE to origin: x = -2..2, z = -2..-8
      const x = (Math.random() * 4 - 2).toFixed(2);
      const y = (0.4 + Math.random() * 1.8).toFixed(2);
      const z = (-2 - Math.random() * 6).toFixed(2);
      e.setAttribute("position", `${x} ${y} ${z}`);

      // float up / down
      const toY = (parseFloat(y) + 0.6 + Math.random() * 0.8).toFixed(2);
      e.setAttribute(
        "animation__float",
        `property: position; dir: alternate; loop: true; dur: ${
          3000 + Math.random() * 2000
        }; to: ${x} ${toY} ${z}`
      );

      this.el.appendChild(e);
      TRASH.push(e);
    }
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

/* ------------- QUEST movement directly from XR input ------------- */
AFRAME.registerComponent("quest-move", {
  schema: {
    moveSpeed: { default: 2.4 },
    verticalSpeed: { default: 1.4 },
  },
  init: function () {
    this.tmpForward = new THREE.Vector3();
    this.tmpRight = new THREE.Vector3();
    this.isVR = false;

    const scene = this.el.sceneEl;
    scene.addEventListener("enter-vr", () => (this.isVR = true));
    scene.addEventListener("exit-vr", () => (this.isVR = false));
  },
  tick: function (time, dt) {
    const rig = this.el.object3D;
    const dts = dt / 1000;

    // also allow desktop arrows
    if (!this.isVR) return;

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
      // prefer right controller for movement
      const isRight = source.handedness === "right";
      const isLeft = source.handedness === "left";

      // axes: try 2/3, else 0/1
      const ax = gp.axes[2] !== undefined ? gp.axes[2] : gp.axes[0] || 0;
      const ay = gp.axes[3] !== undefined ? gp.axes[3] : gp.axes[1] || 0;

      if (isRight) {
        moveX = ax; // strafe
        moveY = ay; // forward/back
        // button[0] usually trigger
        if (gp.buttons[0] && gp.buttons[0].pressed) goUp = true;
      }
      if (isLeft) {
        if (gp.buttons[0] && gp.buttons[0].pressed) goDown = true;
      }
    }

    // forward relative to camera
    const cam = $("#camera").object3D;
    const forward = this.tmpForward.set(0, 0, -1);
    cam.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    // right = sideways
    const right = this.tmpRight
      .crossVectors(forward, new THREE.Vector3(0, 1, 0))
      .negate();

    // apply
    rig.position.addScaledVector(forward, -moveY * this.data.moveSpeed * dts);
    rig.position.addScaledVector(right, moveX * this.data.moveSpeed * dts);

    if (goUp) rig.position.y += this.data.verticalSpeed * dts;
    if (goDown) rig.position.y -= this.data.verticalSpeed * dts;

    // clamp
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

    // listen
    this.scene.addEventListener("trashcollected", (ev) => {
      const t = ev.detail && ev.detail.type ? ev.detail.type : "unknown";
      this.stats[t] = (this.stats[t] || 0) + 1;
      if (this.vrHud.getAttribute("visible")) {
        this.vrHud.setAttribute(
          "text",
          "value",
          "Trash: " + Object.values(this.stats).reduce((a, b) => a + b, 0)
        );
      }
    });

    // start by click or trigger on panel
    this.startPanel.addEventListener("click", () => this.startLevel(0));
    this.scene.addEventListener("click", (e) => {
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

    // show VR HUD in front of cam
    this.vrHud.setAttribute("visible", true);
    this.vrHud.setAttribute("text", "value", L.name);

    // hide start
    this.startPanel.setAttribute("visible", false);

    // spawn close trash
    this.spawner.innerHTML = "";
    TRASH.length = 0;
    const sp = document.createElement("a-entity");
    sp.setAttribute(
      "simple-trash-spawner",
      `count: 25; types: ${content.types.join(",")}`
    );
    this.spawner.appendChild(sp);

    // reset counters
    this.stats = {};
    this.timer = L.time;
    this.levelTitle.textContent = L.name;
    this.updateTimer();
  },

  endLevel: function () {
    // for now: just go to next
    if (this.i < this.levels.length - 1) {
      this.startLevel(this.i + 1);
    } else {
      // final
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
