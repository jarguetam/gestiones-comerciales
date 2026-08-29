# APK preview — Gestiones de campo

`gestiones-campo-preview.apk` es un build **preview DEMO** de la app móvil para probar en un dispositivo o emulador Android.

## Qué es (y qué no es)

- Firmado con el **keystore de debug** de Android, no con un keystore de producción.
- **No** está publicado en Google Play ni listo para distribución de tienda.
- Sirve para instalar a mano y revisar el flujo de campo (demo).

## Instalar con `adb`

Con el dispositivo conectado (USB o emulador) y depuración USB activa:

```bash
adb install releases/gestiones-campo-preview.apk
```

Si ya hay una versión instalada:

```bash
adb install -r releases/gestiones-campo-preview.apk
```

## Instalar desde el teléfono

1. Descarga el `.apk` (enlace raw de este archivo en GitHub, o cópialo al dispositivo).
2. Abre el archivo. Android pedirá permitir **orígenes desconocidos** / instalar apps de esa fuente (Archivos, Chrome, etc.).
3. Acepta e instala.

Si el sistema bloquea la instalación, revisa Ajustes → Seguridad → instalar apps desconocidas para la app que usaste para abrir el APK.
