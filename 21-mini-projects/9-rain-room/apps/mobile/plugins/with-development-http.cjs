const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins')
const fs = require('node:fs/promises')
const path = require('node:path')

module.exports = function withDevelopmentHttp(config, { enabled, host }) {
  config = withAndroidManifest(config, (result) => {
    const app = result.modResults.manifest.application[0]
    app.$['android:usesCleartextTraffic'] = 'false'
    if (enabled) app.$['android:networkSecurityConfig'] = '@xml/rain_room_network_security'
    else delete app.$['android:networkSecurityConfig']
    return result
  })
  return withDangerousMod(config, [
    'android',
    async (result) => {
      const directory = path.join(result.modRequest.platformProjectRoot, 'app/src/main/res/xml')
      const file = path.join(directory, 'rain_room_network_security.xml')
      if (enabled) {
        if (!/^[a-zA-Z0-9.-]+$/.test(host))
          throw new Error('Development HTTP requires a DNS hostname or IPv4 address.')
        await fs.mkdir(directory, { recursive: true })
        await fs.writeFile(
          file,
          `<?xml version="1.0" encoding="utf-8"?>\n<network-security-config><base-config cleartextTrafficPermitted="false"/><domain-config cleartextTrafficPermitted="true"><domain includeSubdomains="false">${host}</domain></domain-config></network-security-config>\n`,
        )
      } else await fs.rm(file, { force: true })
      return result
    },
  ])
}
