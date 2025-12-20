# Remote Print Server Configuration Guide

This guide explains how to configure a Windows Server to allow remote driver management from the PrintCon application.

## 🚀 Quick Start Script

Run the following PowerShell script **as Administrator** on the target Print Server to enable remote access.

```powershell
# ==========================================
# PrintCon Remote Server Setup Script
# Run as Administrator on Target Server
# ==========================================

Write-Host "Configuring Windows Remote Management (WinRM)..." -ForegroundColor Cyan
Enable-PSRemoting -Force -SkipNetworkProfileCheck

Write-Host "Allowing Remote Access..." -ForegroundColor Cyan
# Allow any host to connect (Secure internal networks only)
# For stricter security, replace '*' with the IP of the PrintCon server
Set-Item WSMan:\localhost\Client\TrustedHosts -Value "*" -Force

Write-Host "Restarting WinRM Service..." -ForegroundColor Cyan
Restart-Service WinRM

Write-Host "Configuration Complete!" -ForegroundColor Green
Write-Host "Ensure TCP Port 5985 (HTTP) is open in your firewall." -ForegroundColor Yellow
```

---

## 🔒 Permissions & Security

### Why is this needed?
PrintCon uses **PowerShell Remoting** (WinRM) to query the drivers installed on your server. This is the same technology used by tools like Server Manager and Windows Admin Center.

### Requirements
1.  **Administrator Access**: To enumerate all drivers (especially from the Driver Store), the connecting user must have Administrator privileges on the target server.
2.  **Network Access**: The PrintCon server must be able to reach the target server on **Port 5985**.

### Troubleshooting

**Error: "Access is Denied"**
- Ensure you are using an account with Admin rights on the target server.
- If using a domain account, ensure the server is joined to the domain.

**Error: "The WinRM client cannot process the request"**
- Run `winrm quickconfig` on the target server.
- Verify the firewall allows inbound traffic on Port 5985.
