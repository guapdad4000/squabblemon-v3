$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

$map = @(
    @{ node_id = '443057330438473'; out = 'paper-grain.jpg' },
    @{ node_id = '443057013149910'; out = 'speed-lines.jpg' },
    @{ node_id = '443055146500411'; out = 'washi-tape.jpg' },
    @{ node_id = '443058181320776'; out = 'classified-stamp.jpg' },
    @{ node_id = '443058174333184'; out = 'scout-stamp.jpg' },
    @{ node_id = '443057859596362'; out = 'torn-paper-strip.jpg' }
)

$destDir = 'E:\Apps\code\minimax\Squabblemon\artifacts\squabblemon\public\assets\inspector'

foreach ($entry in $map) {
    Write-Host ("=> " + $entry.node_id + " -> " + $entry.out)
    $urlJson = mcode-tools get-asset-url $entry.node_id 2>&1
    Write-Host $urlJson
    $obj = $urlJson | ConvertFrom-Json
    $downloadUrl = $obj.download_url
    if (-not $downloadUrl) {
        Write-Host ("  no url for " + $entry.node_id)
        continue
    }
    $destPath = Join-Path $destDir $entry.out
    Invoke-WebRequest -Uri $downloadUrl -OutFile $destPath -UseBasicParsing
    Write-Host ("  saved " + $destPath)
}
Write-Host "DONE"