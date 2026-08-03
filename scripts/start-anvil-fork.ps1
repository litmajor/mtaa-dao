# Start Anvil fork (PowerShell)
param()
$rpc = $env:ANVIL_FORK_RPC; if (-not $rpc) { $rpc = $env:ANVIL_RPC_URL }
$block = $env:ANVIL_FORK_BLOCK
$port = $env:ANVIL_FORK_PORT; if (-not $port) { $port = 8545 }
if (-not $rpc) { Write-Error "ANVIL_FORK_RPC or ANVIL_RPC_URL must be set"; exit 1 }

$cmd = @('anvil', '--fork-url', $rpc, '-p', "$port")
if ($block) { $cmd += @('--fork-block-number', $block) }

Write-Host "Starting anvil fork on port $port for RPC: $rpc"
& $cmd
