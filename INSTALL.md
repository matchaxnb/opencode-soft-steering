# OpenCode Steering Checkpoint Plugin

Allows mid-generation steering of OpenCode sessions by intercepting prompt submissions during active turns and exposing them to the LLM via a checkpoint tool.

## Global Installation

### Option A: Symlink (recommended — auto-updates on git pull)

```bash
# Clone the repo
git clone https://github.com/matchaxnb/opencode-soft-steering.git
cd steering-vllm-implem

# Ensure the @opencode-ai/plugin dependency is available globally
cd ~/.config/opencode && bun add @opencode-ai/plugin@1.15.11

# Symlink the plugin into global plugins directory
mkdir -p ~/.config/opencode/plugins
ln -s "$(pwd)/.opencode/plugins/steering-checkpoint.js" ~/.config/opencode/plugins/
```

### Option B: Copy (standalone, no dependency on repo after install)

```bash
# Clone the repo
git clone https://github.com/matchaxnb/opencode-soft-steering.git
cd steering-vllm-implem

# Copy the plugin and install dependency
mkdir -p ~/.config/opencode/plugins
cp .opencode/plugins/steering-checkpoint.js ~/.config/opencode/plugins/
cd ~/.config/opencode && bun add @opencode-ai/plugin@1.15.11
```

## How It Works

The plugin:
- **Injects a checkpoint protocol** into the system prompt, instructing the LLM to call the `opencode_checkpoint` tool after every paragraph
- **Intercepts prompt submissions** during active generation (`tui.prompt.submit` hook) and writes them to a temp file
- **Exposes `opencode_checkpoint` tool** that reads the temp file, delivering any pending steering message back to the LLM

This enables "steering" — you can type feedback while the model is mid-response, and it picks it up at the next checkpoint call.
