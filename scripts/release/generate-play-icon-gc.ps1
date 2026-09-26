param(
  [string]$Output = 'docs/releases/assets/play-icon-gc-draft.png'
)

Add-Type -AssemblyName System.Drawing

$size = 512
$bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

try {
  $blueBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#1D4ED8'))
  $whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $font = [System.Drawing.Font]::new('Segoe UI', 230, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $graphics.FillRectangle($blueBrush, 0, 0, $size, $size)
  $text = 'GC'
  $measured = $graphics.MeasureString($text, $font)
  $x = ($size - $measured.Width) / 2
  $y = ($size - $measured.Height) / 2 - 8
  $graphics.DrawString($text, $font, $whiteBrush, $x, $y)

  $directory = Split-Path -Parent $Output
  if ($directory) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
  $bitmap.Save($Output, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  foreach ($item in @($blueBrush, $whiteBrush, $font, $graphics, $bitmap)) {
    if ($item) { $item.Dispose() }
  }
}
