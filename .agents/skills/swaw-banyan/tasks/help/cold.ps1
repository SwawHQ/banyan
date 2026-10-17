param([string]$Language)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
$tasksRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
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
    $file = Join-Path $directory 'help.json'
    $item = Get-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
    if (-not $item -or $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "missing_help:$Command" }
    $source = [IO.File]::ReadAllText($file,[Text.Encoding]::UTF8)
    try { $document = $source | ConvertFrom-Json }
    catch { Stop-InvalidHelp $file ("Invalid JSON: " + $_.Exception.Message) ("JSON 语法错误：" + $_.Exception.Message) }
    foreach ($name in @('en','zh')) {
        $text = $document.$name
        if ($text -isnot [PSCustomObject]) { Stop-InvalidHelp $file "$name must be an object." "$name 必须是对象。" }
        foreach ($key in @('summary','usage')) {
            if ($text.$key -isnot [string] -or -not $text.$key.Trim() -or $text.$key -match '[\r\n]') {
                Stop-InvalidHelp $file "$name.$key must be a non-empty single-line string." "$name.$key 必须是非空的单行字符串。"
            }
        }
        if ($text.details -isnot [Array]) { Stop-InvalidHelp $file "$name.details must be an array of strings." "$name.details 必须是字符串数组。" }
        for ($index = 0; $index -lt $text.details.Count; $index++) {
            $line = $text.details[$index]
            if ($line -isnot [string] -or $line -match '[\r\n]') {
                Stop-InvalidHelp $file "$name.details[$index] must be a single-line string." "$name.details[$index] 必须是单行字符串。"
            }
        }
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
        $lines = @($text.usage + '  #' + $text.summary)
        if ($text.details.Count) { $lines += @('') + $text.details }
        if (-not [IO.File]::Exists((Join-Path (Join-Path $tasksRoot $query) 'entry.mjs'))) {
            $items = New-Object 'Collections.Generic.Dictionary[string,object]' ([StringComparer]::Ordinal)
            [void](Visit-HelpDirectory $tasksRoot '' $items)
            [string[]]$names = @($items.Keys | Where-Object { $_.StartsWith($query + '/',[StringComparison]::Ordinal) -and $_.Split('/').Count -eq $query.Split('/').Count + 1 })
            if (-not $names.Count) { throw "unknown_help:$query" }
            [Array]::Sort($names,[StringComparer]::Ordinal)
            $lines += @('',(Help-Rows $names $items))
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
