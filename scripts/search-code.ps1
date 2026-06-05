param(
    [string]$Pattern = "/api/"
)

$Dirs   = @("app", "lib", "components")
$ExcDir = @(".next", "node_modules", "dist", "build", "out")
$Exts   = @("*.ts", "*.tsx", "*.js", "*.jsx")

$Root = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "Search pattern : $Pattern" -ForegroundColor Cyan
Write-Host "Search dirs    : $($Dirs -join ', ')" -ForegroundColor Cyan
Write-Host "Excluded dirs  : $($ExcDir -join ', ')" -ForegroundColor DarkGray
Write-Host ""

$total = 0

foreach ($dir in $Dirs) {
    $base = Join-Path $Root $dir
    if (-not (Test-Path $base)) { continue }

    foreach ($ext in $Exts) {
        $files = Get-ChildItem -Path $base -Recurse -Filter $ext -ErrorAction SilentlyContinue |
            Where-Object {
                $parts = $_.FullName.Replace("\", "/").Split("/")
                -not ($parts | Where-Object { $ExcDir -contains $_ })
            }

        foreach ($file in $files) {
            $lines = Select-String -Path $file.FullName -Pattern ([regex]::Escape($Pattern)) -SimpleMatch
            foreach ($m in $lines) {
                $rel = $m.Path.Replace($Root, "").TrimStart("\").TrimStart("/")
                Write-Host ("{0}:{1}  {2}" -f $rel, $m.LineNumber, $m.Line.Trim()) -ForegroundColor White
                $total++
            }
        }
    }
}

Write-Host ""
if ($total -eq 0) {
    Write-Host "No matches found." -ForegroundColor Yellow
} else {
    Write-Host "$total match(es) found." -ForegroundColor Green
}
