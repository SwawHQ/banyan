param([Parameter(Mandatory=$true)][string]$Archive)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
[Console]::InputEncoding = New-Object Text.UTF8Encoding($false)
try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead([IO.Path]::GetFullPath($Archive))
    try {
        if ($zip.Entries.Count -gt 25000) { throw 'too_many_payload_files' }
        # .NET Framework exposes no IsEncrypted property; fail closed if its flag field is unavailable.
        $flags = [IO.Compression.ZipArchiveEntry].GetField('_generalPurposeBitFlag', [Reflection.BindingFlags]'Instance,NonPublic')
        if ($null -eq $flags) { throw 'unsupported_zip_runtime' }
        $entries = @(
            foreach ($entry in $zip.Entries) {
                if ($entry.FullName.Length -gt 482) { throw 'unsafe_zip_entry' }
                @{name=$entry.FullName; attributes=$entry.ExternalAttributes; length=$entry.Length; flags=[int]$flags.GetValue($entry)}
            }
        )
        [Console]::WriteLine((@{entries=$entries} | ConvertTo-Json -Depth 4 -Compress))
        # Keep the archive open while JS validates the complete extraction plan.
        $request = [Console]::ReadLine()
        if ($null -eq $request) { throw 'zip_plan_missing' }
        $plan = $request | ConvertFrom-Json
        foreach ($item in $plan) {
            try { $sourceStream = $zip.Entries[$item.index].Open(); $sourceStream.Dispose() }
            catch { throw 'unsupported_zip_entry_type' }
        }
        $buffer = New-Object byte[] 65536
        foreach ($item in $plan) {
            if ($item.directory) { continue }
            $entry = $zip.Entries[$item.index]
            [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($item.target))
            $sourceStream = $entry.Open()
            try {
                $targetStream = [IO.File]::Open($item.target, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
                try {
                    [long]$length = 0
                    while (($count = $sourceStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                        $length += $count
                        if ($length -gt $entry.Length) { throw 'zip_entry_size_mismatch' }
                        $targetStream.Write($buffer, 0, $count)
                    }
                    if ($length -ne $entry.Length) { throw 'zip_entry_size_mismatch' }
                    $targetStream.Flush($true)
                } finally { $targetStream.Dispose() }
            } finally { $sourceStream.Dispose() }
        }
    } finally { $zip.Dispose() }
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}