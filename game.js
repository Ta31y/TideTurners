// --------- tiny helpers ----------
var $ = function (sel) {
  return document.querySelector(sel);
};
var TOTAL = 0;
var TRASH = []; // cache

// ---------- content per level ----------
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
      "Zinkend plastic, textielvezels, metaal/glasscherven, “marine snow” + microplastics.",
    lifespan: ["Plastic beker — ~450 jaar", "Koffiecup — ~500 jaar"],
    animals: ["Makreel", "Kwal", "Inktvis"],
    animalsInfo:
      "Dieren filteren voedsel en nemen microplastics op; spooknetten drijven mee door de kolom.",
    types: ["bottle", "textile", "metal", "bag"],
  },
  {
    depthName: "Diepe zee (1000–4000 m)",
    wasteInfo:
      "Metaal en glas, plastic zakken, verroeste visnetten, rubber/autobanden.",
    lifespan: [
      "Plastic flesje — ~450 jaar",
      "Autoband/rubber — heel lang (100+ jaar)",
    ],
    animals: ["Diepzeevissen", "Zeekomkommer"],
    animalsInfo: "Weinig licht; afval blijft lang liggen en bedekt de bodem.",
    types: ["bottle", "bag", "net", "rubber"],
  },
  {
    depthName: "Abyssale vlaktes en troggen (4000–11.000 m)",
    wasteInfo:
      "Plastic zakken + microplastics, oude metalen objecten, militair/industrieel afval.",
    lifespan: ["Wegwerpluier — ~500 jaar", "Tandenborstel — ~500 jaar"],
    animals: ["Diepzeevissen", "Spons", "Kreeftachtigen"],
    animalsInfo:
      "Extreem diep; bijna geen afbraak. Afval en microplastics stapelen zich op.",
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

// --------- movement (keyboard) ----------
AFRAME.registerComponent("simple-wasd", {
  schema: { speed: { default: 2.8 } },
  init: function () {
    this.dir = { x: 0, z: 0 };
    this.keys = {
      KeyW: false,
      KeyA: false,
      KeyS: false,
      KeyD: false,
      ArrowUp: false,
      ArrowLeft: false,
      ArrowDown: false,
      ArrowRight: false,
    };
    window.addEventListener("keydown", (e) => {
      if (e.code in this.keys) {
        this.keys[e.code] = true;
        this.updateDir();
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.code in this.keys) {
        this.keys[e.code] = false;
        this.updateDir();
      }
    });
  },
  updateDir: function () {
    var k = this.keys;
    this.dir.z =
      (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    this.dir.x =
      (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
  },
  tick: function (t, dt) {
    if (!dt) return;
    var obj = this.el.object3D;
    var f = new THREE.Vector3(0, 0, -1);
    obj.getWorldDirection(f);
    f.y = 0;
    f.normalize();
    var r = new THREE.Vector3()
      .crossVectors(f, new THREE.Vector3(0, 1, 0))
      .negate();
    var d = (dt / 1000) * this.data.speed;
    obj.position.addScaledVector(f, this.dir.z * d);
    obj.position.addScaledVector(r, this.dir.x * d);
    obj.position.x = THREE.MathUtils.clamp(obj.position.x, -38, 38);
    obj.position.z = THREE.MathUtils.clamp(obj.position.z, -80, 12);
  },
});

AFRAME.registerComponent("simple-vertical", {
  schema: {
    speed: { default: 1.0 },
    minY: { default: -0.2 },
    maxY: { default: 8 },
  },
  init: function () {
    this.ydir = 0;
    this.keys = { Space: false, ShiftLeft: false, KeyQ: false, KeyE: false };
    window.addEventListener("keydown", (e) => {
      if (e.code in this.keys) {
        this.keys[e.code] = true;
        this.calc();
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.code in this.keys) {
        this.keys[e.code] = false;
        this.calc();
      }
    });
  },
  calc: function () {
    this.ydir =
      (this.keys.Space || this.keys.KeyQ ? 1 : 0) +
      (this.keys.ShiftLeft || this.keys.KeyE ? -1 : 0);
  },
  tick: function (t, dt) {
    if (!dt || this.ydir === 0) return;
    var o = this.el.object3D,
      d = (dt / 1000) * this.data.speed * this.ydir;
    o.position.y = THREE.MathUtils.clamp(
      o.position.y + d,
      this.data.minY,
      this.data.maxY
    );
  },
});

AFRAME.registerComponent("simple-drift", {
  schema: { speed: { default: 0 } },
  tick: function (t, dt) {
    if (!dt || !this.data.speed) return;
    var obj = this.el.object3D,
      f = new THREE.Vector3(0, 0, -1);
    obj.getWorldDirection(f);
    f.multiplyScalar((dt / 1000) * this.data.speed);
    obj.position.add(f);
  },
});

// --------- net collector ----------
AFRAME.registerComponent("net-collector", {
  schema: { radius: { default: 0.45 }, score3D: { type: "selector" } },
  init: function () {
    this.score = 0;
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
    this.sync();
  },
  sync: function () {
    var t = "Trash: " + this.score;
    if (this.data.score3D) this.data.score3D.setAttribute("text", "value", t);
    var lbl = $("#totalScoreLabel");
    if (lbl) lbl.textContent = "Total collected: " + TOTAL;
  },
  tick: function () {
    var netPos = this.el.object3D.getWorldPosition(this.tmp);
    for (var i = TRASH.length - 1; i >= 0; i--) {
      var e = TRASH[i];
      if (!e.parentNode) {
        TRASH.splice(i, 1);
        continue;
      }
      var p = e.object3D.getWorldPosition(this.tmp2);
      if (p.distanceTo(netPos) < this.data.radius) {
        var t = e.getAttribute("data-type") || "unknown";
        this.el.sceneEl.emit("trashcollected", { type: t }, true);

        e.parentNode.removeChild(e);
        TRASH.splice(i, 1);
        this.score++;
        TOTAL++;
        this.sync();

        var rightHand = document.querySelector("#rightHand");
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

// --------- boost radius on press (desktop) ----------
AFRAME.registerComponent("net-boost", {
  schema: { base: { default: 0.45 }, boosted: { default: 0.8 } },
  init: function () {
    this.net = this.el.components["net-collector"];
    if (!this.net) return;
    var setBase = () => {
      this.net.data.radius = this.data.base;
    };
    var setBoost = () => {
      this.net.data.radius = this.data.boosted;
    };
    window.addEventListener("mousedown", setBoost);
    window.addEventListener("mouseup", setBase);
    window.addEventListener("blur", setBase);
  },
});

// --------- turtle follow ----------
AFRAME.registerComponent("turtle-guide", {
  schema: { offset: { default: "-0.4 0 -1.2" }, follow: { default: false } },
  init: function () {
    var o = this.data.offset.split(" ").map(parseFloat);
    this.off = new THREE.Vector3(o[0], o[1], o[2]);
    this.t = 0;
  },
  tick: function (t, dt) {
    this.t += dt / 1000;
    if (!this.data.follow) return;
    var rig = $("#rig").object3D;
    var f = new THREE.Vector3(0, 0, -1);
    rig.getWorldDirection(f);
    var base = rig.position.clone().add(f.multiplyScalar(2.3));
    base.y += 0.2 * Math.sin(this.t * 1.2);
    this.el.object3D.position.copy(base.add(this.off));
    this.el.object3D.lookAt(
      rig.position.x,
      rig.position.y + 0.2,
      rig.position.z
    );
  },
});

// --------- trash spawner ----------
AFRAME.registerComponent("simple-trash-spawner", {
  schema: {
    count: { default: 25 },
    types: { default: "bottle,straw,bag,rings" },
  },
  init: function () {
    var typeList = this.data.types
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (var i = 0; i < this.data.count; i++) {
      var e = document.createElement("a-entity");
      e.className = "trash";
      var t = typeList[Math.floor(Math.random() * typeList.length)];
      e.setAttribute("data-type", t);

      var shapes = ["box", "sphere", "cylinder"];
      var shape = shapes[Math.floor(Math.random() * shapes.length)];
      if (shape === "box")
        e.setAttribute(
          "geometry",
          "primitive: box; depth:0.25; height:0.1; width:0.18"
        );
      if (shape === "sphere")
        e.setAttribute("geometry", "primitive: sphere; radius:0.12");
      if (shape === "cylinder")
        e.setAttribute(
          "geometry",
          "primitive: cylinder; radius:0.08; height:0.22"
        );

      var colors = ["#c9e7ff", "#ffcc66", "#ff8888", "#a0ffb3", "#ffd1dc"];
      e.setAttribute(
        "material",
        "color:" + colors[Math.floor(Math.random() * colors.length)]
      );

      var x = (Math.random() * 2 - 1) * 18,
        y = 0.5 + Math.random() * 4,
        z = -5 - Math.random() * 70;
      e.setAttribute("position", x + " " + y + " " + z);

      var toX = x + (Math.random() * 0.5 - 0.25),
        toY = y + (0.6 + Math.random() * 1.2),
        toZ = z + (Math.random() * 0.5 - 0.25);
      e.setAttribute(
        "animation__float",
        "property: position; dir: alternate; loop: true; dur: " +
          (3000 + Math.random() * 4000) +
          "; to: " +
          toX +
          " " +
          toY +
          " " +
          toZ
      );
      e.setAttribute(
        "animation__spin",
        "property: rotation; loop: true; dur: " +
          (4000 + Math.random() * 5000) +
          "; to: " +
          ((Math.random() * 360) | 0) +
          " " +
          ((Math.random() * 360) | 0) +
          " " +
          ((Math.random() * 360) | 0)
      );

      this.el.appendChild(e);
      TRASH.push(e);
    }
  },
});

// --------- game manager ----------
AFRAME.registerComponent("game-manager", {
  init: function () {
    this.dialog = $("#dialog");
    this.dialogBtn = $("#dialogBtn");
    this.info = $("#info");
    this.infoBtn = $("#infoBtn");
    this.infoText = $("#infoText");
    this.levelTitle = $("#levelTitle");
    this.timerLabel = $("#timerLabel");

    this.scene = $("#scene");
    this.sky = $("#sky");
    this.beach = $("#beachEnv");
    this.under = $("#underwaterEnv");
    this.rig = $("#rig");
    this.turtle = $("#turtle");
    this.spawner = $("#spawner");

    this.levels = [
      { name: "Level 1 – Oppervlak", time: 90, fog: 0.045, count: 25 },
      { name: "Level 2 – Waterkolom", time: 60, fog: 0.06, count: 28 },
      { name: "Level 3 – Diepe zee", time: 45, fog: 0.075, count: 30 },
      { name: "Level 4 – Abyssale vlaktes", time: 30, fog: 0.09, count: 32 },
    ];
    this.i = -1;
    this.timer = 0;
    this.stats = {};

    // collect listener
    this.scene.addEventListener("trashcollected", (ev) => {
      const t = (ev.detail && ev.detail.type) || "unknown";
      this.stats[t] = (this.stats[t] || 0) + 1;
    });

    this.turtle.setAttribute("turtle-guide", "follow:false");

    // start button
    this.dialogBtn.onclick = () => this.startTransition();
    // overlay click
    this.dialog.addEventListener("click", (e) => {
      if (e.target.id === "dialog") this.startTransition();
    });
    // keyboard
    window.addEventListener("keydown", (e) => {
      if (
        (e.code === "Enter" || e.code === "Space") &&
        !this.dialog.classList.contains("hidden")
      ) {
        this.startTransition();
      }
    });

    // while start dialog open -> block scene
    this.setCanvasInteractive(false);
  },

  // helper
  setCanvasInteractive: function (on) {
    const canvas = this.scene && this.scene.canvas;
    if (!canvas) return;
    canvas.style.pointerEvents = on ? "auto" : "none";
  },

  startTransition: function () {
    this.dialog.classList.add("hidden");
    this.setCanvasInteractive(true);

    var obj = this.rig.object3D;
    var startZ = obj.position.z,
      startY = obj.position.y;
    var targetZ = -2,
      targetY = 1.6;
    var t0 = null;
    var step = (ts) => {
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / 2000);
      obj.position.z = THREE.MathUtils.lerp(startZ, targetZ, k);
      obj.position.y = THREE.MathUtils.lerp(startY, targetY, k);
      if (k < 1) requestAnimationFrame(step);
      else this.startLevel(0);
    };
    requestAnimationFrame(step);
  },

  startLevel: function (idx) {
    this.i = idx;
    var L = this.levels[idx];
    var content = BOARD_DATA[idx];

    // show Next button again
    if (this.infoBtn) this.infoBtn.style.display = "";

    this.stats = {};

    this.beach.setAttribute("visible", "false");
    this.under.setAttribute("visible", "true");

    const colors = ["#2b7a8b", "#165f75", "#0b4960", "#052e42"];
    this.scene.setAttribute(
      "fog",
      `type: exponential; color: ${colors[idx]}; density: ${L.fog}`
    );
    this.scene.setAttribute("background", "color: " + colors[idx]);
    if (this.sky) this.sky.setAttribute("color", colors[idx]);

    const lights = this.under.querySelectorAll("[light]");
    for (let j = 0; j < lights.length; j++) {
      const el = lights[j];
      const conf = el.getAttribute("light") || {};
      if (conf.type === "ambient") {
        const inten = Math.max(0.18, 0.45 - idx * 0.09);
        el.setAttribute("light", {
          type: "ambient",
          intensity: inten,
          color: colors[idx],
        });
      } else if (conf.type === "directional") {
        const intenD = Math.max(0.35, 0.65 - idx * 0.08);
        el.setAttribute("light", {
          type: "directional",
          intensity: intenD,
          color: "#bfe9ff",
        });
      }
    }

    $("#leftHand").setAttribute("visible", "true");
    $("#rightHand").setAttribute("visible", "true");
    this.rig.setAttribute("simple-drift", "speed: 0.15");
    this.turtle.setAttribute("turtle-guide", "follow:true");

    this.spawner.innerHTML = "";
    TRASH.length = 0;
    var sp = document.createElement("a-entity");
    sp.setAttribute(
      "simple-trash-spawner",
      "count:" + L.count + "; types:" + content.types.join(",")
    );
    this.spawner.appendChild(sp);

    var net = $("#net").components["net-collector"];
    if (net) {
      net.score = 0;
      net.sync();
    }

    this.levelTitle.textContent = L.name;
    this.timer = L.time;
    this.updateTimer();
  },

  buildBoardHTML: function () {
    const content = BOARD_DATA[this.i] || {};
    let listHTML = "";
    const keys = Object.keys(this.stats);
    if (keys.length === 0) {
      listHTML = "<li>—</li>";
    } else {
      listHTML = keys
        .map((k) => {
          const meta = TYPE_META[k] || { label: k, icon: "▪︎" };
          const n = this.stats[k] || 0;
          return `<li><span class="badge">${n}</span><span class="icon">${meta.icon}</span> ${meta.label}</li>`;
        })
        .join("");
    }

    const animalsHTML =
      (content.animals || []).map((a) => `<li>${a}</li>`).join("") ||
      "<li>—</li>";
    const lifeHTML =
      (content.lifespan || []).map((s) => `<li>${s}</li>`).join("") ||
      "<li>—</li>";

    return `
      <div class="board">
        <div class="panelbox">
          <h3>Opbrengst afval</h3>
          <div class="kv">
            <div class="icon">🧹</div><div><small>Diepte:</small><br><strong>${
              content.depthName || ""
            }</strong></div>
          </div>
          <ul>${listHTML}</ul>
          <h3>Info over afval op deze diepte</h3>
          <p>${content.wasteInfo || ""}</p>
          <h3>Levensduur (voorbeeld)</h3>
          <ul>${lifeHTML}</ul>
        </div>
        <div class="panelbox">
          <h3>Geredde dieren</h3>
          <ul>${animalsHTML}</ul>
          <h3>Info over dieren op deze diepte</h3>
          <p>${content.animalsInfo || ""}</p>
        </div>
      </div>
    `;
  },

  endLevel: function () {
    if (this._ending) return;
    this._ending = true;

    var net = $("#net").components["net-collector"];
    var caught = net ? net.score : 0;
    var names = ["Oppervlak", "Waterkolom", "Diepe zee", "Abyssale vlaktes"];

    const board = this.buildBoardHTML();

    var html =
      `<strong>Einde level ${this.i + 1}: ${names[this.i]}</strong><br><br>` +
      `Gevangen plastic dit level: <strong>${caught}</strong><br>` +
      `Totaal gevangen: <strong>${TOTAL}</strong><br><br>` +
      board;

    this.info.querySelector("#infoText").innerHTML = html;
    this.info.classList.remove("hidden");

    this.setCanvasInteractive(false);

    this.infoBtn.onclick = () => {
      this.info.classList.add("hidden");
      this._ending = false;
      this.setCanvasInteractive(true);
      if (this.i < this.levels.length - 1) this.startLevel(this.i + 1);
      else this.finish();
    };
  },

  finish: function () {
    const boardHTML = this.buildBoardHTML();
    const total = TOTAL;

    this.info.querySelector("#infoText").innerHTML =
      `<strong>Einde level 4: Abyssale vlaktes</strong><br><br>` +
      `Gevangen plastic dit level: <strong>${Object.values(this.stats).reduce(
        (a, b) => a + b,
        0
      )}</strong><br>` +
      `Totaal gevangen: <strong>${total}</strong><br><br>` +
      boardHTML +
      `<p style="text-align:center; opacity:.8; margin-top:8px;">Sluit automatisch in 30 seconden...</p>`;
    this.info.classList.remove("hidden");
    this.infoBtn.style.display = "none";

    this.setCanvasInteractive(false);

    setTimeout(() => {
      this.info.classList.add("hidden");
      this.setCanvasInteractive(true);
      this.showThankYouScene(total);
    }, 30000);
  },

  showThankYouScene: function (total) {
    var obj = this.rig.object3D;
    var turtle = this.turtle.object3D;
    var t0 = null;
    var startY = obj.position.y,
      targetY = 3;
    var self = this;
    function movePlayer(ts) {
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / 3000);
      obj.position.y = THREE.MathUtils.lerp(startY, targetY, k);
      if (k < 1) requestAnimationFrame(movePlayer);
      else self.turtleThankYou(total);
    }
    requestAnimationFrame(movePlayer);
  },

  turtleThankYou: function (total) {
    const turtle = this.turtle;
    turtle.setAttribute("turtle-guide", "follow:false");
    const tObj = turtle.object3D;
    const startPos = tObj.position.clone();
    const endPos = startPos.clone().add(new THREE.Vector3(0, 1.5, 1.2));
    const t0 = performance.now();
    const self = this;

    function animate() {
      const elapsed = (performance.now() - t0) / 1000;
      const k = Math.min(1, elapsed / 3);
      tObj.position.lerpVectors(startPos, endPos, k);
      if (k < 1) requestAnimationFrame(animate);
      else showDialog();
    }
    requestAnimationFrame(animate);

    function showDialog() {
      const dlg = $("#dialog");
      const btn = $("#dialogBtn");
      dlg.querySelector(
        "#dialogText"
      ).innerHTML = `🐢 Bedankt voor je hulp!<br>Je hebt <strong>${total}</strong> stukken plastic verzameld.<br><br>Tot snel! 🌊`;
      btn.textContent = "Opnieuw spelen";
      dlg.classList.remove("hidden");

      self.setCanvasInteractive(false);

      btn.onclick = function () {
        location.reload();
      };
    }
  },

  updateTimer: function () {
    var m = Math.floor(this.timer / 60),
      s = ("0" + Math.floor(this.timer % 60)).slice(-2);
    this.timerLabel.textContent = m + ":" + s;
  },

  tick: function (t, dt) {
    if (this.i < 0) return;
    if (TRASH.length === 0) {
      this.updateTimer();
      this.endLevel();
      return;
    }
    this.timer -= dt / 1000;
    if (this.timer <= 0) {
      this.timer = 0;
      this.updateTimer();
      this.endLevel();
    } else this.updateTimer();
  },
});

// --- Button events for Quest 2 ---
AFRAME.registerComponent('vr-controls', {
  init: function () {
    this.rig = document.querySelector('#rig');
    this.left = document.querySelector('#leftController');
    this.right = document.querySelector('#rightController');
    this.speed = 0.03;

    if (this.left) {
      this.left.addEventListener('thumbstickmoved', e => this.move(e));
      this.left.addEventListener('triggerdown', () => this.boost(true));
      this.left.addEventListener('triggerup', () => this.boost(false));

      // Extra buttons (left controller)
      this.left.addEventListener('abuttondown', () => this.toggleTurtleFollow());
      this.left.addEventListener('xbuttondown', () => this.resetPosition());
    }

    if (this.right) {
      this.right.addEventListener('thumbstickmoved', e => this.move(e));
      this.right.addEventListener('triggerdown', () => this.boost(true));
      this.right.addEventListener('triggerup', () => this.boost(false));

      // Extra buttons (right controller)
      this.right.addEventListener('abuttondown', () => this.toggleInfo());
      this.right.addEventListener('bbuttondown', () => this.skipBoard());
    }
  },

  move: function (e) {
    if (!this.rig) return;
    const rigObj = this.rig.object3D;
    const dir = new THREE.Vector3();
    rigObj.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();

    // Move forward/backward
    rigObj.position.addScaledVector(dir, -e.y * this.speed);
    // Move sideways
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    rigObj.position.addScaledVector(right, e.x * this.speed);
  },

  boost: function (on) {
    const net = document.querySelector('#net');
    if (!net) return;
    const comp = net.components['net-collector'];
    if (!comp) return;
    comp.data.radius = on ? 0.8 : 0.45;
  },

  // === Extra button actions ===
  toggleInfo: function () {
    const info = document.querySelector('#info');
    info.classList.toggle('hidden');
  },

  skipBoard: function () {
    const nextBtn = document.querySelector('#infoBtn');
    if (nextBtn && !nextBtn.classList.contains('hidden')) nextBtn.click();
  },

  toggleTurtleFollow: function () {
    const turtle = document.querySelector('#turtle');
    const current = turtle.getAttribute('turtle-guide').follow;
    turtle.setAttribute('turtle-guide', `follow: ${!current}`);
  },

  resetPosition: function () {
    const rig = document.querySelector('#rig');
    rig.setAttribute('position', '0 1.6 8');
  }
});
