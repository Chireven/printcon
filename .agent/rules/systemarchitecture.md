---
trigger: always_on
---

# System Architecture & Lifecycle Rules

## 1. Startup Sequence
Dependencies must initialize in "Infrastructure First" order to prevent race conditions.
1. **databaseProviders:** Initialize first. (Required for configuration and session state).
2. **storageProviders:** Initialize second. (Required for logging and file operations).
3. **logonProviders:** Initialize third. (Depends on DB for user validation and Storage for audit logs).
4. **Availability & Feedback:**
    * The Core Program is **locked** (unavailable to users) until one provider from each category (DB, Storage, Logon) is registered and Healthy.
    * **Splash Screen:** A startup interface must display real-time status, reporting the **Current Category** and **Plugin Name** being loaded.
5. **Watchdog Timer:**
    * Each initialization phase has a hard timeout (Default: 30s).
    * If a plugin hangs, it is forcibly marked "Failed."
    * If a Critical Infrastructure plugin fails, startup aborts.

## 2. Plugin Registration (Handshake)
1. **Initialization:** At startup, plugins begin initialization and register with the Core System.
2. **Compatibility Check:**
    * The Plugin declares its `RequiredCoreVersion`.
    * The Core System verifies compatibility. If the version mismatch is unsafe, the Plugin is rejected immediately.
3. **Requirement Declaration (Infrastructure):**
    * The Plugin transmits its requirements to the Core System.
    * **Schema Isolation:** The Database Provider enforces strict isolation. Each plugin is assigned a unique schema (`plg_<type>_<name>`). The Provider ensures settings/data from one plugin are never accessible to another.
4. **Task Capability Declaration (Actions):**
    * **Definitions:** The Plugin registers its available **Actions** (Code logic) and **Parameter Schemas**.
    * **Defaults:** The Plugin proposes **Default Schedules** and **Default Parameter Values**.
    * **Immutability Rule:** The Core System records defaults only on the **First Run** or **Version Upgrade**. On subsequent boots, the Core respects user modifications and rejects override attempts.
5. **Validation & Finalization:**
    * Infrastructure Providers validate availability.
    * Core informs Plugin of success/failure.
    * **Success:** Plugin marks itself "Ready."
    * **Failure:** Plugin logs error and aborts.

## 3. Operation Strategy
1. **Broker Pattern:** The Core Program acts as the central message broker between Consumers (Plugins) and Infrastructure (Providers).
2. **Registry:** The Core System maintains a lightweight registry of all active requirements.
3. **Runtime Changes:**
    * **High Impact (Schema/Structure):** Strict. Can ONLY be requested during **Registration**.
    * **Low Impact (Temp Files/Data):** Flexible. Can be requested in real-time.

4. **Requirement Auditing (The "Test" Button):**
    * **Standard (Cached):** Requests are answered from the Core Registry Cache.
    * **Forced (Live):** If `FORCE` flag is present, Core queries all Plugins, updates Cache, and responds.

5. **Task Orchestration:**
    * **Authority:** The Core System (via `node-cron`) is the sole trigger.
    * **Persistence Strategy (Database Isolation):**
        * **Core Responsibility:** Core maintains `sys_tasks` (Definitions, Schedules, History).
        * **Plugin Responsibility:** Plugins DO NOT store scheduling data. They only interact with their own `plg_` schemas when invoked.
    * **Execution Handshake:**
        1. **Trigger:** User request or Timer.
        2. **Dispatch:** Core sends `EXECUTE_CMD` (Task ID, **Runtime Parameters**).
        3. **Ack/Run:** Plugin acknowledges and works asynchronously.
        4. **Completion:** Plugin emits `COMPLETE_EVENT` (Status, Output Log).
    * **Concurrency:** Core enforces locking (Default: **Skip if Running**).

## 4. Constraints & Messaging
1. **Asynchronous Handling:**
    * Communications must be non-blocking.
    * **End-to-End Acknowledgement:** All critical messages require an ACK.
2. **Health Monitoring:**
    * **Heartbeat:** Providers emit status every **5 minutes**.
    * **Mayday Protocol:** Providers must **immediately** emit a `CRITICAL_FAILURE` upon crash.
    * **TTL Cache:** Core System maintains "Provider Health" cache (TTL = Heartbeat + 1 Min).
    * **Task Watchdog:** Tasks have a separate Watchdog (Default: **15 Min**). If exceeded, Core terminates process and records "Timed Out."

## 5. Shutdown Protocol (Teardown)
To prevent data corruption during restarts or updates:
1.  **Drain Mode:** Core stops accepting *new* Requests or Tasks.
2.  **Notification:** Core signals all Plugins (`SIG_STOP`). Plugins must save state and release resources within **5 Seconds**.
3.  **Task Termination:** Running tasks are allowed to finish if within the 5-second window; otherwise, they are sent a cancellation signal.
4.  **Disconnect:** Infrastructure Providers (DB, Storage) close connections only after all Plugins have reported "Stopped."