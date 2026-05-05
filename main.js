const {
    app,
    BrowserWindow,
    ipcMain,
    nativeImage,
    dialog,
  } = require("electron"),
  cp = require("child_process"),
  { Builder, Browser, By } = require("selenium-webdriver"),
  chrome = require("selenium-webdriver/chrome"),
  fs = require("fs"),
  path = require("path"),
  os = require("os"),
  crypto = require("crypto"),
  https = require("https"),
  { autoUpdater } = require("electron-updater"),
  treeKill = require("tree-kill"),
  { z } = require("zod");
app.disableHardwareAcceleration();
let chromeDriverPids = new Set();
const oS = cp.spawn;
cp.spawn = function (e, t, a) {
  let r = "string" == typeof e ? e : e.command;
  r &&
    r.includes("app.asar") &&
    (r = r.replace("app.asar", "app.asar.unpacked"));
  const s = oS(r, t, a);
  return (
    r &&
      r.includes("chromedriver") &&
      (chromeDriverPids.add(s.pid),
      s.on("exit", () => chromeDriverPids.delete(s.pid))),
    s
  );
};
const oSS = cp.spawnSync;
cp.spawnSync = function (e, t, a) {
  let r = "string" == typeof e ? e : e.command;
  return (
    r &&
      r.includes("app.asar") &&
      (r = r.replace("app.asar", "app.asar.unpacked")),
    oSS(r, t, a)
  );
};
class AppState {
  constructor() {
    ((this.win = null),
      (this.workerPool = []),
      (this.taskQueue = []),
      (this.isCreatingBrowser = !1),
      (this.isProcessingQueue = !1),
      (this.zombieCheckInterval = null),
      (this.nextWorkerId = 1),
      (this.isQuitting = !1),
      (this.currentStats = {
        total: 0,
        running: 0,
        waiting: 0,
        pulled: 0,
        processed: 0,
        success: 0,
        fail: 0,
      }),
      (this.scriptCache = { dismiss: "", addMember: "", createGroup: "" }));
  }
}
const state = new AppState(),
  rootDir = app.isPackaged
    ? path.join(app.getPath("documents"), "Ellon Inbox Grub")
    : process.cwd();
app.isPackaged &&
  !fs.existsSync(rootDir) &&
  fs.mkdirSync(rootDir, { recursive: !0 });
const logDir = path.join(rootDir, "Akun_log");
class Logger {
  static send(e, t, a, r) {
    const s = new Date().toLocaleTimeString();
    state.win &&
      state.win.webContents.send("log-v2", {
        time: s,
        id: e,
        msg: `[${a}] ${t}`,
        workerId: r,
      });
  }
  static info(e, t, a = "SYSTEM") {
    this.send(e, t, "INFO", a);
  }
  static error(e, t, a = "SYSTEM") {
    this.send(e, t, "ERROR", a);
  }
  static warn(e, t, a = "SYSTEM") {
    this.send(e, t, "WARN", a);
  }
}
async function loadScriptsToCache() {
  try {
    state.scriptCache.dismiss = await fs.promises.readFile(
      path.join(__dirname, "js", "Dismiss.js"),
      "utf8",
    );
  } catch (e) {}
  try {
    state.scriptCache.addMember = await fs.promises.readFile(
      path.join(__dirname, "js", "ADD MEMBER.js"),
      "utf8",
    );
  } catch (e) {}
  try {
    state.scriptCache.createGroup = await fs.promises.readFile(
      path.join(__dirname, "js", "CREATE GROUP.js"),
      "utf8",
    );
  } catch (e) {}
}
function getHardwareId() {
  let e = "",
    t = os.networkInterfaces();
  for (let a in t) {
    let r = t[a].find((e) => !e.internal && "00:00:00:00:00:00" !== e.mac);
    if (r) {
      e = r.mac;
      break;
    }
  }
  return crypto
    .createHash("sha256")
    .update(os.userInfo().username + e + os.hostname())
    .digest("hex");
}
function validateLicense(e, t) {
  return new Promise((a) => {
    const r = JSON.stringify({ license: e, hwid: t }),
      s = https.request(
        "https://ellon-license-api.fanzol633.workers.dev/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(r),
          },
          timeout: 1e4,
        },
        (e) => {
          let t = "";
          (e.on("data", (e) => (t += e)),
            e.on("end", () => {
              try {
                a(JSON.parse(t));
              } catch (e) {
                a({ success: !1, msg: "Invalid Response" });
              }
            }));
        },
      );
    (s.on("error", () => a({ success: !1, msg: "Koneksi Error" })),
      s.on("timeout", () => {
        (s.destroy(), a({ success: !1, msg: "Koneksi Timeout" }));
      }),
      s.write(r),
      s.end());
  });
}
ipcMain.handle("check-license", async (e, t) => {
  const a = getHardwareId(),
    r = await validateLicense(t, a);
  return (
    r.success ||
      "Lisensi Di Gunakan Device Lain" !== r.msg ||
      (dialog.showErrorBox("Akses Ditolak", r.msg), app.quit()),
    r
  );
});
async function ensureLogDir() {
  try {
    await fs.promises.mkdir(logDir, { recursive: !0 });
  } catch (e) {}
}
async function saveToLogDir(e, t) {
  try {
    (await ensureLogDir(),
      await fs.promises.appendFile(
        path.join(logDir, e),
        (Array.isArray(t) ? t.join("\n") : t) + "\n",
      ));
  } catch (e) {}
}
async function saveToRootDir(e, t) {
  try {
    await fs.promises.appendFile(
      path.join(rootDir, e),
      (Array.isArray(t) ? t.join("\n") : t) + "\n",
    );
  } catch (e) {}
}
async function overwriteToRootDir(e, t) {
  try {
    await fs.promises.writeFile(
      path.join(rootDir, e),
      (Array.isArray(t) ? t.join("\n") : t) + "\n",
    );
  } catch (e) {}
}
function updatePoolStatus() {
  if (!state.win) return;
  const e = state.workerPool.length,
    t = state.workerPool.filter((e) => e.busy).length;
  state.win.webContents.send("poolStatus", {
    total: e,
    busy: t,
    idle: e - t,
    workers: state.workerPool.map((e) => ({
      id: e.id,
      busy: e.busy,
      status: e.status,
    })),
  });
}
async function waitForPageLoad(e) {
  try {
    (await e.wait(async () => {
      let t = await e
        .executeScript("return document.readyState")
        .catch(() => "complete");
      return "complete" === t || "interactive" === t;
    }, 3e4),
      await e.sleep(1e3));
  } catch (e) {}
}
async function smartScanInputAndType(e, t, a, r, s, i) {
  Logger.info(s, "Mencari: " + r + "...", i);
  try {
    let n = await e.executeScript(
      'const t=arguments[0],e=document.querySelectorAll(\'input, textarea\');for(let l of e){const s=window.getComputedStyle(l);if(s.display===\'none\'||s.visibility===\'hidden\'||l.offsetWidth===0)continue;let y=(l.type||"").toLowerCase(),n=(l.name||"").toLowerCase(),i=(l.id||"").toLowerCase(),p=(l.placeholder||"").toLowerCase();if(t.includes(y)||t.includes(n)||t.includes(i)||t.some(x=>p.includes(x)))return l;}return null;',
      t,
    );
    if (n)
      return (
        Logger.info(s, r + " ditemukan...", i),
        await n.clear().catch(() => {}),
        await n.sendKeys(a),
        Logger.info(s, "Data " + r + " diisi.", i),
        n
      );
  } catch (e) {}
  return (Logger.warn(s, r + " tidak ditemukan.", i), null);
}
async function createDriver(e = !1) {
  let t = new chrome.Options();
  (e || t.addArguments("--headless=new"),
    t.addArguments(
      "--disable-gpu",
      "--no-sandbox",
      "--window-size=1920,1080",
      "--disable-blink-features=AutomationControlled",
      "--disable-extensions",
      "--disable-dev-shm-usage",
      "--disable-software-rasterizer",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-sync",
      "--disable-translate",
      "--metrics-recording-only",
      "--mute-audio",
      "--no-first-run",
      "--safebrowsing-disable-auto-update",
      "--js-flags=--max-old-space-size=256",
      "--disable-site-isolation-trials",
      "--disable-features=IsolateOrigins,site-per-process",
      "--renderer-process-limit=1",
      "--disable-logging",
      "--log-level=3",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    ),
    t.setPageLoadStrategy("eager"));
  let a = await new Builder()
    .forBrowser(Browser.CHROME)
    .setChromeOptions(t)
    .build();
  await a.manage().setTimeouts({ script: 6e5 });
  try {
    (await a.sendDevToolsCommand("Page.addScriptToEvaluateOnNewDocument", {
      source: `Object.defineProperty(navigator,'webdriver',{get:()=>undefined});window.chrome={runtime:{},loadTimes:function(){},csi:function(){},app:{}};Object.defineProperty(navigator,'languages',{get:()=>['id-ID','id','en-US','en']});Object.defineProperty(navigator,'plugins',{get:()=>[1,2,3,4,5]});try{(function(){${state.scriptCache.dismiss}})();}catch(e){}`,
    }),
      await a.sendDevToolsCommand("Network.enable", {}),
      await a.sendDevToolsCommand("Network.setBlockedURLs", {
        urls: [
          "*.css",
          "*.jpg",
          "*.jpeg",
          "*.png",
          "*.gif",
          "*.woff",
          "*.woff2",
        ],
      }));
  } catch (e) {}
  return a;
}
async function deepClean(e, t, a = "SYSTEM") {
  try {
    (await e.manage().deleteAllCookies(),
      await e.executeScript(
        "try{localStorage.clear();sessionStorage.clear();if(window.indexedDB&&window.indexedDB.databases)window.indexedDB.databases().then(d=>d.forEach(b=>window.indexedDB.deleteDatabase(b.name)))}catch(e){}",
      ),
      await e.get("about:blank"),
      await e.sleep(500));
  } catch (e) {}
}
async function createBrowser(e = !1) {
  if (!state.isCreatingBrowser) {
    state.isCreatingBrowser = !0;
    try {
      const t = await createDriver(e);
      (state.workerPool.push({
        id: state.nextWorkerId++,
        driver: t,
        busy: !1,
        status: "stopped",
        createdAt: Date.now(),
        lastActivity: Date.now(),
        taskStartTime: null,
        currentTask: null,
        forceAbort: !1,
        needsRefresh: !1,
        hasRefreshed: !1,
      }),
        updatePoolStatus());
    } catch (e) {
    } finally {
      state.isCreatingBrowser = !1;
    }
  }
}
async function createMultipleBrowsers(e, t = !1) {
  const a = Math.min(Math.max(parseInt(e) || 1, 1), 50);
  for (let e = 0; e < a; e++)
    state.isCreatingBrowser || state.isQuitting
      ? (await new Promise((e) => setTimeout(e, 500)), e--)
      : await createBrowser(t);
}
async function cleanupAllBrowsers() {
  state.zombieCheckInterval &&
    (clearInterval(state.zombieCheckInterval),
    (state.zombieCheckInterval = null));
  for (let e of state.workerPool) {
    e.status = "stopped";
    try {
      await e.driver.quit();
    } catch (e) {}
  }
  for (let e of chromeDriverPids)
    try {
      treeKill(e, "SIGKILL");
    } catch (e) {}
  (chromeDriverPids.clear(),
    (state.workerPool = []),
    (state.taskQueue = []),
    (state.isProcessingQueue = !1),
    (state.isCreatingBrowser = !1),
    (state.nextWorkerId = 1));
}
async function checkZombies() {
  for (let e = state.workerPool.length - 1; e >= 0; e--) {
    const t = state.workerPool[e];
    let a =
        t.currentTask && t.currentTask.uidChunk
          ? t.currentTask.uidChunk.length
          : 0,
      r = Math.max(6e4, 5e3 * a);
    if (t.busy && t.taskStartTime && Date.now() - t.taskStartTime > r) {
      let s = !1;
      try {
        s =
          null !==
          (await t.driver
            .manage()
            .getCookie("c_user")
            .catch(() => null));
      } catch (e) {}
      if (s && !t.hasRefreshed) {
        Logger.info("SYSTEM", `Me-refresh browser nyangkut ID ${t.id}`, t.id);
        t.needsRefresh = !0;
        t.hasRefreshed = !0;
        t.taskStartTime = Date.now();
      } else {
        Logger.warn("SYSTEM", `Me-reset zombie worker ID ${t.id}`, t.id);
        t.forceAbort = !0;
        await t.driver.executeScript("window.stop();").catch(() => {});
      }
    }
  }
}
async function mLogin(e, t, a, r = "SYSTEM") {
  try {
    (Logger.info(t, "Manual Login...", r),
      await deepClean(e, t, r),
      await e.sendDevToolsCommand("Network.setBlockedURLs", { urls: [] }),
      await e.get("https://web.facebook.com/"),
      await waitForPageLoad(e),
      await e.sleep(2e3),
      await smartScanInputAndType(e, ["email"], t, "Email", t, r));
    let s = await smartScanInputAndType(
      e,
      ["password", "pass"],
      a,
      "Password",
      t,
      r,
    );
    return s &&
      (await s.sendKeys("\uE007"),
      await waitForPageLoad(e),
      await e.sleep(2500),
      await e.executeScript(
        "return !!document.querySelector('[style*=\"line-height: var(--meta-line-height)\"]');",
      ))
      ? (await deepClean(e, t, r), !1)
      : (await waitForPageLoad(e), !0);
  } catch (e) {
    return !1;
  }
}
async function sCont(e, t, a, r = "SYSTEM") {
  try {
    await e.sleep(3e3);
    let s = await smartScanInputAndType(
      e,
      ["password", "pass"],
      a,
      "Password",
      t,
      r,
    );
    if (!s) {
      if (
        !(await e.executeScript(
          'const b=document.querySelectorAll(\'div[role="button"][aria-label*="Lanjutkan"], div[role="button"][aria-label*="Continue"], div[role="button"][aria-label*="Masuk sebagai"], div[role="button"][aria-label*="Log in as"]\');for(let x of b){if(window.getComputedStyle(x).display!==\'none\'&&x.offsetWidth>0){x.click();return true}}return false;',
        ))
      )
        return !1;
      (await e.sleep(3e3),
        (s = await smartScanInputAndType(
          e,
          ["password", "pass"],
          a,
          "Password",
          t,
          r,
        )));
    }
    return (
      !!s &&
      (await s.sendKeys("\uE007"),
      await waitForPageLoad(e),
      await e.sleep(2500),
      !(await e.executeScript(
        "return !!document.querySelector('[style*=\"line-height: var(--meta-line-height)\"]');",
      )) || (await deepClean(e, t, r), !1))
    );
  } catch (e) {
    return !1;
  }
}
async function forceQuickLogin(e, t, a, r = "SYSTEM") {
  try {
    return (
      await e.sendDevToolsCommand("Network.setBlockedURLs", { urls: [] }),
      await e
        .manage()
        .deleteCookie("xs")
        .catch(() => {}),
      await e.get("https://web.facebook.com"),
      await waitForPageLoad(e),
      !!(await sCont(e, t, a, r)) || (await mLogin(e, t, a, r))
    );
  } catch (s) {
    return await mLogin(e, t, a, r);
  }
}
async function processAccount(e, t) {
  const {
      line: a,
      mode: r,
      uidChunk: s,
      accLink: i,
      cfg: n,
      retryCount: o = 0,
      workerId: c,
    } = t,
    l = (e, t = !1, a = !1, r = !1) => {
      state.currentStats.running > 0 &&
        (state.currentStats.running--,
        r ||
          t ||
          (state.currentStats.processed++,
          e ? state.currentStats.success++ : state.currentStats.fail++));
      state.currentStats.waiting = state.taskQueue.length;
      state.win &&
        state.win.webContents.send("update-stats", state.currentStats);
      return { success: e, retry: t, driverDead: a, stopped: r };
    },
    h = () => {
      const e = state.workerPool.find((e) => e.id === c);
      return !!e && e.forceAbort;
    };
  try {
    const t = a.split("|");
    if (t.length < 3) return l(!1);
    const [o, u, d] = t.map((e) => e.trim());
    let w = state.workerPool.find((e) => e.id === c);
    if (!w) {
      try {
        await e.quit();
      } catch (e) {}
      return l(!1, !1, !0);
    }
    for (; "paused" === w.status; )
      (await new Promise((e) => setTimeout(e, 1e3)),
        (w = state.workerPool.find((e) => e.id === c)));
    if ("stopped" === w.status) return l(!1, !1, !1, !0);
    if (
      (state.win && state.win.webContents.send("clear-worker-log", c),
      Logger.info(o, "Mulai...", c),
      await e.sendDevToolsCommand("Network.setBlockedURLs", {
        urls: [
          "*.css",
          "*.jpg",
          "*.jpeg",
          "*.png",
          "*.gif",
          "*.woff",
          "*.woff2",
        ],
      }),
      await e.get("https://www.facebook.com"),
      h())
    )
      return l(!1);
    let p = await e.getCurrentUrl().catch(() => ""),
      g = 0;
    for (; !p.includes("facebook.com") && g < 10; ) {
      if (
        (await e.sleep(1e3),
        await e.get("https://www.facebook.com"),
        (p = await e.getCurrentUrl().catch(() => "")),
        g++,
        h())
      )
        return l(!1);
    }
    if ((await waitForPageLoad(e), h())) return l(!1);
    const m = d.split(";").map((e) => {
      const [t, ...a] = e.trim().split("=");
      return { name: t, value: a.join("="), domain: ".facebook.com" };
    });
    for (let t of m)
      t.name &&
        (await e
          .manage()
          .addCookie(t)
          .catch(() => {}));
    if ((await e.navigate().refresh(), await waitForPageLoad(e), h()))
      return l(!1);
    let f =
      null !==
      (await e
        .manage()
        .getCookie("c_user")
        .catch(() => null));
    const k = await e.getCurrentUrl(),
      y = (await e.findElement(By.tagName("body")).getText()).toLowerCase(),
      S = [
        "pilih profil",
        "choose a profile",
        "selecciona un",
        "choisissez un",
        "escolha um",
        "chọn một",
        "pumili ng",
      ],
      b = await e.executeScript(
        "return !!(document.querySelector('input[type=\"password\"]')||document.querySelector('input[name=\"pass\"]')||window.location.pathname.includes('/login')||document.querySelector('form[action*=\"/login\"]'));",
      );
    let T = !1;
    if (
      (k.includes("checkpoint") || S.some((e) => y.includes(e))
        ? (T = await forceQuickLogin(e, o, u, c))
        : !f || b
          ? (T = await forceQuickLogin(e, o, u, c))
          : ((T = !0), Logger.info(o, "Sesi OK.", c)),
      !T || h())
    )
      return l(!1);
    let L = await e.getCurrentUrl().catch(() => "");
    if (
      L.includes("two_step_verification") ||
      L.includes("auth_platform/codesubmit")
    )
      return (
        Logger.error(
          o,
          "Gagal: " +
            (L.includes("two_step_verification")
              ? "two_step_verification"
              : "auth_platform"),
          c,
        ),
        await deepClean(e, o, c),
        l(!1)
      );
    let D = r.includes("Tambah member")
      ? state.scriptCache.addMember
      : state.scriptCache.createGroup;
    if (!D) return l(!1);
    if (
      !(await e
        .wait(
          async () =>
            await e.executeScript(
              "try{let f=document.querySelector('input[name=\"fb_dtsg\"]')?.value;if(!f&&typeof require!=='undefined')f=require(\"DTSGInitialData\")?.token;if(!f&&typeof __DTSGInitialData!=='undefined')f=__DTSGInitialData?.token;return !!f;}catch(e){return false;}",
            ),
          15e3,
        )
        .catch(() => !1))
    )
      return l(!1);
    if (h()) return l(!1);
    await e.executeScript(
      `window.ellonLogs=[];window.ellonTaskDone=false;window.ellonTaskRefresh=false;window.ellonResumeIndex=0;const lg=x=>window.ellonLogs.push(x);const task=${D};task(arguments[0],arguments[1],arguments[2],arguments[3],lg).then(()=>{if(!window.ellonTaskRefresh)window.ellonTaskDone=true}).catch(e=>{lg("CRASH: "+e.message);window.ellonTaskDone=true});`,
      r,
      s,
      i,
      n,
    );
    let C = !1,
      P = !1;
    for (; !C; ) {
      if (h()) return l(!1);
      if (
        ((w = state.workerPool.find((e) => e.id === c)),
        !w || "stopped" === w.status)
      )
        return l(!1, !1, !1, !0);
      if (w.needsRefresh) {
        w.needsRefresh = !1;
        try {
          let rI = await e
            .executeScript("return window.ellonResumeIndex||0;")
            .catch(() => 0);
          await e.executeScript("window.location.reload();").catch(() => {});
          await waitForPageLoad(e);
          if (h()) return l(!1);
          await e.executeScript(
            `window.ellonLogs=[];window.ellonTaskDone=false;window.ellonTaskRefresh=false;window.ellonResumeIndex=${rI};const lg=x=>window.ellonLogs.push(x);const task=${D};task(arguments[0],arguments[1],arguments[2],arguments[3],lg).then(()=>{if(!window.ellonTaskRefresh)window.ellonTaskDone=true}).catch(e=>{lg("CRASH: "+e.message);window.ellonTaskDone=true});`,
            r,
            s,
            i,
            n,
          );
        } catch (x) {}
        continue;
      }
      for (; "paused" === w.status; ) {
        if ((await new Promise((e) => setTimeout(e, 1e3)), h())) return l(!1);
      }
      let t = 6e4;
      if (w.taskStartTime && Date.now() - w.taskStartTime > t) {
        if (!w.hasRefreshed) {
          Logger.info(o, "Mencoba refresh halaman karena macet...", c);
          w.hasRefreshed = !0;
          w.needsRefresh = !0;
          w.taskStartTime = Date.now();
        } else {
          Logger.warn(o, "Task Timeout", c);
          P = !0;
          break;
        }
      }
      let a = await e
        .executeScript(
          "let l=window.ellonLogs||[];window.ellonLogs=[];return{logs:l,done:window.ellonTaskDone===true,refresh:window.ellonTaskRefresh===true,resumeIndex:window.ellonResumeIndex||0};",
        )
        .catch(() => null);
      if (a) {
        a.logs && a.logs.forEach((e) => Logger.info(o, "> " + e, c));
        if (a.refresh) {
          await e.executeScript("window.location.reload();").catch(() => {});
          await waitForPageLoad(e);
          if (h()) {
            C = !0;
          } else {
            await e.executeScript(
              `window.ellonLogs=[];window.ellonTaskDone=false;window.ellonTaskRefresh=false;window.ellonResumeIndex=${a.resumeIndex};const lg=x=>window.ellonLogs.push(x);const task=${D};task(arguments[0],arguments[1],arguments[2],arguments[3],lg).then(()=>{if(!window.ellonTaskRefresh)window.ellonTaskDone=true}).catch(e=>{lg("CRASH: "+e.message);window.ellonTaskDone=true});`,
              r,
              s,
              i,
              n,
            );
            w.taskStartTime = Date.now();
          }
        } else if (a.done) {
          C = !0;
        }
      }
      await e.sleep(1e3);
    }
    return P
      ? (await deepClean(e, o, c), l(!1))
      : (Logger.info(o, "Selesai.", c),
        await e.sleep(2e3),
        await deepClean(e, o, c),
        l(!0));
  } catch (a) {
    let r = state.workerPool.find((e) => e.id === c);
    if (r && r.forceAbort)
      return (
        await deepClean(e, t.line.split("|")[0].trim(), c).catch(() => {}),
        l(!1)
      );
    try {
      return (await e.getCurrentUrl(), l(!1, o < 2));
    } catch (e) {
      return l(!1, o < 2, !0);
    }
  }
}
async function processQueue() {
  if (!state.isProcessingQueue && !state.isQuitting) {
    for (
      state.isProcessingQueue = !0,
        state.zombieCheckInterval = setInterval(async () => {
          await checkZombies();
        }, 3e4);
      state.taskQueue.length > 0 && !state.isQuitting;
    ) {
      await checkZombies();
      let e = state.workerPool.findIndex(
        (e) => !e.busy && "running" === e.status,
      );
      if (-1 === e) {
        await new Promise((e) => setTimeout(e, 500));
        continue;
      }
      const t = state.workerPool[e],
        a = state.taskQueue.shift();
      ((a.workerId = t.id),
        state.currentStats.running++,
        state.currentStats.pulled++,
        (state.currentStats.waiting = state.taskQueue.length),
        state.win &&
          state.win.webContents.send("update-stats", state.currentStats),
        a.hasStarted ||
          ((a.hasStarted = !0),
          a.uidChunk &&
            a.uidChunk.length > 0 &&
            (await saveToRootDir("UID_terpakai.txt", a.uidChunk)),
          a.accLink && (await saveToRootDir("Link_terpakai.txt", a.accLink))));
      let r = state.taskQueue.map((e) => e.line);
      await overwriteToRootDir("Akun_belum_digunakan.txt", r);
      ((t.busy = !0),
        (t.taskStartTime = Date.now()),
        (t.lastActivity = Date.now()),
        (t.currentTask = a),
        (t.forceAbort = !1),
        (t.needsRefresh = !1),
        (t.hasRefreshed = !1),
        updatePoolStatus(),
        await new Promise((e) => setTimeout(e, 5e3)));
      (async () => {
        try {
          const e = await processAccount(t.driver, a);
          if (state.isQuitting) return;
          if (e.driverDead) {
            const e = state.workerPool.indexOf(t);
            -1 !== e && (state.workerPool.splice(e, 1), updatePoolStatus());
          }
          e.retry
            ? ((a.retryCount = (a.retryCount || 0) + 1),
              state.taskQueue.push(a),
              await overwriteToRootDir(
                "Akun_belum_digunakan.txt",
                state.taskQueue.map((e) => e.line),
              ))
            : e.stopped ||
              (await saveToLogDir(
                e.success ? "Akun_terpakai.txt" : "Akun_gagal.txt",
                a.line,
              ));
        } catch (e) {
        } finally {
          ((t.busy = !1),
            (t.forceAbort = !1),
            (t.needsRefresh = !1),
            (t.hasRefreshed = !1),
            (t.currentTask = null),
            updatePoolStatus());
        }
      })();
    }
    for (; state.workerPool.some((e) => e.busy) && !state.isQuitting; )
      (await checkZombies(), await new Promise((e) => setTimeout(e, 2e3)));
    (state.zombieCheckInterval &&
      (clearInterval(state.zombieCheckInterval),
      (state.zombieCheckInterval = null)),
      (state.isProcessingQueue = !1),
      !state.isQuitting &&
        state.win &&
        (Logger.info("SYSTEM", "ALL TASKS COMPLETED", "SYSTEM"),
        state.win.webContents.send("done")));
  }
}
ipcMain.on("create-browsers", async (e, t) => {
  await createMultipleBrowsers(
    "object" == typeof t ? t.count : t,
    "object" == typeof t && t.showBrowser,
  );
});
ipcMain.on("start-new-browsers", async () => {
  (state.workerPool.forEach((e) => {
    "stopped" === e.status && (e.status = "running");
  }),
    processQueue());
});
const ipcStartSchema = z.object({
  accounts: z.array(z.string()),
  uids: z.array(z.string()).optional(),
  links: z.array(z.string()).optional(),
  mode: z.string(),
  cfg: z.any(),
});
ipcMain.on("start", async (e, t) => {
  if (0 === state.workerPool.length) return;
  let a;
  try {
    a = ipcStartSchema.parse(t);
  } catch (e) {
    return;
  }
  const fClr = [
    "UID_terpakai.txt",
    "Link_terpakai.txt",
    "UID_belum_digunakan.txt",
    "Link_belum_digunakan.txt",
    "Akun_belum_digunakan.txt",
  ];
  for (const f of fClr)
    try {
      const p = path.join(rootDir, f);
      fs.existsSync(p) && (await fs.promises.unlink(p));
    } catch (err) {}
  ((state.currentStats = {
    total: a.accounts.length,
    running: 0,
    waiting: a.accounts.length,
    pulled: 0,
    processed: 0,
    success: 0,
    fail: 0,
  }),
    state.win && state.win.webContents.send("update-stats", state.currentStats),
    state.workerPool.forEach((e) => (e.status = "running")));
  let r = a.mode.includes("Tambah member"),
    s = a.uids ? [...a.uids] : [],
    i = a.links ? [...a.links] : [];
  state.taskQueue = [];
  for (let e of a.accounts) {
    if (!e.trim()) continue;
    let t = [],
      n = "";
    (r
      ? ((t = s.splice(0, parseInt(a.cfg.jmlUid || 160))),
        i.length > 0 && (n = i.shift()))
      : (t = [...s]),
      state.taskQueue.push({
        line: e,
        mode: a.mode,
        uidChunk: t,
        accLink: n,
        cfg: a.cfg,
        retryCount: 0,
        hasStarted: !1,
      }));
  }
  if (
    (r || (s = []),
    await overwriteToRootDir("UID_belum_digunakan.txt", s),
    await overwriteToRootDir("Link_belum_digunakan.txt", i),
    state.taskQueue.length > 0)
  )
    await overwriteToRootDir(
      "Akun_belum_digunakan.txt",
      state.taskQueue.map((e) => e.line),
    );
  processQueue();
});
ipcMain.on("worker-control", async (e, t, a) => {
  const r = state.workerPool.find((e) => e.id === t);
  r && ((r.status = a), updatePoolStatus());
});
ipcMain.on("close-worker", async (e, t) => {
  const a = state.workerPool.findIndex((e) => e.id === t);
  if (-1 !== a) {
    try {
      await state.workerPool[a].driver.quit();
    } catch (e) {}
    (state.workerPool.splice(a, 1), updatePoolStatus());
  }
});
ipcMain.on("full-reset", async () => {
  (await cleanupAllBrowsers(),
    (state.currentStats = {
      total: 0,
      running: 0,
      waiting: 0,
      pulled: 0,
      processed: 0,
      success: 0,
      fail: 0,
    }),
    state.win &&
      state.win.webContents.send("update-stats", state.currentStats));
  const e = [
    "UID_terpakai.txt",
    "Link_terpakai.txt",
    "UID_belum_digunakan.txt",
    "Link_belum_digunakan.txt",
    "Akun_belum_digunakan.txt",
    "log.txt",
  ];
  for (const t of e)
    try {
      const e = path.join(rootDir, t);
      fs.existsSync(e) && (await fs.promises.unlink(e));
    } catch (e) {}
  (updatePoolStatus(),
    state.win && state.win.webContents.send("clear-monitors"));
});
ipcMain.on("restart_app", () => {
  autoUpdater.quitAndInstall();
});
app.whenReady().then(async () => {
  await loadScriptsToCache();
  let e = nativeImage
    .createFromPath(path.join(__dirname, "icon", "icon.png"))
    .resize({ width: 256, height: 256 });
  ((state.win = new BrowserWindow({
    width: 1280,
    height: 900,
    icon: e,
    autoHideMenuBar: !0,
    webPreferences: { nodeIntegration: !0, contextIsolation: !1 },
  })),
    state.win.loadFile("index.html"),
    autoUpdater.checkForUpdatesAndNotify(),
    autoUpdater.on("update-available", () => {
      state.win && state.win.webContents.send("update_available");
    }),
    autoUpdater.on("update-downloaded", () => {
      state.win && state.win.webContents.send("update_downloaded");
    }),
    state.win.on("close", (e) => {
      state.isQuitting ||
        ((state.isQuitting = !0),
        e.preventDefault(),
        cleanupAllBrowsers().then(() => app.exit(0)));
    }));
});
