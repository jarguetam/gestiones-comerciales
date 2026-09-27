function Draw-GcMark {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$X,
    [float]$Y,
    [float]$Size,
    [System.Drawing.Color]$Color
  )

  $stroke = $Size * 0.105
  $pen = [System.Drawing.Pen]::new($Color, $stroke)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $brush = [System.Drawing.SolidBrush]::new($Color)
  try {
    # The open ring and forward point stay recognizable at launcher-icon size.
    $Graphics.DrawArc($pen, $X + $Size * 0.19, $Y + $Size * 0.19,
      $Size * 0.62, $Size * 0.62, 47, 266)
    $Graphics.DrawLine($pen, $X + $Size * 0.48, $Y + $Size * 0.51,
      $X + $Size * 0.68, $Y + $Size * 0.51)
    $tip = [System.Drawing.PointF[]]@(
      [System.Drawing.PointF]::new($X + $Size * 0.80, $Y + $Size * 0.51),
      [System.Drawing.PointF]::new($X + $Size * 0.65, $Y + $Size * 0.40),
      [System.Drawing.PointF]::new($X + $Size * 0.65, $Y + $Size * 0.62)
    )
    $Graphics.FillPolygon($brush, $tip)
  } finally {
    $pen.Dispose()
    $brush.Dispose()
  }
}
