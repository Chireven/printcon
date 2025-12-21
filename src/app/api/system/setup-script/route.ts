import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/system/setup-script
 * 
 * Generates a PowerShell script to configure a remote server for management.
 * Dynamically identifies the PrintCon server's host and adds it to the target's TrustedHosts,
 * replacing the insecure wildcard '*' recommendation.
 */
export async function GET(req: NextRequest) {
    // Determine the PrintCon server identity (Host/IP) as seen by the request
    // This assumes the user is downloading the script FROM the PrintCon server,
    // so the 'Host' header is the address they should trust.
    const hostHeader = req.headers.get('host') || 'localhost';
    const printConHost = hostHeader.split(':')[0]; // Remove port if present

    const script = `# ==========================================
# PrintCon Remote Server Setup Script
# Generated for PrintCon Server: ${printConHost}
# Run as Administrator on Target Server
# ==========================================

$ErrorActionPreference = "Stop"
$printConHost = "${printConHost}"

Write-Host "Configuring Windows Remote Management (WinRM)..." -ForegroundColor Cyan

# 1. Enable PS Remoting
try {
    # SkipNetworkProfileCheck ensures it works even on public networks (use with caution, but standard for setup)
    Enable-PSRemoting -Force -SkipNetworkProfileCheck -ErrorAction SilentlyContinue
    Write-Host "[OK] PS Remoting Enabled" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to enable PS Remoting: $_" -ForegroundColor Red
}

# 2. Configure TrustedHosts (Non-Destructive)
Write-Host "Configuring TrustedHosts..." -ForegroundColor Cyan
$trustedHostsPath = "WSMan:\\localhost\\Client\\TrustedHosts"
$currentHosts = (Get-Item $trustedHostsPath).Value

Write-Host "Current TrustedHosts: $currentHosts" -ForegroundColor Gray

if ($currentHosts -eq "*") {
    Write-Host "[INFO] TrustedHosts is set to wildcard (*). This covers ${printConHost}. No change needed." -ForegroundColor Yellow
} else {
    # Split by comma and trim
    $hostsArray = if ($currentHosts) { $currentHosts -split "," | ForEach-Object { $_.Trim() } } else { @() }
    
    if ($hostsArray -contains $printConHost) {
        Write-Host "[INFO] ${printConHost} is already in TrustedHosts." -ForegroundColor Green
    } else {
        # Add PrintCon host to the list
        $hostsArray += $printConHost
        $newHostsStr = $hostsArray -join ","
        
        Set-Item $trustedHostsPath -Value $newHostsStr -Force
        Write-Host "[SUCCESS] Added ${printConHost} to TrustedHosts." -ForegroundColor Green
        Write-Host "New TrustedHosts: $newHostsStr" -ForegroundColor Gray
    }
}

# 3. Restart Service to Apply
Write-Host "Restarting WinRM Service..." -ForegroundColor Cyan
Restart-Service WinRM

Write-Host "==========================================" -ForegroundColor Green
Write-Host "Configuration Complete!" -ForegroundColor Green
Write-Host "Ensure TCP Port 5985 (HTTP) is open in the firewall." -ForegroundColor Yellow
`;

    return new NextResponse(script, {
        headers: {
            'Content-Type': 'text/plain',
            'Content-Disposition': 'attachment; filename="Configure-PrintCon-Remote.ps1"'
        }
    });
}
