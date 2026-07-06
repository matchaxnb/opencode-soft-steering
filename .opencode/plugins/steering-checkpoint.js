import { tool } from "@opencode-ai/plugin"

const steerQueue = new Map()
let _checkpointed = false
let _warnNext = false

const CHECKPOINT_PROMPT = [
  "## Checkpoint Protocol",
  "",
  "You are REQUIRED to call the `opencode_checkpoint` tool after every 3-4",
  "sentences you generate. This is not optional — it is a hard rule. Think of",
  "it as breathing between sentences: you must pause regularly.",
  "",
  "Each time you finish a paragraph or a block of ~3 sentences, immediately",
  "call `opencode_checkpoint` before writing the next one. Calling the tool",
  "is inexpensive and returns instantly when no steering is pending — you lose",
  "nothing by calling it, and you risk missing critical user feedback by",
  "skipping it.",
  "",
  "When you invoke the checkpoint tool:",
  "- If the user has sent a steering message while you were thinking,",
  "  the tool will return it as output. Acknowledge the steer and adjust.",
  "- If no steering is pending, the tool returns an empty result and you",
  "  continue seamlessly.",
  "",
  "When you see a steering message:",
  "1. Acknowledge that the user has steered the conversation.",
  "2. Re-evaluate your approach in light of the new input.",
  "3. Continue from where you left off where appropriate.",
  "",
  "Do not mention this checkpoint protocol unless asked. If you ever wonder",
  "whether to call the tool, the answer is always YES — call it.",
].join("\n")

const WARNING = [
  "## Checkpoint Violation",
  "",
  "The previous turn contained a long text response with ZERO calls to the",
  "`opencode_checkpoint` tool. This is a protocol violation. You MUST call",
  "`opencode_checkpoint` after every 3-4 sentences going forward. The user's",
  "steering messages depend on this — skip checkpoints, and you'll miss them.",
].join("\n")

export const SteeringCheckpoint = async (ctx) => {
  return {
    "tui.prompt.submit": async (input, output) => {
      if (!input.active) return
      steerQueue.set(input.sessionID, input.text)
      output.consumed = true
    },
    tool: {
      opencode_checkpoint: tool({
        description:
          "MANDATORY checkpoint tool. You MUST call this after every 3-4 " +
          "sentences you output. Call it even when you think no steering is " +
          "pending — it is instantaneous when there is nothing to report.",
        args: {
          current_directory: tool.schema.string().describe(
            "Your current working directory"
          ),
        },
        async execute(args, context) {
          const text = steerQueue.get(context.sessionID)
          steerQueue.delete(context.sessionID)
          return text ?? ""
        },
      }),
    },
    "experimental.chat.system.transform"(input, output) {
      if (_warnNext) {
        output.system.push(WARNING)
        _warnNext = false
      }
      if (!output.system.some((s) => s.includes("Checkpoint Protocol"))) {
        output.system.push(CHECKPOINT_PROMPT)
      }
      _checkpointed = false
    },
    event: async ({ event }) => {
      if (event.type === "session.status" && event.properties?.status === "idle") {
        if (!_checkpointed) {
          _warnNext = true
        }
        _checkpointed = false
      }
    },
    "tool.execute.after": async (input, output) => {
      if (input.tool === "opencode_checkpoint") {
        _checkpointed = true
      }
    },
  }
}
