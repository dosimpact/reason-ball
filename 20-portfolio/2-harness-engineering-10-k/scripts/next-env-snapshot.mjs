import { copyFileSync, existsSync, mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function createNextEnvSnapshot(nextEnvFile, prefix) {
  let snapshotDir = null;
  let hadNextEnv = false;

  return {
    snapshot() {
      if (snapshotDir !== null) {
        return;
      }

      snapshotDir = mkdtempSync(join(tmpdir(), prefix));
      hadNextEnv = existsSync(nextEnvFile);

      if (hadNextEnv) {
        copyFileSync(nextEnvFile, join(snapshotDir, "next-env.d.ts"));
      }
    },

    restore() {
      if (snapshotDir === null) {
        return;
      }

      const snapshotFile = join(snapshotDir, "next-env.d.ts");
      if (hadNextEnv && existsSync(snapshotFile)) {
        copyFileSync(snapshotFile, nextEnvFile);
      } else if (!hadNextEnv && existsSync(nextEnvFile)) {
        unlinkSync(nextEnvFile);
      }

      rmSync(snapshotDir, { recursive: true, force: true });
      snapshotDir = null;
      hadNextEnv = false;
    },
  };
}
