"""Catalogo inicial de entidades y tramites + datos de ejemplo.

Los plazos son REFERENCIALES: se deben validar en la fase de diagnostico normativo
y se pueden editar desde la pestana Catalogo de la plataforma.
"""
import datetime as dt
import hashlib

# (sigla, nombre, tipo, departamentos)
ENTIDADES = [
    # --- Corporaciones Autonomas Regionales y de Desarrollo Sostenible ---
    ("CAR", "Corporación Autónoma Regional de Cundinamarca", "CAR", "Cundinamarca,Bogotá D.C.,Boyacá"),
    ("CORPOBOYACÁ", "Corporación Autónoma Regional de Boyacá", "CAR", "Boyacá"),
    ("CORPOCHIVOR", "Corporación Autónoma Regional de Chivor", "CAR", "Boyacá"),
    ("CORPOGUAVIO", "Corporación Autónoma Regional del Guavio", "CAR", "Cundinamarca"),
    ("CORPORINOQUIA", "Corporación Autónoma Regional de la Orinoquia", "CAR", "Arauca,Casanare,Vichada,Boyacá,Cundinamarca"),
    ("CORMACARENA", "Corporación para el Desarrollo Sostenible del Área de Manejo Especial La Macarena", "CAR", "Meta"),
    ("CDMB", "Corporación Autónoma Regional para la Defensa de la Meseta de Bucaramanga", "CAR", "Santander"),
    ("CAS", "Corporación Autónoma Regional de Santander", "CAR", "Santander"),
    ("CORPONOR", "Corporación Autónoma Regional de la Frontera Nororiental", "CAR", "Norte de Santander"),
    ("CORANTIOQUIA", "Corporación Autónoma Regional del Centro de Antioquia", "CAR", "Antioquia"),
    ("CORNARE", "Corporación Autónoma Regional de las Cuencas de los Ríos Negro y Nare", "CAR", "Antioquia"),
    ("CORPOURABÁ", "Corporación para el Desarrollo Sostenible del Urabá", "CAR", "Antioquia"),
    ("CORPOCALDAS", "Corporación Autónoma Regional de Caldas", "CAR", "Caldas"),
    ("CARDER", "Corporación Autónoma Regional de Risaralda", "CAR", "Risaralda"),
    ("CRQ", "Corporación Autónoma Regional del Quindío", "CAR", "Quindío"),
    ("CVC", "Corporación Autónoma Regional del Valle del Cauca", "CAR", "Valle del Cauca"),
    ("CORTOLIMA", "Corporación Autónoma Regional del Tolima", "CAR", "Tolima"),
    ("CAM", "Corporación Autónoma Regional del Alto Magdalena", "CAR", "Huila"),
    ("CRC", "Corporación Autónoma Regional del Cauca", "CAR", "Cauca"),
    ("CORPONARIÑO", "Corporación Autónoma Regional de Nariño", "CAR", "Nariño"),
    ("CORPOAMAZONIA", "Corporación para el Desarrollo Sostenible del Sur de la Amazonia", "CAR", "Amazonas,Caquetá,Putumayo"),
    ("CDA", "Corporación para el Desarrollo Sostenible del Norte y el Oriente Amazónico", "CAR", "Guainía,Guaviare,Vaupés"),
    ("CORPOCESAR", "Corporación Autónoma Regional del Cesar", "CAR", "Cesar"),
    ("CORPOGUAJIRA", "Corporación Autónoma Regional de La Guajira", "CAR", "La Guajira"),
    ("CORPAMAG", "Corporación Autónoma Regional del Magdalena", "CAR", "Magdalena"),
    ("CRA", "Corporación Autónoma Regional del Atlántico", "CAR", "Atlántico"),
    ("CARDIQUE", "Corporación Autónoma Regional del Canal del Dique", "CAR", "Bolívar"),
    ("CSB", "Corporación Autónoma Regional del Sur de Bolívar", "CAR", "Bolívar"),
    ("CARSUCRE", "Corporación Autónoma Regional de Sucre", "CAR", "Sucre"),
    ("CORPOMOJANA", "Corporación para el Desarrollo Sostenible de La Mojana y el San Jorge", "CAR", "Sucre"),
    ("CVS", "Corporación Autónoma Regional de los Valles del Sinú y del San Jorge", "CAR", "Córdoba"),
    ("CODECHOCÓ", "Corporación Autónoma Regional para el Desarrollo Sostenible del Chocó", "CAR", "Chocó"),
    ("CORALINA", "Corporación para el Desarrollo Sostenible del Archipiélago de San Andrés, Providencia y Santa Catalina", "CAR", "San Andrés y Providencia"),
    # --- Autoridades ambientales urbanas ---
    ("SDA", "Secretaría Distrital de Ambiente de Bogotá", "Autoridad ambiental urbana", "Bogotá D.C."),
    ("AMVA", "Área Metropolitana del Valle de Aburrá", "Autoridad ambiental urbana", "Antioquia"),
    ("AMB", "Área Metropolitana de Bucaramanga", "Autoridad ambiental urbana", "Santander"),
    ("DAGMA", "Departamento Administrativo de Gestión del Medio Ambiente de Cali", "Autoridad ambiental urbana", "Valle del Cauca"),
    ("EPA CARTAGENA", "Establecimiento Público Ambiental de Cartagena", "Autoridad ambiental urbana", "Bolívar"),
    ("BARRANQUILLA VERDE", "Establecimiento Público Ambiental Barranquilla Verde", "Autoridad ambiental urbana", "Atlántico"),
    ("DADSA", "Departamento Administrativo Distrital de Sostenibilidad Ambiental de Santa Marta", "Autoridad ambiental urbana", "Magdalena"),
    # --- Entidades nacionales ---
    ("ANLA", "Autoridad Nacional de Licencias Ambientales", "Nacional", ""),
    ("ANM", "Agencia Nacional de Minería", "Nacional", ""),
    ("ANH", "Agencia Nacional de Hidrocarburos", "Nacional", ""),
    ("ICANH", "Instituto Colombiano de Antropología e Historia", "Nacional", ""),
    ("PNN", "Parques Nacionales Naturales de Colombia", "Nacional", ""),
    ("URT", "Unidad de Restitución de Tierras", "Nacional", ""),
    ("DANCP", "Ministerio del Interior – Dirección de la Autoridad Nacional de Consulta Previa", "Nacional", ""),
    ("ANT", "Agencia Nacional de Tierras", "Nacional", ""),
    ("IGAC", "Instituto Geográfico Agustín Codazzi", "Nacional", ""),
    ("MINAMBIENTE", "Ministerio de Ambiente – Dirección de Bosques (reservas forestales)", "Nacional", ""),
    ("AEROCIVIL", "Aeronáutica Civil", "Nacional", ""),
    ("ANI", "Agencia Nacional de Infraestructura", "Nacional", ""),
    ("INVIAS", "Instituto Nacional de Vías", "Nacional", ""),
    ("ORIP", "Oficina de Registro de Instrumentos Públicos (SNR)", "Nacional", ""),
    ("SSPD", "Superintendencia de Servicios Públicos Domiciliarios", "Nacional", ""),
    ("MINCULTURA", "Ministerio de las Culturas, las Artes y los Saberes", "Nacional", ""),
    # --- Sector electrico ---
    ("UPME", "Unidad de Planeación Minero Energética", "Sector eléctrico", ""),
    ("XM", "XM – Administrador del Sistema de Intercambios Comerciales (ASIC)", "Sector eléctrico", ""),
    ("MINENERGÍA", "Ministerio de Minas y Energía", "Sector eléctrico", ""),
    # --- Operadores de red ---
    ("EBSA", "Empresa de Energía de Boyacá", "Operador de red", "Boyacá"),
    ("ESSA", "Electrificadora de Santander", "Operador de red", "Santander"),
    ("ENEL", "Enel Colombia", "Operador de red", "Bogotá D.C.,Cundinamarca"),
    ("EPM", "Empresas Públicas de Medellín", "Operador de red", "Antioquia"),
    ("CENS", "Centrales Eléctricas del Norte de Santander", "Operador de red", "Norte de Santander"),
    ("CHEC", "Central Hidroeléctrica de Caldas", "Operador de red", "Caldas,Risaralda"),
    ("EDEQ", "Empresa de Energía del Quindío", "Operador de red", "Quindío"),
    ("ENERGÍA DE PEREIRA", "Empresa de Energía de Pereira", "Operador de red", "Risaralda"),
    ("CELSIA", "Celsia Colombia", "Operador de red", "Valle del Cauca,Tolima"),
    ("EMCALI", "Empresas Municipales de Cali", "Operador de red", "Valle del Cauca"),
    ("EMCARTAGO", "Empresas Municipales de Cartago", "Operador de red", "Valle del Cauca"),
    ("AIR-E", "Air-e", "Operador de red", "Atlántico,Magdalena,La Guajira"),
    ("AFINIA", "Afinia (Grupo EPM)", "Operador de red", "Bolívar,Cesar,Córdoba,Sucre"),
    ("ELECTROHUILA", "Electrificadora del Huila", "Operador de red", "Huila"),
    ("EMSA", "Electrificadora del Meta", "Operador de red", "Meta"),
    ("ENERCA", "Empresa de Energía de Casanare", "Operador de red", "Casanare"),
    ("ENELAR", "Empresa de Energía de Arauca", "Operador de red", "Arauca"),
    ("ELECTROCAQUETÁ", "Electrificadora del Caquetá", "Operador de red", "Caquetá"),
    ("CEDENAR", "Centrales Eléctricas de Nariño", "Operador de red", "Nariño"),
    ("CEO", "Compañía Energética de Occidente", "Operador de red", "Cauca"),
    ("DISPAC", "Distribuidora del Pacífico", "Operador de red", "Chocó"),
    ("EEBP", "Empresa de Energía del Bajo Putumayo", "Operador de red", "Putumayo"),
    ("ENERGUAVIARE", "Empresa de Energía del Guaviare", "Operador de red", "Guaviare"),
    ("RUITOQUE", "Ruitoque E.S.P.", "Operador de red", "Santander"),
    ("CETSA", "Compañía de Electricidad de Tuluá (Celsia)", "Operador de red", "Valle del Cauca"),
    ("EEPUTUMAYO", "Empresa de Energía del Putumayo", "Operador de red", "Putumayo"),
    ("EMEVASI", "Empresa de Energía del Valle de Sibundoy", "Operador de red", "Putumayo"),
    ("SOPESA", "Sociedad Productora de Energía de San Andrés y Providencia", "Operador de red", "San Andrés y Providencia"),
    # --- Terceros: hidrocarburos, ductos, transmision, mineria ---
    ("ECOPETROL", "Ecopetrol S.A.", "Operador hidrocarburos", ""),
    ("HOCOL", "Hocol S.A.", "Operador hidrocarburos", ""),
    ("PAREX", "Parex Resources", "Operador hidrocarburos", ""),
    ("GEOPARK", "GeoPark Colombia", "Operador hidrocarburos", ""),
    ("FRONTERA", "Frontera Energy", "Operador hidrocarburos", ""),
    ("GRAN TIERRA", "Gran Tierra Energy", "Operador hidrocarburos", ""),
    ("CANACOL", "Canacol Energy", "Operador hidrocarburos", ""),
    ("CENIT", "Cenit Transporte y Logística de Hidrocarburos", "Transporte de hidrocarburos", ""),
    ("OCENSA", "Oleoducto Central S.A.", "Transporte de hidrocarburos", ""),
    ("ODL", "Oleoducto de los Llanos Orientales", "Transporte de hidrocarburos", ""),
    ("BICENTENARIO", "Oleoducto Bicentenario de Colombia", "Transporte de hidrocarburos", ""),
    ("TGI", "Transportadora de Gas Internacional", "Transporte de hidrocarburos", ""),
    ("PROMIGAS", "Promigas", "Transporte de hidrocarburos", ""),
    ("INTERCOLOMBIA", "ISA InterColombia", "Transmisor", ""),
    ("GEB", "Grupo Energía Bogotá – Transmisión", "Transmisor", ""),
    ("TITULAR MINERO", "Titular minero (concesionario) – registrar nombre en notas", "Titular minero", ""),
    ("SOLCOR", "SOLCOR Colombia – equipo de desarrollo (entregables internos y de consultores)", "Interno", ""),
]

# (codigo, nombre, entidad_tipo, entidad_sigla, area, plazo, tipo_plazo, base_legal, figuras, base, motivo)
# area: Solapamientos / Jurídico / Conexión / Ingeniería / Predial  -> etapa Factibilidad
#       Licenciamiento                                           -> etapa Licenciamiento
# Factibilidad y Licenciamiento avanzan en paralelo; el proyecto es RTB cuando ambas están completas.
# entidad_tipo especial: CAR / Operador de red / Municipal -> se asigna la del proyecto.
H = "hábiles"
L1755 = "Ley 1755/2015 art. 14 (petición general 15 d.h.; información 10 d.h.)"
SOL, JUR, CON, ING, PRE, SOC, LIC = "Solapamientos", "Jurídico", "Conexión", "Ingeniería", "Predial", "Social", "Licenciamiento"
AREAS = [SOL, JUR, CON, ING, PRE, SOC, LIC]
INT = "Entregable interno"
CATALOGO = [
    # ---- Factibilidad · Solapamientos (consultas externas) ----
    ("COEX-ANLA", "Consulta de traslape con proyectos licenciados o en trámite", "Nacional", "ANLA", SOL, 15, H, L1755, "*", 1, ""),
    ("COEX-ANM", "Consulta de traslape con títulos y solicitudes mineras", "Nacional", "ANM", SOL, 15, H, L1755, "*", 1, ""),
    ("COEX-ANH", "Consulta de traslape con áreas de exploración y explotación de hidrocarburos", "Nacional", "ANH", SOL, 15, H, L1755, "*", 1, ""),
    ("COEX-PNN", "Consulta de traslape con áreas protegidas (SINAP/RUNAP)", "Nacional", "PNN", SOL, 15, H, L1755, "*", 1, ""),
    ("COEX-URT", "Consulta de predios en proceso de restitución de tierras", "Nacional", "URT", SOL, 15, H, L1755, "*", 1, ""),
    ("COEX-ANT", "Consulta de naturaleza jurídica del predio (baldíos, resguardos, ZRC)", "Nacional", "ANT", SOL, 15, H, L1755, "*", 1, ""),
    ("COEX-DANCP", "Certificación de procedencia y oportunidad de consulta previa", "Nacional", "DANCP", SOL, 15, H, "Decreto 2353/2019 (plazo referencial – validar)", "*", 1, ""),
    ("COEX-ICANH", "Consulta de potencial arqueológico del área", "Nacional", "ICANH", SOL, 15, H, L1755 + "; Decreto 138/2019", "*", 1, ""),
    ("COEX-CAR", "Consulta de determinantes ambientales y áreas protegidas regionales", "CAR", "", SOL, 15, H, L1755, "*", 1, ""),
    ("COEX-MADS", "Consulta de traslape con reservas forestales y áreas de MinAmbiente", "Nacional", "MINAMBIENTE", SOL, 15, H, L1755, "*", 0, "Verificación de reserva forestal (Ley 2ª) y áreas de MinAmbiente"),
    ("COEX-MINCULT", "Consulta de bienes de interés cultural", "Nacional", "MINCULTURA", SOL, 15, H, L1755, "*", 0, "Verificación de patrimonio cultural"),
    ("COEX-INVIAS", "Consulta de fajas de retiro y vías nacionales", "Nacional", "INVIAS", SOL, 15, H, L1755, "*", 0, "Predio o trazado cerca de una vía nacional"),
    # ---- Factibilidad · Jurídico ----
    ("JUR-CONTRATO", "Contrato de arrendamiento firmado", "Interno", "SOLCOR", JUR, None, H, INT, "*", 1, ""),
    ("JUR-TITULOS", "Estudio de títulos", "Interno", "SOLCOR", JUR, None, H, INT, "*", 1, ""),
    ("CE-REG", "Constitución y registro de la comunidad energética", "Sector eléctrico", "MINENERGÍA", JUR, None, H, "Decreto 2236/2023, CREG 101 072/2025", "CE", 1, ""),
    # ---- Factibilidad · Conexión ----
    ("OR-DISP", "Solicitud de insumos al operador de red", "Operador de red", "", CON, 15, H, "CREG 174/2021 – Ley 1755/2015 (validar)", "*", 1, ""),
    ("OR-SOL", "Radicación y aprobación del estudio de conexión (ECS)", "Operador de red", "", CON, 15, H, "CREG 174/2021, CREG 075/2021 (plazo referencial – validar)", "*", 1, ""),
    ("OR-FPO", "Fecha de puesta en operación (FPO) asignada", "Operador de red", "", CON, None, H, "Concepto de aprobación del OR", "*", 1, ""),
    ("OR-APR", "Contrato de conexión con el operador de red", "Operador de red", "", CON, None, H, "CREG 174/2021 (definir plazo)", "*", 1, ""),
    ("UPME-CON", "Concepto de conexión de la UPME (≥ 5 MW o STR/STN)", "Sector eléctrico", "UPME", CON, None, H, "CREG 075/2021, CREG 101 099/2026 – ventanas de enero y mayo", "AGR,PMR", 0, "Proyecto ≥ 5 MW o conexión al STR/STN"),
    ("OR-RESP", "Contrato de respaldo (≥ 100 kW)", "Operador de red", "", CON, None, H, "CREG 101 099/2026", "AGR,PMR", 1, ""),
    ("XM-FRT", "Registro de la frontera comercial ante el ASIC", "Sector eléctrico", "XM", CON, None, H, "CREG 101 099/2026", "AGR,PMR", 1, ""),
    # ---- Factibilidad · Ingeniería ----
    ("ING-LAYOUT", "Layout preliminar", "Interno", "SOLCOR", ING, None, H, INT, "*", 1, ""),
    ("ING-BASICA", "Diseño de ingeniería básica", "Interno", "SOLCOR", ING, None, H, INT, "*", 1, ""),
    ("ING-AUTOCAD", "Layout en AutoCAD", "Interno", "SOLCOR", ING, None, H, INT, "*", 1, ""),
    ("ING-PVSYST", "Simulación PVsyst (última versión)", "Interno", "SOLCOR", ING, None, H, INT, "*", 1, ""),
    # ---- Factibilidad · Predial (estudios del predio) ----
    ("PRE-TOPO", "Levantamiento topográfico", "Interno", "SOLCOR", PRE, None, H, INT, "*", 1, ""),
    ("PRE-HIDRO", "Estudio hidrológico e hidrográfico", "Interno", "SOLCOR", PRE, None, H, INT, "*", 1, ""),
    ("PRE-PULL", "Pruebas de pull-out", "Interno", "SOLCOR", PRE, None, H, INT, "*", 1, ""),
    # ---- Factibilidad · Social ----
    ("SOC-SEG", "Estudio de seguridad", "Interno", "SOLCOR", SOC, None, H, INT, "*", 1, ""),
    ("SOC-SOCIAL", "Estudio social", "Interno", "SOLCOR", SOC, None, H, INT, "*", 1, ""),
    # ---- Licenciamiento (en paralelo con Factibilidad) ----
    ("MUN-USO", "Certificado de uso del suelo", "Municipal", "", LIC, 15, H, L1755, "*", 1, ""),
    ("MUN-LIC-CER", "Licencia de construcción para cerramiento", "Municipal", "", LIC, 45, H, "Decreto 1077/2015 art. 2.2.6.1.2.3.5", "*", 1, ""),
    ("MUN-LIC-BAS", "Licencia de construcción para bases (cimentaciones de las estructuras)", "Municipal", "", LIC, 45, H, "Decreto 1077/2015 art. 2.2.6.1.2.3.5", "*", 1, ""),
    ("UPME-INC", "Certificación de incentivos tributarios (Ley 1715)", "Sector eléctrico", "UPME", LIC, None, H, "Ley 1715/2014, Ley 2099/2021 (definir plazo)", "*", 1, ""),
    ("CAR-FOR", "Permiso de aprovechamiento forestal", "CAR", "", LIC, None, H, "Decreto 1076/2015 (definir plazo)", "*", 0, "Cobertura arbórea a intervenir"),
    ("CAR-CAUCE", "Permiso de ocupación de cauce", "CAR", "", LIC, None, H, "Decreto 1076/2015 (definir plazo)", "*", 0, "Cuerpos de agua o rondas en el predio o el trazado"),
    ("CAR-VEDA", "Medidas de manejo de especies en veda", "CAR", "", LIC, None, H, "Decreto 2106/2019 art. 125 (definir plazo)", "*", 0, "Especies en veda (epífitas, helechos, etc.)"),
    ("ICANH-PAP", "Registro del Programa de Arqueología Preventiva", "Nacional", "ICANH", LIC, None, H, "Decreto 138/2019 (definir plazo)", "*", 0, "Requerido por potencial arqueológico"),
    ("ADD-ARQ", "Autorización de intervención arqueológica", "Nacional", "ICANH", LIC, None, H, "Decreto 138/2019 (definir plazo)", "*", 0, "Hallazgo arqueológico"),
    ("ADD-RF", "Solicitud de sustracción de reserva forestal", "Nacional", "MINAMBIENTE", LIC, None, H, "Ley 2ª/1959; Res. MinAmbiente vigente (definir plazo)", "*", 0, "Predio dentro de una reserva forestal"),
    ("ADD-VIA", "Permiso de ocupación o cruce de vía nacional", "Nacional", "", LIC, None, H, "Ley 1228/2008 (definir plazo)", "*", 0, "Red de media tensión o acceso sobre una vía nacional (ANI / INVIAS)"),
    # ---- Solapamientos · consultas adicionales (se activan por hallazgos) ----
    ("ADD-HC", "Consulta de coexistencia con el operador del bloque de hidrocarburos", "Operador hidrocarburos", "", SOL, None, H, "Sin plazo legal (tercero privado)", "*", 0, "Solapamiento con área de exploración o explotación (respuesta ANH)"),
    ("ADD-DUCTO", "Consulta de cruce o proximidad con ducto (derecho de vía)", "Transporte de hidrocarburos", "", SOL, None, H, "Sin plazo legal (tercero privado)", "*", 0, "Oleoducto o gasoducto en el predio o colindante"),
    ("ADD-MIN", "Consulta de coexistencia con el titular minero", "Titular minero", "TITULAR MINERO", SOL, None, H, "Sin plazo legal (tercero privado)", "*", 0, "Solapamiento con título minero (respuesta ANM)"),
    ("ADD-PNN-ZA", "Concepto por zona de amortiguación de área protegida", "Nacional", "PNN", SOL, 15, H, L1755, "*", 0, "Colindancia o zona de amortiguación de un área protegida"),
    ("ADD-CP", "Proceso de consulta previa", "Nacional", "DANCP", SOL, None, H, "Convenio 169 OIT; Decreto 1066/2015", "*", 0, "Procede consulta previa (comunidades étnicas)"),
    ("ADD-AERO", "Concepto de altura y reflectividad cerca de aeródromo", "Nacional", "AEROCIVIL", SOL, None, H, "RAC 14 (definir plazo)", "*", 0, "Cercanía a un aeródromo o helipuerto"),
    ("ADD-LT", "Consulta de servidumbre o cruce con línea de transmisión", "Transmisor", "", SOL, None, H, "Sin plazo legal (tercero)", "*", 0, "Línea de alta tensión en el predio o el trazado"),
    ("ADD-URT", "Seguimiento a proceso de restitución sobre el predio", "Nacional", "URT", SOL, 15, H, L1755, "*", 0, "Predio en zona microfocalizada o con solicitud de restitución"),
]


def etapa_de(area):
    return "Licenciamiento" if area == LIC else "Factibilidad"


def clase_de(c):
    return "entregable" if c[2] == "Interno" or c[0] == "OR-FPO" else "consulta"


def seed_catalog(con):
    """Inserta solo las entidades / tipos de tramite que aun no existen (por sigla / codigo)."""
    have_e = {r[0] for r in con.execute("SELECT sigla FROM entidades")}
    for sigla, nombre, tipo, deps in ENTIDADES:
        if sigla not in have_e:
            con.execute("INSERT INTO entidades (sigla,nombre,tipo,departamentos) VALUES (?,?,?,?)",
                        (sigla, nombre, tipo, deps))
    have_c = {r[0] for r in con.execute("SELECT codigo FROM catalogo")}
    for i, c in enumerate(CATALOGO):
        if c[0] not in have_c:
            con.execute("""INSERT INTO catalogo (codigo,nombre,entidad_tipo,entidad_sigla,area,plazo_dias,tipo_plazo,
                           base_legal,figuras,base,motivo,orden,etapa,clase) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (*c, i, etapa_de(c[4]), clase_de(c)))


def sync_catalog(con):
    """Migracion v3: alinea nombre, area, etapa, clase y orden de los tipos de tramite existentes."""
    for i, c in enumerate(CATALOGO):
        con.execute("""UPDATE catalogo SET nombre=?, entidad_tipo=?, entidad_sigla=?, area=?, etapa=?, clase=?, orden=?,
                       figuras=?, base=? WHERE codigo=?""",
                    (c[1], c[2], c[3], c[4], etapa_de(c[4]), clase_de(c), i, c[8], c[9], c[0]))


# ------------------------------------------------------------------ demo
# Velocidad tipica (dias calendario) por entidad para generar datos de ejemplo
SPEED = {"ANLA": 24, "ANM": 19, "ANH": 17, "PNN": 33, "URT": 21, "ANT": 52, "DANCP": 38, "ICANH": 27,
         "CORPOBOYACÁ": 41, "CDMB": 26, "CAR": 63, "CORMACARENA": 48,
         "EBSA": 22, "ESSA": 31, "ENEL": 58, "EMSA": 36, "MUN": 29, "ECOPETROL": 45, "CENIT": 34,
         "TITULAR MINERO": 40, "UPME": 60, "MINENERGÍA": 40, "XM": 15}

DEMO = [
    # nombre, codigo, figura, kw, depto, municipio, predio, lat, lon, car, or, contrato, etapa_max, extras
    ("GD Duitama – San Lorenzo", "GD-BOY-001", "GD", 990, "Boyacá", "Duitama", "San Lorenzo", 5.8267, -73.0338,
     "CORPOBOYACÁ", "EBSA", "2025-11-05", 2, {"ANM": "Con condiciones"}),
    ("GD Sogamoso – La Esperanza", "GD-BOY-002", "GD", 990, "Boyacá", "Sogamoso", "La Esperanza", 5.7145, -72.9339,
     "CORPOBOYACÁ", "EBSA", "2026-02-10", 1, {}),
    ("GD Piedecuesta – El Mirador", "GD-SAN-001", "GD", 990, "Santander", "Piedecuesta", "El Mirador", 6.9879, -73.0498,
     "CDMB", "ESSA", "2026-03-02", 0, {"ANH": "Con condiciones", "DUCTO": True}),
    ("AGR Tocancipá – Planta industrial", "AGR-CUN-001", "AGR", 4500, "Cundinamarca", "Tocancipá", "Lote Industrial 3", 4.9650, -73.9130,
     "CAR", "ENEL", "2026-04-15", 0, {}),
    ("CE Villavicencio – Vereda Apiay", "CE-MET-001", "CE", 500, "Meta", "Villavicencio", "Vereda Apiay", 4.0760, -73.5640,
     "CORMACARENA", "EMSA", "2026-05-20", 0, {"ANH": "Con condiciones"}),
]
ETAPAS = ["Factibilidad", "Licenciamiento"]


def _jit(key, lo=0.75, hi=1.35):
    h = int(hashlib.md5(key.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
    return lo + (hi - lo) * h


def load_demo(con):
    today = dt.date.today()
    ent = {r["sigla"]: r["id"] for r in con.execute("SELECT id, sigla FROM entidades")}
    cat = [dict(r) for r in con.execute("SELECT * FROM catalogo ORDER BY orden")]

    def d(x):
        return x.isoformat()

    for (nombre, codigo, fig, kw, dep, mun, predio, lat, lon, car, orr, contrato, emax, extras) in DEMO:
        msig = f"Alcaldía {mun}"
        if msig not in ent:
            cur = con.execute("INSERT INTO entidades (sigla,nombre,tipo,departamentos) VALUES (?,?,?,?)",
                              (msig, f"Alcaldía de {mun} – Secretaría de Planeación", "Municipal", dep))
            ent[msig] = cur.lastrowid
        cur = con.execute(
            """INSERT INTO proyectos (codigo,nombre,figura,capacidad_kw,departamento,municipio,predio,lat,lon,
               car_id,or_id,mun_id,fecha_contrato,etapa,rtb_objetivo,estado,responsable,demo)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)""",
            (codigo, nombre, fig, kw, dep, mun, predio, lat, lon, ent[car], ent[orr], ent[msig], contrato,
             "Desarrollo", d(dt.date.fromisoformat(contrato) + dt.timedelta(days=330)), "Activo", "Desarrollo GD"))
        pid = cur.lastrowid

        items = []
        for c in cat:
            figs = c["figuras"]
            if not c["base"] or (figs != "*" and fig not in figs.split(",")):
                continue
            items.append((c, None, ""))
        if "ANH" in extras:
            items.append((next(c for c in cat if c["codigo"] == "ADD-HC"), "ECOPETROL",
                          "Solapamiento con área de exploración/explotación (respuesta ANH)"))
        if extras.get("DUCTO"):
            items.append((next(c for c in cat if c["codigo"] == "ADD-DUCTO"), "CENIT",
                          "Oleoducto / gasoducto en el predio o colindante"))
        if "ANM" in extras:
            items.append((next(c for c in cat if c["codigo"] == "ADD-MIN"), "TITULAR MINERO",
                          "Solapamiento con título minero (respuesta ANM)"))

        # Factibilidad y Licenciamiento avanzan en paralelo desde la firma del contrato
        for si, etapa in enumerate(ETAPAS):
            stage_start = dt.date.fromisoformat(contrato) + dt.timedelta(days=7 + 20 * si)
            for c, forced, motivo in [x for x in items if x[0]["etapa"] == etapa]:
                if forced:
                    sig = forced
                elif c["entidad_tipo"] == "CAR":
                    sig = car
                elif c["entidad_tipo"] == "Operador de red":
                    sig = orr
                elif c["entidad_tipo"] == "Municipal":
                    sig = msig
                else:
                    sig = c["entidad_sigla"]
                speed = SPEED.get("MUN" if sig == msig else sig, 30)
                key = codigo + c["codigo"]
                rad = stage_start + dt.timedelta(days=int(5 * _jit(key + "r", 0, 1)) + (25 if forced else 0))
                resp = rad + dt.timedelta(days=int(speed * _jit(key)))
                req = c["entidad_tipo"] in ("CAR", "Operador de red") and _jit(key + "q", 0, 1) > 0.5
                if req:
                    resp += dt.timedelta(days=14)
                t = dict(proyecto_id=pid, catalogo_id=c["id"], entidad_id=ent[sig], nombre=c["nombre"],
                         etapa=etapa, area=c["area"], adicional=0 if c["base"] else 1, motivo=motivo,
                         plazo_dias=c["plazo_dias"], tipo_plazo=c["tipo_plazo"], estado="Por radicar",
                         resultado="", radicado_num="", fecha_radicado=None, fecha_respuesta=None)
                evs = []
                if c["clase"] == "entregable":
                    if si <= emax and resp <= today and _jit(key + "e", 0, 1) > 0.4:
                        t.update(estado="Respondido", fecha_respuesta=d(resp))
                        evs.append((d(resp), "Entrega", "Entregable completado"))
                elif si <= emax and rad <= today:
                    t.update(estado="Radicado", fecha_radicado=d(rad),
                             radicado_num=f"{sig[:4].upper()}-2026-{int(_jit(key + 'n', 1000, 9999))}")
                    evs.append((d(rad), "Radicado", "Radicación de la solicitud"))
                    if req:
                        r1 = rad + dt.timedelta(days=12)
                        if r1 <= today:
                            evs.append((d(r1), "Requerimiento de la entidad", "Solicitan información adicional"))
                            t["estado"] = "Requerimiento"
                            r2 = r1 + dt.timedelta(days=9)
                            if r2 <= today:
                                evs.append((d(r2), "Respuesta a requerimiento", "Se entrega información"))
                                t["estado"] = "Radicado"
                    if resp <= today:
                        res = "Favorable"
                        for k, v in extras.items():
                            if k in c["codigo"] and isinstance(v, str):
                                res = v
                        t.update(estado="Respondido", fecha_respuesta=d(resp), resultado=res)
                        evs.append((d(resp), "Respuesta de la entidad", f"Resultado: {res}"))
                cols = list(t)
                cur = con.execute(f"INSERT INTO tramites ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})",
                                  [t[k] for k in cols])
                for f, tp, desc in evs:
                    con.execute("INSERT INTO eventos (tramite_id,fecha,tipo,descripcion) VALUES (?,?,?,?)",
                                (cur.lastrowid, f, tp, desc))
