---
name: vibe-tdd-workflow
description: >-
  Use this skill to implement features using the Vibe Coding TDD methodology. 
  Trigger this when the user asks to implement a feature with TDD, or when starting a new implementation cycle.
---

# Vibe Coding TDD Workflow

This skill ensures that the agent rigorously adheres to the Standard Operating Procedure (SOP) for TDD and Vibe Coding.

## Instructions

1. **Read the SOP Document:**
   Before beginning any implementation or TDD cycle, you MUST read the exact procedure defined in the SOP document using the `view_file` tool:
   `document/sop/vibe_tdd_sop.md`

2. **Execute the SOP:**
   Follow the steps strictly as defined in the SOP:
   - Step 1: Write the Test (Red)
   - Step 2: Implement (Green)
   - Step 3: Tiered Subagent Review (R0 skip / R1 `deep_code_reviewer` / R2 + `security_code_reviewer` — see the SOP table)
   - Step 4: Remediation Loop
   - Step 5: Regression Check
   - Step 6: Completion Report — subagents do NOT edit `document/todo.md`; the main agent marks it `[x]` on main right after merging (DL-0028)
   - Step 7: Decision Logging (DL/ADR + `document/index.md` sync)

3. **Strict Compliance:**
   - Use the SOP commands: `./node_modules/.bin/vitest run <file>` for a single file, `npm test` (suite + coverage baseline) for regression.
   - Treat security reviewer findings as new requirements (write tests for them first, do not just patch).
   - Never skip the final regression check suite.
