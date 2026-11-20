// 把 src-ztools 整理成可安装、可分发的插件目录
//
// 仓库里提交的是 ZTools-plugins 的目录约定：可运行产物放在 src-ztools/pkg
// （清单、图标、index.html、preload 都在里面），这里把它整理成 dist/，
// 也就是安装包的内容，并核对清单声明的文件真的存在。
//
// 目录名不能叫 dist：发布 CLI 复制插件目录时会跳过所有名为 dist 的目录。
import { cp, rm, mkdir, readFile, stat } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const src = path.join(root, 'src-ztools')
const pkg = path.join(src, 'pkg')
const out = path.join(root, 'dist')
const manifest = JSON.parse(await readFile(path.join(pkg, 'plugin.json'), 'utf8'))

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })
await cp(pkg, out, { recursive: true, filter: p => !p.endsWith('.DS_Store') })

for (const file of [manifest.main, manifest.preload, manifest.logo]) {
  if (!file) continue
  await stat(path.join(out, file)).catch(() => {
    throw new Error('plugin.json 声明的文件不存在: ' + file)
  })
}

console.log('build ok ->', path.relative(root, out))

if (process.argv.includes('--zip')) {
  const zip = path.join(root, 'releases', `process-killer-${manifest.version}.zip`)
  await mkdir(path.dirname(zip), { recursive: true })
  await rm(zip, { force: true })
  // Windows 自带 tar（bsdtar）也能打 zip，Mac 上用 ditto 保留架构信息
  if (process.platform === 'win32') {
    execFileSync('tar.exe', ['-a', '-c', '-f', zip, '-C', out, '.'])
  } else {
    execFileSync('/usr/bin/ditto', ['-c', '-k', '--norsrc', out, zip])
  }
  console.log('zip ->', path.relative(root, zip))
}
