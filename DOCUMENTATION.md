# Project Documentation

Name: Sloppy Pub

LLM Roleplay Project inspired by Silly Tavern.

## System Overview

This application provides an interactive narrative engine for roleplay chat with Large Language Models.
The architecture adapts container virtualization concepts to narrative generation, game mechanics, and state tracking.
World templates declare narrative rules, parameters, initial states, and semantic blueprints.
Frozen world templates instantiate isolated or synchronized chat sessions.
Universe instances coordinate shared lore and states across multiple concurrent sessions.
Local reactive state stores record narrative changes and rollback states across branching message trees.
Chat instances parse streaming XML commands for low-latency state mutations and decision cards.

## Features and Mechanics

### World System

The world system manages environmental settings, narrative rules, and dynamic world states.
Authors declare worlds using worldfile templates.
Each worldfile defines metadata, compile-time arguments, runtime variables, narrative content, initial states, and semantic blueprints.
Compile-time arguments bake fixed parameters into world descriptions at build time.
Runtime variables inject configurable values when a user creates a new world session.
Narrative content includes background stories, setting descriptions, guidelines, plot intros, and narrative incidents.

World instances represent active chat sessions created from world templates.
Each instance maintains an isolated state store, a message tree, and session metadata.
The reactive state store tracks arbitrary key-value pairs as a baseline.
Semantic state blueprints build on this baseline to enforce structured progression rules.
Every state mutation creates a state change event and saves a state snapshot.

### Semantic State Architecture

The semantic state architecture decouples raw numeric values from narrative directives sent to the model.
Raw values track metrics, while mapped directives enforce explicit behavioral boundaries and permitted actions.
The system implements three formal blueprint archetypes on top of the baseline key-value store.
Authors declare these blueprints in world and character templates to create consistent game progression.

Archetype A defines bounded gauges with non-overlapping numerical tiers.
Gauges track continuous progression metrics such as affection, sanity, corruption, and energy.
Each gauge specifies minimum limits, maximum limits, a default value, and a maximum delta per turn.
The per-turn delta clamp prevents unearned or sudden attribute jumps.
Each tier defines a display label, a behavioral directive for the model, and threshold transition events.
Crossing a tier threshold executes registered on-enter and on-exit actions.

Archetype B defines finite state machines for discrete relational or world phases.
Finite state machines track conditions such as relationship status, combat posture, and world seasons.
Each machine defines an initial state and an explicit transition graph of permitted target states.
Transition guards verify prerequisite conditions before allowing state changes.
Prerequisites include required gauge thresholds, inventory items, or active flags.
Active states inject specific behavioral directives and narrative constraints into the model context.

Archetype C defines qualitative flags and item inventories.
Flags track discrete boolean achievements, story milestones, and discovered secrets.
Inventories record collected items and equipment identifiers.
Gating conditions check active flags and items to enable or disable choices in the conversation.
These conditions also unlock alternate narrative paths and trigger specialized world events.

State mutation follows a strict validation pipeline.
The system receives proposed state deltas from streaming XML commands or plugin scripts.
The validation engine clamps numerical deltas to configured limits and verifies transition guards.
The engine detects tier boundary crossings and updates active behavioral directives.
Finally, the store updates state records, dispatches lifecycle events, and saves snapshot records.

### Universe System

The universe system coordinates global lore and shared states across multiple world sessions.
Universe templates define global rules, cosmological backgrounds, and initial universe states.
The central universe coordinator manages active universe registrations, sequence numbers, and subscribers.
Different world sessions can participate in the same universe simultaneously.
The coordinator supports two distinct operational modes for world sessions.

Isolated mode creates an independent snapshot of universe rules and states on session creation.
State changes in isolated mode remain local to the session and never alter the parent universe.
Synchronized mode connects the world session to a live universe channel.
Universe-level state mutations broadcast to all connected synchronized world sessions in real time.
Users can inspect and edit universe templates using structured forms or raw text editors.

### Character System

The character system manages personas and entities that interact within the narrative world.
Authors configure character profiles using characterfile templates.
Character templates define metadata, summary, physical characteristics, linguistic patterns, psychology, desires, skills, backgrounds, and example dialogues.
Initial character states specify starting attributes, gauges, state machines, and inventory flags.
The system supports two distinct character types during runtime sessions.

Actor characters instantiate directly from persistent character templates.
Non-player characters generate dynamically during conversations to satisfy immediate narrative requirements.
Each character instance tracks active thoughts, emotional states, narrative goals, and personal states.
Streaming XML commands mutate character attributes, update relationship gauges, and transition character states.
Users can manage character templates through form controls or raw text editors.

### Lore System

The lore system injects contextual world knowledge on demand to preserve context tokens.
Lore books group individual lore entries into organized collections.
Each lore entry specifies an identifier, a title, content text, trigger keywords, and priority values.
The system supports static activation mode and dynamic activation mode.

Static lore entries remain active continuously and inject into every session prompt assembly.
Dynamic lore entries activate only when recent messages or context match declared keywords.
The lore manager view provides filtering, entry inspection, and text editing tools.

### Chat and Message Tree System

The chat system uses a non-linear directed message tree rather than a flat message list.
Each message exists as an independent node linked by parent and child identifiers.
Users can branch conversations at any point to explore alternate narrative paths.
Sibling navigation allows users to switch between alternative model responses on the same turn.
Users can edit existing messages or regenerate responses from parent nodes.

Each message node captures a snapshot of active world states at turn completion.
When a user switches between tree branches, the system restores the exact state snapshot of the target node.
Streaming communication uses Server-Sent Events from OpenAI-compatible endpoints.
The interface tracks generation duration and token consumption metrics.
A collapsible reasoning view displays model thinking text separately from the main response.

Chat instances use inline XML tags for function and command calling.
The model embeds command tags alongside dialogue during generation.
Supported commands include state update tags, event log tags, director tags, chapter tags, and choice tags.

The streaming parser intercepts and extracts XML command tags in real time.
The interface strips command tags from the message bubble to display clean narrative prose.
Extracted state tags apply mutations to the reactive state store without follow-up requests.
Choice tags parse into interactive decision cards with requirement metadata for rapid player input.

### World Info Drawer and Inspection

The chat workspace provides a slide-over world info drawer for active session inspection.
Users can open the drawer through the chat header button or the input action bar.
The drawer serves as the primary visual display for active session states.
The drawer organizes information into independent collapsible sections.
Collapsible sections include world metadata, full world prompt, universe background, and character profiles.
The drawer displays active lore entries resolved from attached lorebooks and the latest turn context.

The event logs section displays chronological session events with event type badges and timestamps.
The chapters section lists persistent story summaries and associated event counts.
The live state section displays real-time state tables with text filtering.
This section inspects baseline key-value variables, active gauge meters, tier labels, and state machine values.
Future interface additions can render extra HUD views, while the drawer provides the immediate complete view.

### Session Management and Compaction

Session management tracks the lifecycle of active roleplay instances.
Session events record chronological narrative milestones, character actions, and system updates.
Models and users record events through inline event tags or interface controls.
Chapter checkpoints summarize recent events and dialogue turns into persistent story summaries.
Models record chapter checkpoints through inline chapter tags or compaction controls.
Chapters preserve long-term continuity without overloading context windows.

Session compaction creates a permanent chapter summary and clears the active message tree.
Compacted chapters inject into system prompts to maintain continuity across long-running campaigns.
The instance manager view displays active sessions, creation dates, and current state metrics.
Users can switch active sessions, inspect state tables, or delete unused instances.

### Director AI Agent

The director system acts as an autonomous steering agent for the active session.
The director monitors narrative pacing, world rule compliance, and dramatic tension.
The agent maintains hidden internal thoughts, strategic plans, and steering instructions.
These internal thoughts and plans remain hidden from user-facing conversation turns.

The director records thoughts and updates plans through inline XML director tags during generation.
When enabled, the prompt pipeline injects director guideline instructions into the prompt sequence.
The director steers the conversation without breaking character immersion.

### AI Assistant and Creation Wizard

The application provides a slide-over assistant panel across all template and settings views.
The assistant acts as an interactive co-author for worlds, universes, characters, lore, and settings.
The assistant uses specialized tools to propose targeted line modifications to active editors.
All assistant tools use standard function tool objects with explicit type fields.
This tool structure ensures compatibility with client parsing engines across models.
Supported line operations include line replacement, line insertion, and line deletion.

The assistant panel computes structured diff hunks and displays unified diff cards with change counts.
Users can inspect visual additions and deletions before applying or rejecting proposed modifications.
Wizards invoke modification tools autonomously when users request creations or edits.
The session stages proposed modifications and pauses requests for user approval.
When the user applies or rejects changes, the session sends a follow-up completion request.

The assistant session coordinates message branches and staged diffs with reactive subscriptions.
Session managers retain conversation history and avoid resetting state after completions finish.
Form fields include Feeling Lucky toggles for automated preprocessing.
When enabled, the model generates field values during instance creation before initial prompt assembly.
The instance creation wizard automates runtime variable generation using model completions.

### Prompt Pipeline and Configuration

The prompt pipeline controls the composition, order, and roles of messages sent to the model.
The pipeline assembles system instructions, world prompts, character profiles, lore, events, and history.
Users can reorder prompts to alter how the model prioritizes instructions.
The system protects critical structural prompts while allowing custom ordering.

Users can add custom prompt blocks with user-defined names and content.
Eligible system and user prompts support configurable message roles including system, user, and assistant.
A separate assistance prompt registry manages prompts for the co-author assistant panel.
The settings view provides drag-and-drop reordering, role selection, and prompt toggles.

### Plugin Host Architecture

The application provides a reactive plugin host architecture for external scripts and story modules.
The plugin host connects custom scripts to the central reactive store without causing component render desyncs.
External modules register with the host to monitor session events and automate state changes.
The host architecture operates through three primary subsystems.

The state management subsystem allows plugins to query values, propose state deltas, and retrieve active tier directives.
The event dispatcher subsystem allows plugins to publish and subscribe to lifecycle hooks.
Lifecycle hooks run at initialization, turn start, turn end, state changes, and choice selections.
The plugin registry subsystem manages plugin installation, dependency resolution, and runtime deregistration.
Plugins can implement custom game rules, milestone detectors, and narrative mechanics through this bridge.

### Module Packaging and Serialization

The module packaging system manages the import and export of roleplay assets.
Individual templates serialize to human-readable text files following standard schemas.
Assets serialize as worldfiles, universefiles, characterfiles, and lorefiles.
The system bundles multiple related assets into compressed zip package archives.

Module archives contain a manifest file and categorized directories for each asset type.
When importing modules, the system inspects asset identifiers and flags potential name collisions.
Users can choose to overwrite existing assets or cancel conflicting imports.
The packaging system operates entirely in client memory without external server dependencies.

## Project Structure

### Root Files and Configuration

The project root contains configuration files, dependency definitions, and development scripts.
`package.json` defines project dependencies, npm scripts, and metadata.
`pnpm-lock.yaml` locks precise dependency versions for repeatable package installations.
`tsconfig.json`, `tsconfig.app.json`, and `tsconfig.node.json` configure TypeScript compiler rules.

`vite.config.ts` configures the Vite build tool and local development server.
`eslint.config.js` specifies code formatting and static analysis rules.
`index.html` serves as the single-page application host document.

### Documentation and Scripts

The repository maintains technical references and utility scripts.
`README.md` provides an architectural overview and container lifecycle metaphors.
`docs/APP.md` specifies application requirements, data schemas, and system capabilities.
`scripts/verify_ste.py` validates text against Simplified Technical English rules.

### Source Code Layout

Application source code resides in the `src` directory.
`src/main.tsx` initializes the React application root and mounts the primary component.
`src/App.tsx` coordinates top-level tab navigation, assistant context, and view routing.
`src/App.module.css` and `src/index.css` define application layout styles and base themes.
`src/assets/prompts/` contains default system prompt templates.

### User Interface Components

User interface components reside in `src/components/`.
`src/components/layouts/` contains header navigation bars and chat input components.
`src/components/common/` contains reusable buttons, badges, modals, tab groups, and empty states.
`src/components/messages/` contains chat bubbles, action bars, choice selectors, and reasoning cards.
`src/components/views/` contains view controllers for each primary application section.

`src/components/views/ChatView.tsx` renders the conversation workspace and message history.
`src/components/views/WorldManagerView.tsx` and `src/components/views/world-manager/` provide world template forms and subcomponents.
`src/components/views/UniverseManagerView.tsx` and `src/components/views/universe-manager/` provide universe template management tools.
`src/components/views/CharacterManagerView.tsx` and `src/components/views/character-manager/` provide character profile editors and trait builders.
`src/components/views/LoreManagerView.tsx` and `src/components/views/lore-manager/` provide lore book management and entry lists.
`src/components/views/InstanceManagerView.tsx` and `src/components/views/instance-manager/` provide session listings and creation wizards.
`src/components/views/WorldInfoDrawer.tsx` and `src/components/views/world-info-drawer/` provide collapsible world info, event logs, chapters, full world prompt, active lore, and live state drawers.
`src/components/views/settings/` provides prompt pipeline reordering and configuration panels.
`src/components/views/assistant/` provides slide-over diff cards and assistance chat panels.

### Shared Core Modules

Core business logic, state management, and services reside in `src/shared/`.
`src/shared/ai/` provides model communication clients, message tree structures, XML command parsers, assistance schemas, and diff tools.
`src/shared/world/` implements world template serialization, state stores, state tools, and session runners.
`src/shared/universe/` implements the universe coordinator and real-time state channels.
`src/shared/character/` implements character registries, state stores, and character prompt builders.
`src/shared/lore/` implements lore book storage, serialization, and keyword matching algorithms.
`src/shared/session/` implements director state tracking, chapter checkpoints, and session compaction.
`src/shared/settings/` implements prompt registries, definitions, formatters, and persistence hooks.
`src/shared/wizard/` implements creation wizard prompt generators and template creation tools.
`src/shared/plugin/` implements plugin registries, lifecycle hooks, and host API bridges.
`src/shared/toml/` implements multiline-preserving TOML serialization and formatting.
`src/shared/io/` implements zip archive creation, module export, and collision detection.
