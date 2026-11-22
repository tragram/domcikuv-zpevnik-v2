import { create } from "zustand";
import { getIsOnline, subscribeOnline } from "~/hooks/use-is-online";

export const updateLabels = {
  idle: "Check for updates",
  checking: "Checking for updates…",
  current: "Up to date · Check again",
  downloading: "Downloading update…",
  ready: "Restart open tabs to update",
  restarting: "Restarting…",
  otherTabs: "Another tab couldn’t restart. Open it and retry.",
  failed: "Couldn’t check for updates · Retry",
} as const;

type UpdateStatus = keyof typeof updateLabels;
export const useAppUpdate = create<UpdateStatus>(() => "idle");
const setStatus = (status: UpdateStatus) => useAppUpdate.setState(status, true);
const checkInterval = 15 * 60_000;
let lastCheck = 0;
let registration: ServiceWorkerRegistration | undefined;
let checkInFlight: Promise<void> | undefined;

function observeInstallation(reg: ServiceWorkerRegistration) {
  const worker = reg.installing;
  if (!worker || !reg.active) return;
  const observe = () => {
    if (worker.state === "installed") setStatus("ready");
    if (worker.state === "redundant") setStatus(reg.waiting ? "ready" : "failed");
  };
  setStatus("downloading");
  worker.addEventListener("statechange", observe);
  observe();
}

async function check(applyWaitingUpdate: boolean) {
  try {
    if (!registration) {
      registration = await navigator.serviceWorker.getRegistration("/")
        ?? await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const reg = registration;
      reg.addEventListener("updatefound", () => observeInstallation(reg));
      observeInstallation(reg);
    }
    // A browser refresh already expresses intent to reload. Apply a staged
    // update through the same coordinated restart as the settings action.
    if (applyWaitingUpdate && registration.waiting && getIsOnline()) {
      await runUpdateAction();
      return;
    }
    if (registration.active && !registration.waiting && !registration.installing) {
      await registration.update();
    }
    if (registration.waiting) setStatus("ready");
    else if (registration.installing && registration.active) setStatus("downloading");
    else setStatus(registration.active ? "current" : "idle");
  } catch {
    setStatus("failed");
  }
}

function checkForUpdate(manual = false, applyWaitingUpdate = false) {
  if (!getIsOnline() || checkInFlight || useAppUpdate.getState() === "restarting") return checkInFlight;
  if (!manual && Date.now() - lastCheck < checkInterval) return;
  lastCheck = Date.now();
  setStatus("checking");
  checkInFlight = check(applyWaitingUpdate).finally(() => { checkInFlight = undefined; });
  return checkInFlight;
}

let reloadPending = false;
let reloadHolds = 0;

function reloadWhenReady() {
  if (reloadPending && reloadHolds === 0) {
    reloadPending = false;
    window.location.reload();
  }
}

/** Hold this tab's restart until an in-flight write or an in-memory draft is safe. */
export function holdAppReload() {
  reloadHolds++;
  return () => {
    reloadHolds--;
    reloadWhenReady();
  };
}

export function startAppUpdates() {
  if (!("serviceWorker" in navigator)) return;
  let controller = navigator.serviceWorker.controller;
  let coordinated = false;
  navigator.serviceWorker.addEventListener("message", event => {
    if (event.data?.type === "CHECK_UPDATE_RELOAD") {
      coordinated = true;
      event.ports[0]?.postMessage("reload-on-update");
    }
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const next = navigator.serviceWorker.controller;
    if (next && next !== controller && (controller || coordinated || useAppUpdate.getState() === "restarting")) {
      reloadPending = true;
      reloadWhenReady();
    }
    controller = next;
  });
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (navigation?.type === "reload") {
    const applyAfterNavigation = () => {
      // Let the browser finish its own service worker update check triggered
      // by navigation before asking the waiting worker to activate.
      setTimeout(() => void checkForUpdate(true, true), 1500);
    };
    if (document.readyState === "complete") applyAfterNavigation();
    else window.addEventListener("load", applyAfterNavigation, { once: true });
  } else {
    void checkForUpdate();
  }
  subscribeOnline(() => { if (getIsOnline()) void checkForUpdate(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkForUpdate();
  });
}

/** Registration objects reflect updates initiated by other tabs as well. */
export async function hasPendingAppUpdate() {
  if (!("serviceWorker" in navigator)) return false;
  if (reloadPending) return true;
  const reg = registration ?? await navigator.serviceWorker.getRegistration();
  return !!(reg?.waiting || (reg?.active && reg.installing));
}

export async function retryAppLoad(checkForNewBuild: boolean) {
  if (import.meta.env.PROD && getIsOnline() && "serviceWorker" in navigator) {
    if (checkForNewBuild && !registration?.waiting) await checkForUpdate(true);
    if (registration?.waiting) {
      await runUpdateAction();
      return;
    }
    if (checkForNewBuild && useAppUpdate.getState() === "downloading") return;
  }
  window.location.reload();
}

export async function runUpdateAction() {
  if (!getIsOnline()) return;
  const worker = registration?.waiting;
  if (!worker) return checkForUpdate(true);
  if (useAppUpdate.getState() === "restarting") return;
  setStatus("restarting");
  const channel = new MessageChannel();
  const cleanup = () => {
    clearTimeout(timer);
    navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    channel.port1.close();
  };
  const onControllerChange = () => {
    if (navigator.serviceWorker.controller !== worker) return;
    cleanup();
  };
  const timer = setTimeout(() => { cleanup(); setStatus("failed"); }, 15_000);
  navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
  channel.port1.onmessage = () => { cleanup(); setStatus("otherTabs"); };
  try {
    worker.postMessage({ type: "RESTART_FOR_UPDATE" }, [channel.port2]);
  } catch {
    cleanup();
    setStatus("failed");
  }
}
