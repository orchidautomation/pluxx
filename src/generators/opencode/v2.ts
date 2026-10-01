// The shared V1 handlers retain matcher order, runtime environment and readiness.
// This bridge registers them through V2 domains; it never exports another plugin.
export function buildOpenCodeV2Definition(id: string, server: string): string {
  return `
export default {
  id: ${JSON.stringify(id)},
  async setup(ctx) {
      const directory = ctx.location.directory
      const hooks = await ${server}({
        directory,
        client: { app: { log: async ({ body }: { body: { level: string; message: string } }) => {
          if (body.level === "error") console.error(body.message)
          else if (body.level === "warn") console.warn(body.message)
        } } },
        $: (_strings: TemplateStringsArray, command: string) => new Promise((resolve, reject) => {
          execFile("bash", ["-lc", command], { cwd: directory, maxBuffer: 1024 * 1024 }, error => error ? reject(error) : resolve(undefined))
        }),
      } as unknown as Parameters<Plugin>[0])
      const config: Config = {}
      await hooks.config?.(config)
      if (Object.values(EVENT_HOOKS).some(entries => entries.some(hook => hook.failClosed))) {
        throw new Error(${JSON.stringify(id + ': OpenCode 2 event subscriptions cannot enforce failClosed event hooks. Use OpenCode 1.18.29+ or remove failClosed from event hooks.')})
      }
      // V2 retains environment and replaces enabled with disabled.
      const servers = Object.entries(config.mcp ?? {}).map(([name, definition]) => {
        if (!("type" in definition)) throw new Error("Unsupported MCP definition: " + name)
        const { enabled, timeout, ...rest } = definition
        return [name, { ...rest, disabled: enabled === false, ...(timeout === undefined ? {} : { timeout: { startup: timeout, catalog: timeout, execution: timeout } }) }] as const
      })
      const commandPrompts: Array<{ sessionID: string; text: string; original: string }> = []
      const registrations: Array<{ dispose(): Promise<void> }> = []
      const controller = new AbortController()
      let events: Promise<void> | undefined
      try {
        if (servers.length) registrations.push(await ctx.mcp.transform(editor => {
          for (const [name, definition] of servers) editor.set(name, definition)
        }))
        if (Object.keys(TUI_COMMANDS).length) registrations.push(await ctx.command.transform(editor => {
          for (const [name, definition] of Object.entries(TUI_COMMANDS)) editor.add({
            name,
            description: definition.description,
            async execute({ sessionID, prompt, delivery }) {
              const args = prompt.text.trim().split(/\\s+/)
              const text = definition.template.replace(/\\$ARGUMENTS/g, prompt.text)
                .replace(/\\$(\\d+)/g, (_match, index) => args[Number(index) - 1] ?? "")
              const admission = { sessionID, text, original: "/" + name + " " + prompt.text }
              commandPrompts.push(admission)
              try {
                await ctx.session.prompt({ ...prompt, sessionID, text, delivery,
                  ...(definition.agent ? { agent: definition.agent } : {}) })
              } finally {
                const index = commandPrompts.indexOf(admission)
                if (index !== -1) commandPrompts.splice(index, 1)
              }
            },
          })
        }))
        const canonicalTool = (tool: string): string => {
          const namespace = (name: string) => name.replace(/[^a-zA-Z0-9_]/g, "_")
          const server = Object.keys(MCP_DEFINITIONS).sort((a, b) => b.length - a.length).find(name => tool.startsWith(namespace(name) + "_"))
          return server ? "mcp." + server + "." + tool.slice(namespace(server).length + 1) : tool
        }
        registrations.push(await ctx.tool.hook("execute.before", async event => {
          await hooks["tool.execute.before"]?.({ ...event, tool: canonicalTool(event.tool), callID: event.id }, { args: event.input as Record<string, unknown> })
        }))
        registrations.push(await ctx.tool.hook("execute.after", async event => {
          await hooks["tool.execute.after"]?.(
            { ...event, tool: canonicalTool(event.tool), callID: event.id, args: event.input }, { title: "", output: "", metadata: {} })
        }))
        registrations.push(await ctx.shell.hook("create.before", async event => {
          const env = Object.fromEntries(Object.entries(event.env).filter((entry): entry is [string, string] => entry[1] !== undefined))
          await hooks["shell.env"]?.({ cwd: directory }, { env })
          Object.assign(event.env, env)
        }))
        registrations.push(await ctx.session.hook("prompt", async event => {
          const index = commandPrompts.findIndex(item => item.sessionID === event.sessionID && item.text === event.prompt.text)
          const admission = index === -1 ? undefined : commandPrompts.splice(index, 1)[0]
          await hooks["chat.message"]?.({ sessionID: event.sessionID, prompt: admission?.original ?? event.prompt.text } as never, {} as never)
        }))
        const instructions = (event: { system: Array<{ type: string; text?: string }> }) => {
          if (INSTRUCTIONS && !event.system.some(part => part.type === "text" && part.text === INSTRUCTIONS)) {
            event.system.unshift({ type: "text", text: INSTRUCTIONS })
          }
        }
        for (const kind of ["context", "compaction", "generate", "title"] as const) {
          registrations.push(await ctx.session.hook(kind, instructions))
        }
        if (Object.keys(AGENT_DEFINITIONS).length) {
          console.warn(${JSON.stringify(id + ': OpenCode 2 cannot add agents through the agent editor; bundled agents are retained, but native agent registration is unsupported.')})
        }
        if (Object.keys(PERMISSIONS).length) {
          throw new Error(${JSON.stringify(id + ': OpenCode 2 has no global permission config transform. Configure host/agent permissions before loading this bundle, or use V1.')})
        }
        if (READINESS_SCRIPT || Object.keys(EVENT_HOOKS).length || REQUIRED_ENV_VARS.length) {
          events = (async () => {
            try {
              for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
                await hooks.event?.({ event } as never)
              }
            } catch (error) {
              if (!controller.signal.aborted) console.error(${JSON.stringify(id + ': OpenCode event/readiness subscription failed')}, error)
            }
          })()
        }
      } catch (error) {
        controller.abort()
        for (const registration of registrations.reverse()) await registration.dispose()
        throw error
      }
      return async () => {
        controller.abort()
        await events
        for (const registration of registrations.reverse()) await registration.dispose()
      }
    },
  server: ${server},
} satisfies OpenCodePlugin.Plugin & { server: Plugin }
`
}
