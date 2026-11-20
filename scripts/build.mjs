// 纯静态插件：把 src-ztools 拷到 dist，再把 dist 打包成可分发的 zip
import { cp, rm, mkdir, readFile, stat } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const src = path.join(root, 'src-ztools')
const dist = path.join(root, 'dist')
const manifest = JSON.parse(await readFile(path.join(src, 'plugin.json'), 'utf8'))

await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })
await cp(src, dist, {
  recursive: true,
  filter: p => !p.includes('node_modules') && !p.endsWith('.DS_Store')
})

// manifest 声明的文件必须真的存在，否则插件装上是白屏
for (const file of [manifest.main, manifest.preload, manifest.logo]) {
  if (!file) continue
  await stat(path.join(dist, file)).catch(() => {
    throw new Error('plugin.json 声明的文件不存在: ' + file)
  })
}

console.log('build ok ->', path.relative(root, dist))

if (process.argv.includes('--zip')) {
  const zip = path.join(root, 'releases', `process-killer-${manifest.version}.zip`)
  await mkdir(path.dirname(zip), { recursive: true })
  await rm(zip, { force: true })
  execFileSync('/usr/bin/ditto', ['-c', '-k', '--norsrc', dist, zip])
  console.log('zip ->', path.relative(root, zip))
}
