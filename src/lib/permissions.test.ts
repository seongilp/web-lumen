import { describe, it, expect, vi } from "vitest";
import { ensureReadPermission, type Permissioned } from "./permissions";

function root(state: PermissionState, requestResult: PermissionState = "granted") {
  return {
    queryPermission: vi.fn(async () => state),
    requestPermission: vi.fn(async () => requestResult),
  } satisfies Permissioned;
}

describe("ensureReadPermission", () => {
  it("does not prompt when a root is already granted", async () => {
    const r = root("granted");
    await ensureReadPermission([r]);
    expect(r.queryPermission).toHaveBeenCalledWith({ mode: "read" });
    expect(r.requestPermission).not.toHaveBeenCalled();
  });

  it("requests permission when a root is only in the prompt state", async () => {
    const r = root("prompt");
    await ensureReadPermission([r]);
    expect(r.requestPermission).toHaveBeenCalledWith({ mode: "read" });
  });

  it("prompts once per distinct handle even if it appears multiple times", async () => {
    const r = root("prompt");
    await ensureReadPermission([r, r, r]);
    expect(r.queryPermission).toHaveBeenCalledTimes(1);
    expect(r.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("skips null/undefined roots (OPFS-only items need no permission)", async () => {
    const r = root("prompt");
    await expect(ensureReadPermission([null, undefined, r])).resolves.toBeUndefined();
    expect(r.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("swallows a denial and keeps going to the next root", async () => {
    const bad: Permissioned = {
      queryPermission: vi.fn(async () => {
        throw new Error("SecurityError");
      }),
      requestPermission: vi.fn(async () => "denied" as PermissionState),
    };
    const good = root("prompt");

    await expect(ensureReadPermission([bad, good])).resolves.toBeUndefined();
    // The thrown root didn't abort the loop — the next root was still handled.
    expect(good.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("handles an empty list", async () => {
    await expect(ensureReadPermission([])).resolves.toBeUndefined();
  });
});
