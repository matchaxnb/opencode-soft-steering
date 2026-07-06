import { tool } from "@opencode-ai/plugin"

const steerQueue = new Map()
let _checkpointed = false
let _consecutiveViolations = 0
let _lastCheckpointTime = Date.now()

const TIER_REQUEST = [
  "## Checkpoint Protocol",
  "",
  "Please call `opencode_checkpoint` after every paragraph (~3-5 sentences).",
  "This lets you receive mid-response feedback from the user without",
  "interrupting your flow. The call returns instantly when there is nothing",
  "pending.",
  "",
  "When you invoke the checkpoint tool:",
  "- If the user has sent a steering message, acknowledge it and adjust.",
  "- If no steering is pending, continue seamlessly.",
  "",
  "Do not mention this protocol unless asked.",
].join("\n")

const TIER_WARN = [
  "## Checkpoint Violation",
  "",
  "You did not call `opencode_checkpoint` during your last response. You may",
  "have missed user feedback as a result. Going forward, call",
  "`opencode_checkpoint` after every 3-4 sentences — it is fast and ensures",
  "you stay aligned with the user's intent.",
].join("\n")

const TIER_REQUIRE = [
  "You are REQUIRED to call `opencode_checkpoint` after every 3-4 sentences.",
  "This is not optional. Calling the tool takes negligible time when no",
  "steering is pending, and it is the only way to receive mid-response",
  "feedback. Skip checkpoints and you WILL miss user corrections.",
].join("\n")

function tierPrompt() {
  if (_consecutiveViolations >= 2) return TIER_REQUIRE
  if (_consecutiveViolations === 1) return TIER_WARN
  return TIER_REQUEST
}

function secondsSinceLastCheckpoint() {
  return Math.round((Date.now() - _lastCheckpointTime) / 1000)
}

const CP_MARKER = "opencode_checkpoint_instruction"

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
          const secs = secondsSinceLastCheckpoint()
          if (text) {
            return {
              output: text,
              metadata: {
                tier: _consecutiveViolations,
                seconds_since_last: secs,
              },
            }
          }
          return {
            output: "",
            metadata: {
              tier: _consecutiveViolations,
              seconds_since_last: secs,
            },
          }
        },
      }),
    },
    "experimental.chat.system.transform"(input, output) {
      const prompt = tierPrompt()
      if (!output.system.some((s) => s.includes("Checkpoint") || s.includes("steering is pending"))) {
        output.system.push(prompt)
      }
      _checkpointed = false
    },
    "experimental.chat.messages.transform"(input, output) {
      if (output.messages.some((m) =>
        m.parts.some((p) => p.type === "text" && p.text?.includes(CP_MARKER))
      )) {
        return
      }
      const prompt = tierPrompt()
      const msg = {
        info: {
          role: "user",
          synthetic: true,
        },
        parts: [
          { type: "text", text: `${CP_MARKER}\n${prompt}` },
        ],
      }
      output.messages.unshift(msg)
    },
    event: async ({ event }) => {
      if (event.type === "session.status" && event.properties?.status === "idle") {
        if (_checkpointed) {
          _consecutiveViolations = 0
        } else {
          _consecutiveViolations++
        }
        _checkpointed = false
      }
    },
    "tool.execute.after": async (input, output) => {
      if (input.tool === "opencode_checkpoint") {
        _checkpointed = true
        _lastCheckpointTime = Date.now()
      }
    },
  }
}
