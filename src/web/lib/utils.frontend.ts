import { useRouteContext } from "@tanstack/react-router";

export const tailwindBreakpoint = (
  breakpoint: "xs" | "xsm" | "sm" | "md" | "lg" | "xl",
) => {
  const styles = getComputedStyle(document.documentElement);
  const value = styles.getPropertyValue(`--breakpoint-${breakpoint}`);
  return parseInt(value, 10);
};
export function useLoggedIn() {
  const routeContext = useRouteContext({ from: "__root__" });
  return routeContext.user.loggedIn;
}
