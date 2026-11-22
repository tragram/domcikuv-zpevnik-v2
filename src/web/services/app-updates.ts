import { create } from "zustand";
import { getIsOnline, subscribeOnline } from "~/hooks/use-is-online";

export const updateLabels = {
  idle: "Check for updates",
  checking: "Checking for updates…",
  current: "Up to date · Check again",
  downloading: "Downloading update…",
  ready: "Restart to update",
  restarting: "Restarting…",
  otherTabs: "Close other songbook tabs, then retry",
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

async function check() {
  try {
    if (!registration) {
      registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const reg = registration;
      reg.addEventListener("updatefound", () => observeInstallation(reg));
      observeInstallation(reg);
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

function checkForUpdate(manual = false) {
  if (!getIsOnline() || checkInFlight || useAppUpdate.getState() === "restarting") return checkInFlight;
  if (!manual && Date.now() - lastCheck < checkInterval) return;
  lastCheck = Date.now();
  setStatus("checking");
  checkInFlight = check().finally(() => { checkInFlight = undefined; });
  return checkInFlight;
}

export function startAppUpdates() {
  if (!("serviceWorker" in navigator)) return;
  void checkForUpdate();
  subscribeOnline(() => { if (getIsOnline()) void checkForUpdate(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkForUpdate();
  });
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
    window.location.reload();
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
