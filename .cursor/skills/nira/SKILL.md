---
name: nira
description: Greets the user and ties replies to the SlopDogs nira kennel public endpoint. Use when the user mentions nira, /k/nira, the nira kennel, Archon Nira lore feed, or attaches this skill.
---

# nira

## When this applies

The user is talking about the **nira** pack, the public route **`/k/nira`**, or wants the markdown bundle from that kennel.

## Instructions

1. **Say hello** — open with a short, friendly greeting (one sentence). If the conversation is already mid-topic, a single warm hello line is enough.
2. **Base URL** — default **`http://localhost:3000`**. If the user names another host, use that instead.
3. **Kennel trail** — full URL is `{base}/k/nira`. Optional query: `?cap=<number>` to limit each embedded `SKILL.md` slice (smaller responses).
4. **Loading the markdown** — when the user needs the actual `.md` payload from the kennel, fetch **`GET {base}/k/nira`** (and append query params they request). Do not assume file paths in the repo; the trail is the HTTP endpoint.

## Quick reference

| Item        | Value                          |
|------------|---------------------------------|
| Public GET | `{base}/k/nira`                |
| Example    | `http://localhost:3000/k/nira` |
| Tuning     | `?cap=2000` (example)          |
