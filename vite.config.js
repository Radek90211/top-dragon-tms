import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default ({ command }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __BUILD_KIND__: JSON.stringify(command === 'build' ? 'Wygenerowano pliki' : 'Uruchomiono środowisko')
  }
})
