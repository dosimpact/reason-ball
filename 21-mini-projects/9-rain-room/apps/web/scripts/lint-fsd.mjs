import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Steiger's one-shot scanner uses chokidar internally. Polling avoids unavailable
// native filesystem watchers in restricted macOS/CI environments; rules stay intact.
const cli = fileURLToPath(new URL('../node_modules/steiger/dist/cli.mjs', import.meta.url))
const result = spawnSync(process.execPath, [cli, './src', '--fail-on-warnings'], {
  stdio: 'inherit',
  env: { ...process.env, CHOKIDAR_USEPOLLING: '1' },
})
if (result.error) {
  console.error(result.error.message)
  process.exitCode = 1
} else process.exitCode = result.status ?? 1
