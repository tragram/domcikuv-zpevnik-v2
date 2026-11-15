/** The virtualized list restores its own position; song routes use the router. */
export function shouldRestoreSongScroll({
  location,
}: {
  location: { pathname: string };
}) {
  return location.pathname.startsWith("/song/");
}
