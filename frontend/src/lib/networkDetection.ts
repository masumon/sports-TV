type NetworkInformation = {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  saveData?: boolean;
  addEventListener?: (event: string, callback: () => void) => void;
  removeEventListener?: (event: string, callback: () => void) => void;
};

/**
 * Detect network quality and return optimization flags.
 * Returns true if network is constrained (slow/metered data).
 */
export function isSlowNetwork(): boolean {
  if (typeof window === "undefined") return false;

  const nav = navigator as Navigator & { connection?: NetworkInformation; mozConnection?: NetworkInformation; webkitConnection?: NetworkInformation };
  const connection: NetworkInformation | undefined = nav.connection || nav.mozConnection || nav.webkitConnection;
  if (!connection) return false;

  const effectiveType = connection.effectiveType;  // 'slow-2g', '2g', '3g', '4g'
  const saveData = connection.saveData;  // User enabled data saver

  return saveData || effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g";
}

/**
 * Monitor network changes and return callback for updates.
 */
export function onNetworkChange(callback: (isSlowNetwork: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const nav = navigator as Navigator & { connection?: NetworkInformation; mozConnection?: NetworkInformation; webkitConnection?: NetworkInformation };
  const connection: NetworkInformation | undefined = nav.connection || nav.mozConnection || nav.webkitConnection;
  if (!connection || !connection.addEventListener || !connection.removeEventListener) return () => {};

  const handleChange = () => {
    callback(isSlowNetwork());
  };

  connection.addEventListener("change", handleChange);

  return () => {
    connection.removeEventListener?.("change", handleChange);
  };
}
