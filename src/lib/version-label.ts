export function versionLabel(version: {
  label?: string | null;
  importSourceId?: string | null;
  createdAt?: Date | string;
  isOfficial?: boolean;
  isCurrent?: boolean;
  versionNumber?: number;
}) {
  return (
    version.label ||
    version.importSourceId ||
    (version.isOfficial || version.isCurrent ? "Official version" : `Version ${version.versionNumber ?? 1}`)
  );
}

export function versionBadgeLabel(version: Parameters<typeof versionLabel>[0]) {
  return version.isOfficial || version.isCurrent ? "Official" : versionLabel(version);
}
