param([string]$Language, [string]$TasksRoot)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
$tasksRoot = if ($TasksRoot) { [IO.Path]::GetFullPath($TasksRoot) } else { [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../tasks')) }
$segment = '^[a-z_][a-z0-9_-]*(?:\.[a-z_][a-z0-9_-]*)*$'
function Stop-InvalidHelp([string]$File,[string]$English,[string]$Chinese) {
    if ($Language -eq 'zh') { throw "帮助文件格式错误：$File`n$Chinese" }
    throw "Invalid help file: $File`n$English"
}
function Read-HelpDocument([string]$Command) {
    $directory = $tasksRoot
    foreach ($part in $Command.Split('/')) {
        if ($part -cnotmatch $segment) { throw "unknown_help:$Command" }
        $directory = Join-Path $directory $part
        $item = Get-Item -LiteralPath $directory -Force -ErrorAction SilentlyContinue
        if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "unknown_help:$Command" }
    }
    $document = @{}
    foreach ($name in @('en','zh')) {
        $file = Join-Path $directory ("help.$name.txt")
        $item = Get-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
        if (-not $item -or $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "missing_help:$Command" }
        $source = [Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($file))
        if ($source.EndsWith([string][char]10)) { $source = $source.Substring(0,$source.Length-1) }
        $first = $source.Split([char]10)[0]; $index = $first.IndexOf('  #')
        if ($source.Contains([string][char]13) -or $source.StartsWith([string][char]0xfeff,[StringComparison]::Ordinal) -or $index -lt 1 -or -not $first.Substring(0,$index).Trim() -or -not $first.Substring($index+3).Trim()) {
            Stop-InvalidHelp $file 'Expected: usage  #summary' 'Expected: usage  #summary'
        }
        $document[$name] = @{usage=$first.Substring(0,$index); summary=$first.Substring($index+3); text=$source}
    }
    return $document
}
function Visit-HelpDirectory([string]$Directory,[string]$Command,$Items) {
    $active = [IO.File]::Exists((Join-Path $Directory 'entry.mjs'))
    foreach ($child in @(Get-ChildItem -LiteralPath $Directory -Directory -Force)) {
        if ($child.Name -eq 'node_modules' -or $child.Name -cnotmatch $segment -or ($child.Attributes -band [IO.FileAttributes]::ReparsePoint)) { continue }
        $name = if ($Command) { $Command + '/' + $child.Name } else { $child.Name }
        if (Visit-HelpDirectory $child.FullName $name $Items) { $active = $true }
    }
    if ($active -and $Command) { $Items.Add($Command,(Read-HelpDocument $Command)) }
    return $active
}
function Help-Rows($Names,$Items) {
    [string[]]$labels = @($Names | ForEach-Object {
        if ([IO.File]::Exists((Join-Path (Join-Path $tasksRoot $_) 'entry.mjs'))) { $_ } else { $_ + '/' }
    })
    $width = 0
    foreach ($label in $labels) { $width = [Math]::Max($width,$label.Length) }
    return @(for ($index = 0; $index -lt $Names.Count; $index++) {
        $labels[$index].PadRight($width) + '  #' + $Items[$Names[$index]].$Language.summary
    }) -join "`n"
}
try {
    if ($Language -notin @('en','zh')) { throw "unsupported_help_language:$Language" }
    if ($args.Count -gt 2) { throw 'invalid_help_arguments' }
    $query = if ($args.Count) { [string]$args[0] } else { $null }
    $scoped = $args.Count -eq 2
    if (-not $scoped -and ($null -eq $query -or $query -in @('--help','-h'))) { $query = 'help' }
    if (-not $scoped -and $query -notmatch '^\d+$') {
        $query = $query -creplace '/$',''
        $text = (Read-HelpDocument $query).$Language
        $lines = @($text.text)
        if (-not [IO.File]::Exists((Join-Path (Join-Path $tasksRoot $query) 'entry.mjs'))) {
            $items = New-Object 'Collections.Generic.Dictionary[string,object]' ([StringComparer]::Ordinal)
            [void](Visit-HelpDirectory $tasksRoot '' $items)
            [string[]]$names = @($items.Keys | Where-Object { $_.StartsWith($query + '/',[StringComparison]::Ordinal) -and $_.Split('/').Count -eq $query.Split('/').Count + 1 })
            if ($names.Count) {
                [Array]::Sort($names,[StringComparer]::Ordinal)
                $lines += @('',(Help-Rows $names $items))
            }
        }
        [Console]::Write(($lines -join "`n") + "`n")
    } else {
        if ($scoped -and ($query -match '^\d+$' -or $query -in @('--help','-h'))) { throw 'invalid_help_arguments' }
        $value = if ($scoped) { [string]$args[1] } else { $query }
        $depth = [long]::MaxValue
        if ($value -notmatch '^\d+$' -or -not [long]::TryParse($value,[ref]$depth) -or $depth -lt 1 -or $depth -gt 9007199254740991) { throw 'invalid_help_depth' }
        if ($scoped) { $query = $query -creplace '/$',''; [void](Read-HelpDocument $query) }
        $items = New-Object 'Collections.Generic.Dictionary[string,object]' ([StringComparer]::Ordinal)
        [void](Visit-HelpDirectory $tasksRoot '' $items)
        if ($scoped -and -not $items.ContainsKey($query)) { throw "unknown_help:$query" }
        $offset = if ($scoped) { $query.Split('/').Count } else { 0 }
        [string[]]$names = @($items.Keys | Where-Object { (-not $scoped -or $_.StartsWith($query + '/',[StringComparison]::Ordinal)) -and $_.Split('/').Count - $offset -le $depth })
        [Array]::Sort($names,[StringComparer]::Ordinal)
        [Console]::Write((Help-Rows $names $items) + "`n")
    }
} catch { [Console]::Error.WriteLine("[swban] $($_.Exception.Message)"); exit 1 }
