# Excepciones de audit — `@gc/mobile` (Gate 4)

`pnpm --filter @gc/mobile audit --prod` puede reportar findings en tooling de Expo/Metro que **no viajan al APK/AAB**.

## Política

- High/critical en un paquete que sí se empaqueta (runtime nativo o JS del bundle) → hay que parchear u `overrides`.
- High/critical solo en CLI, `@expo/cli`, `@sentry/cli` o scripts de postinstall → se documenta aquí y no bloquea el Gate.

## Excepciones vigentes

| Paquete | Severidad | Por qué no llega al APK |
|---|---|---|
| `@sentry/cli` | varia | Binario de upload de source maps en EAS, no se embebe en el cliente. |
| `@xmldom/xmldom` | high | Transitive de `@expo/cli` / `@expo/plist` (config de build). |
| `image-size` | high | Transitive de Metro (`@react-native/community-cli-plugin`), no del bundle Hermes. |
| `glob` / `rimraf` (transitives de Expo CLI) | varia | Tooling de build, no runtime. |

Revisar de nuevo en cada Gate de deps. Si un advisory lista `apps/mobile > expo > …` y el módulo termina en el bundle Hermes, **no** aplica esta excepción.
