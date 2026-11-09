import { callServer } from "../lib/server.ts";

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function notificationsSupported(): boolean {
  return Boolean(PUBLIC_KEY) && "serviceWorker" in navigator && "PushManager" in window;
}

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/** Asks for permission, and gives the server this browser's subscription (REQ-11). */
export async function subscribeToNotifications(): Promise<void> {
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Permission refused");
  const registration = await navigator.serviceWorker.register("/sw.js");
  const ready = await navigator.serviceWorker.ready;
  const subscription = await (ready ?? registration).pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(PUBLIC_KEY!),
  });
  await callServer("/notifications/subscribe", subscription.toJSON());
}
