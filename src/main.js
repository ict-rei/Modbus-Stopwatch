const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  MessageChannelMain,
} = require("electron");
const path = require("node:path");
const fs = require("fs");
const { ModbusButton } = require("./modules/ModbusButton");
const { StopwatchCore, formatMs } = require("./modules/Stopwatch");
const { startWss, broadcast } = require("./modules/wss");
const express = require("express");
const multer = require("multer");
const http = require("node:http");

function getExecPath() {
  if (app.isPackaged) {
    return process.env.PORTABLE_EXECUTABLE_DIR;
  } else {
    return app.getAppPath();
  }
}

const cfgPath = path.join(getExecPath(), "config.json");
const assetsPath = path.join(getExecPath(), "assets");

const webRoot = (() => {
  return app.isPackaged
    ? path.join(process.resourcesPath, "leaderboard")
    : path.join(app.getAppPath(), "leaderboard");
})();

if (!fs.existsSync(assetsPath)) {
  fs.mkdirSync(assetsPath);
}

const cfg = (() => {
  if (fs.existsSync(cfgPath)) {
    return JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  } else {
    const defaultCfg = {
      modbus: {
        host: "127.0.0.1",
        port: 502,
        addr: 0,
        pollMs: 100,
        cooldownMs: 500,
      },
      timer: {
        showMs: true,
        "--msOpacity": 1,
        "--fontSize": "12vw",
        "--fontFamily":
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        "--text": "#ffffff",
        "--bg": "#333333",
      },
      leaderboard: {
        logo: "/default/logo.png",
        showLogo: true,
        "--logoW": "200px",
        "--logoX": "2%",
        "--logoY": "2%",
        "--bgColor": "#333333",
        "--bgImg": "/default/bg.jpg",
        showBg: false,
        "--panel": "#1a171b",
        "--input": "#262327",
        "--border": "#4b4b4b",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif',
        "--text": "#f5f5f5",
      },
    };
    fs.writeFileSync(cfgPath, JSON.stringify(defaultCfg, null, 2), "utf8");
    return defaultCfg;
  }
})();

function saveConfig() {
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), "utf8");
}

let button = null;
let mainWindow = null;
let settingsWindow = null;
let modbusPolling = false;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 752,
    icon: "img/ICT-Logo-Square.png",
    resizable: true,
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    title: "Stopwatch",
    ...(process.platform !== "darwin"
      ? {
          titleBarOverlay: {
            color: "#1a171b",
            symbolColor: "#e7e7e7",
            height: 20,
          },
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  ipcMain.handle("openExternal", (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.on("enter-full-screen", () => {
    send("fullscreen-changed", true);
  });

  mainWindow.on("leave-full-screen", () => {
    send("fullscreen-changed", false);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    send("config", cfg);
    send("fullscreen-changed", mainWindow.fullScreen);
  });

  ipcMain.handle("openSettings", (e) => {
    const parent = BrowserWindow.fromWebContents(e.sender);
    settingsWindow = new BrowserWindow({
      parent,
      width: 600,
      height: 380,
      icon: "img/ICT-Logo-Square.png",
      resizable: false,
      autoHideMenuBar: true,
      titleBarStyle: "hidden",
      title: "Stopwatch",
      ...(process.platform !== "darwin"
        ? {
            titleBarOverlay: {
              color: "#1a171b",
              symbolColor: "#e7e7e7",
              height: 20,
            },
          }
        : {}),
      webPreferences: {
        preload: path.join(__dirname, "preloadSettings.js"),
      },
    });
    settingsWindow.loadFile(path.join(__dirname, "renderer", "settings.html"));

    settingsWindow.webContents.on("did-finish-load", () => {
      send("config", cfg, settingsWindow);
      send("polling", modbusPolling, settingsWindow);
    });

    settingsWindow.webContents.mainFrame.ipc.on("getSettingsChannel", (e) => {
      const { port1, port2 } = new MessageChannelMain();
      e.senderFrame.postMessage("settingsChannel", null, [port1]);
      mainWindow.webContents.postMessage("settingsChannel", null, [port2]);
    });

    ipcMain.handle("connectModbus", async (event, newCfg) => {
      Object.assign(cfg, newCfg);
      if (button) {
        await button.setDevice(cfg.modbus);
      }
      saveConfig();
    });

    ipcMain.on("setOpacity", (event, opacity) => {
      if (settingsWindow) {
        settingsWindow.setOpacity(opacity);
      }
    });

    ipcMain.handle("saveConfig", (event, newCfg) => {
      Object.assign(cfg, newCfg);
      saveConfig();
    });

    if (!app.isPackaged) {
      settingsWindow.webContents.openDevTools();
    }
  });

  // Open the DevTools.
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  createWindow();

  const { server } = await startHttpServer({ port: 3000 });
  const wss = startWss(server);
  const stopwatch = new StopwatchCore();
  button = new ModbusButton(cfg.modbus);
  button.start();

  rows = loadRows();

  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "sync", payload: rows }));

    ws.on("message", (buf) => {
      let msg;
      try {
        msg = JSON.parse(buf.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;

      if (msg.type === "confirm" && msg.payload) {
        const id = Number(msg.payload.id);
        const name = String(msg.payload.name || "");
        const r = rows.find((x) => x.id === id);
        if (!r) return;
        r.name = name;
        r.confirmed = true;
        saveRows(rows);
        broadcast({
          type: "row:update",
          payload: { id: r.id, name: r.name, confirmed: true },
        });
        return;
      }
      if (msg.type === "remove" && msg.payload) {
        removeRow(Number(msg.payload.id));
        return;
      }
      if (msg.type === "clear") {
        clearRows();
        return;
      }
    });
  });

  button.on("disconnect", (e) => {
    modbusPolling = false;
    send("polling", modbusPolling, settingsWindow);
    console.log("modbus disconnected" + JSON.stringify(e));
  });

  button.on("polling", () => {
    modbusPolling = true;
    send("polling", modbusPolling, settingsWindow);
    console.log("start polling");
  });

  button.on("press", () => {
    const state = stopwatch.press();
    if (state.action == "STOP" && typeof state.finalMs === "number") {
      addRow(state.finalMs);
      send("stop", formatMs(state.finalMs, cfg.timer.showMs));
    }
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.code === "Space") {
      event.preventDefault();
      button.emit("press");
    }
  });

  setInterval(() => {
    send("tick", formatMs(stopwatch.getElapsedMs(), cfg.timer.showMs));
  }, 50);

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

function send(channel, payload, target = mainWindow) {
  if (target && !target.isDestroyed()) {
    target.webContents.send(channel, payload);
  }
}

let rows = [];
let nextRowId = 1;

function dataFile() {
  if (!app.isPackaged) {
    return path.join(app.getAppPath(""), "leaderboard.json");
  }
  return path.join(process.env.PORTABLE_EXECUTABLE_DIR, "leaderboard.json");
}
function loadRows() {
  try {
    const raw = fs.readFileSync(dataFile(), "utf8");
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
  } catch {
    // ignore
  }
  return [];
}
function saveRows(rows) {
  try {
    fs.writeFileSync(dataFile(), JSON.stringify(rows, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to save rows:", e);
  }
}

function addRow(ms) {
  const row = {
    id: nextRowId++,
    ms: ms,
    createdAt: new Date(),
    name: "",
    confirmed: false,
  };
  rows.push(row);
  saveRows(rows);
  broadcast({
    type: "row:add",
    payload: row,
  });
}
function removeRow(id) {
  const before = rows.length;
  rows = rows.filter((r) => r.id !== id);
  if (rows.length !== before) {
    saveRows(rows);
    broadcast({ type: "row:remove", payload: { id } });
  }
}
function clearRows() {
  rows = [];
  nextRowId = 1;
  saveRows(rows);
  broadcast({ type: "clear" });
}

function startHttpServer({ port = 3000 } = {}) {
  const appx = express();
  appx.use(express.json());

  // Serve uploaded files
  appx.use("/assets", express.static(assetsPath, { etag: false, maxAge: 0 }));

  // Serve your bundled pages
  appx.use(express.static(webRoot, { index: "leaderboard.html" }));

  // Multer: store files on disk in assetsPath
  const storage = multer.diskStorage({
    destination: assetsPath,
    filename: (req, file, cb) => {
      // slot is set per route; keep extension from original name
      const ext = path.extname(file.originalname).toLowerCase() || "";
      cb(null, `${req.uploadSlot}${ext}`);
    },
  });

  const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
      const ok = ["image/png", "image/jpeg", "image/svg+xml"].includes(
        file.mimetype,
      );
      cb(ok ? null : new Error("Unsupported file type"), ok);
    },
  });

  // Settings
  appx.get("/api/settings", (req, res) => {
    res.json(cfg.leaderboard);
  });

  appx.post("/api/settings/save", (req, res) => {
    const newCfg = req.body;
    Object.assign(cfg.leaderboard, newCfg);
    saveConfig();
    res.sendStatus(204);
  });

  // Upload routes
  appx.post(
    "/api/upload/logo",
    (req, res, next) => {
      req.uploadSlot = "logo";
      next();
    },
    upload.single("file"),
    async (req, res) => {
      cfg.leaderboard.logo = `/assets/${req.file.filename}`;
      cfg.leaderboard.showLogo = true;
      saveConfig();
      res.json({ ok: true, url: cfg.leaderboard.logo });
    },
  );

  appx.post(
    "/api/upload/background",
    (req, res, next) => {
      req.uploadSlot = "background";
      next();
    },
    upload.single("file"),
    async (req, res) => {
      cfg.leaderboard["--bgImg"] = `/assets/${req.file.filename}`;
      cfg.leaderboard.showBg = true;
      saveConfig();
      res.json({ ok: true, url: cfg.leaderboard["--bgImg"] });
    },
  );

  // Multer/fileFilter errors -> readable responses
  appx.use((err, req, res, next) => {
    if (!err) return next();
    return res.status(400).send(err.message || "Upload error");
  });

  // Create a single HTTP server we can also attach WebSockets to
  const server = http.createServer(appx);

  return new Promise((resolve, reject) => {
    server.listen(port, "0.0.0.0", () => resolve({ server, port }));
    server.on("error", reject);
  });
}
