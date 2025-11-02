// --------- tiny helpers ----------
var $ = function (sel) { return document.querySelector(sel); };
var TOTAL = 0;
var TRASH = []; // live list of spawned trash

// ---------- per-level info (for the board) ----------
const BOARD_DATA = [
  {
    depthName: "Oppervlak (0–200 m)",
    wasteInfo: "Plastic drijvers, visserijmateriaal en microplastics.",
    lifespan: [
      "Plastic tas — ~20 jaar",
      "Plastic rietje — ~200 jaar",
      "6-pack ringen — ~400 jaar"
    ],
    animals: ["Zeemeeuw", "Zeepaardje", "Schildpad (oppervlak)"],
    animalsInfo: "Veel dieren raken hier verstrikt in drijvend plastic of slikken microplastics in.",
    types: ["bottle", "straw", "bag", "rings"]
  },
  {
    depthName: "Waterkolom (200–1000 m)",
    wasteInfo: "Zinkend plastic, textielvezels, metaal/glasscherven, “marine snow” + microplastics.",
    lifespan: ["Plastic beker — ~450 jaar", "Koffiecup — ~500 jaar"],
    animals: ["Makreel", "Kwal", "Inktvis"],
    animalsInfo: "Dieren filteren voedsel en nemen microplastics op.",
    types: ["bottle", "straw", "bag", "rings"]   // ← same as level 1
  },
  {
    depthName: "Diepe zee (1000–4000 m)",
    wasteInfo: "Metaal en glas, plastic zakken, verroeste visnetten, rubber/autobanden.",
    lifespan: ["Plastic flesje — ~450 jaar", "Autoband — heel lang (100+ jaar)"],
    animals: ["Diepzeevissen", "Zeekomkommer"],
    animalsInfo: "Weinig licht; afval blijft lang liggen en bedekt de bodem.",
    types: ["bottle", "straw", "bag", "rings"]
  },
  {
    depthName: "Abyssale vlaktes en troggen (4000–11.000 m)",
    wasteInfo: "Plastic zakken + microplastics, oude metalen objecten, militair/industrieel afval.",
    lifespan: ["Wegwerpluier — ~500 jaar", "Tandenborstel — ~500 jaar"],
    animals: ["Diepzeevissen", "Spons", "Kreeftachtigen"],
    animalsInfo: "Extreem diep; bijna geen afbraak. Afval en microplastics stapelen zich op.",
    types: ["bottle", "straw", "bag", "rings"]
  }
];

const TYPE_META = {
  bottle: { label: "Fles", icon: "🧴" },
  straw:  { label: "Rietje", icon: "🥤" },
  bag:    { label: "Plastic zak", icon: "🛍️" },
  rings:  { label: "6-pack ringen", icon: "⭕" }
};

// --------- drift ----------
AFRAME.registerComponent("simple-drift", {
  schema: { speed: { default: 0 } },
  tick: function (t, dt) {
    if (!dt || !this.data.speed) return;
    const obj = this.el.object3D;
    const f = new THREE.Vector3(0, 0, -1);
    obj.getWorldDirection(f);
    f.multiplyScalar((dt / 1000) * this.data.speed);
    obj.position.add(f);
  }
});

// --------- net collector ----------
AFRAME.registerComponent("net-collector", {
  schema: { radius: { default: 0.5 }, score3D: { type: "selector" } },
  init: function () {
    this.score = 0;
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
    this.sync();
  },
  sync: function () {
    const text = "Trash: " + this.score;
    if (this.data.score3D) this.data.score3D.setAttribute("text", "value", text);
    const lbl = $("#totalScoreLabel");
    if (lbl) lbl.textContent = "Total collected: " + TOTAL;
  },
  tick: function () {
    const netPos = this.el.object3D.getWorldPosition(this.tmp);
    for (let i = TRASH.length - 1; i >= 0; i--) {
      const e = TRASH[i];
      if (!e.parentNode) { TRASH.splice(i, 1); continue; }
      const p = e.object3D.getWorldPosition(this.tmp2);
      if (p.distanceTo(netPos) < this.data.radius) {
        // send event for stats
        const t = e.getAttribute("data-type") || "unknown";
        this.el.sceneEl.emit("trashcollected", { type: t }, true);

        e.parentNode.removeChild(e);
        TRASH.splice(i, 1);
        this.score++;
        TOTAL++;
        this.sync();

        // hand swing
        const rightHand = $("#rightHand");
        if (rightHand) {
          rightHand.removeAttribute("animation__swing");
          rightHand.setAttribute("animation__swing",
            "property: rotation; from: 0 0 0; to: -25 0 0; dur: 120; dir: alternate; easing: easeInOutSine; loop: 2");
        }
      }
    }
  }
});

// mouse boost (desktop)
AFRAME.registerComponent("net-boost", {
  schema: { base: { default: 0.5 }, boosted: { default: 0.85 } },
  init: function () {
    this.net = this.el.components["net-collector"];
    if (!this.net) return;
    const setBase = () => { this.net.data.radius = this.data.base; };
    const setBoost = () => { this.net.data.radius = this.data.boosted; };
    window.addEventListener("mousedown", setBoost);
    window.addEventListener("mouseup", setBase);
    window.addEventListener("blur", setBase);
  }
});

// --------- turtle follow ----------
AFRAME.registerComponent("turtle-guide", {
  schema: { offset: { default: "-0.4 0 -1.2" }, follow: { default: false } },
  init: function () {
    const o = this.data.offset.split(" ").map(parseFloat);
    this.off = new THREE.Vector3(o[0], o[1], o[2]);
    this.t = 0;
  },
  tick: function (t, dt) {
    this.t += dt / 1000;
    if (!this.data.follow) return;
    const rig = $("#rig").object3D;
    const f = new THREE.Vector3(0, 0, -1);
    rig.getWorldDirection(f);
    const base = rig.position.clone().add(f.multiplyScalar(2.3));
    base.y += 0.2 * Math.sin(this.t * 1.2);
    this.el.object3D.position.copy(base.add(this.off));
    this.el.object3D.lookAt(rig.position.x, rig.position.y + 0.2, rig.position.z);
  }
});

// --------- trash spawner (now CLOSE) ----------
AFRAME.registerComponent("simple-trash-spawner", {
  schema: {
    count: { default: 25 },
    types: { default: "bottle,straw,bag,rings" }
  },
  init: function () {
    const typeList = this.data.types.split(",").map(s => s.trim()).filter(Boolean);
    for (let i = 0; i < this.data.count; i++) {
      const e = document.createElement("a-entity");
      e.className = "trash";
      const t = typeList[Math.floor(Math.random() * typeList.length)];
      e.setAttribute("data-type", t);

      // shape
      const shapes = ["box", "sphere", "cylinder"];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      if (shape === "box")      e.setAttribute("geometry", "primitive: box; depth:0.25; height:0.1; width:0.18");
      if (shape === "sphere")   e.setAttribute("geometry", "primitive: sphere; radius:0.12");
      if (shape === "cylinder") e.setAttribute("geometry", "primitive: cylinder; radius:0.08; height:0.22");

      const colors = ["#c9e7ff", "#ffcc66", "#ff8888", "#a0ffb3", "#ffd1dc"];
      e.setAttribute("material", "color:" + colors[Math.floor(Math.random() * colors.length)]);

      // CLOSE to player: x -6..6, z -3 .. -18, y 0.5 .. 2.2
      const x = (Math.random() * 12) - 6;
      const y = 0.5 + Math.random() * 1.7;
      const z = -3 - Math.random() * 15;
      e.setAttribute("position", `${x} ${y} ${z}`);

      const toX = x + (Math.random() * 0.5 - 0.25);
      const toY = y + (0.5 + Math.random() * 0.9);
      const toZ = z + (Math.random() * 0.5 - 0.25);
      e.setAttribute("animation__float",
        `property: position; dir: alternate; loop: true; dur: ${3000 + Math.random() * 4000}; to: ${toX} ${toY} ${toZ}`);
      e.setAttribute("animation__spin",
        `property: rotation; loop: true; dur: ${4000 + Math.random() * 5000}; to: ${(Math.random()*360|0)} ${(Math.random()*360|0)} ${(Math.random()*360|0)}`);

      this.el.appendChild(e);
      TRASH.push(e);
    }
  }
});

// --------- GAME MANAGER ----------
AFRAME.registerComponent("game-manager", {
  init: function () {
    this.levelTitle = $("#levelTitle");
    this.timerLabel = $("#timerLabel");
    this.info3D = $("#infoPanel");
    this.info3DText = $("#infoPanelText");
    this.info3DBtn = $("#infoPanelBtn");
    this.startPanel = $("#startPanel");

    this.scene = $("#scene");
    this.sky = $("#sky");
    this.beach = $("#beachEnv");
    this.under = $("#underwaterEnv");
    this.rig = $("#rig");
    this.turtle = $("#turtle");
    this.spawner = $("#spawner");

    this.levels = [
      { name: "Level 1 – Oppervlak", time: 90 },
      { name: "Level 2 – Waterkolom", time: 60 },
      { name: "Level 3 – Diepe zee", time: 45 },
      { name: "Level 4 – Abyssale vlaktes", time: 30 }
    ];
    this.i = -1;
    this.timer = 0;
    this.stats = {};

    // when trash collected
    this.scene.addEventListener("trashcollected", (ev) => {
      const t = (ev.detail && ev.detail.type) || "unknown";
      this.stats[t] = (this.stats[t] || 0) + 1;
    });

    // click start panel (desktop + VR ray)
    if (this.startPanel) {
      this.startPanel.addEventListener("click", () => this.startFromUI());
    }

    // desktop fallback
    window.addEventListener("click", () => {
      if (this.i < 0) this.startFromUI();
    });

    // turtle waits
    this.turtle.setAttribute("turtle-guide", "follow:false");
  },

  startFromUI: function () {
    if (this.i >= 0) return; // already started
    if (this.startPanel) this.startPanel.setAttribute("visible", "false");

    // small jump forward
    const obj = this.rig.object3D;
    obj.position.set(0, 1.6, -1);

    this.startLevel(0);
  },

  startLevel: function (idx) {
    this.i = idx;
    this.stats = {};

    // show underwater, hide beach
    this.beach.setAttribute("visible", "false");
    this.under.setAttribute("visible", "true");

    // fog always same, but sky darker
    const skyColors = ["#6cacbb", "#2e7991", "#0b4960", "#052e42"];
    this.scene.setAttribute("fog", "type: exponential; color: #0a3d62; density: 0.045");
    if (this.sky) this.sky.setAttribute("color", skyColors[idx]);

    // lights stable
    const lights = this.under.querySelectorAll("[light]");
    lights.forEach(el => {
      const conf = el.getAttribute("light") || {};
      if (conf.type === "ambient") {
        el.setAttribute("light", { type: "ambient", intensity: 0.45, color: "#7fd0ff" });
      } else if (conf.type === "directional") {
        el.setAttribute("light", { type: "directional", intensity: 0.65, color: "#bfe9ff" });
      }
    });

    // hands on + drift + turtle follow
    $("#leftHand").setAttribute("visible", "true");
    $("#rightHand").setAttribute("visible", "true");
    this.rig.setAttribute("simple-drift", "speed: 0.15");
    this.turtle.setAttribute("turtle-guide", "follow:true");

    // spawn trash (same style every level)
    this.spawner.innerHTML = "";
    TRASH.length = 0;
    const content = BOARD_DATA[idx];
    const sp = document.createElement("a-entity");
    sp.setAttribute("simple-trash-spawner", `count: 25; types: ${content.types.join(",")}`);
    this.spawner.appendChild(sp);

    // reset net score (per level)
    const net = $("#net").components["net-collector"];
    if (net) { net.score = 0; net.sync(); }

    // HUD
    this.levelTitle.textContent = this.levels[idx].name;
    this.timer = this.levels[idx].time;
    this.updateTimer();
  },

  buildBoardHTML: function () {
    const content = BOARD_DATA[this.i] || {};
    const keys = Object.keys(this.stats);
    let listHTML = "";
    if (keys.length === 0) {
      listHTML = "-";
    } else {
      listHTML = keys.map(k => {
        const meta = TYPE_META[k] || { label: k, icon: "•" };
        return `${meta.icon} ${meta.label}: ${this.stats[k]}`;
      }).join("\n");
    }

    return (
      `Opbrengst afval\n${listHTML}\n\n` +
      `Diepte: ${content.depthName || ""}\n` +
      `Afval op deze diepte:\n${content.wasteInfo || ""}\n\n` +
      `Levensduur:\n${(content.lifespan || []).join("\n")}\n\n` +
      `Geredde dieren:\n${(content.animals || []).join("\n")}\n` +
      `Info dieren:\n${content.animalsInfo || ""}`
    );
  },

  endLevel: function () {
    if (this._ending) return;
    this._ending = true;

    const net = $("#net").components["net-collector"];
    const caught = net ? net.score : 0;
    const names = ["Oppervlak", "Waterkolom", "Diepe zee", "Abyssale vlaktes"];

    const body = this.buildBoardHTML();
    this.info3DText.setAttribute(
      "text",
      `value: Einde level ${this.i + 1}: ${names[this.i]}\nGevangen dit level: ${caught}\nTotaal: ${TOTAL}\n\n${body}; align: center; color: #163344; width: 2.1; wrapCount: 38`
    );
    this.info3D.setAttribute("visible", true);

    // button -> next or finish
    this.info3DBtn.onclick = null;
    this.info3DBtn.addEventListener("click", () => {
      this.info3D.setAttribute("visible", false);
      this._ending = false;
      if (this.i < this.levels.length - 1) this.startLevel(this.i + 1);
      else this.finish();
    }, { once: true });
  },

  finish: function () {
    // final info
    const body = this.buildBoardHTML();
    this.info3DText.setAttribute(
      "text",
      `value: Einde level 4\nTotaal: ${TOTAL}\n\n${body}\n\nSluit in 30s...; align: center; color: #163344; width: 2.1; wrapCount: 38`
    );
    this.info3D.setAttribute("visible", true);

    setTimeout(() => {
      this.info3D.setAttribute("visible", false);
      this.showThankYou();
    }, 30000);
  },

  showThankYou: function () {
    const dlg = $("#startPanel");
    dlg.setAttribute("visible", true);
    dlg.querySelector("[text]").setAttribute(
      "text",
      `value: 🐢 Bedankt! Je hebt ${TOTAL} stukken plastic verzameld.\nKlik om opnieuw te spelen; align: center; color: #163344; width: 1.6`
    );
    dlg.addEventListener("click", () => location.reload(), { once: true });
  },

  updateTimer: function () {
    const m = Math.floor(this.timer / 60);
    const s = ("0" + Math.floor(this.timer % 60)).slice(-2);
    this.timerLabel.textContent = m + ":" + s;
  },

  tick: function (t, dt) {
    if (this.i < 0) return; // not started
    // timer
    this.timer -= dt / 1000;
    if (this.timer <= 0) {
      this.timer = 0;
      this.updateTimer();
      this.endLevel();
    } else {
      this.updateTimer();
    }
    // if player collected everything
    if (TRASH.length === 0) {
      this.endLevel();
    }
  }
});

// --------- VR SWIM (Quest 2) ----------
AFRAME.registerComponent("vr-swim", {
  schema: {
    moveSpeed: { default: 2.2 },
    verticalSpeed: { default: 1.5 },
    rotateSpeed: { default: 45 }
  },
  init: function () {
    this.rig = this.el;
    this.left = $("#leftController");
    this.right = $("#rightController");
    this.rightAxis = { x: 0, y: 0 };
    this.leftAxis = { x: 0, y: 0 };

    if (this.right) {
      this.right.addEventListener("thumbstickmoved", e => {
        this.rightAxis.x = e.detail.x;
        this.rightAxis.y = e.detail.y;
      });
      this.right.addEventListener("triggerdown", () => { this.goingUp = true; });
      this.right.addEventListener("triggerup", () => { this.goingUp = false; });
      // grip = bigger net
      this.right.addEventListener("gripdown", () => this.boostNet(true));
      this.right.addEventListener("gripup", () => this.boostNet(false));
    }
    if (this.left) {
      this.left.addEventListener("thumbstickmoved", e => {
        this.leftAxis.x = e.detail.x;
        this.leftAxis.y = e.detail.y;
      });
      this.left.addEventListener("triggerdown", () => { this.goingDown = true; });
      this.left.addEventListener("triggerup", () => { this.goingDown = false; });
    }
  },
  boostNet: function (on) {
    const net = $("#net");
    if (!net) return;
    const comp = net.components["net-collector"];
    if (!comp) return;
    comp.data.radius = on ? 0.85 : 0.5;
  },
  tick: function (time, dt) {
    if (!dt) return;
    const dts = dt / 1000;
    const rigObj = this.rig.object3D;

    // where camera looks
    const cam = this.rig.querySelector("[camera]");
    const camObj = cam ? cam.object3D : rigObj;

    const forward = new THREE.Vector3(0, 0, -1);
    camObj.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    // move fw/bw
    const fw = -this.rightAxis.y * this.data.moveSpeed * dts;
    rigObj.position.addScaledVector(forward, fw);

    // strafe
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const side = this.rightAxis.x * this.data.moveSpeed * dts;
    rigObj.position.addScaledVector(right, side);

    // vertical
    let vy = 0;
    if (this.goingUp) vy += this.data.verticalSpeed * dts;
    if (this.goingDown) vy -= this.data.verticalSpeed * dts;
    if (vy !== 0) rigObj.position.y += vy;

    // rotate with left X
    if (Math.abs(this.leftAxis.x) > 0.05) {
      const rotY = -this.leftAxis.x * this.data.rotateSpeed * dts;
      const euler = new THREE.Euler().setFromQuaternion(rigObj.quaternion, "YXZ");
      euler.y += THREE.MathUtils.degToRad(rotY);
      rigObj.quaternion.setFromEuler(euler);
    }
  }
});

// --------- hand vr sync ----------
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
      this.leftRigHand.setAttribute("visible", true);
      this.leftRigHand.object3D.position.set(0.02, -0.03, -0.13);
    }
    if (this.rightCtrl && this.rightRigHand) {
      this.rightCtrl.appendChild(this.rightRigHand);
      this.rightRigHand.setAttribute("visible", true);
      this.rightRigHand.object3D.position.set(0.02, -0.03, -0.13);
    }
    if (this.net && this.rightRigHand) {
      this.rightRigHand.appendChild(this.net);
      this.net.object3D.position.set(0, -0.02, -0.18);
    }
  },
  toDesktop: function () {
    if (this.rig && this.leftRigHand) {
      this.rig.appendChild(this.leftRigHand);
      this.leftRigHand.setAttribute("visible", true);
      this.leftRigHand.object3D.position.set(-0.25, -0.15, -0.5);
    }
    if (this.rig && this.rightRigHand) {
      this.rig.appendChild(this.rightRigHand);
      this.rightRigHand.setAttribute("visible", true);
      this.rightRigHand.object3D.position.set(0.25, -0.15, -0.5);
    }
  }
});
