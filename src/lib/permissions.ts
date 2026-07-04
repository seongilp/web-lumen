// File System Access permission helpers. Requesting a permission needs
// transient activation, so callers must invoke this straight from a gesture.

type RWMode = { mode: "read" | "readwrite" };

export interface Permissioned {
  queryPermission(o: RWMode): Promise<PermissionState>;
  requestPermission(o: RWMode): Promise<PermissionState>;
}

/**
 * Ensure read permission on each distinct root directory handle. Prompts at
 * most once per handle (already-granted roots are skipped), ignores
 * null/undefined entries (OPFS-only items need no disk permission), and
 * swallows denials so one refused folder doesn't abort the rest.
 */
export async function ensureReadPermission(
  roots: Iterable<Permissioned | null | undefined>
): Promise<void> {
  const seen = new Set<Permissioned>();
  for (const root of roots) {
    if (!root || seen.has(root)) continue;
    seen.add(root);
    try {
      if ((await root.queryPermission({ mode: "read" })) !== "granted") {
        await root.requestPermission({ mode: "read" });
      }
    } catch {
      /* denied — the caller reports skipped originals afterwards */
    }
  }
}
