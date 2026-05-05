import frida, { type Device, type Session, type Script, type Crash, type SessionDetachReason } from "frida";

export interface ScriptResult {
  messages: unknown[];
  error?: string;
}

export class SessionManager {
  private device: Device | null = null;
  private session: Session | null = null;
  private target: number | string = 0;
  private processName: string = "";
  private detachReason: string | null = null;
  private crashInfo: { summary: string; report: string } | null = null;
  private persistentScripts = new Map<string, { script: Script; output: unknown[] }>();

  async init(target: number | string): Promise<void> {
    if (this.session) {
      await this.dispose();
    }
    this.target = target;
    this.device = await frida.getLocalDevice();
    
    if (typeof target === "number") {
      try {
        const proc = await this.device.getProcess(target.toString());
        this.processName = proc.name;
      } catch {
        this.processName = `pid:${target}`;
      }
    } else {
      this.processName = target;
    }
    
    this.session = await this.device.attach(target);
    this.session.detached.connect((reason: SessionDetachReason, crash: Crash | null) => {
      this.detachReason = reason;
      if (crash) this.crashInfo = { summary: crash.summary, report: crash.report };
    });
  }

  get isAttached(): boolean {
    return this.session !== null && !this.session.isDetached();
  }

  get status() {
    return {
      target: this.target,
      processName: this.processName,
      attached: this.isAttached,
      detachReason: this.detachReason,
      crash: this.crashInfo,
      persistentScripts: Array.from(this.persistentScripts.keys()),
    };
  }

  private ensureAttached() {
    if (!this.isAttached) {
      const info = this.crashInfo ? ` (crash: ${this.crashInfo.summary})` : "";
      const reason = this.detachReason ?? (this.session ? "unknown" : "not attached");
      throw new Error(
        `Process ${this.processName || this.target} is not attached (reason: ${reason}${info}). ` +
        `Please call the \`attach\` tool again to reconnect before retrying.`,
      );
    }
  }

  async runScript(source: string, timeoutMs: number = 5000, returnOnFirstMessage: boolean = false): Promise<ScriptResult> {
    this.ensureAttached();
    const messages: unknown[] = [];
    let scriptError: string | undefined;
    const script = await this.session!.createScript(source);

    const done = new Promise<void>((resolve) => {
      const timer = setTimeout(() => resolve(), timeoutMs);
      script.destroyed.connect(() => { clearTimeout(timer); resolve(); });
      script.message.connect((message, _data) => {
        if (message.type === "send") {
          messages.push(message.payload);
          if (returnOnFirstMessage) {
            clearTimeout(timer);
            resolve();
          }
        } else if (message.type === "error") {
          scriptError = (message as any).description ?? String(message);
          clearTimeout(timer);
          resolve(); // Always avoid blocking on error
        }
      });
    });

    await script.load();
    await done;
    try { await script.unload(); } catch { }
    return { messages, error: scriptError };
  }

  async loadPersistentScript(name: string, source: string): Promise<void> {
    this.ensureAttached();
    // Drop stale script handles if they survived a previous detach.
    for (const [key, info] of this.persistentScripts) {
      if (info.script.isDestroyed) this.persistentScripts.delete(key);
    }
    const old = this.persistentScripts.get(name);
    if (old && !old.script.isDestroyed) {
      try { await old.script.unload(); } catch {}
    }

    const script = await this.session!.createScript(source);
    const info = { script, output: [] as unknown[] };
    
    script.message.connect((message, _data) => {
      if (message.type === "send") {
        info.output.push(message.payload);
      } else if (message.type === "error") {
        info.output.push({ _error: (message as any).description ?? String(message) });
      }
    });

    script.destroyed.connect(() => this.persistentScripts.delete(name));
    await script.load();
    this.persistentScripts.set(name, info);
    // Give it a brief moment in case the script sends immediate setup info
    await new Promise(r => setTimeout(r, 100));
  }

  getScriptOutput(name: string): unknown[] {
    const info = this.persistentScripts.get(name);
    if (!info) {
      if (!this.isAttached) {
        this.ensureAttached(); // throws a clear reconnect message
      }
      throw new Error(`Script '${name}' not found or already destroyed.`);
    }
    const out = [...info.output];
    info.output.length = 0; // Clear the queue after reading
    return out;
  }

  async unloadPersistentScript(name: string): Promise<void> {
    const info = this.persistentScripts.get(name);
    if (!info) return;
    try { await info.script.unload(); } catch {}
    this.persistentScripts.delete(name);
  }

  async rpcCall(scriptName: string, method: string, args: unknown[] = []): Promise<unknown> {
    this.ensureAttached();
    const info = this.persistentScripts.get(scriptName);
    if (!info || info.script.isDestroyed) {
      throw new Error(
        `Persistent script '${scriptName}' not found. It may have been unloaded or destroyed when the process detached. ` +
        `Please \`load_script\` it again.`,
      );
    }
    return await (info.script.exports as any)[method](...args);
  }

  async dispose(): Promise<void> {
    for (const [, info] of this.persistentScripts) {
      try { await info.script.unload(); } catch {}
    }
    this.persistentScripts.clear();
    if (this.session && !this.session.isDetached()) {
      await this.session.detach();
    }
    this.session = null;
    this.device = null;
  }
}
