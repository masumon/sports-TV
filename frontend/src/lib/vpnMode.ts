/**
 * VPN/Proxy Mode - Force proxy usage for all streams
 * Helps bypass geo-blocks and ISP throttling
 */

const VPN_MODE_KEY = "gstv-vpn-mode";

export function isVpnModeEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(VPN_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setVpnMode(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(VPN_MODE_KEY, "1");
    } else {
      localStorage.removeItem(VPN_MODE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function toggleVpnMode(): boolean {
  const newState = !isVpnModeEnabled();
  setVpnMode(newState);
  return newState;
}
