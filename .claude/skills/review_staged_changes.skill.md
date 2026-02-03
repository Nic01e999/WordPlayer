# Skill: Review Staged Changes as Context

## Purpose
This skill is used to inspect, understand, and reason about the currently staged changes in the workspace.
All subsequent discussion, analysis, or code generation should be based on these staged modifications.

## Instructions
When this skill is active, you should:

1. Check the current workspace for staged changes using git.
   - Prefer inspecting:
     - `git diff --staged`
     - file lists and diff hunks
2. Identify:
   - Which files were modified, added, or deleted
   - The intent of each change (bug fix, refactor, feature, config change, etc.)
3. Treat the staged changes as the **authoritative baseline** for the current task.
   - Do NOT assume the codebase state beyond what can be inferred from these changes.
4. Base all further reasoning, suggestions, or edits on:
   - The staged diff
   - The implied design decisions in those changes
5. If something is unclear or risky:
   - Ask for clarification **before** proposing structural changes
6. Do not reformat or rewrite unrelated code unless explicitly requested.

## Output Expectations
- Summarize the staged changes concisely when first activated.
- Reference specific files and diff sections when reasoning.
- Assume the user intends to continue working from this exact staged state.

## Constraints
- Do not rely on unstaged or untracked files unless explicitly instructed.
- Avoid speculative refactors not justified by the staged changes.
