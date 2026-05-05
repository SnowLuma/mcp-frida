# frida-mcp

极简的 Frida MCP 服务器。**只暴露 5 个工具**，把 Hook / 内存 / 调用栈等全部能力交给 LLM 用一次性的 Frida JS 脚本自主表达，避免工具爆炸。

## 设计理念

- **Attach → LoadScript → Call/Listen → Unload** 的最短工作流
- 进程崩溃或 detach 时，工具会返回明确错误并指示 LLM **重新调用 `attach`**
- 所有真正"干活"的逻辑写在 Frida JS 里（由 LLM 在 `load_script` 时生成），不是固化的工具
- 持久脚本可暴露 `rpc.exports` 与 `send(...)` 两条通道，对应 `call_rpc` 与 `get_script_output`

## 工具一览

| 工具 | 用途 |
|------|------|
| `attach` | Attach Frida 到进程（PID 或进程名）。进程 detach/crash 后必须重新调用 |
| `load_script` | 加载一段持久 Frida JS。可定义 `rpc.exports = {...}`，可用 `send(data)` 产出日志 |
| `call_rpc` | 调用 `load_script` 注册的 RPC 方法，同步返回结果 |
| `get_script_output` | 拉取并清空脚本的 `send(...)` 消息队列，类似 tail log |
| `unload_script` | 卸载并清理持久脚本 |

## 安装

**从源码：**

```bash
npm install
npm run build
```

**或从 Release 下载：** 在 [GitHub Releases](../../releases) 中选择与平台对应的压缩包（`win-x64` / `linux-x64` / `macos-arm64`），解压后即可使用，无需 `npm install`：

```bash
# 解压后会得到 frida-mcp/ 目录
node frida-mcp/dist/index.js
```

## 使用

### 直接启动（可选预附加 PID）

```bash
# 不带参数启动，由 LLM 通过 attach 工具连接
node dist/index.js

# 或启动时直接 attach 到 PID
node dist/index.js 12345
```

### MCP 客户端配置

```json
{
  "mcpServers": {
    "frida": {
      "command": "node",
      "args": ["e:/mcp-ida-frida/dist/index.js"]
    }
  }
}
```

## 典型工作流

1. `attach({ target: "notepad.exe" })` —— 附加目标进程
2. `load_script({ name: "probe", source: "..." })` —— 注入带 `rpc.exports` 的脚本
3. `call_rpc({ script: "probe", method: "readString", args: ["0x7ff..."] })` —— 同步调用
4. `get_script_output({ name: "probe" })` —— 拉取 `send(...)` 累积日志
5. `unload_script({ name: "probe" })` —— 清理

### 脚本示例

```js
// 在 load_script 的 source 中
const user32 = Process.getModuleByName("user32.dll");
Interceptor.attach(user32.getExportByName("MessageBoxW"), {
  onEnter(args) {
    send({ caption: args[2].readUtf16String(), text: args[1].readUtf16String() });
  },
});

rpc.exports = {
  readPtr: (addr) => ptr(addr).readPointer().toString(),
};
```

## 崩溃 / 断开处理

- 进程崩溃或 detach 后，`load_script` / `call_rpc` / `get_script_output` 会返回包含明确指令的错误：
  > `Process <name> is not attached (reason: ...). Please call the \`attach\` tool again to reconnect before retrying.`
- LLM 收到该错误后应调用 `attach` 重新附加，并重新 `load_script` 后继续操作
- `unload_script` 是本地清理，不依赖进程存活

## 发布

推送 `v*` 形式的 Git tag 即可由 GitHub Actions 自动构建并发布 Release（含开箱即用的 `dist/` + `node_modules`）：

```bash
npm version patch   # 或 minor / major
git push --follow-tags
```

工作流定义见 `.github/workflows/release.yml`。
