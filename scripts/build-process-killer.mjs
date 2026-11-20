// 把 src-ztools 整理成可安装、可分发的插件目录
//
// 仓库按 ZTools-plugins 的目录约定提交：可运行产物在 src-ztools/dist，
// 清单与图标在 src-ztools/。这里生成 dist/（安装包的内容），
// 并核对清单声明的文件真的存在，避免装上是白屏。
import { cp, rm, mkdir, readFile, stat } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const src = path.join(root, 'src-ztools')
const runtime = path.join(src, 'dist')
const out = path.join(root, 'dist')
const manifest = JSON.parse(await readFile(path.join(src, 'plugin.json'), 'utf8'))

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })

// 清单、图标直接放到插件根目录
for (const name of ['plugin.json', 'logo.png']) {
  await cp(path.join(src, name), path.join(out, name)).catch(() => {})
}
// 运行时代码整体铺到插件根目录：index.html、main.js、style.css、preload/
// 注意：filter 里不能用字符串路径判断，会按目录结构误伤，只排除 .DS_Store
await cp(runtime, out, { recursive: true, filter: p => !p.endsWith('.DS_Store') })

// 清单声明的文件必须落在打包后的插件根目录里。
// 清单是相对 src-ztools 写的（dist/index.html），去掉开头的 dist/ 才是包内路径
const inPackage = file => path.join(out, file.replace(/^dist\//, ''))
for (const file of [manifest.main, manifest.preload, manifest.logo]) {
  if (!file) continue
  await stat(inPackage(file)).catch(() => {
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
