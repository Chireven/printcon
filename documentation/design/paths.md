# Project Paths

This document tracks the purpose of various paths within the `printcon` repository. All paths below are relative to the project source root.

## Paths

- `.agent/`: Root configuration directory for AI agent behavior and context.
    - `.agent/rules/`: Contains markdown-based rule definitions that govern how AI agents interact with the codebase.
        - `.agent/rules/documentation.md`: Rules for maintaining project documentation.
        - `.agent/rules/plugins.md`: Architectural rules for the plugin subsystem.

- `documentation/`: Central repository for all project-level documentation, including design specs and manual verification guides.
    - `documentation/design/`: Technical design documents and architectural blueprints.
        - `documentation/design/paths.md`: This file; maps the directory structure to its intended purpose.
    - `documentation/plugins/`: Technical specifications for the plugin architecture.
        - `documentation/plugins/plugins-subsystem.md`: The master "Single Source of Truth" technical specification (Rule #20).

- `dist/`: Temporary directory for generated build artifacts.
    - `dist/plugins/`: Destination for packed `.plugin` bundles ready for distribution.

- `index.html`: Main entry point for the browser-based management console.

- `package.json`: Project manifest defining dependencies, scripts, and basic metadata.

- `plugins/`: The heart of the `printcon` extensibility model. Contains isolated modules for specific functionalities.
    - `plugins/features/`: Business-logic plugins that provide user-facing features.
        - `plugins/features/printer-manager/`: Comprehensive tool for managing network and local printers.
    - `plugins/logging/`: Internal plugins dedicated to unified logging across the core and other plugins.
    - `plugins/logonproviders/`: Integration points for Windows logon and authentication mechanisms.
    - `plugins/printers/`: Specialized plugins for printer management and fleet control.

- `scripts/`: Orchestration and utility scripts (e.g., PowerShell, Node.js) used for deployment, environment setup, and automation.
    - `scripts/delete.ts`: Cleanup utility for removing plugins and updating the registry.
    - `scripts/install.ts`: Deployment script for installing `.plugin` packages (Rule #4, #5).
    - `scripts/list.ts`: Utility for viewing all currently installed plugins in a table format.
    - `scripts/new.ts`: Interactive scaffolding tool for generating new plugin boilerplate (Rule #2 & #6).
    - `scripts/rename.ts`: Utility for renaming plugin IDs and folders.
    - `scripts/pack.ts`: Packaging utility to bundle plugins into `.plugin` files (Rule #14, #15).
    - `scripts/test-execution.ts`: Utility script for verifying the core execution engine and mock data.

- `src/`: Main source code directory for the `printcon` application.
    - `src/App.tsx`: The main UI composition layer, containing Sidebar, Header, and View routing.
    - `src/index.css`: Global styling tokens and layout rules for the dynamic UI.
    - `src/main.tsx`: React entry point for mounting the GUI.
    - `src/core/`: Primitive system logic, base classes, and fundamental service implementations.
        - `src/core/events.ts`: Global event hub utility for system-wide broadcasts (Rule #18).
        - `src/core/execution.ts`: Core engine for executing OS-level tools and managing mocks.
        - `src/core/loader.ts`: Server-side Plugin Loader that initializes plugins on startup.
        - `src/core/registry.json`: Central database of currently installed and active plugins.
        - `src/core/types/`: Global TypeScript type definitions and interfaces.
    - `src/lib/`: Reusable utility functions and vendor integrations that are not specific to the core logic.
    - `src/instrumentation.ts`: Next.js Server Lifecycle Hook for initializing the Plugin Loader.

- `vite.config.ts`: Configuration for the Vite build engine and dev server.
