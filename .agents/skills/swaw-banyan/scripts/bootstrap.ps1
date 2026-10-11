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
function Find-Engine($Manifest, [string]$SkipManaged) {
    $bindings = $null
    $bindingFile = Join-Path $skillRoot '.tools/bindings.json'
    if ([IO.File]::Exists($bindingFile)) { $bindings = [IO.File]::ReadAllText($bindingFile) | ConvertFrom-Json }
    $candidates = @()
    if ($bindings.runtime -in @('bun','node')) {
        $bound = $bindings.tools.($bindings.runtime)
        $path = if ($bound.source -eq 'managed') { Join-Path $skillRoot ('.tools/' + $bound.path) } else { $bound.path }
        $candidates += @{name=$bindings.runtime;path=$path}
    }
    foreach ($name in @('bun','node')) { $candidates += @{name=$name;path=(Join-Path $skillRoot ".tools/$name/$name.exe")} }
    foreach ($name in @('bun','node')) {
        foreach ($application in @(Get-Command "$name.exe" -CommandType Application -All -ErrorAction SilentlyContinue)) {
            $candidates += @{name=$name;path=$application.Source}
        }
    }
    foreach ($candidate in $candidates) {
        if (-not $candidate.path -or -not [IO.File]::Exists($candidate.path)) { continue }
        $name = $candidate.name
        $target = [IO.Path]::GetFullPath((Join-Path $skillRoot ".tools/$name"))
        $managed = [IO.Path]::GetFullPath($candidate.path).StartsWith($target + '\',[StringComparison]::OrdinalIgnoreCase)
        if ($managed) {
            if ($SkipManaged -eq 'all' -or $SkipManaged -eq $name) { continue }
            Assert-PlainBootstrapPath $candidate.path
            $receiptFile = Join-Path $target 'install.json'
            if (-not [IO.File]::Exists($receiptFile)) { continue }
            $receipt = [IO.File]::ReadAllText($receiptFile) | ConvertFrom-Json
            $binary = @($receipt.files | Where-Object name -CEQ "$name.exe")
            if ($receipt.schema -ne 'swaw-banyan.install/v1' -or $receipt.name -ne $name -or $binary.Count -ne 1 -or
                $binary[0].sha256 -cne (Get-FileHash -LiteralPath $candidate.path -Algorithm SHA256).Hash.ToLowerInvariant()) { continue }
        }
        $definition = @($Manifest.platforms.'windows-x64'.tools | Where-Object name -CEQ $name)[0]
        $process = New-Object Diagnostics.Process
        $process.StartInfo.FileName = $candidate.path
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
            $pattern = if ($name -eq 'node') { '^v(\d+\.\d+\.\d+)$' } else { '^(\d+\.\d+\.\d+)$' }
            if ($process.ExitCode -eq 0 -and $text -cmatch $pattern) {
                $version = [version]$Matches[1]; $rule = $definition.compatibility
                if (($rule.exact -and $version -ne [version]$rule.exact) -or
                    ($rule.min -and $version -lt [version]$rule.min) -or ($rule.before -and $version -ge [version]$rule.before)) { continue }
                return $candidate.path
            }
        } catch { continue } finally { $process.Dispose() }
    }
    return $null
}
try {
    if ($args.Count -eq 0 -or $args[0] -in @('help','--help','-h')) {
        if ($args.Count -gt 2) { throw 'invalid_help_arguments; run swban help en or swban help zh' }
        $language = if ($args.Count -eq 2) {
            switch ($args[1]) { 'en' { 'en' }; 'zh' { 'zh-CN' }; default { throw 'unsupported_help_language; use en or zh' } }
        } elseif ([Globalization.CultureInfo]::CurrentUICulture.Name -match '^zh(?:-|$)') { 'zh-CN' } else { 'en' }
        [Console]::Write([IO.File]::ReadAllText((Join-Path $skillRoot "references/swban.help.$language.md"), [Text.Encoding]::UTF8))
        exit 0
    }
    $preparing = $args[0] -match '^(ensure|(bun|node|hugo|go|git|gh)\.ensure)$'
    if ($preparing -and ($args.Count -gt 2 -or ($args.Count -eq 2 -and $args[1] -ne '--force'))) { throw 'invalid_ensure_arguments' }
    $force = $preparing -and $args.Count -eq 2
    $architecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    if ($env:OS -ne 'Windows_NT' -or $architecture -ne 'AMD64') { throw 'supported_bootstrap_platform_is_windows_x64' }
    $manifest = [IO.File]::ReadAllText((Join-Path $skillRoot 'toolchain.json')) | ConvertFrom-Json
    if ($manifest.schema -ne 'swaw-banyan.toolchain/v2') { throw 'invalid_toolchain_manifest' }
    $skip = if (-not $force) { '' } elseif ($args[0] -eq 'ensure') { 'all' } else { $args[0].Split('.')[0] }
    $available = Find-Engine $manifest $skip
    if ($available) {
        & $available (Join-Path $skillRoot 'scripts.js/swban.mjs') @args
        exit $LASTEXITCODE
    }
    if (-not $preparing) { throw 'runtime_not_ready; run swban ensure' }
    $definitions = @($manifest.platforms.'windows-x64'.tools | Where-Object name -eq 'bun')
    if ($definitions.Count -ne 1) { throw 'missing_or_duplicate_runtime:bun' }
    $definition = $definitions[0]
    if ($definition.sha256 -cnotmatch '^[a-f0-9]{64}$' -or ([uri]$definition.url).Scheme -ne 'https' -or $definition.executable -ne 'bun.exe') { throw 'invalid_bun_definition' }
    $cache = Join-Path $skillRoot '.tools/.cache'
    Assert-PlainBootstrapPath $cache
    [void][IO.Directory]::CreateDirectory($cache)
    $temporary = Join-Path $cache ('bootstrap-' + [guid]::NewGuid().ToString())
    [void][IO.Directory]::CreateDirectory($temporary)
    $archive = Join-Path $temporary 'download.zip'
    $engine = Join-Path $temporary 'bun.exe'
    try {
        [Console]::Error.WriteLine("Banyan bootstrap: Bun $($definition.version)")
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
            $entries = @($zip.Entries | Where-Object FullName -ceq ($definition.archiveRoot + '/bun.exe'))
            if ($entries.Count -ne 1 -or $entries[0].Length -gt 256MB -or (($entries[0].ExternalAttributes -shr 16) -band 0xf000) -notin @(0,0x8000)) { throw 'invalid_bootstrap_binary' }
            $inputStream = $entries[0].Open()
            $output = [IO.File]::Open($engine, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
            try { $inputStream.CopyTo($output); $output.Flush($true) } finally { $inputStream.Dispose(); $output.Dispose() }
        } finally { $zip.Dispose() }
        $arguments = @((Join-Path $skillRoot 'scripts.js/bootstrap-bun.mjs'), $archive) + $args
        & $engine @arguments
        $result = $LASTEXITCODE
    } finally {
        # Only remove the two files created by this invocation, after Bun exits.
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
