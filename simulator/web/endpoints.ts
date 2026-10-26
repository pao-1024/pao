const controlBase = new URL(import.meta.env.VITE_CONTROL_BASE || `http://${location.hostname}:8081/`, location.href);

export const controlPageUrl = controlBase.href;

export function websocketUrl(url: URL): string {
  const socket = new URL(url);
  socket.protocol = socket.protocol === "https:" ? "wss:" : "ws:";
  return socket.href;
}

export const controlSocketUrl = websocketUrl(new URL("ws", controlBase));

export async function deviceBusy(): Promise<boolean> {
  try {
    const response = await fetch("/_single_device/status", { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (!response.ok) return false;
    const status = await response.json();
    return status.available === false && status.owned === false;
  } catch { return false; }
}
