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
   `document/vibe_tdd_sop.md`

2. **Execute the SOP:**
   Follow the 5 steps strictly as defined in the SOP:
   - Step 1: Write the Test (Red)
   - Step 2: Implement (Green)
   - Step 3: Subagent Review
   - Step 4: Remediation Loop
   - Step 5: Regression Check

3. **Strict Compliance:**
   - Do not deviate from the commands specified in the SOP (e.g., using `npx vitest run`).
   - Treat security reviewer findings as new requirements (write tests for them first, do not just patch).
   - Never skip the final regression check suite.
