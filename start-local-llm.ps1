# Start All Local LLM Services
# Usage: .\start-local-llm.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Local LLM Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Ollama is installed
Write-Host "Checking Ollama installation..." -ForegroundColor Yellow
$ollamaPath = Get-Command ollama -ErrorAction SilentlyContinue

if (-not $ollamaPath) {
    Write-Host "❌ Ollama not found!" -ForegroundColor Red
    Write-Host "Please install Ollama from: https://ollama.ai" -ForegroundColor Cyan
    Write-Host "Then run: ollama pull llama2" -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ Ollama found at: $($ollamaPath.Source)" -ForegroundColor Green
Write-Host ""

# Check if LLaMA model exists locally
Write-Host "Checking LLaMA 2 model..." -ForegroundColor Yellow
$models = ollama list 2>$null | Select-String "llama2"

if ($models) {
    Write-Host "✅ LLaMA 2 model found" -ForegroundColor Green
} else {
    Write-Host "⚠️  LLaMA 2 model not found. Downloading..." -ForegroundColor Yellow
    ollama pull llama2
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Terminal 1: Start Ollama
Write-Host "Starting Ollama service..." -ForegroundColor Yellow
$ollamaJob = Start-Job -Name "Ollama" -ScriptBlock {
    ollama serve
}
Write-Host "✅ Ollama started (Job ID: $($ollamaJob.Id))" -ForegroundColor Green
Write-Host ""

# Wait for Ollama to be ready
Write-Host "Waiting for Ollama to be ready..." -ForegroundColor Yellow
$ollamaReady = $false
$attempts = 0
While (-not $ollamaReady -and $attempts -lt 30) {
    try {
        $response = Invoke-WebRequest "http://localhost:11434/api/tags" -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $ollamaReady = $true
            Write-Host "✅ Ollama is ready" -ForegroundColor Green
        }
    } catch {
        Start-Sleep -Milliseconds 500
        $attempts++
    }
}

if (-not $ollamaReady) {
    Write-Host "⚠️  Ollama connection timeout. Continuing anyway..." -ForegroundColor Yellow
}

Write-Host ""

# Terminal 2: Start OpenClaw
Write-Host "Starting OpenClaw..." -ForegroundColor Yellow
$openclawJob = Start-Job -Name "OpenClaw" -ScriptBlock {
    Set-Location (Join-Path $PSScriptRoot "OpenClaw")
    
    # Set environment variables
    $env:OPENCLAW_LLM_TYPE = 'local'
    $env:OPENCLAW_LLM_PROVIDER = 'local'
    $env:OPENCLAW_LLM_MODEL = 'llama-2-7b-chat'
    $env:OPENCLAW_LLM_BASE_URL = 'http://localhost:11434'
    
    # Install and start
    try {
        npm install 2>&1 | Out-Null
        npm run start
    } catch {
        Write-Host "Error starting OpenClaw: $_" -ForegroundColor Red
    }
}
Write-Host "✅ OpenClaw startup initiated (Job ID: $($openclawJob.Id))" -ForegroundColor Green
Write-Host ""

# Wait a bit for OpenClaw to install
Start-Sleep -Seconds 5

# Terminal 3: Start Morio
Write-Host "Starting Morio..." -ForegroundColor Yellow
$morioJob = Start-Job -Name "Morio" -ScriptBlock {
    Set-Location $PSScriptRoot
    
    # Set environment variables
    $env:MORIO_LLM_TYPE = 'local'
    $env:MORIO_LLM_PROVIDER = 'ollama'
    $env:MORIO_LLM_MODEL = 'llama2'
    $env:MORIO_LLM_BASE_URL = 'http://localhost:11434'
    
    # Install and start
    try {
        npm install 2>&1 | Out-Null
        npm run dev
    } catch {
        Write-Host "Error starting Morio: $_" -ForegroundColor Red
    }
}
Write-Host "✅ Morio startup initiated (Job ID: $($morioJob.Id))" -ForegroundColor Green
Write-Host ""

# Display status
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Service Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🟢 Ollama Service:" -ForegroundColor Green
Write-Host "   URL: http://localhost:11434" -ForegroundColor Gray
Write-Host "   Model: llama2" -ForegroundColor Gray
Write-Host ""
Write-Host "🟢 OpenClaw Agent:" -ForegroundColor Green
Write-Host "   URL: http://localhost:5000" -ForegroundColor Gray
Write-Host "   Config: ./config/openclaw-llm.json" -ForegroundColor Gray
Write-Host ""
Write-Host "🟢 Morio Hub:" -ForegroundColor Green
Write-Host "   URL: http://localhost:5173" -ForegroundColor Gray
Write-Host "   Config: ./config/morio-llm.json" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Running Jobs" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Get-Job | Format-Table Name, Id, State, @{Label="Started"; Expression={$_.PSBeginTime}} -AutoSize
Write-Host ""

Write-Host "View logs:" -ForegroundColor Yellow
Write-Host "  Ollama:    Get-Job -Name 'Ollama' | Receive-Job -Keep" -ForegroundColor Gray
Write-Host "  OpenClaw:  Get-Job -Name 'OpenClaw' | Receive-Job -Keep" -ForegroundColor Gray
Write-Host "  Morio:     Get-Job -Name 'Morio' | Receive-Job -Keep" -ForegroundColor Gray
Write-Host ""

Write-Host "Stop services:" -ForegroundColor Yellow
Write-Host "  Get-Job | Stop-Job" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ All services started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop watching, or wait for services to finish..." -ForegroundColor Yellow

# Keep script running and monitor jobs
while ($true) {
    Start-Sleep -Seconds 5
    
    # Check if any job has failed
    $failedJobs = Get-Job | Where-Object { $_.State -eq "Failed" }
    if ($failedJobs) {
        Write-Host "⚠️  Some jobs failed:" -ForegroundColor Red
        $failedJobs | Format-Table Name, State, Error
    }
}
