# Hábitat — alta de usuarios (Fase 0 · 0.6)

Fuente: roadmap §6 y el organigrama de Luis. Correos `@habitathn.org`.
Los marcados con † no están confirmados.

## Orden de alta en el backoffice (Empresas → Hábitat → Usuarios → Invitar)

El formulario pide email, nombre, rol, supervisor (solo para asesores) y contraseña inicial.
No tiene campo de oficina ni de jefe para supervisores: eso se asigna después con
`06-usuarios-oficina-jefe.sql`.

| # | Nombre | Email | Rol | Supervisor (en el formulario) | Oficina (por SQL) | Jefe (por SQL) |
|---|---|---|---|---|---|---|
| — | Luis Martinez | luis.martinez@habitat.com (ya existe; ¿cambiar a @habitathn.org?) | gerente | — | — | — |
| 1 | Ana Medina | ana.medina@habitathn.org † | admin | — | — | — |
| 2 | Maricela Lendos | maricela.lendos@habitathn.org | supervisor | — | Santa Rosa (SRC) | Luis |
| 3 | Luis López | luis.lopez@habitathn.org | supervisor | — | San Pedro Sula (SPS) | Luis |
| 4 | Amílcar Matamoros | amilcar.matamoros@habitathn.org | supervisor | — | Siguatepeque (SIG) | Luis |
| 5 | César Gonzales | cesar.gonzales@habitathn.org † | supervisor | — | Santa Cruz (SCY) | Luis |
| 6 | Marlon Reyes | marlon.reyes@habitathn.org † | supervisor | — | Aguán (AGU) | Luis |
| 7 | Pedro Alvarado | pedro.alvarado@habitathn.org | asesor | Maricela Lendos | Santa Rosa (SRC) | — |
| 8 | Jorge Miranda | jorge.miranda@habitathn.org | asesor | Maricela Lendos | Santa Rosa (SRC) | — |
| 9 | Cinthia López | cinthia.lopez@habitathn.org | asesor | Luis López | San Pedro Sula (SPS) | — |
| 10 | Wilmer Osorio | wilmer.osorio@habitathn.org | asesor | Luis López | San Pedro Sula (SPS) | — |
| 11 | Edson Díaz | edson.diaz@habitathn.org | asesor | Amílcar Matamoros | Siguatepeque (SIG) | — |
| 12 | Winston Amaya | winston.amaya@habitathn.org | asesor | Amílcar Matamoros | Siguatepeque (SIG) | — |
| 13 | Kevin Amador | kevin.amador@habitathn.org | asesor | Amílcar Matamoros | Tegucigalpa (TGU) | — |
| 14 | Alirio Anariba | alirio.anariba@habitathn.org | asesor | Amílcar Matamoros | Tegucigalpa (TGU) | — |
| 15 | Ernesto Mejía | ernesto.mejia@habitathn.org | asesor | César Gonzales | Santa Cruz (SCY) | — |
| 16 | Florentino Castillo | florentino.castillo@habitathn.org | asesor | César Gonzales | Santa Cruz (SCY) | — |
| 17 | Edelia Hernández | edelia.hernandez@habitathn.org | asesor | Marlon Reyes | Aguán (AGU) | — |
| 18 | Gerson Argueta | gerson.argueta@habitathn.org | asesor | Marlon Reyes | La Ceiba (CEI) | — |
| — | Linton Mejía | linton.mejia@habitathn.org | asesor | pendiente (cobros) | pendiente | — |
| — | Nelson Munguía | nelson.munguia@habitathn.org † | asesor | pendiente (cobros) | pendiente | — |

- Amílcar y Marlon cubren dos oficinas; se les asigna la primera (roadmap §6). Sus asesores quedan en la oficina correcta.
- «Merlon» en La Ceiba se toma como Marlon Reyes.
- Las contraseñas iniciales las escribe Josue y las entrega en privado a cada persona, nunca en grupo.
