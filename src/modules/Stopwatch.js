function nowNs() {
  return process.hrtime.bigint(); // monotonic
}

function nsToMs(ns) {
  return Number(ns / 1000000n);
}

function formatMs(ms, showMs) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  let res = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  if (showMs) res += `.${String(millis).padStart(3, "0")}`;
  return res;
}

class StopwatchCore {
  constructor() {
    this.state = "READY";
    this.startNs = null;
    this.stoppedMs = 0;
  }

  press() {
    //start
    if (this.state === "READY") {
      this.state = "RUNNING";
      this.startNs = nowNs();
      this.stoppedMs = 0;
      return { action: "START" };
    }
    //stop
    if (this.state === "RUNNING") {
      const elapsedMs = nsToMs(nowNs() - this.startNs);
      this.state = "STOPPED";
      this.startNs = null;
      this.stoppedMs = elapsedMs;
      return { action: "STOP", finalMs: elapsedMs };
    }
    //reset
    this.state = "READY";
    this.startNs = null;
    this.stoppedMs = 0;
    return { action: "RESET" };
  }

  getElapsedMs() {
    if (this.state === "RUNNING" && this.startNs != null) {
      return nsToMs(nowNs() - this.startNs);
    }
    return this.stoppedMs;
  }
}

module.exports = { StopwatchCore, formatMs };
