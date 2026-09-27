param(
  [string]$AssetDir = 'apps/mobile/assets'
)

Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot '_gc-brand.ps1')

function Save-GcAsset {
  param(
    [int]$Width,
    [int]$Height,
    [int]$MarkSize,
    [bool]$Transparent,
    [string]$Path
  )

  $bitmap = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $background = $null
  try {
    if ($Transparent) {
      $graphics.Clear([System.Drawing.Color]::Transparent)
    } else {
      $background = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#1D4ED8'))
      $graphics.FillRectangle($background, 0, 0, $Width, $Height)
    }
    Draw-GcMark -Graphics $graphics -X (($Width - $MarkSize) / 2) -Y (($Height - $MarkSize) / 2) -Size $MarkSize -Color ([System.Drawing.Color]::White)
    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    foreach ($item in @($background, $graphics, $bitmap)) {
      if ($item) { $item.Dispose() }
    }
  }
}

New-Item -ItemType Directory -Force -Path $AssetDir | Out-Null
Save-GcAsset -Width 1024 -Height 1024 -MarkSize 800 -Transparent $false -Path (Join-Path $AssetDir 'icon-gc.png')
Save-GcAsset -Width 1024 -Height 1024 -MarkSize 650 -Transparent $true -Path (Join-Path $AssetDir 'adaptive-icon-gc.png')
Save-GcAsset -Width 1284 -Height 2778 -MarkSize 800 -Transparent $false -Path (Join-Path $AssetDir 'splash-gc.png')
