# System Permissions Reference

This document serves as the Single Source of Truth for all Role-Based Access Control (RBAC) permissions in the PrintCon system.

## Permission Groups

### 1. Print Servers (`printservers.*`)

Controls access to the Print Server Management ecosystem, including the dashboard, server configuration, and provisioning tools.

| Permission ID         | Label                    | Description                                                                                                                                                                     |
| :-------------------- | :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `printservers.read`   | **View Print Servers**   | **Required** to access the Print Servers dashboard. Users without this permission will see a "Permission Denied" screen if they attempt to access the module.                   |
| `printservers.create` | **Add Print Servers**    | Grants the ability to register new print servers. Controls visibility of the "Add Server" button on the dashboard and validation of the creation form.                          |
| `printservers.update` | **Edit Print Servers**   | Grants the ability to modify existing server details (Hostname, IP) and manage server resources (Drivers, Ports, Devices). Controls the "Manage Server" button.                 |
| `printservers.delete` | **Delete Print Servers** | **High Risk**. Grants the ability to permanently remove a print server and all its associated configurations. Controls visibility of the Delete icon in the Server Config page. |

---

## Implementation Details

### Client-Side Enforcement

Permissions are checked using the `useAuth()` hook:

```typescript
const { hasPermission } = useAuth();
if (!hasPermission('printservers.read')) {
  return <PermissionDenied />;
}
```

### Server-Side Validation

For security, permissions are also validated at the Event Hub level. The client must pass the user's permissions in the request context:

```typescript
// Plugin Handler
if (!context?.permissions?.includes("printservers.delete")) {
  throw new Error("PERMISSION_DENIED");
}
```

## Default Assignments

| Role             | Permissions                                                                              |
| :--------------- | :--------------------------------------------------------------------------------------- |
| **System Admin** | All (`*`)                                                                                |
| **Print Admin**  | `printservers.read`, `printservers.create`, `printservers.update`, `printservers.delete` |
| **Operator**     | `printservers.read`, `printservers.update`                                               |
| **Viewer**       | `printservers.read`                                                                      |
