param(
  [string]$Output = 'docs/releases/assets/play-feature-graphic-draft.png'
)

Add-Type -AssemblyName System.Drawing

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
  $white = [System.Drawing.Color]::White
  $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new($bounds, $blue, $navy, 0)
  $graphics.FillRectangle($background, $bounds)

  $gridPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#315DB5'), 1)
  foreach ($x in @(650, 735, 820, 905, 990)) {
    $graphics.DrawLine($gridPen, $x, 0, $x - 140, $height)
  }
  foreach ($y in @(90, 190, 290, 390)) {
    $graphics.DrawLine($gridPen, 550, $y, $width, $y)
  }

  $routePen = [System.Drawing.Pen]::new($pale, 12)
  $routePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $routePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $routePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $route = [System.Drawing.Point[]]@(
    [System.Drawing.Point]::new(628, 378),
    [System.Drawing.Point]::new(690, 300),
    [System.Drawing.Point]::new(790, 325),
    [System.Drawing.Point]::new(832, 190),
    [System.Drawing.Point]::new(902, 124)
  )
  $graphics.DrawLines($routePen, $route)

  $nodeBrush = [System.Drawing.SolidBrush]::new($white)
  $nodeCenterBrush = [System.Drawing.SolidBrush]::new($blue)
  foreach ($node in @(@(628, 378), @(790, 325), @(902, 124))) {
    $graphics.FillEllipse($nodeBrush, $node[0] - 19, $node[1] - 19, 38, 38)
    $graphics.FillEllipse($nodeCenterBrush, $node[0] - 8, $node[1] - 8, 16, 16)
  }

  $nameFont = [System.Drawing.Font]::new('Segoe UI', 62, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $detailFont = [System.Drawing.Font]::new('Segoe UI', 26, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $whiteBrush = [System.Drawing.SolidBrush]::new($white)
  $paleBrush = [System.Drawing.SolidBrush]::new($pale)
  $graphics.DrawString('Gestiones', $nameFont, $whiteBrush, 112, 145)
  $graphics.DrawString('Comerciales', $nameFont, $whiteBrush, 112, 213)
  $graphics.DrawString('Agenda · Visitas · Formularios', $detailFont, $paleBrush, 118, 335)

  $directory = Split-Path -Parent $Output
  if ($directory) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
  $bitmap.Save($Output, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  foreach ($item in @($background, $gridPen, $routePen, $nodeBrush, $nodeCenterBrush, $nameFont, $detailFont, $whiteBrush, $paleBrush, $graphics, $bitmap)) {
    if ($item) { $item.Dispose() }
  }
}
