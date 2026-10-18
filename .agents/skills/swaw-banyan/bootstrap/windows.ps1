# Windows cold start only. All final installation and ownership rules live in JS.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
$skillRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$skillItem = Get-Item -LiteralPath $skillRoot -Force
if ($skillItem.LinkType -eq 'Junction') { $skillRoot = [IO.Path]::GetFullPath([string]$skillItem.Target[0]) }
function Assert-PlainBootstrapPath([string]$Path) {
    for ($current = [IO.Path]::GetFullPath($Path); $current; $current = [IO.Path]::GetDirectoryName($current.TrimEnd('\'))) {
        if ((Test-Path -LiteralPath $current) -and ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'linked_bootstrap_path' }
    }
}
function Find-Node($Manifest, [bool]$SkipManaged, [bool]$Diagnosing) {
    $candidates = @()
    try {
        $bindingFile = Join-Path $skillRoot '.tools/bindings.json'
        if ([IO.File]::Exists($bindingFile)) {
            $bindings = [IO.File]::ReadAllText($bindingFile) | ConvertFrom-Json
            if ($bindings.tools.node) {
                $bound = $bindings.tools.node
                $path = if ($bound.source -eq 'managed') { Join-Path $skillRoot ('.tools/' + $bound.path) } else { $bound.path }
                $candidates += $path
            }
        }
    } catch { if (-not $Diagnosing) { throw } }
    $candidates += Join-Path $skillRoot '.tools/node/node.exe'
    foreach ($application in @(Get-Command 'node.exe' -CommandType Application -All -ErrorAction SilentlyContinue)) {
        $candidates += $application.Source
    }
    foreach ($candidate in $candidates) {
        try {
            if (-not $candidate -or -not [IO.File]::Exists($candidate)) { continue }
            $target = [IO.Path]::GetFullPath((Join-Path $skillRoot '.tools/node'))
            $managed = [IO.Path]::GetFullPath($candidate).StartsWith($target + '\',[StringComparison]::OrdinalIgnoreCase)
            if ($managed) {
                if ($SkipManaged) { continue }
                Assert-PlainBootstrapPath $candidate
                $receiptFile = Join-Path $target 'install.json'
                if (-not [IO.File]::Exists($receiptFile)) { continue }
                $receipt = [IO.File]::ReadAllText($receiptFile) | ConvertFrom-Json
                $binary = @($receipt.files | Where-Object name -CEQ 'node.exe')
                if ($receipt.schema -ne 'swaw-banyan.install/v1' -or $receipt.name -ne 'node' -or $binary.Count -ne 1 -or
                    $binary[0].sha256 -cne (Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash.ToLowerInvariant()) { continue }
            }
        } catch {
            if (-not $Diagnosing) { throw }
            continue
        }
        $definition = @($Manifest.platforms.'windows-x64'.tools | Where-Object name -CEQ 'node')[0]
        $process = New-Object Diagnostics.Process
        $process.StartInfo.FileName = $candidate
        $process.StartInfo.Arguments = '--version'
        $process.StartInfo.UseShellExecute = $false
        $process.StartInfo.CreateNoWindow = $true
        $process.StartInfo.RedirectStandardOutput = $true
        $process.StartInfo.RedirectStandardError = $true
        try {
            [void]$process.Start()
            $output = $process.StandardOutput.ReadToEndAsync()
            $errorOutput = $process.StandardError.ReadToEndAsync()
            if (-not $process.WaitForExit(5000)) { $process.Kill(); continue }
            $text = $output.GetAwaiter().GetResult().Trim()
            if ($process.ExitCode -eq 0 -and $text -cmatch '^v(\d+\.\d+\.\d+)$') {
                $version = [version]$Matches[1]; $rule = $definition.compatibility
                if (($rule.exact -and $version -ne [version]$rule.exact) -or
                    ($rule.min -and $version -lt [version]$rule.min) -or ($rule.before -and $version -ge [version]$rule.before)) { continue }
                return $candidate
            }
        } catch { continue } finally { $process.Dispose() }
    }
    return $null
}
try {
    $helpCommand = if ($args.Count) { [string]$args[0] } else { 'help' }
    if ($helpCommand -in @('--help','-h')) { $helpCommand = 'help' }
    if ($helpCommand -cmatch '^help(?:/(en|zh))?$') {
        $language = if ($Matches[1]) { $Matches[1] } elseif ([Globalization.CultureInfo]::CurrentUICulture.Name -match '^zh(?:-|$)') { 'zh' } else { 'en' }
        $helpArgs = @()
        if ($args.Count -gt 1) { $helpArgs = @($args[1..($args.Count-1)]) }
        if ($helpArgs.Count -eq 1 -and $helpArgs[0] -in @('--help','-h')) { $helpArgs = @($helpCommand) }
        & (Join-Path $skillRoot 'tasks/help/cold.ps1') $language @helpArgs
        exit $LASTEXITCODE
    }
    $directory = Join-Path $skillRoot 'tasks'
    foreach ($part in $helpCommand.Split('/')) {
        if ($part -cnotmatch '^[a-z_][a-z0-9_-]*(?:\.[a-z_][a-z0-9_-]*)*$') { throw "unknown_command:$helpCommand; run swban help" }
        $directory = Join-Path $directory $part
    }
    $entry = Join-Path $directory 'entry.mjs'
    if (-not [IO.File]::Exists($entry)) { throw "unknown_command:$helpCommand; run swban help" }
    Assert-PlainBootstrapPath $entry
    $native = $helpCommand -cmatch '^base/(bun|node|hugo|go|git|gh|uv|python)(?:/(npm|npx))?$'
    if (-not $native -and $args.Count -eq 2 -and $args[1] -in @('--help','-h')) {
        $language = if ([Globalization.CultureInfo]::CurrentUICulture.Name -match '^zh(?:-|$)') { 'zh' } else { 'en' }
        & (Join-Path $skillRoot 'tasks/help/cold.ps1') $language $helpCommand
        exit $LASTEXITCODE
    }
    $preparing = $args[0] -match '^base/(bun|node|hugo|go|git|gh|uv)/ensure$'
    if ($preparing -and ($args.Count -gt 2 -or ($args.Count -eq 2 -and $args[1] -ne '--force'))) { throw 'invalid_ensure_arguments' }
    if ($helpCommand -eq 'base/python/ensure' -and $args.Count -gt 1) { throw 'invalid_ensure_arguments' }
    $force = $preparing -and $args.Count -eq 2
    $architecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    if ($env:OS -ne 'Windows_NT' -or $architecture -ne 'AMD64') { throw 'supported_bootstrap_platform_is_windows_x64' }
    $manifest = [IO.File]::ReadAllText((Join-Path $skillRoot 'tools.json')) | ConvertFrom-Json
    if ($manifest.schema -ne 'swaw-banyan.tools/v2') { throw 'invalid_tools_manifest' }
    $available = Find-Node $manifest ($force -and $helpCommand -ceq 'base/node/ensure') ($helpCommand -ceq 'doctor')
    if ($available) {
        & $available (Join-Path $skillRoot 'tasks/_cli/main.mjs') @args
        exit $LASTEXITCODE
    }
    if ($helpCommand -eq 'doctor' -or $helpCommand -cmatch '^base/[^/]+/check$') { throw 'runtime_not_ready; run swban base/node/ensure' }
    $definitions = @($manifest.platforms.'windows-x64'.tools | Where-Object name -eq 'node')
    if ($definitions.Count -ne 1) { throw 'missing_or_duplicate_runtime:node' }
    $definition = $definitions[0]
    if ($definition.sha256 -cnotmatch '^[a-f0-9]{64}$' -or ([uri]$definition.url).Scheme -ne 'https' -or $definition.executable -ne 'node.exe') { throw 'invalid_node_definition' }
    $cache = Join-Path $skillRoot '.tools/.cache'
    Assert-PlainBootstrapPath $cache
    [void][IO.Directory]::CreateDirectory($cache)
    $temporary = Join-Path $cache ('bootstrap-' + [guid]::NewGuid().ToString())
    [void][IO.Directory]::CreateDirectory($temporary)
    $archive = Join-Path $temporary 'download.zip'
    $engine = Join-Path $temporary 'node.exe'
    try {
        [Console]::Error.WriteLine("Banyan bootstrap: Node $($definition.version)")
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $url = [uri]$definition.url
        $response = $null
        for ($redirects = 0; $redirects -le 5; $redirects++) {
            $request = [Net.HttpWebRequest]::Create($url)
            $request.AllowAutoRedirect = $false
            $request.Timeout = 30000; $request.ReadWriteTimeout = 30000
            $request.UserAgent = 'swaw-banyan-bootstrap'
            $response = $request.GetResponse()
            if ([int]$response.StatusCode -notin @(301,302,303,307,308)) { break }
            $next = New-Object uri($url, $response.Headers['Location'])
            $response.Dispose(); $response = $null
            if ($next.Scheme -ne 'https') { throw 'https_redirect_required' }
            $url = $next
        }
        if (-not $response -or [int]$response.StatusCode -ne 200) { throw 'bootstrap_download_failed' }
        $inputStream = $null; $output = $null
        try {
            $inputStream = $response.GetResponseStream()
            $output = [IO.File]::Open($archive, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
            $buffer = New-Object byte[] 65536; $total = 0L
            while (($count = $inputStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                $total += $count
                if ($total -gt 256MB) { throw 'download_too_large' }
                $output.Write($buffer, 0, $count)
            }
            $output.Flush($true)
        } finally { if ($inputStream) { $inputStream.Dispose() }; if ($output) { $output.Dispose() }; $response.Dispose() }
        if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $definition.sha256) { throw 'download_hash_mismatch' }
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [IO.Compression.ZipFile]::OpenRead($archive)
        try {
            $entries = @($zip.Entries | Where-Object FullName -ceq ($definition.archiveRoot + '/node.exe'))
            if ($entries.Count -ne 1 -or $entries[0].Length -gt 256MB -or (($entries[0].ExternalAttributes -shr 16) -band 0xf000) -notin @(0,0x8000)) { throw 'invalid_bootstrap_binary' }
            $inputStream = $entries[0].Open()
            $output = [IO.File]::Open($engine, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
            try { $inputStream.CopyTo($output); $output.Flush($true) } finally { $inputStream.Dispose(); $output.Dispose() }
        } finally { $zip.Dispose() }
        $arguments = @((Join-Path $skillRoot 'tasks/_cli/bootstrap-node.mjs'), $archive) + $args
        & $engine @arguments
        $result = $LASTEXITCODE
    } finally {
        # Only remove the two files created by this invocation, after Node exits.
        foreach ($file in @($engine, $archive)) {
            Assert-PlainBootstrapPath $file
            if ([IO.File]::Exists($file)) { [IO.File]::Delete($file) }
        }
        [IO.Directory]::Delete($temporary)
    }
    exit $result
} catch {
    [Console]::Error.WriteLine("[swban] $($_.Exception.Message)")
    exit 1
}
