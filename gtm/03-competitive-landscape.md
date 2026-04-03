# Competitive Landscape

## Direct Competitors (Agent Plugin/Skill Tooling)

### npx skills (Vercel Labs) — skills.sh
- **Stars**: 12.8K
- **What**: Package manager for agent skills. Install SKILL.md to 44 agents.
- **Strengths**: Vercel backing, massive adoption, simple UX
- **Weakness**: Skills only. No manifests, MCP config, hooks, brand metadata, or plugin packaging.
- **Relationship to us**: Complementary. Use skills to distribute skills, use pluxx to build the full plugin.

### SkillKit — skillkit.sh
- **Stars**: 708
- **What**: Skill manager + translator. Can convert SKILL.md to .mdc for Cursor.
- **Strengths**: Translation feature is unique. MCP server available.
- **Weakness**: Translation only for skills/rules. No full plugin generation.
- **Relationship to us**: Mild overlap on translation. We generate native formats from scratch, not translate.

### build-skill
- **What**: Scaffolding CLI for SKILL.md files
- **Strengths**: Simple, does one thing well
- **Weakness**: Just scaffolding. No build, no multi-platform.
- **Relationship to us**: We could absorb this into `pluxx init`.

### SkillHub Desktop
- **Stars**: 502
- **What**: Tauri desktop app for browsing/installing skills
- **Strengths**: Nice GUI, AI-enhanced skill editing
- **Weakness**: Consumer tool, not a build tool. No plugin generation.
- **Relationship to us**: Potential distribution channel.

### Agent Skills Spec (agentskills.io)
- **Stars**: 14.9K (spec repo)
- **What**: The open standard. SKILL.md format specification.
- **Strengths**: Industry standard, Anthropic-backed, 30+ adopters
- **Weakness**: Spec only. Reference Python validator is "not for production."
- **Relationship to us**: Foundation we build on. We're spec-compliant.

## Adjacent Competitors (SDK Generation)

### Speakeasy
- **What**: Generate SDKs + MCP servers from OpenAPI specs
- **Pricing**: $250/mo per SDK
- **Overlap**: They generate MCP servers. We generate the plugin wrapper around MCP servers.
- **Key difference**: They start from OpenAPI. We start from a plugin config.

### Stainless
- **What**: Generate SDKs from API specs (OpenAI, Anthropic use them)
- **Pricing**: $250-800/mo per SDK
- **Overlap**: Same as Speakeasy — MCP server generation.
- **Key difference**: Same as above. Different starting point, different output.

### Composio
- **What**: Managed auth for 800+ tool integrations
- **Pricing**: Raised $29M Series A
- **Overlap**: They solve auth for MCP/tools. We generate auth configs.
- **Key difference**: They're a runtime service. We're a build tool.

## Gap Analysis

| Capability | pluxx | npx skills | SkillKit | Speakeasy |
|-----------|:---:|:---:|:---:|:---:|
| SKILL.md scaffolding | Yes | Yes | Yes | - |
| Skill installation | - | Yes | Yes | - |
| Plugin manifest generation | **Yes** | - | - | - |
| MCP auth translation | **Yes** | - | - | - |
| Hook generation | **Yes** | - | - | - |
| Brand/interface metadata | **Yes** | - | - | - |
| Rules/instructions generation | **Yes** | - | Partial | - |
| OpenCode JS wrapper | **Yes** | - | - | - |
| MCP server generation | - | - | - | Yes |
| SDK generation | - | - | - | Yes |

**We own the "full plugin generation" column. Nobody else does this.**
