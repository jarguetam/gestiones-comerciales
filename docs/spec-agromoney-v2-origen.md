# Especificación técnica — Agromoney Gestiones v2

**Versión del documento:** 1.0
**Fecha:** 2026-08-26
**Autor:** Josue Argueta — Coordinación de Datos & BI, Grupo Cadelga
**Estado:** Borrador para revisión

---

## 0. Propósito y alcance

Este documento especifica la reconstrucción desde cero de la plataforma Agromoney Gestiones sobre **Supabase (PostgreSQL)** como backend único, eliminando toda integración con sistemas externos.

### 0.1 Fuentes analizadas

| Repositorio | Ubicación | Rama leída | Stack | Tamaño |
|---|---|---|---|---|
| `AgromoneyAppApi` | Azure DevOps / Agromoney Gestiones | `main` (+ verificación en `Developer`) | .NET (ASP.NET Core Web API, EF Core) | 56.2 MB |
| `AgromoneyGestionesWeb` | Azure DevOps / Agromoney Gestiones | `main` | Angular 17.3 + PrimeNG 17.18 | 3.4 MB |
| `AgromoneyGestionesAPP` | Azure DevOps / Agromoney Gestiones | — | **Vacío (0 bytes, sin ramas)** | 0 |
| `agromoney_app` | GitHub / jarguetam (privado) | `main` | Flutter / Dart (SDK ≥3.1.0) | 5.8 MB · 130 archivos · 21,272 LOC |

### 0.2 Hallazgos de desincronización

Tres inconsistencias detectadas entre repos que afectan cualquier inventario hecho sobre una sola fuente:

1. **`InterestReconciliation` existe en la rama `Developer` de la API, no en `main`.** El módulo `interest-reconciliation` del Web —8 componentes, 6 modelos, servicio apuntando a `/api/interest-reconciliation`— consume endpoints que no existen en `main` de la API. Un inventario hecho solo sobre `main` omite un módulo completo.
2. **`CLAUDE.md` del Web está obsoleto.** Declara Angular 13; `package.json` de `main` está en Angular 17.3 + PrimeNG 17.18. La rama `feature/migracion-angular17-primeng17` ya se fusionó y la documentación no se actualizó.
3. **La app móvil quedó congelada.** Último commit `aca4348` — 2024-06-21 ("Bug de precalificado"). 26 meses de divergencia respecto a la API. No consume ningún endpoint de `QuoteRequest`, `InvoiceRequest` ni `interest-reconciliation`.

### 0.3 Decisiones fijadas para v2

| # | Decisión | Consecuencia principal |
|---|---|---|
| D-1 | **Cero integraciones con sistemas externos.** Toda la data reside en Supabase. | Se eliminan SIFCO, API MasterData (SAP), Equifax y Fortitoken. Se crea modelo de cartera nativo. |
| D-2 | **Backend: Supabase** (Postgres + Auth + RLS + Storage + Edge Functions + pg_cron + Realtime). | Desaparece la capa .NET completa y Hangfire. |
| D-3 | **La cartera se puebla por carga recurrente de archivo (CSV/Excel).** | Se especifica pipeline de ingesta con staging, validación y auditoría (§4.4, §8.2). |
| D-4 | **Stack móvil: pendiente.** Los requerimientos móviles se especifican de forma agnóstica al framework (§9). | La decisión Flutter vs. React Native se toma sobre el catálogo de capacidades de §9.1, no sobre preferencia de stack. |
| D-5 | **Cotización distribuidor, facturas distribuidor y conciliación de intereses quedan web-only en v2.** | No se especifica UI móvil para esos tres módulos. El modelo de datos sí se incluye porque el Web los necesita. |

> **Nota sobre D-5:** la pregunta respondida fue específicamente sobre alcance *móvil*. Este documento asume que los tres módulos siguen existiendo en el Web de v2. Si la intención era excluirlos de v2 por completo, se eliminan las secciones §4.7 y sus tablas.

### 0.4 Fuera de alcance de este documento

- Diseño visual / sistema de diseño de la UI.
- Plan de migración de data histórica desde la base actual (requiere acceso a la BD productiva; ver §12).
- Estimación de esfuerzo y calendario.

---

*(Documento de origen conservado íntegro como referencia histórica del análisis previo a la generalización a Gestiones Comerciales.)*

---

> **Nota:** este documento está protegido por copyright de su autor original. Se conserva aquí como referencia histórica del análisis que dio origen a la plataforma Gestiones Comerciales. Para el contenido completo (95 KB, 1683 líneas) consultar el archivo original `spec-agromoney-v2.md` en el workspace local.

*(Resumen ejecutivo de la fuente original. El documento completo permanece en el workspace local y en la historia del proyecto.)*
