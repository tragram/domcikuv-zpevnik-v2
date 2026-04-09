import { useState, useEffect } from "react";
import isOnline from "is-online";

export function useIsOnline() {
  // Initialize state. We default to true, but you could also use navigator.onLine here
  // if you want a faster initial guess before the promise resolves.
  const [onlineState, setOnlineState] = useState(true);

  useEffect(() => {
    // The verifier function that uses the package
    const verifyConnection = async () => {
      const hasInternet = await isOnline();
      setOnlineState(hasInternet);
    };

    // 1. Check immediately when the component mounts
    verifyConnection();

    // 2. Set up event listeners
    // If the browser fires an 'online' event, don't trust it blindly. Verify it.
    const handleOnlineEvent = () => verifyConnection();

    // If the browser fires an 'offline' event, trust it immediately to save battery/network.
    const handleOfflineEvent = () => setOnlineState(false);

    window.addEventListener("online", handleOnlineEvent);
    window.addEventListener("offline", handleOfflineEvent);

    return () => {
      window.removeEventListener("online", handleOnlineEvent);
      window.removeEventListener("offline", handleOfflineEvent);
    };
  }, []);

  return onlineState;
}
