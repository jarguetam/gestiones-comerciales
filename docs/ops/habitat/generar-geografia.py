"""Genera geografia-honduras.csv y 01-geografia.sql desde la lista de
Wikipedia «Anexo:Municipios de Honduras» (referencia AMHON, 298 municipios).
Uso: python -I generar-geografia.py docs/ops/habitat
"""
import sys
import unicodedata
from pathlib import Path

DATOS = {
    "Atlántida": ["La Ceiba", "El Porvenir", "Tela", "Jutiapa", "La Masica", "San Francisco", "Arizona", "Esparta"],
    "Choluteca": ["Choluteca", "Apacilagua", "Concepción de María", "Duyure", "El Corpus", "El Triunfo", "Marcovia",
                  "Morolica", "Namasigüe", "Orocuina", "Pespire", "San Antonio de Flores", "San Isidro", "San José",
                  "San Marcos de Colón", "Santa Ana de Yusguare"],
    "Colón": ["Trujillo", "Balfate", "Iriona", "Limón", "Sabá", "Santa Fe", "Santa Rosa de Aguán", "Sonaguera",
              "Tocoa", "Bonito Oriental"],
    "Comayagua": ["Comayagua", "Ajuterique", "El Rosario", "Esquías", "Humuya", "La Libertad", "Lamaní",
                  "La Trinidad", "Lejamaní", "Meámbar", "Minas de Oro", "Ojos de Agua", "San Jerónimo",
                  "San José de Comayagua", "San José del Potrero", "San Luis", "San Sebastián", "Siguatepeque",
                  "Villa de San Antonio", "Las Lajas", "Taulabé"],
    "Copán": ["Santa Rosa de Copán", "Cabañas", "Concepción", "Copán Ruinas", "Corquín", "Cucuyagua", "Dolores",
              "Dulce Nombre", "El Paraíso", "Florida", "La Jigua", "La Unión", "Nueva Arcadia", "San Agustín",
              "San Antonio", "San Jerónimo", "San José", "San Juan de Opoa", "San Nicolás", "San Pedro",
              "Santa Rita", "Trinidad de Copán", "Veracruz"],
    "Cortés": ["San Pedro Sula", "Choloma", "Omoa", "Pimienta", "Potrerillos", "Puerto Cortés",
               "San Antonio de Cortés", "San Francisco de Yojoa", "San Manuel", "Santa Cruz de Yojoa",
               "Villanueva", "La Lima"],
    "El Paraíso": ["Yuscarán", "Alauca", "Danlí", "El Paraíso", "Güinope", "Jacaleapa", "Liure", "Morocelí",
                   "Oropolí", "Potrerillos", "San Antonio de Flores", "San Lucas", "San Matías", "Soledad",
                   "Teupasenti", "Texiguat", "Vado Ancho", "Yauyupe", "Trojes"],
    "Francisco Morazán": ["Distrito Central", "Alubarén", "Cedros", "Curarén", "El Porvenir", "Guaimaca",
                          "La Libertad", "La Venta", "Lepaterique", "Maraita", "Marale", "Nueva Armenia",
                          "Ojojona", "Orica", "Reitoca", "Sabanagrande", "San Antonio de Oriente",
                          "San Buenaventura", "San Ignacio", "Cantarranas", "San Miguelito", "Santa Ana",
                          "Santa Lucía", "Talanga", "Tatumbla", "Valle de Ángeles", "Villa de San Francisco",
                          "Vallecillo"],
    "Gracias a Dios": ["Puerto Lempira", "Brus Laguna", "Ahuas", "Juan Francisco Bulnes", "Villeda Morales",
                       "Wampusirpe"],
    "Intibucá": ["La Esperanza", "Camasca", "Colomoncagua", "Concepción", "Dolores", "Intibucá",
                 "Jesús de Otoro", "Magdalena", "Masaguara", "San Antonio", "San Isidro", "San Juan",
                 "San Marcos de la Sierra", "San Miguel Guancapla", "Santa Lucía", "Yamaranguila",
                 "San Francisco de Opalaca"],
    "Islas de la Bahía": ["Roatán", "Guanaja", "José Santos Guardiola", "Utila"],
    "La Paz": ["La Paz", "Aguanqueterique", "Cabañas", "Cane", "Chinacla", "Guajiquiro", "Lauterique", "Marcala",
               "Mercedes de Oriente", "Opatoro", "San Antonio del Norte", "San José", "San Juan",
               "San Pedro de Tutule", "Santa Ana", "Santa Elena", "Santa María", "Santiago de Puringla", "Yarula"],
    "Lempira": ["Gracias", "Belén", "Candelaria", "Cololaca", "Erandique", "Gualcince", "Guarita", "La Campa",
                "La Iguala", "Las Flores", "La Unión", "La Virtud", "Lepaera", "Mapulaca", "Piraera",
                "San Andrés", "San Francisco", "San Juan Guarita", "San Manuel Colohete", "San Rafael",
                "San Sebastián", "Santa Cruz", "Talgua", "Tambla", "Tomalá", "Valladolid", "Virginia",
                "San Marcos de Caiquín"],
    "Ocotepeque": ["Ocotepeque", "Belén Gualcho", "Concepción", "Dolores Merendón", "Fraternidad",
                   "La Encarnación", "La Labor", "Lucerna", "Mercedes", "San Fernando", "San Francisco del Valle",
                   "San Jorge", "San Marcos", "Santa Fe", "Sensenti", "Sinuapa"],
    "Olancho": ["Juticalpa", "Campamento", "Catacamas", "Concordia", "Dulce Nombre de Culmí", "El Rosario",
                "Esquipulas del Norte", "Gualaco", "Guarizama", "Guata", "Guayape", "Jano", "La Unión",
                "Mangulile", "Manto", "Salamá", "San Esteban", "San Francisco de Becerra",
                "San Francisco de la Paz", "Santa María del Real", "Silca", "Yocón", "Patuca"],
    "Santa Bárbara": ["Santa Bárbara", "Arada", "Atima", "Azacualpa", "Ceguaca", "Concepción del Norte",
                      "Concepción del Sur", "Chinda", "El Níspero", "Gualala", "Ilama", "Las Vegas", "Macuelizo",
                      "Naranjito", "Nuevo Celilac", "Nueva Frontera", "Petoa", "Protección", "Quimistán",
                      "San Francisco de Ojuera", "San José de las Colinas", "San Luis", "San Marcos",
                      "San Nicolás", "San Pedro Zacapa", "San Vicente Centenario", "Santa Rita", "Trinidad"],
    "Valle": ["Nacaome", "Alianza", "Amapala", "Aramecina", "Caridad", "Goascorán", "Langue",
              "San Francisco de Coray", "San Lorenzo"],
    "Yoro": ["Yoro", "Arenal", "El Negrito", "El Progreso", "Jocón", "Morazán", "Olanchito", "Santa Rita",
             "Sulaco", "Victoria", "Yorito"],
}

ESPERADO = {
    "Atlántida": 8, "Choluteca": 16, "Colón": 10, "Comayagua": 21, "Copán": 23, "Cortés": 12,
    "El Paraíso": 19, "Francisco Morazán": 28, "Gracias a Dios": 6, "Intibucá": 17, "Islas de la Bahía": 4,
    "La Paz": 19, "Lempira": 28, "Ocotepeque": 16, "Olancho": 23, "Santa Bárbara": 28, "Valle": 9, "Yoro": 11,
}

# Oficinas de Hábitat (plan Task 11, Step 5): deben existir tal cual.
OFICINAS = [
    ("Copán", "Santa Rosa de Copán"), ("Cortés", "San Pedro Sula"), ("Comayagua", "Siguatepeque"),
    ("Francisco Morazán", "Distrito Central"), ("Cortés", "Santa Cruz de Yojoa"), ("Colón", "Tocoa"),
    ("Atlántida", "La Ceiba"),
]


def validar() -> list[tuple[str, str]]:
    filas: list[tuple[str, str]] = []
    assert set(DATOS) == set(ESPERADO), "departamentos distintos"
    assert len(DATOS) == 18
    for dep, muns in DATOS.items():
        assert len(muns) == ESPERADO[dep], f"{dep}: {len(muns)} != {ESPERADO[dep]}"
        assert len(set(muns)) == len(muns), f"{dep}: municipio repetido"
        for nombre in [dep, *muns]:
            assert nombre == nombre.strip() and "  " not in nombre, f"espacios: {nombre!r}"
            assert unicodedata.normalize("NFC", nombre) == nombre, f"no NFC: {nombre!r}"
            assert "(" not in nombre and "," not in nombre and "'" not in nombre, f"carácter raro: {nombre!r}"
        filas.extend((dep, m) for m in muns)
    assert len(filas) == 298, len(filas)
    for dep, mun in OFICINAS:
        assert mun in DATOS[dep], f"oficina sin municipio: {dep}/{mun}"
    return filas


def main() -> None:
    salida = Path(sys.argv[1])
    salida.mkdir(parents=True, exist_ok=True)
    filas = validar()

    csv = ["departamento,municipio", *(f"{d},{m}" for d, m in filas)]
    (salida / "geografia-honduras.csv").write_text("\n".join(csv) + "\n", encoding="utf-8", newline="\n")

    deps = ",\n    ".join(f"('{d}')" for d in DATOS)
    muns = ",\n    ".join(f"('{d}', '{m}')" for d, m in filas)
    sql = f"""-- Hábitat · Fase 0 · 0.3 — Geografía de Honduras (18 departamentos, 298 municipios)
-- Fuente: Wikipedia «Anexo:Municipios de Honduras» (referencia AMHON), mismo
-- contenido que geografia-honduras.csv. Generado por generar-geografia.py.
-- La geografía es COMPARTIDA por todas las empresas (sin tenant_id).
-- Equivale a admin_geografia_importar, que no corre desde el editor SQL
-- (exige sesión de plataforma). Idempotente: se puede correr dos veces.
-- Todo va en una transacción: si al final los 18 departamentos no tienen
-- exactamente 298 municipios (p. ej. un departamento homónimo de otro país
-- ya existía con municipios propios), se aborta y no queda nada escrito.

begin;

insert into public.departamento (nombre)
select v.nombre
  from (values
    {deps}
  ) as v(nombre)
on conflict (nombre) do nothing;

insert into public.municipio (departamento_id, nombre)
select d.id, v.municipio
  from (values
    {muns}
  ) as v(departamento, municipio)
  join public.departamento d on d.nombre = v.departamento
on conflict (departamento_id, nombre) do nothing;

do $$
declare
  v_deps int;
  v_muns int;
begin
  select count(*) into v_deps from public.departamento
   where nombre in ({", ".join(f"'{d}'" for d in DATOS)});
  select count(*) into v_muns from public.municipio m
    join public.departamento d on d.id = m.departamento_id
   where d.nombre in ({", ".join(f"'{d}'" for d in DATOS)});
  if v_deps <> 18 or v_muns <> 298 then
    raise exception 'Geografía incompleta: % departamentos, % municipios (se esperaban 18 y 298)', v_deps, v_muns;
  end if;
  perform public.registrar_auditoria(null, 'municipio', 'import-honduras', 'insert',
    jsonb_build_object('fuente', 'docs/ops/habitat/geografia-honduras.csv', 'departamentos', v_deps, 'municipios', v_muns));
end $$;

commit;
"""
    (salida / "01-geografia.sql").write_text(sql, encoding="utf-8", newline="\n")
    print(f"OK: {len(DATOS)} departamentos, {len(filas)} municipios")


if __name__ == "__main__":
    main()
