import { describe, expect, test } from "bun:test"
import { buildSkillCommands, buildTriggerCommands } from "./registrar"
import type { LoadedSkill } from "../opencode-skill-loader/types"

function createLoadedSkill(overrides: Partial<LoadedSkill>): LoadedSkill {
  return {
    name: "test-skill",
    definition: {
      name: "test-skill",
      description: "A test skill",
      template: "test",
    },
    scope: "builtin",
    ...overrides,
  }
}

describe("skill-command-registrar", () => {
  describe("buildSkillCommands", () => {
    test("creates command from skill name", () => {
      const skills = [createLoadedSkill({ name: "frontend" })]
      const commands = buildSkillCommands(skills)
      expect(commands).toHaveLength(1)
      expect(commands[0].command).toBe("frontend")
      expect(commands[0].name).toBe("frontend")
    })

    test("normalizes skill name to command", () => {
      const skills = [createLoadedSkill({ name: "My Skill Name" })]
      const commands = buildSkillCommands(skills)
      expect(commands[0].command).toBe("my-skill-name")
    })

    test("includes triggers from skill", () => {
      const skills = [
        createLoadedSkill({
          name: "debugging",
          triggers: ["debug this", "why is X broken"],
        }),
      ]
      const commands = buildSkillCommands(skills)
      expect(commands[0].triggers).toEqual(["debug this", "why is X broken"])
    })

    test("handles undefined triggers", () => {
      const skills = [createLoadedSkill({ name: "test" })]
      const commands = buildSkillCommands(skills)
      expect(commands[0].triggers).toEqual([])
    })

    test("passes through skillPath from resolvedPath", () => {
      const skills = [
        createLoadedSkill({ name: "test", resolvedPath: "/some/path" }),
      ]
      const commands = buildSkillCommands(skills)
      expect(commands[0].skillPath).toBe("/some/path")
    })
  })

  describe("buildTriggerCommands", () => {
    test("generates command entries from triggers", () => {
      const baseCommands = [
        {
          name: "debugging",
          description: "Debug stuff",
          triggers: ["debug this", "fix the bug"],
          command: "debugging",
          skillPath: undefined,
        },
      ]
      const triggerCommands = buildTriggerCommands(baseCommands)
      expect(triggerCommands).toHaveLength(2)
      expect(triggerCommands[0].command).toBe("debug-this")
      expect(triggerCommands[0].name).toBe("debugging/debug this")
      expect(triggerCommands[1].command).toBe("fix-the-bug")
    })

    test("skips triggers that would duplicate the skill command", () => {
      const baseCommands = [
        {
          name: "test",
          description: "Test",
          triggers: ["test"],
          command: "test",
          skillPath: undefined,
        },
      ]
      const triggerCommands = buildTriggerCommands(baseCommands)
      expect(triggerCommands).toHaveLength(0)
    })

    test("handles empty triggers", () => {
      const baseCommands = [
        {
          name: "test",
          description: "Test",
          triggers: [],
          command: "test",
          skillPath: undefined,
        },
      ]
      const triggerCommands = buildTriggerCommands(baseCommands)
      expect(triggerCommands).toHaveLength(0)
    })
  })
})
