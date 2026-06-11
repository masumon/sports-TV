/**
 * Detect network quality and return optimization flags.
 * Returns true if network is constrained (slow/metered data).
 */
export function isSlowNetwork(): boolean {
  if (typeof window === "undefined") return false;

  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
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

  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  if (!connection) return () => {};

  const handleChange = () => {
    callback(isSlowNetwork());
  };

  connection.addEventListener("change", handleChange);

  return () => {
    connection.removeEventListener("change", handleChange);
  };
}
