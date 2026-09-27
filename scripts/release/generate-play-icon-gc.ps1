param(
  [string]$Output = 'docs/releases/assets/play-icon-gc-draft.png'
)

Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot '_gc-brand.ps1')

$size = 512
$bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$background = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#1D4ED8'))
try {
  $graphics.FillRectangle($background, 0, 0, $size, $size)
  Draw-GcMark -Graphics $graphics -X 56 -Y 56 -Size 400 -Color ([System.Drawing.Color]::White)

  $directory = Split-Path -Parent $Output
  if ($directory) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
  $bitmap.Save($Output, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  foreach ($item in @($background, $graphics, $bitmap)) {
    if ($item) { $item.Dispose() }
  }
}
