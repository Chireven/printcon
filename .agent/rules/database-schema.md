---
trigger: always_on
---

PrintCon has an internal method for administrators to maintain the database schema. The system can identify when it needs a schema update and present the Administrator with an opportunity to Fix it or dismiss the warning.

When _ANY_ change to the database is made, it should be registered with our self heal system.

When an administrator clicks the Fix button, the schema (and all other database objects - missing tables, schemas, etc) should be created.
