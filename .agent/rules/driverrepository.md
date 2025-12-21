---
trigger: always_on
---

# Technical Specification: Driver Repository Storage Architecture

**TL;DR:** Write to `{Root}/{XX}/{hash}.pd`, read with fallback to `{Root}/{XX}/{YY}/{hash}.pd`

**Context:** This standard applies to the "Driver Repository" module. It defines a **Dual-Path Resolution** strategy to support storage scalability and seamless future migration.

### 1. Storage Strategy (Write Operations)
When **saving** new files, the system defaults to the **Single-Tier** structure to minimize file system overhead.

* **Write Target:** Single-Tier (Depth: 1)
* **Path Pattern:** `{RepositoryRoot}/{Shard_L1}/{Hash}.pd`
* **Shard_L1:** First 2 characters of the hash.

### 2. Retrieval Strategy (Read Operations)
When **reading** files, the system employs a "Fall-through" logic to locate files that may exist in either the standard (Single-Tier) or extended (Two-Tier) structure.

**Resolution Logic:**
1.  **Attempt 1: Single-Tier Check (Primary)**
    * *Path:* `{Root}/{Shard_L1}/{Hash}.pd`
    * *Logic:* Check if file exists here first. This is the standard location for small-to-medium scale deployments (< 5M files).
    * *Action:* If found, return file.

2.  **Attempt 2: Two-Tier Check (Extended)**
    * *Path:* `{Root}/{Shard_L1}/{Shard_L2}/{Hash}.pd`
    * *Logic:* Check if file exists in the deep nested structure. This location is reserved for high-scale deployments.
    * *Action:* If found, return file.

3.  **Final Action:**
    * If neither path resolves, throw `FileNotFoundException`.

### 3. Path & Variable Definitions
* **Hash:** SHA256 hash (64-character hexadecimal, e.g., `1234567890abcdef...`)
* **Shard_L1 (Level 1):** The **first 2 characters** of the Hash (e.g., `12`).
* **Shard_L2 (Level 2):** The **3rd and 4th characters** of the Hash (e.g., `34`).

### 4. Implementation Examples

| Hash | Single-Tier Path (Primary) | Two-Tier Path (Extended) |
| :--- | :--- | :--- |
| `123456...` | `Root/12/123456....pd` | `Root/12/34/123456....pd` |
| `a5b3c4...` | `Root/a5/a5b3c4....pd` | `Root/a5/b3/a5b3c4....pd` |

### 5. AI Implementation Rules
* **Code Structure:** Always encapsulate file retrieval in a helper method (e.g., `ResolveDriverPath(hash)`).
* **Read-Robustness:** Never assume the file is in the Single-Tier location. Always implement the fallback check to the Two-Tier location.
* **Write-Strictness:** Unless explicitly configured otherwise, all new writes must go to the **Single-Tier** path.
* **Case Sensitivity:** Always force hash strings to **lowercase** before generating directory names.

### 6. Automated Scalability & Migration
**Soft Limit:** 5,000,000 Files.

**A. Capacity Alerts:**
The system must monitor total file count and trigger administrator alerts at the following utilization thresholds (based on 5M limit):
* **75% (3.75M files):** Warning (Cleanup Recommended).
* **80% (4.00M files):** Elevated Warning.
* **95% (4.75M files):** Critical Alert (Migration Imminent).

**B. Auto-Migration Logic (Trigger: 98% / 4.9M files):**
When the repository exceeds 98% of the soft limit, the system initiates the **Expansion Protocol**:
1.  **Write State:** New writes continue to **Single-Tier** (to preserve system stability during transition).
2.  **Background Process:** A low-priority job iterates through Single-Tier folders, moving files to their corresponding **Two-Tier** paths.
3.  **Read State:** The existing Dual-Path Resolution (Section 2) handles requests for both moved and unmoved files seamlessly.
4.  **Completion:** Once the Single-Tier folders are empty (excluding recent writes), the Write Configuration should be updated to target **Two-Tier** permanently.