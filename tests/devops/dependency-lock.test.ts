import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const json = async (path: string) => JSON.parse(await readFile(resolve(path), "utf8"));
type LockEntry = {
  link?: boolean;
  optional?: boolean;
  version: string;
  dependencies?: Record<string, string>;
};

// Keep the real installed-manifest check: it catches lockfile edits made AFTER
// npm ci. Bound I/O concurrency instead of reading hundreds of Windows files
// synchronously while the database suites are also starting.
describe("release dependency metadata", () => {
  it("matches installed package versions and dependency ranges against the final lockfile", async () => {
    const [app, lock] = await Promise.all([json("package.json"), json("package-lock.json")]);
    expect(lock.version).toBe(app.version);
    expect(lock.packages[""].version).toBe(app.version);
    const errors: string[] = [];
    const entries = Object.entries(lock.packages) as Array<[string, LockEntry]>;
    let checked = 0;
    for (let start = 0; start < entries.length; start += 8) {
      await Promise.all(entries.slice(start, start + 8).map(async ([path, entry]) => {
        if (!path || entry.link) return;
        let installed;
        try {
          installed = await json(path + "/package.json");
        } catch (error) {
          // npm omits optional native packages for other operating systems.
          if ((error as NodeJS.ErrnoException).code === "ENOENT" && entry.optional) return;
          throw error;
        }
        checked++;
        if (entry.version !== installed.version)
          errors.push(path + ": installed version differs from lockfile");
        const declared = { ...installed.dependencies, ...installed.optionalDependencies };
        for (const [name, range] of Object.entries(entry.dependencies || {}))
          if (range !== declared[name]) errors.push(path + ": stale range for " + name);
      }));
    }
    expect(checked).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  }, 30_000);
});
