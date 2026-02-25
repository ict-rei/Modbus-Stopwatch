const titlebar = document.getElementById("titlebar");
const timer = document.getElementById("timer");

let cfg;

window.electronAPI.onConfig((value) => {
  cfg = value;
  setStyles(cfg.timer);
});

window.electronAPI.onSettingsMessage((data) => {
  setStyles(data.timer);
});

function setStyles(obj) {
  for (const [key, value] of Object.entries(obj)) {
    if (!key.startsWith("--")) continue;
    document.documentElement.style.setProperty(key, value);
  }
}

window.electronAPI.onTick((value) => {
  let [mm, ss, ms] = value.split(/[:.]/).map(Number);
  mm = String(mm).padStart(2, "0");
  ss = String(ss).padStart(2, "0");
  ms = String(ms).padStart(3, "0");
  if (ms != "undefined") {
    timer.innerHTML = `${mm}:${ss}<span class="ms">.${ms}</span>`;
  } else {
    timer.innerText = `${mm}:${ss}`;
  }
});

window.electronAPI.onStop((value) => {
  let [mm, ss, ms] = value.split(/[:.]/).map(Number);
  mm = String(mm).padStart(2, "0");
  ss = String(ss).padStart(2, "0");
  ms = String(ms).padStart(3, "0");
  if (ms != "undefined") {
    timer.innerHTML = `${mm}:${ss}<span class="ms">.${ms}</span>`;
  } else {
    timer.innerText = `${mm}:${ss}`;
  }
});

window.electronAPI.onFullscreenChanged((isFullscreen) => {
  titlebar.style.display = isFullscreen ? "none" : "flex";
});

window.addEventListener("keydown", (e) => {
  if (e.altKey && (e.key === "c" || e.key === "C")) {
    window.electronAPI.openSettings();
  }
});

onload = () => {};
