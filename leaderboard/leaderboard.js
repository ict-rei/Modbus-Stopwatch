const tbody = document.getElementById("rows");
const clearAllBtn = document.getElementById("clearAll");
const exportBtn = document.getElementById("exportCsv");
const body = document.body;
const logo = document.getElementById("logo");

const dlg = document.getElementById("settingsDialog");
const dlgTitlebar = document.getElementById("settingsHeader");
const btnCloseSettings = document.getElementById("btnCloseSettings");
const showLogoInput = document.getElementById("showLogo");
const showBgInput = document.getElementById("showBg");
const logoXInput = document.getElementById("logoX");
const logoXLabel = document.getElementById("logoXLabel");
const logoYInput = document.getElementById("logoY");
const logoYLabel = document.getElementById("logoYLabel");
const logoSizeInput = document.getElementById("logoSize");
const logoSizeLabel = document.getElementById("logoSizeLabel");

const bgColorInput = document.getElementById("bgColor");
const tableColorInput = document.getElementById("tableColor");
const textColorInput = document.getElementById("textColor");
const inputColorInput = document.getElementById("inputColor");
const borderColorInput = document.getElementById("borderColor");

const headerRank = document.getElementById("thRank");
const headerTime = document.getElementById("thTime");
const headerCreatedAt = document.getElementById("thCreatedAt");

const isClientInput = document.getElementById("isClient");
const maxLinesInput = document.getElementById("clientMaxLines");
const showCreatedAtInput = document.getElementById("showCreatedAt");

const inputElements = [
  showLogoInput,
  showBgInput,
  logoXInput,
  logoYInput,
  logoSizeInput,
  bgColorInput,
  tableColorInput,
  textColorInput,
  inputColorInput,
  borderColorInput,
];

inputElements.forEach((el) => {
  el.addEventListener("change", () => saveConfig());
});

let client = false;
let showCreatedAt = false;

let cfg = null;
let bgVer = 0;
let logoVer = 0;

let rows = []; // {id, ms, name, confirmed}
let sortKey = "rank";
let ws = null;
let targetUrl = "";

let maxLinesClient = 10;
let justCleared = false;

function applyClientMode() {
  client = isClientInput.checked;
  if (client) {
    clearAllBtn.style.display = "none";
    exportBtn.style.display = "none";
  } else {
    clearAllBtn.style.display = "";
    exportBtn.style.display = "";
  }
  body.dataset.role = client ? "client" : "host";
  if (client) {
    maxLinesClient = Number(maxLinesInput?.value ?? 10);
  }
  renderTable();
}

isClientInput.addEventListener("change", () => {
  client = isClientInput.checked;
  applyClientMode();
});

maxLinesInput.addEventListener("input", () => {
  maxLinesClient = Number(maxLinesInput.value) || 0;
  if (client) renderTable();
});

showCreatedAtInput.addEventListener("change", () => {
  if (showCreatedAtInput.checked) {
    body.dataset.showCreatedAt = "true";
    showCreatedAt = true;
  } else {
    body.dataset.showCreatedAt = "false";
    showCreatedAt = false;
    sortKey = "rank";
  }
  renderTable();
});

headerRank.addEventListener("click", () => {
  sortKey = "rank";
  renderTable();
});
headerTime.addEventListener("click", () => {
  sortKey = "rank";
  renderTable();
});
headerCreatedAt.addEventListener("click", () => {
  sortKey = "createdAt";
  renderTable();
});

async function init() {
  cfg = await fetch("/api/settings").then((r) => r.json());
  console.log("Config loaded:", cfg);
  logoXInput.value = cfg["--logoX"].replace("%", "");
  logoYInput.value = cfg["--logoY"].replace("%", "");
  logoSizeInput.value = cfg["--logoW"].replace("px", "");
  bgColorInput.value = cfg["--bgColor"];
  tableColorInput.value = cfg["--panel"];
  textColorInput.value = cfg["--text"];
  inputColorInput.value = cfg["--input"];
  borderColorInput.value = cfg["--border"];
  setStyles(cfg);
}

function setStyles() {
  for (let [key, value] of Object.entries(cfg)) {
    if (!key.startsWith("--")) continue;
    if (key == "--bgImg") {
      if (cfg.showBg == false) {
        value = "none";
      } else {
        value = `url(${value}?v=${bgVer})`;
      }
    }
    document.documentElement.style.setProperty(key, value);
  }

  logo.src = `${cfg.logo}?v=${logoVer}`;
  logo.classList.toggle("hidden", !cfg.showLogo);
  showLogoInput.checked = cfg.showLogo;
  showBgInput.checked = cfg.showBg;
  logoXLabel.textContent = `Logo X [${cfg["--logoX"]}]`;
  logoYLabel.textContent = `Logo Y [${cfg["--logoY"]}]`;
  logoSizeLabel.textContent = `Logo width [${cfg["--logoW"]}]`;
}

async function submitForm(form, url) {
  const fd = new FormData(form);
  console.log(fd);
  const resp = await fetch(url, { method: "POST", body: fd });
  if (!resp.ok) throw new Error(await resp.text());
  return (await resp.json()).url;
}
document.getElementById("logoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = await submitForm(e.target, "/api/upload/logo");
  logoVer++;
  cfg.logo = url;
  cfg.showLogo = true;
  setStyles();
});
showLogoInput.addEventListener("change", (e) => {
  cfg.showLogo = e.target.checked;
  logo.classList.toggle("hidden", !cfg.showLogo);
  saveConfig();
});
document.getElementById("bgForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = await submitForm(e.target, "/api/upload/background");
  bgVer++;
  cfg["--bgImg"] = url;
  cfg.showBg = true;
  setStyles();
});
showBgInput.addEventListener("change", (e) => {
  cfg.showBg = e.target.checked;
  setStyles();
  saveConfig();
});

bgColorInput.addEventListener("input", (e) => {
  const color = e.target.value;
  cfg["--bgColor"] = color;
  setStyles();
});
tableColorInput.addEventListener("input", (e) => {
  const color = e.target.value;
  cfg["--panel"] = color;
  setStyles();
});
textColorInput.addEventListener("input", (e) => {
  const color = e.target.value;
  cfg["--text"] = color;
  setStyles();
});
inputColorInput.addEventListener("input", (e) => {
  const color = e.target.value;
  cfg["--input"] = color;
  setStyles();
});
borderColorInput.addEventListener("input", (e) => {
  const color = e.target.value;
  cfg["--border"] = color;
  setStyles();
});
logoXInput.addEventListener("input", (e) => {
  const val = e.target.value;
  cfg["--logoX"] = `${val}%`;
  setStyles();
});
logoYInput.addEventListener("input", (e) => {
  const val = e.target.value;
  cfg["--logoY"] = `${val}%`;
  setStyles();
});
logoSizeInput.addEventListener("input", (e) => {
  const val = e.target.value;
  cfg["--logoW"] = `${val}px`;
  setStyles();
});
async function saveConfig() {
  await fetch("/api/settings/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cfg),
  });
}

function setStatus(text) {
  console.log(text);
}

function formatTimerNoHours(msValue) {
  let ms = Number(msValue) || 0;
  const neg = ms < 0;
  ms = Math.abs(ms);
  const totalMinutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);
  const mm = String(totalMinutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const mmm = String(millis).padStart(3, "0");
  return `${neg ? "-" : ""}${mm}:${ss}<span class="ms">.${mmm}</span>`;
}
function formatTimerPlain(msValue) {
  let ms = Number(msValue) || 0;
  const neg = ms < 0;
  ms = Math.abs(ms);
  const totalMinutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);
  const mm = String(totalMinutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const mmm = String(millis).padStart(3, "0");
  return `${neg ? "-" : ""}${mm}:${ss}.${mmm}`;
}

function formatCreatedAt(string) {
  const date = new Date(string);

  const time = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(2);

  return `${time} ${day}.${month}.${year}`;
}

// Render (client applies top-N if maxLinesClient > 0)
function renderTable(opts = {}) {
  // Capture current focused name-input (if any) to restore caret later
  const active = document.activeElement;
  const restore =
    active && active.classList && active.classList.contains("name-input")
      ? {
          id: active.dataset.id,
          start: active.selectionStart ?? null,
          end: active.selectionEnd ?? null,
        }
      : null;

  const byTime = [...rows].sort((a, b) => a.ms - b.ms || a.id - b.id);
  const rankMap = new Map(byTime.map((r, i) => [r.id, i + 1]));

  const sorted = [...rows].sort((a, b) => {
    if (sortKey === "createdAt") {
      const at = new Date(a.createdAt);
      const bt = new Date(b.createdAt);
      if (at == null && bt == null) return a.ms - b.ms || a.id - b.id;
      if (at == null) return 1;
      if (bt == null) return -1;
      return (at - bt) * -1 || a.ms - b.ms || a.id - b.id;
    }
    // sortKey === "rank"
    return a.ms - b.ms || a.id - b.id;
  });

  const view =
    client && maxLinesClient > 0 ? sorted.slice(0, maxLinesClient) : sorted;

  tbody.innerHTML = "";

  view.forEach((r, idx) => {
    const tr = document.createElement("tr");

    const tdRank = document.createElement("td");
    tdRank.className = "rank";
    tdRank.textContent = String(rankMap.get(r.id) ?? idx + 1);

    const tdTime = document.createElement("td");
    tdTime.className = "time";
    tdTime.innerHTML = formatTimerNoHours(r.ms);

    const tdName = document.createElement("td");
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "name-input";
    inp.placeholder = client ? "" : "Enter name…";
    inp.value = r.name || "";
    inp.dataset.id = String(r.id);
    inp.readOnly = client;
    inp.readOnly = client || r.confirmed; // confirmed rows not editable
    inp.disabled = client || !!r.confirmed;
    if (r.confirmed) inp.classList.add("is-confirmed");
    else inp.classList.remove("is-confirmed");
    inp.autocomplete = "off";
    inp.spellcheck = false;
    tdName.appendChild(inp);

    tr.appendChild(tdRank);
    tr.appendChild(tdTime);
    tr.appendChild(tdName);

    if (showCreatedAt) {
      const tdCreatedAt = document.createElement("td");
      tdCreatedAt.className = "col-createdAt created-at";
      tdCreatedAt.textContent = formatCreatedAt(r.createdAt);
      tr.appendChild(tdCreatedAt);
    }

    if (!client) {
      const tdActions = document.createElement("td");
      tdActions.className = "col-actions";
      const box = document.createElement("div");
      box.className = "row-actions";

      if (!r.confirmed) {
        const confirmBtn = document.createElement("button");
        confirmBtn.className = "icon-btn";
        confirmBtn.textContent = "✓ Confirm";
        confirmBtn.dataset.id = String(r.id);
        confirmBtn.dataset.action = "confirm";
        box.appendChild(confirmBtn);
      }
      const rmBtn = document.createElement("button");
      rmBtn.className = "icon-btn";
      rmBtn.textContent = "✖ Remove";
      rmBtn.dataset.id = String(r.id);
      rmBtn.dataset.action = "remove";
      box.appendChild(rmBtn);

      tdActions.appendChild(box);
      tr.appendChild(tdActions);
    }

    tbody.appendChild(tr);
  });

  // Try to restore focus/caret if we were editing
  let restored = false;
  if (restore && restore.id) {
    const el = tbody.querySelector(`.name-input[data-id="${restore.id}"]`);
    if (el && !el.readOnly) {
      el.focus();
      try {
        if (restore.start != null && restore.end != null) {
          el.setSelectionRange(restore.start, restore.end);
        }
      } catch {
        //continute
      }
      restored = true;
    }
  }

  // If we just cleared and a new row appeared, focus the first input for the host
  if (!restored && !client && (opts.focusFirst || justCleared)) {
    const first = tbody.querySelector(".name-input");
    if (first && !first.readOnly) first.focus();
    justCleared = false; // reset the flag
  }
}

function localAdd(row) {
  const exists = rows.some((r) => r.id === row.id);
  if (!exists) rows.push(row);
  // After a clear, auto-focus the first new row
  renderTable({ focusFirst: true }); // <— changed
}

function localUpdate(id, patch) {
  const r = rows.find((x) => x.id === id);
  if (!r) return;
  Object.assign(r, patch);
  renderTable();
}

function localRemove(id) {
  rows = rows.filter((x) => x.id !== id);
  renderTable();
}

function localClear() {
  rows = [];
  justCleared = true; // <— mark that we cleared
  renderTable(); // table empties now; next add will focus
}

// Host typing: local only
tbody.addEventListener("input", (e) => {
  if (client) return;
  if (!e.target.classList.contains("name-input")) return;
  const id = Number(e.target.dataset.id);
  const row = rows.find((r) => r.id === id);
  if (row) row.name = e.target.value;
});

// Host clicks
tbody.addEventListener("click", (e) => {
  if (client) return;
  const btn = e.target.closest(".icon-btn");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const row = rows.find((r) => r.id === id);
  if (!row) return;

  const action = btn.dataset.action;
  if (action === "remove") {
    send({ type: "remove", payload: { id } });
    return;
  }
  if (action === "confirm") {
    const inputEl = tbody.querySelector(`.name-input[data-id="${id}"]`);
    const finalName = inputEl ? inputEl.value : row.name || "";
    if (!finalName.trim()) {
      alert("Please enter a name before confirming.");
      return;
    }
    localUpdate(id, { name: finalName, confirmed: true }); // optimistic
    send({ type: "confirm", payload: { id, name: finalName } });
  }
});

// Clear all (host only)
clearAllBtn.addEventListener("click", () => {
  if (client) return;
  if (confirm("Clear all rows?")) send({ type: "clear" });
});

// Export CSV (host & client hidden by role)
function buildCsv() {
  const sorted = [...rows].sort((a, b) => a.ms - b.ms || a.id - b.id);
  const header = ["Rank", "Time", "Name", "Created at"];
  const lines = [header.join(",")];
  sorted.forEach((r, i) => {
    const timeTxt = formatTimerPlain(r.ms);
    const nameEsc = `"${String(r.name || "").replace(/"/g, '""')}"`;
    lines.push(
      [i + 1, timeTxt, nameEsc, formatCreatedAt(r.createdAt)].join(","),
    );
  });
  return lines.join("\n");
}

function downloadCsv(csvText, filename) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

exportBtn.addEventListener("click", () => {
  downloadCsv(buildCsv(), "scoreboard.csv");
});

// WS client
let reconnectTimer = null;
function connectWs(url) {
  targetUrl = url;
  try {
    if (ws) ws.close();
  } catch {
    // continue
  }
  setStatus(`Connecting to ${url}…`);

  ws = new WebSocket(url);
  ws.addEventListener("open", () => {
    setStatus(`Connected to ${url}`);
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  });
  ws.addEventListener("close", () => {
    setStatus("Disconnected — retrying…");
    if (!reconnectTimer)
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectWs(targetUrl);
      }, 1000);
  });
  ws.addEventListener("error", (e) => console.error("WS error", e));

  ws.addEventListener("message", (evt) => {
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "sync" && Array.isArray(msg.payload)) {
      rows = msg.payload.slice();
      renderTable();
      return;
    }
    if (msg.type === "row:add" && msg.payload) {
      localAdd(msg.payload);
      return;
    }
    if (msg.type === "row:update" && msg.payload) {
      localUpdate(Number(msg.payload.id), msg.payload);
      return;
    }
    if (msg.type === "row:remove" && msg.payload) {
      localRemove(Number(msg.payload.id));
      return;
    }
    if (msg.type === "clear") {
      localClear();
      return;
    }
  });
}
function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

window.addEventListener("keydown", (e) => {
  if (e.altKey && (e.key === "c" || e.key === "C")) {
    e.preventDefault();
    if (dlg.hasAttribute("open")) closeSettingsDialog();
    else openSettingsDialog();
  }
});

btnCloseSettings.addEventListener("click", () => {
  if (dlg.hasAttribute("open")) {
    closeSettingsDialog();
  }
});

dlg.addEventListener("click", (e) => {
  if (e.target === dlg) {
    closeSettingsDialog();
  }
});

let dragging = false;
let startX = 0,
  startY = 0;
let startLeft = 0,
  startTop = 0;

function openSettingsDialog() {
  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "open");
  const r = dlg.getBoundingClientRect();
  dlg.style.left = `${Math.round((window.innerWidth - r.width) / 2)}px`;
  dlg.style.top = `${Math.round((window.innerHeight - r.height) / 2)}px`;
}

function closeSettingsDialog() {
  if (typeof dlg.close === "function") dlg.close();
  else dlg.removeAttribute("open");
}

dlgTitlebar.addEventListener("pointerdown", (e) => {
  // left mouse button only (but allow touch/pen)
  if (e.target.closest("button")) return;
  if (e.pointerType === "mouse" && e.button !== 0) return;

  dragging = true;
  dlgTitlebar.setPointerCapture(e.pointerId);

  const r = dlg.getBoundingClientRect();
  startX = e.clientX;
  startY = e.clientY;
  startLeft = r.left;
  startTop = r.top;
});

dlgTitlebar.addEventListener("pointermove", (e) => {
  if (!dragging) return;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  // clamp to viewport (optional but feels “desktop-like”)
  const r = dlg.getBoundingClientRect();
  const w = r.width,
    h = r.height;

  let left = startLeft + dx;
  let top = startTop + dy;

  left = Math.max(0, Math.min(left, window.innerWidth - w));
  top = Math.max(0, Math.min(top, window.innerHeight - h));

  dlg.style.left = `${Math.round(left)}px`;
  dlg.style.top = `${Math.round(top)}px`;
});

const stopDrag = (e) => {
  if (!dragging) return;
  dragging = false;
  try {
    dlgTitlebar.releasePointerCapture(e.pointerId);
  } catch {}
};

dlgTitlebar.addEventListener("pointerup", stopDrag);
dlgTitlebar.addEventListener("pointercancel", stopDrag);

// Init
init();
connectWs("ws://" + window.location.host + "/times");
