# ZTools 关闭进程

从 uTools 插件「关闭进程」的能力清单独立实现，面向 macOS。

## 功能

- 列出进程及其 CPU、内存、监听端口，按内存 / CPU / 名称 / 端口排序
- 搜索进程名、路径、PID 或端口号
- 关闭（先 SIGTERM，3 秒未退提示可强制 SIGKILL）、强制结束、重启 .app、复制路径、文件夹中显示、查看完整启动命令
- 主搜索框直接推结果：输入 `kill chrome` 或 `netstat 8080` 即列出，回车关闭

## 安装

ZTools 开发者工具添加 `src-ztools/plugin.json`；或安装 `releases/process-killer-0.1.0.zip`。

## 开发

Node.js >= 20（本机用 nvm 的 v20.19.5）。

```sh
npm run build     # src-ztools -> dist
npm run package   # 另外输出 releases/*.zip
npm test          # 15 个单元测试
node test/ui-smoke.cjs   # Chrome 里跑一遍界面（需已 build）
```

## 注意

- CPU 取自 `ps` 的累计百分比，不是瞬时值，与活动监视器口径不同。
- `lsof` 看不到无权限用户进程的端口，界面会提示。
- 只能重启 `.app`；命令行程序直接启动会丢环境变量，故明确报错。
- 关闭系统进程需要更高权限，插件不做提权。
