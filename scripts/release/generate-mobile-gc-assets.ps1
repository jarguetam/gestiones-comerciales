param(
  [string]$AssetDir = 'apps/mobile/assets'
)

Add-Type -AssemblyName System.Drawing

function Save-GcAsset {
  param(
    [int]$Width,
    [int]$Height,
    [int]$FontSize,
    [bool]$Transparent,
    [string]$Path
  )

  $bitmap = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $background = $null
  $white = $null
  $font = $null

  try {
    if ($Transparent) {
      $graphics.Clear([System.Drawing.Color]::Transparent)
    } else {
      $background = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#1D4ED8'))
      $graphics.FillRectangle($background, 0, 0, $Width, $Height)
    }
    $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $font = [System.Drawing.Font]::new('Segoe UI', $FontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $text = 'GC'
    $measured = $graphics.MeasureString($text, $font)
    $graphics.DrawString($text, $font, $white, ($Width - $measured.Width) / 2, ($Height - $measured.Height) / 2 - 8)
    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    foreach ($item in @($background, $white, $font, $graphics, $bitmap)) {
      if ($item) { $item.Dispose() }
    }
  }
}

New-Item -ItemType Directory -Force -Path $AssetDir | Out-Null
Save-GcAsset -Width 1024 -Height 1024 -FontSize 460 -Transparent $false -Path (Join-Path $AssetDir 'icon-gc.png')
Save-GcAsset -Width 1024 -Height 1024 -FontSize 370 -Transparent $true -Path (Join-Path $AssetDir 'adaptive-icon-gc.png')
Save-GcAsset -Width 1284 -Height 2778 -FontSize 420 -Transparent $false -Path (Join-Path $AssetDir 'splash-gc.png')
