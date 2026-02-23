import { useState, useEffect } from "react";

export function useScrollDirection(threshold = 50) {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const updateScrollDirection = () => {
      const scrollY = window.scrollY;

      // Always show toolbar if we are near the top of the page
      if (scrollY <= threshold) {
        setIsVisible(true);
        setLastScrollY(scrollY);
        return;
      }

      // Determine scroll direction
      const direction = scrollY > lastScrollY ? "down" : "up";

      if (direction === "down" && isVisible) {
        setIsVisible(false);
      } else if (direction === "up" && !isVisible) {
        setIsVisible(true);
      }

      setLastScrollY(scrollY);
    };

    // passive: true for better scrolling performance
    window.addEventListener("scroll", updateScrollDirection, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollDirection);
  }, [lastScrollY, isVisible, threshold]);

  return isVisible;
}
