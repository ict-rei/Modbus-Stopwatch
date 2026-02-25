// ButtonModbusEmitter.js
"use strict";

const EventEmitter = require("events");
const ModbusRTU = require("modbus-serial");
const net = require("net");

async function tcpProbe(host, port, timeoutMs) {
  return await new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));

    socket.connect(port, host);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class ModbusButton extends EventEmitter {
  /**
   * @param {object} options
   * @param {string} options.host - Modbus TCP IP
   * @param {number} [options.port=502] - Modbus TCP port
   * @param {number} [options.unitId=1] - Modbus unit/slave id
   * @param {number} [options.inputAddress=0] - discrete input address (0-based)
   * @param {number} [options.pollMs=100] - polling interval in ms
   * @param {number} [options.connectTimeoutMs=2000] - TCP connect timeout
   */
  constructor(options) {
    super();

    if (!options || !options.host) {
      throw new Error("ButtonModbusEmitter requires { ip }");
    }

    this._ip = options.host;
    this._port = options.port ?? 502;
    this._unitId = options.unitId ?? 1;
    this._inputAddress = options.addr ?? 0;

    this._pollMs = options.pollMs ?? 100;
    this._connectTimeoutMs = 2000;

    this._probeIntervalMs = 1000; // how often to probe reachability
    this._probeTimeoutMs = 500; // TCP connect timeout for probe
    this._maxProbeFails = 5; // after N failed probes, "pause" modbus connects

    this._reconnectBaseDelayMs = 500;
    this._reconnectMaxDelayMs = 2000;

    this._createClient();
    this._running = false;
    this._pollTimer = null;

    this._cooldownMs = options.cooldownMs;
    this._cooldown = false;
    this._cooldownTimer = null;

    this._connected = false;
    this._lastValue = null; // unknown until first read
    this._connecting = false;

    // A monotonically increasing token to cancel in-flight loops after setDevice/stop
    this._sessionId = 0;
  }

  async setDevice(cfg) {
    if (!cfg?.host) throw new Error("setDevice(cfg) requires cfg.host");

    this._ip = cfg.host;
    if (typeof cfg.port === "number") this._port = cfg.port;
    if (typeof cfg.addr === "number") this._inputAddress = cfg.addr;

    // cancel any in-flight connect/poll work
    this._sessionId++;

    this._stopPolling();
    this._connected = false;
    this._lastValue = null;
    await this._disconnectSafe();

    // DO NOT start a new loop here.
    // The existing loop (started by start()) will pick up the new IP automatically.
  }

  _createClient() {
    // If an old client exists, try to close it (non-blocking safety)
    try {
      this._client?.removeAllListeners?.();
    } catch {}
    this._client = new ModbusRTU();

    // Optional: surface low-level errors
    this._client.on?.("error", (e) => this.emit("error", e));
  }

  /**
   * Start connecting + polling. Retries forever until connected.
   */
  async start() {
    if (this._running) return;
    this._running = true;

    this._sessionId++;
    const mySession = this._sessionId;

    // start the supervisor loop once
    this._connectLoop(mySession).catch((e) => this.emit("error", e));
  }

  /**
   * Stop polling and disconnect.
   */
  async stop() {
    if (!this._running) return;
    this._running = false;
    this._sessionId++;

    this._stopPolling();
    await this._disconnectSafe();
    this._connected = false;
    this._lastValue = null;
  }

  /**
   * Internal: keep trying to connect, then start polling.
   */
  async _connectLoop() {
    if (this._connecting) return;
    this._connecting = true;

    let probeFails = 0;
    let reachable = false;

    try {
      while (this._running) {
        // Snapshot target for this iteration (prevents mid-await changes)
        const sessionId = this._sessionId;
        const ip = this._ip;
        const port = this._port;

        let ok = false;

        if (
          typeof ip !== "string" ||
          ip.trim() === "" ||
          !Number.isFinite(port)
        ) {
          this.emit("disconnect", { reason: "bad_target", ip, port });
          await sleep(this._probeIntervalMs);
          continue;
        }

        try {
          ok = await tcpProbe(ip, port, this._probeTimeoutMs);
        } catch {
          ok = false;
        }

        // If setDevice() happened during the await, stop immediately
        if (!this._running) return;
        if (sessionId !== this._sessionId) continue;

        if (ok) {
          probeFails = 0;
          if (!reachable) {
            reachable = true;
            this.emit("reachable", { ip, port });
          }
        } else {
          probeFails++;
          if (reachable) {
            reachable = false;
            this.emit("unreachable", { ip, port });
          }

          if (probeFails >= this._maxProbeFails) {
            if (this._connected) {
              this._connected = false;
              this._stopPolling();
              this._lastValue = null;
              this.emit("disconnect", { reason: "probe_failed" });
              await this._disconnectSafe();
              if (!this._running || sessionId !== this._sessionId) return;
            }

            await sleep(this._probeIntervalMs);
            continue;
          }

          await sleep(this._probeIntervalMs);
          continue;
        }

        if (!this._connected) {
          this.emit("connecting");
          try {
            await this._connectOnce(ip, port, sessionId); // pass snapshot + session
            if (!this._running || sessionId !== this._sessionId) return;

            this._connected = true;
            this.emit("connect", { ip, port, unitId: this._unitId });
            this._startPolling(sessionId);
          } catch (err) {
            if (!this._running || sessionId !== this._sessionId) return;

            this.emit("disconnect", {
              reason: "connect_failed",
              ip: this._ip,
              port: this._port,
              error: {
                code: err?.code,
                message: err?.message,
                stack: err?.stack,
                name: err?.name,
              },
            });
            await this._disconnectSafe();

            this._connected = false;
            this._stopPolling();
            this._lastValue = null;

            await sleep(this._probeIntervalMs);
          }
        }

        if (this._connected && !this._pollTimer) {
          this._startPolling(sessionId);
        }

        await sleep(250);
      }
    } finally {
      this._connecting = false;
    }
  }

  async _connectOnce(ip, port, sessionId) {
    // Ensure any previous connection is gone
    await this._disconnectSafe();

    // IMPORTANT: recreate ModbusRTU client for a clean socket state
    this._createClient();

    if (!this._running || sessionId !== this._sessionId) {
      throw new Error("connect cancelled (session changed)");
    }

    await new Promise((resolve, reject) => {
      let finished = false;

      const timeout = setTimeout(() => {
        if (finished) return;
        finished = true;
        reject(new Error(`connect timeout after ${this._connectTimeoutMs}ms`));
      }, this._connectTimeoutMs);

      this._client.connectTCP(ip, { port }, (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve();
      });
    });

    if (!this._running || sessionId !== this._sessionId) {
      await this._disconnectSafe();
      throw new Error("connect cancelled (session changed)");
    }

    this._client.setID(this._unitId);
  }

  _startPolling(sessionId) {
    this.emit("polling");
    this._stopPolling();

    this._pollTimer = setInterval(() => {
      this._pollOnce(sessionId).catch((err) => {
        // Poll error: treat as connection loss and kick reconnect loop
        this.emit("error", err);
        this._handleConnectionLoss(err);
      });
    }, this._pollMs);

    // Don’t keep Node alive solely for polling (optional)
    if (this._pollTimer.unref) this._pollTimer.unref();
  }

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    if (this._cooldown) {
      this._cooldown = false;
      this._cooldownTimer = null;
    }
  }

  async _pollOnce(sessionId) {
    if (!this._running) return;
    if (sessionId !== this._sessionId) return;
    if (!this._connected) return;

    // Read 1 discrete input bit
    const res = await this._client.readDiscreteInputs(this._inputAddress, 1);
    const value = res?.data?.[0];

    if (typeof value !== "boolean") {
      throw new Error(`Unexpected discrete input value: ${value}`);
    }

    if (this._lastValue === null) {
      // First sample: establish baseline, do not emit press/release.
      this._lastValue = value;
      return;
    }

    if (value !== this._lastValue) {
      // Edge detected
      if (value === true && !this._cooldown) {
        this._cooldown = true;
        this.emit("press");

        this._cooldownTimer = setTimeout(() => {
          this._cooldown = false;
        }, this._cooldownMs);
      } else this.emit("release");

      this.emit("change", value); // optional: always emits boolean
      this._lastValue = value;
    }
  }

  async _handleConnectionLoss(err) {
    if (!this._connected) return;

    this._connected = false;
    this._stopPolling();
    this._lastValue = null;

    this.emit("disconnect", { reason: "poll_failed", error: err });
    await this._disconnectSafe();

    // Do NOT start a new connectLoop here.
    // The existing connect loop will keep probing and reconnect when reachable.
  }

  async _disconnectSafe() {
    const c = this._client;
    if (!c) return;

    await new Promise((resolve) => {
      let done = false;

      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };

      // close() can hang depending on state; force-resolve
      const t = setTimeout(finish, 500);

      try {
        c.close(() => {
          clearTimeout(t);
          finish();
        });
      } catch {
        clearTimeout(t);
        finish();
      }
    });
  }
}

module.exports = { ModbusButton };
