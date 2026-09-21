# `design.md` Template — 5 Sections

Write exactly these 5 sections, in this exact order. Do not add sections, do not rename sections.

Write each section **short and specific**. A second reader must understand what the app does without needing to ask anything further.

---

## The Template

```markdown
# design.md — <app name>

> One sentence: this app helps <who> do <what> that is currently <where the difficulty is>.

## 1. Users & Problem

| Role | Name/department | What question do they open the app to ask |
|---|---|---|
| <role 1> | <who> | <question in their mind> |
| <role 2> | <who> | <question in their mind> |

**Where the work currently lives:** <tool currently used>
**Biggest pain point:** <verbatim, in the user's own words>

## 2. Business Logic & Stages

*(Choose ONE of the two formats below — don't use both)*

**Format A — app WITH stages** *(a task/order/request goes through steps, may wait for approval)*

Lifecycle of a <thing>:
<stage 1> → <stage 2> → <stage 3> → <stage 4>

Branches: *(abandoned, cancelled, returned, not approved — state clearly whether a person clicks it or the app marks it automatically)*
- <stage X> → **<branch name>** when <condition>; <who clicks / app auto>

**Format B — app WITHOUT stages** *(a class taught, an expense paid, a workout done — logged and done, doesn't go anywhere)*

A <thing> is logged as one of these types:
- **<type 1>** — <when>
- **<type 2>** — <when>

Change type: <yes/no — if yes, which type to which type, who clicks>

**Numbers the app must calculate** *(do not store — see rule in section 4)*
- **<number name>** = <how it's calculated>

**Rules:**
- <rule 1 — e.g.: only the team lead can move to Done · only deduct from the package for those paying by package>
- <rule 2 — e.g.: if untouched for more than 7 days, show red>

## 3. Screens

| Screen | Who sees it | What they see when it opens | What they can do here |
|---|---|---|---|
| **1 · <name>** | <who> | <content> | <action> |
| **2 · <name>** | <who> | <content> | <action> |
| **3 · <name>** | <who> | <content> | <action> |

## 4. Data to Store

Things that must **remain** after the browser is closed:

| Record of | Each record contains | How they connect | Where I inferred — needs your confirmation |
|---|---|---|---|
| **<thing 1>** `<table_name>` | <item 1> · <item 2> · <item 3> | <one thing 1 has many thing 2> | <leave blank if they said everything> |

*The faint `<table_name>` text is the technical name — Claude assigns it so the app can be built in a later session. You don't need to change it.*

## 5. Done Criteria

Each line must be **an action + a visible result**:

- <do what> → <see what>
- <do what> → <see what>
- <do what> → <see what>

## Considered and Deferred

| Feature | Why deferred |
|---|---|
| <name> | <short reason> |
```

---

## Rules for Each Section

### Section 1 · Users & Problem
An app for a **team** should have ≥2 roles, and those two roles must ask **two different questions** — that is exactly why multiple screens are needed. If every role asks the same question, the app only needs one screen.

⚠️ An app for **one person** only needs **one role — don't invent a second role** just to "fill the template."

Is there anyone who will **not open the app themselves** (customers, patients, people outside the team)? → they are **data**, not a user. Record it as a separate **Risk** line, don't list them as a role.

### Section 2 · Business Logic
**Choose format A or B based on the app, don't force it.** Sign that Format B applies: the `<thing>` is logged and done, no one is waiting on anyone, there's no step "pending." Example: a class already taught · an expense already paid · a workout that already happened.

Format A: the lifecycle is **a straight line with arrows**; branches are stated explicitly.
Format B: **don't draw arrows** — the types are parallel choices, not sequential steps. Drawing an arrow here invents a state machine nobody needs.

⚠️ A **single-user** app is usually Format B, with **no approval rule at all** — don't add one just to fill the template.

A rule must be a sentence **a machine can act on**: *"overdue tasks rise to the top"* is fine; *"the team works more efficiently"* is not — that's a wish, not a rule.

### Section 3 · Screens
**2–3 screens, maximum 5.** Why: every screen is one more thing to describe, build, and fix. More than 5 screens and the next session won't finish building — and it's usually because 2 screens are actually one.

🔑 **Count screens by the number of different QUESTIONS, NOT by the number of roles.** One person can still ask three different questions at three different moments *(each time they work · end of month · when someone asks)* → three screens is correct.

🔑 **Every screen must answer the question of at least ONE role from section 1.** A screen that doesn't match any role → drop it.

If the *"What they can do here"* column is empty → **that screen is view-only** → reconsider whether it's needed, or whether it's just a block on another screen.

### Section 4 · Data
Write in the **user's own words**, not technical language. The first column is the *"thing"* they described when asked about their data; the middle column is the *"items"* they listed. The English table name goes in backticks, at the end — it's a note for the next session, not something they need to understand.

Only record things that **must remain**. Things that can be **calculated** from other data should NOT be stored — e.g. *"number of overdue tasks"* is counted, not stored separately. Say this out loud to the user.

**The "How they connect" column is written in plain sentences**, not `foreign key`: *"one customer has many orders"* · *"each visit belongs to one patient."*

Anywhere you inferred something (table name, connecting column) → record it in **column 4** of the table, don't let it blend into the "items" column.

⚠️ **If there is sensitive data** (health · salary · a customer's personal information · contracts) → add a line stating clearly: **who can see it, who cannot**. No need to design permissions in this session, but it must be recorded so the next session doesn't expose it.

### Section 5 · Done Criteria
The only accepted format is: **`<action>` → `<observable result>`**

| ✅ Accepted | ❌ Not accepted |
|---|---|
| Add a task with an empty name → error shown, not saved | Interface is easy to use |
| A task overdue since yesterday → red label shown at the top of the list | App runs fast |
| Move to a different stage → reload the page, still in the new stage | Looks nice, tidy |

Test: if you can **read it and immediately know how to test it**, accept it; if you have to ask *"how do I test that?"*, don't.

### Final Section · Considered and Deferred
Not a filler appendix. This is where the MVP proves it's the result of **cutting with a reason** — and it becomes the upgrade plan for later.
