---
name: code-review
description: Review code changes against repo standards and the originating spec.
---

# Code Review

Review the provided code diff along two axes:

1. **Standards**: Does it follow this repo's patterns? TypeScript strictness, test seams, no direct Jira API calls, write-back through jira-cli, existing shadcn/Tailwind components.
2. **Spec**: Does the code match what the issue or spec asked for? Are edge cases handled? Are tests behavioral and at the right seam?

Be specific. Quote lines. Cite the relevant ADR or CONTEXT.md term when rejecting something. Suggest concrete fixes, not vague improvements.
