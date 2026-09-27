param(
  [string]$Output = 'docs/releases/assets/play-feature-graphic-draft.png'
)

Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot '_gc-brand.ps1')

$width = 1024
$height = 500
$bitmap = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

try {
  $bounds = [System.Drawing.Rectangle]::new(0, 0, $width, $height)
  $blue = [System.Drawing.ColorTranslator]::FromHtml('#1D4ED8')
  $navy = [System.Drawing.ColorTranslator]::FromHtml('#102E78')
  $pale = [System.Drawing.ColorTranslator]::FromHtml('#DCE9FF')
  $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new($bounds, $blue, $navy, 0)
  $graphics.FillRectangle($background, $bounds)

  Draw-GcMark -Graphics $graphics -X 42 -Y 82 -Size 330 -Color ([System.Drawing.Color]::White)

  $nameFont = [System.Drawing.Font]::new('Segoe UI', 60, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $detailFont = [System.Drawing.Font]::new('Segoe UI', 25, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $paleBrush = [System.Drawing.SolidBrush]::new($pale)
  $graphics.DrawString('Gestiones', $nameFont, $whiteBrush, 370, 140)
  $graphics.DrawString('Comerciales', $nameFont, $whiteBrush, 370, 208)
  $graphics.DrawString('Agenda · Visitas · Formularios', $detailFont, $paleBrush, 375, 330)

  $directory = Split-Path -Parent $Output
  if ($directory) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
  $bitmap.Save($Output, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  foreach ($item in @($background, $nameFont, $detailFont, $whiteBrush, $paleBrush, $graphics, $bitmap)) {
    if ($item) { $item.Dispose() }
  }
}
