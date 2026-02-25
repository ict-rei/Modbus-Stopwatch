const modbusIpInput = document.getElementById("modbusIp");
const modbusPortInput = document.getElementById("modbusPort");
const modbusAddrInput = document.getElementById("modbusAddr");
const modbusConnect = document.getElementById("modbusConnect");
const bgColorInput = document.getElementById("bgColor");
const timerColorInput = document.getElementById("timerColor");
const timerShowMsInput = document.getElementById("showMs");
const msOpacityInput = document.getElementById("msOpacity");
const timerSizeInput = document.getElementById("timerSize");

let cfg;
window.electronAPI.getSettingsChannel();

window.electronAPI.onConfig((value) => {
  cfg = value;
  modbusIpInput.value = cfg.modbus.host;
  modbusPortInput.value = cfg.modbus.port;
  modbusAddrInput.value = cfg.modbus.addr;
  bgColorInput.value = cfg.timer["--bg"];
  timerColorInput.value = cfg.timer["--text"];
  timerShowMsInput.checked = cfg.timer.showMs;
  msOpacityInput.value = cfg.timer["--msOpacity"] * 100;
  timerSizeInput.max = cfg.timer.showMs ? 23 : 35;
  if (!cfg.timer.showMs) {
    timerSizeInput.max = 35;
  }
  timerSizeInput.value = cfg.timer["--fontSize"].replace("vw", "");
});

bgColorInput.addEventListener("focus", () => {
  window.electronAPI.setOpacity(0.4);
});
bgColorInput.addEventListener("blur", () => {
  window.electronAPI.setOpacity(1);
});
bgColorInput.addEventListener("input", (e) => {
  const color = e.target.value;
  cfg.timer["--bg"] = color;
  window.electronAPI.sendSettingsMessage(cfg);
});
bgColorInput.addEventListener("change", () => {
  window.electronAPI.saveConfig(cfg);
});

timerColorInput.addEventListener("focus", () => {
  window.electronAPI.setOpacity(0.4);
});
timerColorInput.addEventListener("blur", () => {
  window.electronAPI.setOpacity(1);
});
timerColorInput.addEventListener("input", (e) => {
  const color = e.target.value;
  cfg.timer["--text"] = color;
  window.electronAPI.sendSettingsMessage(cfg);
});
timerColorInput.addEventListener("change", () => {
  window.electronAPI.saveConfig(cfg);
});

timerShowMsInput.addEventListener("input", (e) => {
  const showMs = e.target.checked;
  cfg.timer.showMs = showMs;
  if (showMs && timerSizeInput.value > 23) {
    timerSizeInput.value = 23;
    cfg.timer["--fontSize"] = "23vw";
  }
  timerSizeInput.max = showMs ? 23 : 35;
  window.electronAPI.sendSettingsMessage(cfg);
});
timerShowMsInput.addEventListener("change", () => {
  window.electronAPI.saveConfig(cfg);
});

msOpacityInput.addEventListener("focus", () => {
  window.electronAPI.setOpacity(0.4);
});
msOpacityInput.addEventListener("input", (e) => {
  const opacity = e.target.value / 100;
  cfg.timer["--msOpacity"] = opacity;
  window.electronAPI.sendSettingsMessage(cfg);
});
msOpacityInput.addEventListener("change", () => {
  window.electronAPI.setOpacity(1);
  window.electronAPI.saveConfig(cfg);
});

timerSizeInput.addEventListener("focus", () => {
  window.electronAPI.setOpacity(0.4);
});
timerSizeInput.addEventListener("input", (e) => {
  const size = e.target.value;
  cfg.timer["--fontSize"] = `${size}vw`;
  window.electronAPI.sendSettingsMessage(cfg);
});
timerSizeInput.addEventListener("change", () => {
  window.electronAPI.setOpacity(1);
  window.electronAPI.saveConfig(cfg);
});

modbusConnect.addEventListener("click", () => {
  cfg.modbus.host = modbusIpInput.value;
  cfg.modbus.port = Number(modbusPortInput.value);
  cfg.modbus.addr = Number(modbusAddrInput.value);
  const elements = document.querySelectorAll("div.status");
  elements.forEach((el) => {
    el.classList.remove("status-success", "status-error");
    el.classList.add("status-warning");
  });
  window.electronAPI.connectModbus(cfg);
});

window.electronAPI.getPollStatus((value) => {
  const elements = document.querySelectorAll("div.status");
  let state = "status-warning";
  if (value) {
    state = "status-success";
  } else {
    state = "status-error";
  }
  elements.forEach((el) => {
    el.classList.remove("status-warning", "status-success", "status-error");
    el.classList.add(state);
  });
});

onload = () => {};
