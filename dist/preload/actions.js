const { execFile, spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

const SIGTERM_GRACE_MS = 3000

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function isAlive(pid) {
  try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' }
}

async function waitGone(pid, timeout) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return true
    await sleep(100)
  }
  return !isAlive(pid)
}

// 返回 { ok, pid, signal?, reason? }；reason 区分无权限 / 已退出 / 仍需强杀
async function kill(pid, options = {}) {
  const target = Number(pid)
  if (!Number.isInteger(target) || target <= 0) return { ok: false, pid: target, reason: 'invalid_pid' }
  if (target === process.pid) return { ok: false, pid: target, reason: 'self' }
  if (!isAlive(target)) return { ok: false, pid: target, reason: 'gone' }

  try {
    process.kill(target, 'SIGTERM')
  } catch (e) {
    return { ok: false, pid: target, reason: e.code === 'EPERM' ? 'permission' : 'failed', error: e.message }
  }

  if (options.force) {
    process.kill(target, 'SIGKILL')
    return { ok: true, pid: target, signal: 'SIGKILL' }
  }

  const gone = await waitGone(target, SIGTERM_GRACE_MS)
  if (gone) return { ok: true, pid: target, signal: 'SIGTERM' }
  return { ok: false, pid: target, reason: 'still_alive', signal: 'SIGTERM' }
}

async function forceKill(pid) {
  try {
    process.kill(Number(pid), 'SIGKILL')
    return { ok: true, pid: Number(pid), signal: 'SIGKILL' }
  } catch (e) {
    return { ok: false, pid: Number(pid), reason: e.code === 'EPERM' ? 'permission' : 'failed', error: e.message }
  }
}

function commandLine(pid) {
  return new Promise(resolve => {
    execFile('/bin/ps', ['-ww', '-o', 'command=', '-p', String(pid)], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => resolve(err ? '' : stdout.trim()))
  })
}

// 只重启 .app：命令行拆分启动会丢环境变量和参数，宁可明确失败
async function restart(pid, info = {}) {
  const app = info.app || (await commandLine(pid).then(cmd => (/(\/.*?\.app)\//.exec(cmd) || [])[1]))
  if (!app || !fs.existsSync(app)) return { ok: false, pid: Number(pid), reason: 'not_an_app' }
  try {
    const child = spawn('/usr/bin/open', ['-n', app], { detached: true, stdio: 'ignore' })
    child.unref()
    return { ok: true, pid: Number(pid), launched: app }
  } catch (e) {
    return { ok: false, pid: Number(pid), reason: 'spawn_failed', error: e.message }
  }
}

// 从 .icns 中切出最大的 PNG 片段转 base64，供列表显示应用图标
function icnsToBase64(icnsPath) {
  const buf = fs.readFileSync(icnsPath)
  const head = Buffer.from([0x89, 0x50, 0x4e, 0x47])
  const tail = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])
  let best = null
  let i = buf.indexOf(head)
  while (i !== -1) {
    const end = buf.indexOf(tail, i)
    if (end === -1) break
    const chunk = buf.subarray(i, end + tail.length)
    if (!best || chunk.length > best.length) best = chunk
    i = buf.indexOf(head, end + tail.length)
  }
  return best ? 'data:image/png;base64,' + best.toString('base64') : null
}

function iconOf(bundlePath) {
  try {
    if (!bundlePath) return null
    const infoPlist = path.join(bundlePath, 'Contents', 'Info.plist')
    if (!fs.existsSync(infoPlist)) return null
    const raw = fs.readFileSync(infoPlist, 'utf8')
    const m = /CFBundleIconFile<\/key>\s*<string>([^<]+)<\/string>/.exec(raw)
    if (!m) return null
    let name = m[1].trim()
    if (!name.endsWith('.icns')) name += '.icns'
    const file = path.join(bundlePath, 'Contents', 'Resources', name)
    if (!fs.existsSync(file)) return null
    return icnsToBase64(file)
  } catch (e) {
    return null
  }
}

module.exports = { kill, forceKill, commandLine, restart, iconOf, isAlive, waitGone }
