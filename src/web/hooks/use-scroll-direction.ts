import { useState, useEffect, useRef } from "react";

export function useScrollDirection(threshold = 50) {
  const [isVisible, setIsVisible] = useState(true);
  // Kept in a ref so the scroll listener is registered once, not re-subscribed
  // on every scroll event (which is what tracking it in state would cause).
  const lastScrollY = useRef(0);

  useEffect(() => {
    const updateScrollDirection = () => {
      const scrollY = window.scrollY;

      // Always show the toolbar near the top of the page.
      if (scrollY <= threshold) {
        setIsVisible(true);
        lastScrollY.current = scrollY;
        return;
      }

      // Show when scrolling up, hide when scrolling down (setState bails out
      // when the value is unchanged).
      setIsVisible(scrollY < lastScrollY.current);
      lastScrollY.current = scrollY;
    };

    // passive: true for better scrolling performance
    window.addEventListener("scroll", updateScrollDirection, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollDirection);
  }, [threshold]);

  return isVisible;
}
