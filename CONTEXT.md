# pipe-kan

A local Kanban view of Jira issues, fed by jira-cli. The first release changes Jira only by running jira-cli.

## Language

**Issue**:
A Jira work item identified by its key.
_Avoid_: ticket, item, task (when meaning the Jira record)

**Card**:
The Board representation of one Issue. It shows the Issue key and summary, and when the payload has them, priority, assignee, due date, labels, and age since created. On All epics the Card is an Epic and is marked Epic.

**Column**:
A Board lane named by an Issue status present in the payload. Statuses with no Issues are omitted.
_Avoid_: lane, list

**Board**:
The Kanban of Cards grouped into Columns. All stories and All epics each open a Board. Selecting an Epic on All stories keeps that Board and shows only that Epic's children.
_Avoid_: dashboard, Jira board (that is Atlassian's saved board), view (Linear's saved query)

**All stories**:
The left-pane opener for the Board whose Cards are non-Epic Issues.
_Avoid_: inbox, home, all issues

**All epics**:
The left-pane opener for the Board whose Cards are Epics. Sibling of All stories. Last opener persists locally. Not Favourite, Preset, Scope, or selecting an Epic.
_Avoid_: epic view, epic board (Atlassian's), toggle

**Project**:
A Jira project identified by its key. Refresh and the default Scope are one Project. A Pipe may hold Issues from several keys until Refresh.
_Avoid_: repo, codebase (those are this tool)

**Epic**:
An Issue of type Epic, listed from `jira issue list -tEpic`. On All stories it lives in the left pane; clicking it shows children. On All epics it is a Card.
_Avoid_: parent (jira-cli's `-P` flag name)

**Favourite**:
A user-curated Epic in a collapsible group after All epics. Clicking it still shows only its children on All stories. Local only; not Scope, Filter, Hide, or Preset.
_Avoid_: pin, bookmark, star (the control)

**Folder**:
A named, one-level group of Favourites in the left pane. Local only; not Scope, Filter, Hide, Preset, or an Epic status group.
_Avoid_: directory, collection, project (when meaning this)

**Scope**:
The jira-cli list invocation that fills All stories. All epics is filled by `jira issue list -tEpic`, not by typing that into Scope.
_Avoid_: filter, view, query (when meaning this)

**Search**:
Typing in the header that hides Epics and Cards that do not match. An Epic matches on key, summary, and labels, or when a child matches. It does not change Scope or Refresh Jira.
_Avoid_: filter, query (when meaning this)

**Filter**:
Persisted Board controls that hide Cards without changing Scope or Refresh. An Epic row stays when the Epic's own field matches or a remaining child matches; it hides when neither does.
_Avoid_: Search, Scope, Sort, Preset, query

**Sort**:
Persisted order of Cards inside each Column.
_Avoid_: Filter, Search, Preset, order-by (jira-cli's list flag)

**Hide**:
User action that removes a Column from the Board until they put it back. Distinct from collapse (thin the Column) and from omitting a status that has no Issues.
_Avoid_: collapse, remove (when meaning this)

**Preset**:
A named, local snapshot of Filter, Sort, and Hide. Listed in a collapsible group after Favourites. Apply copies it into last-used chrome; Save names the current last-used chrome. Not Scope, Search, Favourite, or Open.
_Avoid_: view, layout, saved filter

**Pipe**:
stdin carrying `jira issue list --raw` JSON into the app. The payload may include Issues from more than one Project. Refresh replaces that Board with the current jira-cli Project.
_Avoid_: stream, feed, Scope (when meaning this)

**Refresh**:
Re-running jira-cli from the UI to replace the Issues on the current Board.
_Avoid_: sync, reload (when meaning that action)

**Move**:
Changing an Issue's status by running `jira issue move`. A Card is Moved by dropping it on a Column, including an Epic Card on All epics. On All stories an Epic is Moved from its row menu. The only Write-back in the first release. Dropping a Card on the same Column, or picking the Epic's current status, does nothing.
_Avoid_: transition, drag (the gesture), update, file (putting a Favourite in a Folder)

**Open**:
Showing an Issue's details and Jira URL in the side pane. A Card Opens on click, including an Epic Card on All epics. On All stories an Epic Opens from its row menu. `jira open KEY` still resolves that URL. Same-origin pages embed; remote Jira is a link because it refuses frames.
_Avoid_: view, browse (when meaning this)

**Write-back**:
Changing Jira from the Board, only by running jira-cli. Never a direct Jira API call from this app.
_Avoid_: sync, persist, save (when meaning a Jira mutation)

**Agent**:
An external coding agent (Cursor today, Devin when available) spawned by pipe-kan over ACP to assist the user inside the app. The agent does not hold Jira credentials.
_Avoid_: AI assistant, copilot, chatbot (when meaning this integration)

**Agent Sidepanel**:
The resizable right-side panel where the user chats with the Agent, attaches context, and approves actions.
_Avoid_: chat panel, assistant window, copilot pane

**ACP**:
Agent Client Protocol, the JSON-RPC-over-stdio protocol pipe-kan uses to drive the Agent. Not a direct LLM API.
_Avoid_: MCP, agent API, model protocol

**Skill**:
A Markdown instruction file in the mattpocock/skills format that guides the Agent's behavior for a specific task. Selected by the user and injected into the ACP prompt as context.
_Avoid_: plugin, extension, tool (when meaning the instruction file)

**Attached Context**:
The set of Issue keys, board state, and selected Skill the user adds to the current Agent conversation. Sent as resource blocks in the ACP prompt.
_Avoid_: prompt, input, attachments

**Agent Action**:
A mutation the Agent proposes that requires user approval before pipe-kan executes it: Move a Card, Refresh the Board, edit a repo file, or run a terminal command.
_Avoid_: tool call, command, automation

**Fixture**:
Checked-in fake `jira issue list --raw` JSON that seeds the Board and the Fake Jira when no Pipe is given.
_Avoid_: mock, stub, sample (when meaning this file)

**Fake Jira**:
A local HTTP stand-in for Jira's REST API so jira-cli can be tested without a real site.
_Avoid_: mock Jira, stub API
