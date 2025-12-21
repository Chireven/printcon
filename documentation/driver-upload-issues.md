# Driver Upload/Download Issues - Analysis & Fixes

## Issues Identified

### 1. Gateway Timeout on Upload ⏱️
**Root Cause:** The `/api/system/command` route has a **2-second timeout** for REQUEST_/RESPONSE_ events. Building

 driver packages can take longer than 2 seconds, especially for large driver folders.

**Location:** [`src/app/api/system/command/route.ts:44`](file:///d:/GitHub/printcon/src/app/api/system/command/route.ts#L44)
```typescript
const timeout = setTimeout(() => {
    console.warn(`[API] Timeout waiting for ${responseEvent}`);
    resolve(NextResponse.json({ error: 'Gateway Timeout' }, { status: 504 }));
}, 2000); // Only 2 seconds!
```

**Fix:** Increase timeout for BUILD_PACKAGE operations to 30 seconds

---

### 2. Different Hashes on Duplicate Uploads 🔄
**Root Cause:** The manifest includes a **timestamp** (`createdAt`) that changes with each build, causing the package content to be different each time.

**Location:** [`plugins/printers/printer-drivers/pd-builder.ts:368`](file:///d:/GitHub/printcon/plugins/printers/printer-drivers/pd-builder.ts#L368)
```typescript
packageInfo: {
    id: packageId,
    createdAt: new Date().toISOString(), // Changes every time!
    createdBy: user
}
```

**Impact:**
- Same driver uploaded twice creates different SHA256 hashes
- No deduplication
- Storage waste
- Hash shown in UI doesn't match filename

**Fix:** Use deterministic timestamps or remove `createdAt` for hash calculation consistency

---

### 3. Download Not Working 📥
**Root Cause:** The DOWNLOAD_DRIVER event handler returns base64-encoded buffer, but **no frontend code exists** to handle the download.

**Location:** [`plugins/printers/printer-drivers/index.ts:116-120`](file:///d:/GitHub/printcon/plugins/printers/printer-drivers/index.ts#L116-L120)
```typescript
api.events.emit('RESPONSE_DOWNLOAD_DRIVER', {
    success: true,
    buffer: downloadBuffer.toString('base64'), // Base64 encoded
    filename: payload.filename || `${payload.id}.zip`
});
```

**Missing:** Frontend code to:
1. Receive the base64 buffer
2. Decode it to binary
3. Create a Blob
4. Trigger browser download

---

## Recommended Fixes

### Fix #1: Increase Timeout for Long Operations

**File:** `src/app/api/system/command/route.ts`

```typescript
// Dynamic timeout based on operation
let timeoutMs = 2000; // Default 2 seconds

// Long-running operations get extended timeout
if (event === 'REQUEST_BUILD_PACKAGE') {
    timeoutMs = 30000; // 30 seconds for package building
} else if (event === 'REQUEST_DOWNLOAD_DRIVER') {
    timeoutMs = 10000; // 10 seconds for downloads
}

const timeout = setTimeout(() => {
    console.warn(`[API] Timeout waiting for ${responseEvent}`);
    resolve(NextResponse.json({ error: 'Gateway Timeout' }, { status: 504 }));
}, timeoutMs);
```

---

### Fix #2: Deterministic Package Building

**Option A (Recommended):** Remove timestamp from hash calculation
**Option B:** Use fixed "build date" instead of runtime date
**Option C:** Calculate hash only on payload content, exclude manifest

**Implementation (Option A):**
```typescript
// In pd-builder.ts - use a fixed timestamp or omit it
packageInfo: {
    id: packageId,
    createdAt: '2024-01-01T00:00:00Z', // Fixed date for consistency
    createdBy: user
}
```

---

### Fix #3: Frontend Download Handler

**Location:** Create new component or add to `DriverRepository.tsx`

```typescript
const handleDownload = async (driverId: string, filename: string) => {
    const response = await fetch('/api/system/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event: 'REQUEST_DOWNLOAD_DRIVER',
            pluginId: 'printer-drivers',
            data: { id: driverId, filename }
        })
    });

    const result = await response.json();
    
    if (!result.success) {
        toast.error('Download failed: ' + result.error);
        return;
    }

    // Decode base64 to binary
    const binaryString = atob(result.buffer);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // Create blob and trigger download
    const blob = new Blob([bytes], { type: 'application/zip' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};
```

---

## Implementation Priority

1. **HIGH**: Fix timeout (prevents upload failures)
2. **HIGH**: Add download handler (enables downloads)
3. **MEDIUM**: Fix hash consistency (prevents storage waste)

---

## Testing Checklist

After fixes:
- [ ] Upload same driver twice - verify identical hashes
- [ ] Upload completes without timeout
- [ ] Download button works and sends file to client
- [ ] SHA hash in UI matches filename in storage
- [ ] Deduplication works (same driver uploaded twice only stores once)
