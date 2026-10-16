/*
 * House Shutters Card for Home Assistant
 * Author: Daniel Dias (@dmdias) - https://github.com/dmdias/house-shutters-card
 *
 * Draws your roller shutters, lamps and gates over a photo of your house.
 *
 *   type: custom:house-shutters-card
 *   title: Front
 *   image: /local/house/front.jpg
 *   color: "#2a5152"              # optional, shutter colour
 *   slat_size: 0.28               # optional, slat height in % of the photo width
 *   windows:                      # box of each window, in % of the photo
 *     - entity: cover.living_room
 *       name: Living room
 *       x: 25
 *       y: 60
 *       w: 12.5
 *       h: 15.6
 *       label: below              # optional, name under the window instead of above
 *   others:                       # shutters not visible in the photo
 *     - entity: cover.bathroom
 *       name: Bathroom
 *   lights:                       # lamps in the photo (centre, in %): tap to toggle
 *     - entity: light.porch
 *       name: Porch
 *       x: 56
 *       y: 62
 *       size: 0.7                 # optional, scale of the lamp and its glow
 *   other_lights:                 # lights not visible in the photo
 *     - entity: light.garden
 *       name: Garden
 *   gates:                        # swing gates
 *     - entity: cover.gate
 *       name: Gate
 *       x: 12                   # box of the whole gate, in % of the photo
 *       y: 55
 *       w: 28
 *       h: 33
 *       split: 50               # where the two leaves meet, in % of the box width
 *       behind: [26, 61, 14, 10]   # photo area (x, y, w, h in %) shown through the opening
 *       frames: [/local/house/gate-1.jpg, /local/house/gate-2.jpg]   # optional, photos of the gate opening
 *       frames_box: [10, 42, 30, 52]  # where the frames go (x, y, w, h in %)
 *       duration: 15              # seconds the gate takes to open
 *
 * A shutter comes down over its window as far as the cover's current position
 * (0 = closed, 100 = open). Tap a window or a gate for its controls.
 */

const CARD_VERSION = "1.5.1";

const hscEsc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

class HouseShuttersCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._open = null; // entity whose controls are shown
  }

  setConfig(config) {
    if (!config.image) throw new Error("image is required");
    this._config = { color: "#2a5152", slat_size: 0.28, windows: [], others: [], lights: [], other_lights: [], gates: [], ...config };
    this._built = false;
    this._build();
  }

  getCardSize() {
    return 8;
  }

  set hass(hass) {
    const lang = (hass?.locale?.language || "en").slice(0, 2);
    if (lang !== this._lang) this._built = false; // texts follow the Home Assistant language
    this._hass = hass;
    if (!this._built) this._build();
    this._update();
  }

  _position(entity) {
    const st = this._hass?.states[entity];
    if (!st) return null;
    const p = Number(st.attributes.current_position);
    if (Number.isFinite(p)) return Math.max(0, Math.min(100, p));
    return st.state === "open" ? 100 : st.state === "closed" ? 0 : null;
  }

  _label(entity, fallback) {
    return fallback || this._hass?.states[entity]?.attributes.friendly_name || entity;
  }

  _build() {
    if (!this._config) return;
    const c = this._config;
    const lang = (this._hass?.locale?.language || "en").slice(0, 2);
    this._lang = lang;
    this._t = lang === "pt"
      ? { up: "Subir", stop: "Parar", down: "Descer", half: "50%", closed: "Fechada", open: "Aberta", g_open: "Aberto", g_closed: "Fechado", g_opening: "A abrir", g_closing: "A fechar", g_up: "Abrir", g_down: "Fechar" }
      : { up: "Open", stop: "Stop", down: "Close", half: "50%", closed: "Closed", open: "Open", g_open: "Open", g_closed: "Closed", g_opening: "Opening", g_closing: "Closing", g_up: "Open", g_down: "Close" };
    const img = hscEsc(c.image);
    const gates = c.gates
      .map((g, i) => {
        const split = g.split ?? 50;
        const [bx, by, bw, bh] = g.behind || [g.x, g.y, g.w, g.h];
        // Leaves show their own piece of the photo: the photo scaled to the gate box
        const size = `${(100 / g.w) * 100}% ${(100 / g.h) * 100}%`;
        const posL = `${(g.x / (100 - g.w)) * 100}% ${(g.y / (100 - g.h)) * 100}%`;
        const leaf = (side, left, width) => {
          const px = g.x + (left / 100) * g.w;
          const pw = (width / 100) * g.w;
          const lsize = `${(100 / pw) * 100}% ${(100 / g.h) * 100}%`;
          const lpos = `${(px / (100 - pw)) * 100}% ${(g.y / (100 - g.h)) * 100}%`;
          return `<div class="leaf ${side}" style="left:${left}%;width:${width}%;background-image:url('${img}');background-size:${lsize};background-position:${lpos}"></div>`;
        };
        const bsize = `${(100 / bw) * 100}% ${(100 / bh) * 100}%`;
        const bpos = `${(bx / (100 - bw)) * 100}% ${(by / (100 - bh)) * 100}%`;
        if (Array.isArray(g.frames) && g.frames.length) {
          const [fx, fy, fw, fh] = g.frames_box || [g.x, g.y, g.w, g.h];
          const imgs = g.frames.map((f) => `<img src="${hscEsc(f)}" alt="">`).join("");
          return `<div class="frames" data-gf="${i}" style="left:${fx}%;top:${fy}%;width:${fw}%;height:${fh}%">${imgs}</div>
            <div class="gate photo-gate" data-g="${i}" style="left:${g.x}%;top:${g.y}%;width:${g.w}%;height:${g.h}%">
            <span class="tag"><b>${hscEsc(g.name || "")}</b><em></em></span></div>`;
        }
        return `<div class="gate" data-g="${i}" style="left:${g.x}%;top:${g.y}%;width:${g.w}%;height:${g.h}%">
          <div class="behind" style="background-image:url('${img}');background-size:${bsize};background-position:${bpos}"></div>
          ${leaf("l", 0, split)}${leaf("r", split, 100 - split)}
          <span class="tag"><b>${hscEsc(g.name || "")}</b><em></em></span></div>`;
      })
      .join("");
    const windows = c.windows
      .map(
        (w, i) => `<div class="win${w.label === "below" ? " label-below" : ""}" data-i="${i}" style="left:${w.x}%;top:${w.y}%;width:${w.w}%;height:${w.h}%">
          <div class="shutter"><i class="bar"></i></div>
          <span class="tag"><b>${hscEsc(w.name || "")}</b><em></em></span>
        </div>`
      )
      .join("");
    const lamps = c.lights
      .map((l, i) => `<div class="lamp" data-l="${i}" style="left:${l.x}%;top:${l.y}%;width:${3.4 * (Number(l.size) || 1)}%" title="${hscEsc(l.name || "")}"><i class="glow"></i><i class="spot"></i></div>`)
      .join("");
    const otherLights = c.other_lights
      .map((l, i) => `<button class="other light" data-ol="${i}"><span class="bulb">💡</span><b>${hscEsc(l.name || "")}</b></button>`)
      .join("");
    const others = c.others
      .map((o, i) => `<button class="other" data-o="${i}"><span class="mini"><i></i></span><b>${hscEsc(o.name || "")}</b><em></em></button>`)
      .join("");
    this.shadowRoot.innerHTML = `<style>${HSC_STYLES}</style>
      <ha-card style="--slat:${hscEsc(c.color)}">
        ${c.title ? `<div class="title">${hscEsc(c.title)}</div>` : ""}
        <div class="photo"><img src="${hscEsc(c.image)}" alt="">${gates}${windows}${lamps}<div class="panel" hidden></div></div>
        ${others || otherLights ? `<div class="others">${others}${otherLights}</div>` : ""}
      </ha-card>`;
    this.shadowRoot.querySelectorAll(".win").forEach((el) => (el.onclick = (ev) => (ev.stopPropagation(), this._toggle(c.windows[Number(el.dataset.i)], el))));
    this.shadowRoot.querySelectorAll("[data-o]").forEach((el) => (el.onclick = (ev) => (ev.stopPropagation(), this._toggle(c.others[Number(el.dataset.o)], el))));
    this.shadowRoot.querySelectorAll(".gate").forEach((el) => (el.onclick = (ev) => (ev.stopPropagation(), this._toggle({ ...c.gates[Number(el.dataset.g)], kind: "gate" }, el))));
    this.shadowRoot.querySelectorAll(".lamp").forEach((el) => (el.onclick = (ev) => (ev.stopPropagation(), this._toggleLight(c.lights[Number(el.dataset.l)].entity))));
    this.shadowRoot.querySelectorAll("[data-ol]").forEach((el) => (el.onclick = (ev) => (ev.stopPropagation(), this._toggleLight(c.other_lights[Number(el.dataset.ol)].entity))));
    this.shadowRoot.querySelector(".photo").onclick = () => this._close();
    this._built = true;
    const photo = this.shadowRoot.querySelector(".photo");
    const pitch = () => photo.style.setProperty("--p", `${Math.max(2.6, (photo.clientWidth * this._config.slat_size) / 100).toFixed(2)}px`);
    this._ro?.disconnect();
    this._ro = new ResizeObserver(pitch);
    this._ro.observe(photo);
    pitch();
    if (this._hass) this._update();
  }

  _update() {
    if (!this._built || !this._hass) return;
    const t = this._t;
    const root = this.shadowRoot;
    root.querySelectorAll(".win").forEach((el) => {
      const w = this._config.windows[Number(el.dataset.i)];
      const p = this._position(w.entity);
      const closed = p == null ? 0 : 100 - p; // how far the blind is down
      el.querySelector(".shutter").style.height = `${closed}%`;
      el.querySelector(".tag em").textContent = p == null ? "—" : p === 0 ? t.closed : p === 100 ? t.open : `${Math.round(p)}%`;
      el.classList.toggle("unavailable", this._hass.states[w.entity]?.state === "unavailable");
    });
    root.querySelectorAll("[data-o]").forEach((el) => {
      const o = this._config.others[Number(el.dataset.o)];
      const p = this._position(o.entity);
      el.querySelector(".mini i").style.height = `${p == null ? 0 : 100 - p}%`;
      el.querySelector("em").textContent = p == null ? "—" : `${Math.round(p)}%`;
    });
    root.querySelectorAll(".gate").forEach((el) => {
      const gi = Number(el.dataset.g);
      const st = this._hass.states[this._config.gates[gi].entity]?.state;
      if (el.classList.contains("photo-gate")) this._animateFrames(gi, st);
      el.classList.toggle("open", st === "open" || st === "opening");
      el.querySelector(".tag em").textContent = { open: t.g_open, closed: t.g_closed, opening: t.g_opening, closing: t.g_closing }[st] || "—";
    });
    root.querySelectorAll(".lamp").forEach((el) => {
      const st = this._hass.states[this._config.lights[Number(el.dataset.l)].entity];
      el.classList.toggle("on", st?.state === "on");
    });
    root.querySelectorAll("[data-ol]").forEach((el) => {
      const st = this._hass.states[this._config.other_lights[Number(el.dataset.ol)].entity];
      el.classList.toggle("on", st?.state === "on");
    });
    if (this._open) this._refreshPanel();
  }

  _placePanel(panel) {
    const photo = this.shadowRoot.querySelector(".photo").getBoundingClientRect();
    const a = this._anchor.getBoundingClientRect();
    const inPhoto = this._anchor.classList.contains("win");
    const left = inPhoto ? Math.min(Math.max(a.left - photo.left + a.width / 2 - 90, 6), photo.width - 186) : 6;
    const top = inPhoto ? (a.bottom - photo.top + 128 < photo.height ? a.bottom - photo.top + 6 : Math.max(a.top - photo.top - 128, 6)) : photo.height - 134;
    Object.assign(panel.style, { left: `${left}px`, top: `${top}px` });
  }

  _refreshPanel() {
    const panel = this.shadowRoot.querySelector(".panel");
    if (!panel || panel.hidden || !this._open) return;
    const p = this._position(this._open.entity);
    const value = panel.querySelector(".ph span");
    if (this._open.kind === "gate") {
      const st = this._hass.states[this._open.entity]?.state;
      const t = this._t;
      if (value) value.textContent = { open: t.g_open, closed: t.g_closed, opening: t.g_opening, closing: t.g_closing }[st] || "—";
      return;
    }
    if (value) value.textContent = p == null ? "—" : `${Math.round(p)}%`;
    const range = panel.querySelector("input");
    if (range && !this._dragging && p != null) range.value = p;
  }

  /** Step through the photos of the gate towards open (last frame) or closed (none shown). */
  _animateFrames(gi, state) {
    const g = this._config.gates[gi];
    const box = this.shadowRoot.querySelector(`.frames[data-gf="${gi}"]`);
    if (!box) return;
    const imgs = [...box.querySelectorAll("img")];
    const target = state === "open" || state === "opening" ? imgs.length : 0;
    this._frame ??= {};
    this._timers ??= {};
    if (this._frame[gi] === undefined) {
      // First state seen: show it without animating
      this._frame[gi] = target;
      imgs.forEach((im, k) => im.classList.toggle("on", k < target));
      return;
    }
    if (this._frameTarget?.[gi] === target) return;
    (this._frameTarget ??= {})[gi] = target;
    clearInterval(this._timers[gi]);
    const step = ((Number(g.duration) || 15) * 1000) / imgs.length;
    const tick = () => {
      const cur = this._frame[gi];
      if (cur === target) return clearInterval(this._timers[gi]);
      this._frame[gi] = cur + (target > cur ? 1 : -1);
      imgs.forEach((im, k) => im.classList.toggle("on", k < this._frame[gi]));
    };
    tick();
    this._timers[gi] = setInterval(tick, step);
  }

  _toggleLight(entity) {
    this._hass.callService("homeassistant", "toggle", { entity_id: entity });
  }

  _toggle(item, anchor) {
    if (this._open?.entity === item.entity) return this._close();
    this._open = item;
    this._anchor = anchor;
    this._renderPanel();
  }

  _close() {
    this._open = null;
    const panel = this.shadowRoot.querySelector(".panel");
    if (panel) panel.hidden = true;
  }

  _renderPanel() {
    const panel = this.shadowRoot.querySelector(".panel");
    const item = this._open;
    if (!panel || !item) return;
    const t = this._t;
    const p = this._position(item.entity);
    if (item.kind === "gate") {
      const st = this._hass.states[item.entity]?.state;
      panel.innerHTML = `<div class="ph"><b>${hscEsc(this._label(item.entity, item.name))}</b><span>${hscEsc({ open: t.g_open, closed: t.g_closed, opening: t.g_opening, closing: t.g_closing }[st] || "—")}</span></div>
        <div class="pb"><button data-a="open">${t.g_up}</button><button data-a="stop">■</button><button data-a="close">${t.g_down}</button></div>`;
    } else panel.innerHTML = `<div class="ph"><b>${hscEsc(this._label(item.entity, item.name))}</b><span>${p == null ? "—" : Math.round(p) + "%"}</span></div>
      <div class="pb">
        <button data-a="open" title="${t.up}">▲</button>
        <button data-a="stop" title="${t.stop}">■</button>
        <button data-a="close" title="${t.down}">▼</button>
        <button data-a="half" title="${t.half}">½</button>
      </div>
      <input type="range" min="0" max="100" step="5" value="${p ?? 0}">`;
    if (item.kind === "gate") {
      panel.hidden = false;
      this._placePanel(panel);
      panel.onclick = (ev) => ev.stopPropagation();
      panel.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => this._hass.callService("cover", `${b.dataset.a}_cover`, { entity_id: item.entity })));
      return;
    }
    panel.hidden = false;
    this._placePanel(panel);
    panel.onclick = (ev) => ev.stopPropagation();
    panel.querySelectorAll("[data-a]").forEach(
      (b) =>
        (b.onclick = () => {
          const a = b.dataset.a;
          if (a === "half") this._hass.callService("cover", "set_cover_position", { entity_id: item.entity, position: 50 });
          else this._hass.callService("cover", `${a}_cover`, { entity_id: item.entity });
        })
    );
    const range = panel.querySelector("input");
    range.onpointerdown = () => (this._dragging = true);
    range.oninput = () => {
      this._dragging = true;
      panel.querySelector(".ph span").textContent = `${range.value}%`;
    };
    range.onchange = () => {
      this._dragging = false;
      this._hass.callService("cover", "set_cover_position", { entity_id: item.entity, position: Number(range.value) });
    };
    range.onpointerup = range.onpointercancel = () => setTimeout(() => (this._dragging = false), 300);
  }
}

const HSC_STYLES = `
  :host { display:block; }
  ha-card { overflow:hidden; border-radius:16px; }
  .title { padding:12px 16px 0; font-size:18px; font-weight:500; }
  .photo { position:relative; margin:10px; border-radius:12px; overflow:hidden; line-height:0; user-select:none; }
  .photo img { width:100%; display:block; }
  .win { position:absolute; cursor:pointer; }
  .win:hover { outline:2px solid rgba(255,255,255,.85); outline-offset:2px; border-radius:2px; }
  .shutter { position:absolute; left:0; right:0; top:0; height:0; overflow:hidden; border-radius:1px; transition:height .8s ease;
    background:
      repeating-linear-gradient(180deg,
        rgba(0,0,0,.30) 0 1px,
        rgba(255,255,255,.10) 1px 2px,
        rgba(255,255,255,.04) 2px calc(var(--p) * .5),
        rgba(0,0,0,.14) calc(var(--p) * .5) calc(var(--p) * .5 + 1px),
        rgba(255,255,255,.05) calc(var(--p) * .5 + 1px) calc(var(--p) * .5 + 2px),
        rgba(0,0,0,.05) calc(var(--p) * .5 + 2px) var(--p)),
      linear-gradient(100deg, rgba(255,255,255,.10), rgba(255,255,255,0) 35%, rgba(0,0,0,.10) 70%, rgba(255,255,255,.05)),
      var(--slat);
    box-shadow: inset 2px 0 2px rgba(0,0,0,.35), inset -2px 0 2px rgba(0,0,0,.35), 0 2px 4px rgba(0,0,0,.35); }
  .shutter .bar { position:absolute; left:0; right:0; bottom:0; height:max(3px, calc(var(--p) * 1.3));
    background:linear-gradient(rgba(255,255,255,.12), rgba(0,0,0,.25)), var(--slat); box-shadow:0 1px 0 rgba(0,0,0,.45); }
  .tag { position:absolute; left:50%; bottom:calc(100% + 4px); transform:translateX(-50%); background:rgba(0,0,0,.6); color:#fff;
    padding:3px 8px; border-radius:8px; font-size:12px; line-height:1.3; white-space:nowrap; display:flex; gap:6px; pointer-events:none; }
  .tag em { font-style:normal; opacity:.85; }
  .win.label-below .tag { bottom:auto; top:calc(100% + 4px); }
  .win.unavailable .tag { background:rgba(150,30,30,.7); }
  .panel { position:absolute; z-index:3; width:180px; background:rgba(20,26,36,.92); color:#fff; border-radius:12px; padding:8px 10px; line-height:1.2;
    box-shadow:0 6px 18px rgba(0,0,0,.4); backdrop-filter:blur(6px); }
  .panel[hidden] { display:none; }
  .ph { display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px; }
  .pb { display:flex; gap:6px; margin-bottom:6px; }
  .pb button { flex:1; background:#2f3a4d; color:#fff; border:none; border-radius:8px; padding:7px 0; font-size:14px; cursor:pointer; }
  .pb button:hover { background:#3d4b63; }
  .panel input { width:100%; accent-color:#6fbf73; }
  .gate { position:absolute; cursor:pointer; perspective:900px; z-index:1; }
  .gate:hover { outline:2px solid rgba(255,255,255,.85); outline-offset:2px; }
  .gate .behind { position:absolute; inset:0; opacity:0; transition:opacity .4s ease 0s; filter:blur(.6px) brightness(.95); }
  .gate.open .behind { opacity:1; transition-delay:0s; }
  .gate .leaf { position:absolute; top:0; bottom:0; transition:transform 2.6s cubic-bezier(.45,.05,.3,1), filter 2.6s; backface-visibility:hidden; }
  .gate .leaf.l { transform-origin:left center; }
  .gate .leaf.r { transform-origin:right center; }
  .gate.open .leaf.l { transform:rotateY(78deg); filter:brightness(.7); }
  .gate.open .leaf.r { transform:rotateY(-78deg); filter:brightness(.7); }
  .gate .tag { bottom:auto; top:calc(100% + 4px); }
  .frames { position:absolute; pointer-events:none; z-index:1;
    -webkit-mask-image:linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent), linear-gradient(180deg, transparent, #000 5%, #000 95%, transparent);
    -webkit-mask-composite:source-in; mask-image:linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent), linear-gradient(180deg, transparent, #000 5%, #000 95%, transparent); mask-composite:intersect; }
  .frames img { position:absolute; inset:0; width:100%; height:100%; opacity:0; transition:opacity 1.2s ease; }
  .frames img.on { opacity:1; }
  .photo-gate { perspective:none; }
  .lamp { position:absolute; width:3.4%; aspect-ratio:1; transform:translate(-50%,-50%); cursor:pointer; border-radius:50%; z-index:2; }
  .lamp:hover { box-shadow:0 0 0 2px rgba(255,255,255,.9); }
  .lamp .glow { position:absolute; left:50%; top:50%; width:520%; aspect-ratio:1; transform:translate(-50%,-38%); border-radius:50%; pointer-events:none;
    background:radial-gradient(circle, rgba(255,224,140,.85) 0%, rgba(255,200,90,.45) 18%, rgba(255,190,80,.18) 40%, rgba(255,180,70,0) 68%);
    mix-blend-mode:screen; opacity:0; transition:opacity .5s ease; }
  .lamp .spot { position:absolute; left:50%; top:50%; width:46%; aspect-ratio:1; transform:translate(-50%,-50%); border-radius:50%; pointer-events:none;
    background:radial-gradient(circle, #fff 0%, #ffe9a8 45%, rgba(255,220,140,0) 75%); opacity:0; transition:opacity .4s ease; }
  .lamp.on .glow, .lamp.on .spot { opacity:1; }
  .other.light .bulb { filter:grayscale(1) opacity(.45); transition:filter .3s; }
  .other.light.on { background:#fff3c4; } .other.light.on .bulb { filter:none; }
  .others { display:flex; gap:8px; padding:0 10px 12px; flex-wrap:wrap; }
  .other { display:flex; align-items:center; gap:8px; background:var(--secondary-background-color, #f1f1f1); color:var(--primary-text-color);
    border:none; border-radius:10px; padding:6px 12px; cursor:pointer; font:inherit; font-size:14px; }
  .other em { font-style:normal; color:var(--secondary-text-color); }
  .mini { position:relative; width:22px; height:22px; border-radius:3px; background:#bcd3e6; overflow:hidden; border:2px solid #fff; box-shadow:0 0 0 1px #cfcfcf; }
  .mini i { position:absolute; left:0; right:0; top:0; height:0; background:repeating-linear-gradient(180deg, transparent 0 3px, rgba(0,0,0,.3) 3px 4px), var(--slat); transition:height .8s; }
`;

/**
 * Several house photos side by side, using the whole width (for a panel view):
 *   type: custom:house-shutters-grid
 *   min_width: 560          # optional, px per photo before wrapping
 *   cards: [ {house-shutters-card config}, ... ]
 */
class HouseShuttersGrid extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    if (!Array.isArray(config.cards)) throw new Error("cards is required");
    this._config = config;
    const min = Number(config.min_width) || 560;
    this.shadowRoot.innerHTML = `<style>
      :host { display:block; padding:12px; box-sizing:border-box; }
      .grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(min(100%, ${min}px), 1fr)); align-items:start; }
    </style><div class="grid"></div>`;
    const grid = this.shadowRoot.querySelector(".grid");
    this._cards = config.cards.map((c) => {
      const el = document.createElement("house-shutters-card");
      el.setConfig(c);
      grid.appendChild(el);
      return el;
    });
    if (this._hass) this.hass = this._hass;
  }

  set hass(hass) {
    this._hass = hass;
    (this._cards || []).forEach((el) => (el.hass = hass));
  }

  getCardSize() {
    return 10;
  }
}

if (!customElements.get("house-shutters-grid")) customElements.define("house-shutters-grid", HouseShuttersGrid);

if (!customElements.get("house-shutters-card")) {
  customElements.define("house-shutters-card", HouseShuttersCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "house-shutters-card", name: "House Shutters", description: "Shutters, lamps and gates drawn over a photo of your house", documentationURL: "https://github.com/dmdias/house-shutters-card" });
}
console.info(`%c HOUSE-SHUTTERS-CARD %c ${CARD_VERSION} `, "background:#4d6b3c;color:#fff", "background:#1b2130;color:#fff");
