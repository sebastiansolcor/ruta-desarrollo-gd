"""Sincronizacion con la carpeta del Pipeline en SharePoint (sincronizada con OneDrive).

Lee la estructura estandar de carpetas de cada proyecto y propone / aplica:
  - proyectos (uno por cada GD dentro de 4 Conexion/ECS; varios GD pueden compartir carpeta y predio)
  - radicados de consultas (2 Consultas/Cartas solicitud...)
  - respuestas, requerimientos y resultado (2 Consultas/Respuesta..., leyendo el PDF)
  - tramites ante el OR por GD (solicitud de insumos, insumos recibidos, ECS radicado)
  - fecha de firma del contrato (3 Juridico/Contrato...)
"""
import datetime as dt
import hashlib
import json
import os
import re
import unicodedata

try:
    import pypdf
except ImportError:  # pragma: no cover
    pypdf = None

DEFAULT_ROOT = os.path.join(os.path.expanduser("~"), "Solcor Colombia S.A.S",
                            "Solcor Colombia S.A.S. - Desarrollo GD", "01 Pipeline")
CACHE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "pdf_cache.json")

MESES = {"ene": 1, "jan": 1, "feb": 2, "mar": 3, "abr": 4, "apr": 4, "may": 5, "jun": 6, "jul": 7,
         "ago": 8, "aug": 8, "sep": 9, "set": 9, "oct": 10, "nov": 11, "dic": 12, "dec": 12}
DEPTOS = ["Amazonas", "Antioquia", "Arauca", "Atlántico", "Bogotá D.C.", "Bolívar", "Boyacá", "Caldas", "Caquetá",
          "Casanare", "Cauca", "Cesar", "Chocó", "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila",
          "La Guajira", "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío", "Risaralda",
          "San Andrés y Providencia", "Santander", "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada"]

# alias en nombres de carpeta/archivo -> sigla de la entidad en la plataforma
ALIAS = [("MIN INTERIOR", "DANCP"), ("MININTERIOR", "DANCP"), ("MININT", "DANCP"), ("DANCP", "DANCP"),
         ("MINCULTURA", "MINCULTURA"), ("MINCULT", "MINCULTURA"), ("MADS", "MINAMBIENTE"),
         ("MINAMBIENTE", "MINAMBIENTE"), ("ANLA", "ANLA"), ("ANH", "ANH"), ("ANM", "ANM"), ("ANT", "ANT"),
         ("URT", "URT"), ("PNN", "PNN"), ("ICANH", "ICANH"), ("IGAC", "IGAC"), ("INVIAS", "INVIAS"),
         ("ANI", "ANI"), ("AEROCIVIL", "AEROCIVIL"), ("UPME", "UPME"), ("ECOPETROL", "ECOPETROL"),
         ("CENIT", "CENIT"), ("OCENSA", "OCENSA"), ("TGI", "TGI")]
CODIGO = {"ANLA": "COEX-ANLA", "ANM": "COEX-ANM", "ANH": "COEX-ANH", "PNN": "COEX-PNN", "URT": "COEX-URT",
          "ANT": "COEX-ANT", "DANCP": "COEX-DANCP", "ICANH": "COEX-ICANH", "MINAMBIENTE": "COEX-MADS",
          "MINCULTURA": "COEX-MINCULT", "INVIAS": "COEX-INVIAS", "ECOPETROL": "ADD-HC", "CENIT": "ADD-DUCTO",
          "OCENSA": "ADD-DUCTO", "TGI": "ADD-DUCTO", "AEROCIVIL": "ADD-AERO"}
SKIP_EXT = {".docx", ".doc", ".zip", ".kmz", ".kml", ".shp", ".shx", ".dbf", ".prj", ".cpg", ".qmd", ".xlsx", ".dxf", ".pptx"}

RE_REQ = re.compile(r"(para poder dar (una )?respuesta de fondo|requiere(mos)? la siguiente informaci|"
                    r"solicita(mos)? (allegar|complementar|remitir|aportar)|se requiere (complementar|allegar|aportar)|"
                    r"informaci[oó]n adicional|subsanar)", re.I)
RE_FAV = re.compile(r"(no se (encuentra|encontr[oó]|evidencia|identific[oó]|registra|presenta|superpone|traslapa)"
                    r"[^.]{0,120}?(dentro|superposici|traslap|ubicad|interferencia|sitio)|no (existe|presenta|hay|se present[oó]) "
                    r"(superposici|traslap|interferencia)|sin superposici|no se encontr[oó] superposici|"
                    r"no requiere|no se requiere)", re.I)
RE_COND = re.compile(r"(se (encuentra|ubica) (ubicad[oa] )?(total o parcialmente )?dentro|presenta (superposici|traslap)|"
                     r"se (superpone|traslapa) (total|parcial)|existe (superposici|traslap)|s[ií] (existe|presenta) traslap|"
                     r"deber[aá] (solicitar|tramitar|adelantar))", re.I)
RE_REMITE = re.compile(r"(lo[s]? invitamos a realizar la consulta|puede(n)? realizar (la|su) consulta|"
                       r"a trav[eé]s del visor geogr[aá]fico|consultar directamente|no es de (su|nuestra) competencia|"
                       r"no (tiene|cuenta con) competencia)", re.I)


# ------------------------------------------------------------------ utilidades
def strip_acc(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def norm(s):
    return re.sub(r"[_\-\.\(\)\[\],]+", " ", strip_acc(s).upper())


def date_from_name(name):
    """YYYYMMDD, DDMMYYYY o YYMMDD al inicio del nombre."""
    m = re.search(r"(?<!\d)(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])", name)
    if m:
        return _mk(int(m[1]), int(m[2]), int(m[3]))
    m = re.search(r"(?<!\d)(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])(20\d{2})(?!\d)", name)
    if m:
        return _mk(int(m[3]), int(m[2]), int(m[1]))
    m = re.match(r"(2\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)", name)
    if m:
        return _mk(2000 + int(m[1]), int(m[2]), int(m[3]))
    return None


def _mk(y, m, d):
    try:
        return dt.date(y, m, d).isoformat()
    except ValueError:
        return None


def date_from_text(txt):
    """Primera fecha del documento (encabezado / fecha de la comunicacion)."""
    t = re.sub(r"Fecha de entrada en\s*operaci[oó]n:\s*\S+", "", txt, flags=re.I)  # formularios EBSA
    cands = []
    for m in re.finditer(r"(?<!\d)(\d{1,2})\s*(?:de\s*)?([A-Za-zÁÉÍÓÚáéíóú]{3,10})\.?\s*(?:de\s*|del\s*)?(20\d{2})", t):
        mes = MESES.get(strip_acc(m[2]).lower()[:3])
        if mes:
            cands.append((m.start(), _mk(int(m[3]), mes, int(m[1]))))
    for m in re.finditer(r"(?<!\d)(\d{1,2})[-/](\d{1,2})[-/](20\d{2})(?!\d)", t):
        cands.append((m.start(), _mk(int(m[3]), int(m[2]), int(m[1]))))
    for m in re.finditer(r"(?<!\d)(\d{2})-([A-Za-z]{3})-(\d{2})(?!\d)", t):
        mes = MESES.get(m[2].lower())
        if mes:
            cands.append((m.start(), _mk(2000 + int(m[3]), mes, int(m[1]))))
    cands = [c for c in cands if c[1]]
    return min(cands)[1] if cands else None


class PdfCache:
    def __init__(self):
        try:
            with open(CACHE_PATH, encoding="utf-8") as f:
                self.data = json.load(f)
        except Exception:  # noqa: BLE001
            self.data = {}
        self.dirty = False

    def text(self, path, pages=3):
        if not pypdf:
            return ""
        st = os.stat(path)
        key = f"{path}|{int(st.st_mtime)}|{st.st_size}|{pages}"
        if key not in self.data:
            try:
                r = pypdf.PdfReader(path)
                txt = "\n".join((p.extract_text() or "") for p in r.pages[:pages])
            except Exception:  # noqa: BLE001
                txt = ""
            self.data[key] = re.sub(r"[ \t]+", " ", txt)
            self.dirty = True
        return self.data[key]

    def save(self):
        if self.dirty:
            os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
            with open(CACHE_PATH, "w", encoding="utf-8") as f:
                json.dump(self.data, f, ensure_ascii=False)
            self.dirty = False


def walk_files(root):
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if not d.startswith((".", "~"))]
        for fn in fns:
            if not fn.startswith(("~$", ".")):
                yield os.path.join(dp, fn)


def find_dir(parent, pattern):
    if not os.path.isdir(parent):
        return None
    for d in sorted(os.listdir(parent)):
        if os.path.isdir(os.path.join(parent, d)) and re.search(pattern, strip_acc(d), re.I):
            return os.path.join(parent, d)
    return None


def match_depto(s):
    k = strip_acc(s or "").lower().strip(" .")
    for d in DEPTOS:
        if strip_acc(d).lower() == k:
            return d
    return (s or "").strip(" .") or None


# ------------------------------------------------------------------ escaneo
class Scanner:
    def __init__(self, entidades):
        self.ent = {e["sigla"]: e for e in entidades}
        self.cars = {norm(e["sigla"]).strip(): e["sigla"] for e in entidades if e["tipo"] in ("CAR", "Autoridad ambiental urbana")}
        self.ors = {norm(e["sigla"]).strip(): e["sigla"] for e in entidades if e["tipo"] == "Operador de red"}
        self.cache = PdfCache()

    def entity_in(self, s):
        n = f" {norm(s)} "
        for k, v in ALIAS:
            if re.search(rf"(?<![A-Z]){re.escape(k)}(?![A-Z])", n):
                return v
        for k, v in self.cars.items():
            if k != "CAR" and re.search(rf"(?<![A-Z]){re.escape(k)}(?![A-Z])", n):
                return v
        if re.search(r"(?<![A-Z])CAR(?![A-Z])", n):
            return "@CAR"
        return None

    def or_in(self, s):
        n = f" {norm(s)} "
        for k, v in self.ors.items():
            if re.search(rf"(?<![A-Z]){re.escape(k)}(?![A-Z])", n):
                return v
        return None

    def file_date(self, path, base, text=None):
        """(fecha, origen): nombre del archivo > carpetas ancestro > texto del PDF > fecha de modificacion."""
        d = date_from_name(os.path.basename(path))
        if d:
            return d, "nombre"
        rel = os.path.relpath(os.path.dirname(path), base)
        for seg in reversed(rel.split(os.sep)):
            d = date_from_name(seg)
            if d:
                return d, "carpeta"
        if text is None and path.lower().endswith(".pdf"):
            text = self.cache.text(path, 1)
        d = date_from_text(text or "")
        if d:
            return d, "pdf"
        return dt.date.fromtimestamp(os.path.getmtime(path)).isoformat(), "modificación"

    # -------------------------------------------------------------- proyecto
    def scan_project(self, folder, etapa_carpeta, root):
        rel_folder = os.path.relpath(folder, root)
        name = os.path.basename(folder)
        m = re.match(r"\s*GD\s*(\d+)\s*(.*)", name, re.I)
        num, resto = (m[1], m[2]) if m else ("", name)
        props, avisos = [], []
        info = {"municipio": None, "departamento": None, "predio": None}

        # ---- sub-proyectos (cada GD dentro de 4 Conexion/ECS)
        conex = find_dir(folder, r"^\d*\s*conexi")
        ecs = find_dir(conex, r"^ECS") if conex else None
        subs = []
        if ecs:
            for d in sorted(os.listdir(ecs)):
                p = os.path.join(ecs, d)
                mm = re.match(r"^(.*?[A-Za-zÁ-ú])\s*(\d{1,2})(?!\d)", d)
                if os.path.isdir(p) and mm and not re.search(r"servicio", d, re.I):
                    subs.append((f"{mm[1].strip()} {mm[2]}", p))
        if not subs:
            subs = [(re.sub(r"\s+y\s+\d+.*$", "", resto).strip() or name, ecs or folder)]

        # ---- contrato firmado
        fecha_contrato, contrato_ev = None, []
        jur = find_dir(folder, r"^\d*\s*jur[ií]dic")
        cont = find_dir(jur, r"contrato") if jur else None
        if cont:
            firmados = [p for p in walk_files(cont) if p.lower().endswith(".pdf") and re.search(r"signed|firmad", os.path.basename(p), re.I)]
            fechas = sorted((d, p) for d, p in ((date_from_name(os.path.basename(p)), p) for p in firmados) if d)
            if fechas:
                fecha_contrato = fechas[0][0]
                contrato_ev = [self._ev("SOLCOR", "Entrega", fechas[0][0], "nombre", fechas[0][1], folder,
                                        "Contrato de arrendamiento firmado", codigo="JUR-CONTRATO",
                                        detalle=f"Firmado el {fechas[0][0]}; {len(fechas)} versión(es) firmada(s)")]

        # ---- consultas compartidas por todos los GD de la carpeta
        shared = self.scan_consultas(folder, info) + contrato_ev
        bases = {re.sub(r"\s*\d+$", "", s).strip() for s, _ in subs if re.search(r"\d+$", s)}
        entregables = self.scan_entregables(folder, bases)
        costos = self.scan_costos(folder)

        car_sig = None
        cons = find_dir(folder, r"^\d*\s*consultas")
        if cons:
            for p in walk_files(cons):
                e = self.entity_in(os.path.basename(p))
                if e and e != "@CAR" and self.ent.get(e, {}).get("tipo") in ("CAR", "Autoridad ambiental urbana"):
                    car_sig = e
                    break

        for i, (sub, sdir) in enumerate(subs, 1):
            sp_ref = f"{rel_folder}#{sub}"
            data = {"nombre": f"GD {sub}" if not sub.upper().startswith("GD") else sub,
                    "codigo": f"GD-{num}-{i}" if num and len(subs) > 1 else (f"GD-{num}" if num else ""),
                    "figura": "GD", "capacidad_kw": 990, "fecha_contrato": fecha_contrato,
                    "car_sigla": car_sig, "or_sigla": None, "lat": None, "lon": None}
            or_events = self.scan_or(sdir, folder, data) if sdir != folder else []
            data.update({k: v for k, v in info.items() if v and not data.get(k)})
            if not data.get("municipio") and data.get("municipio_or"):
                data["municipio"] = data["municipio_or"]
            data.pop("municipio_or", None)
            data["notas"] = f"Sincronizado desde SharePoint: 01 Pipeline\\{rel_folder} ({etapa_carpeta})"
            n_sub = re.search(r"(\d+)$", sub)[1] if re.search(r"(\d+)$", sub) else None
            mine = [ev for ev in entregables if ev.get("_sub") in (None, n_sub)]
            # PVsyst: solo el reporte más reciente que aplique a este GD
            pv = [ev for ev in mine if ev.get("codigo") == "ING-PVSYST"]
            if pv:
                ultimo = max(pv, key=lambda e: (e["fecha"], e["_sub"] is not None, e.get("_mtime", 0)))
                mine = [ev for ev in mine if ev.get("codigo") != "ING-PVSYST"] + [ultimo]
            evs = [dict(ev) for ev in shared + or_events + mine]
            for ev in evs:
                ev.pop("_sub", None)
                ev.pop("_mtime", None)
            # control de coherencia: respuesta anterior al radicado
            for cod in {e.get("codigo") for e in evs if e["kind"] == "evento"}:
                rad = [e for e in evs if e["kind"] == "evento" and e.get("codigo") == cod and e["tipo"] == "Radicado"]
                rsp = [e for e in evs if e["kind"] == "evento" and e.get("codigo") == cod and e["tipo"] != "Radicado"]
                if rad and rsp and min(e["fecha"] for e in rsp) < min(e["fecha"] for e in rad):
                    for e in rad:
                        e["confianza"] = "media"
                        e["nota"] = "La respuesta tiene fecha anterior a este radicado: confirmar la fecha real de radicación"
            props.append({"kind": "proyecto", "sp_ref": sp_ref, "carpeta": rel_folder, "data": data})
            for ev in evs:
                props.append({**ev, "sp_ref": sp_ref})
            # costos de la carpeta: se reparten por igual entre los GD que la comparten
            for c in costos:
                k = len(subs)
                props.append({**c, "sp_ref": sp_ref, "valor": round(c["valor"] / k, 2),
                              "concepto": c["concepto"] + (f" (1/{k} del valor compartido)" if k > 1 else "")})
        # ubicación de cada GD = centro de sus mesas en el layout (más precisa que el punto de la solicitud al OR)
        centros = self.centros_layout(folder)
        for pr in [p for p in props if p["kind"] == "proyecto"]:
            n = re.search(r"(\d+)$", pr["sp_ref"])
            c = centros.get(n[1] if n else None) or (centros.get("1") if len(subs) == 1 and len(centros) == 1 else None)
            if c:
                pr["data"]["lat"], pr["data"]["lon"] = c
                pr["data"]["coord_fuente"] = "layout"
        # GD del mismo predio: completa coordenadas / OR faltantes con los de sus hermanos
        hermanos = [p["data"] for p in props if p["kind"] == "proyecto"]
        for k in ("lat", "lon", "or_sigla"):
            val = next((h[k] for h in hermanos if h.get(k) is not None), None)
            for h in hermanos:
                if h.get(k) is None and val is not None:
                    h[k] = val
        for a in avisos:
            props.append({"kind": "aviso", "sp_ref": f"{rel_folder}#*", "texto": a})
        return props

    # -------------------------------------------------------------- consultas
    def scan_consultas(self, folder, info):
        cons = find_dir(folder, r"^\d*\s*consultas")
        if not cons:
            return []
        out = []
        cartas = find_dir(cons, r"carta|solicitud")
        resp = find_dir(cons, r"^respuesta")
        porent = {}
        if cartas:
            for p in walk_files(cartas):
                fn = os.path.basename(p)
                ext = os.path.splitext(fn)[1].lower()
                if ext in SKIP_EXT or re.match(r"anexo", fn, re.I):
                    continue
                rel = os.path.relpath(p, cartas)
                e = self.entity_in(fn) or self.entity_in(rel.split(os.sep)[0])
                if not e:
                    continue
                porent.setdefault(e, []).append(p)
        for e, files in porent.items():
            proofs, cartas_pdf = [], []
            for p in files:
                fn = os.path.basename(p)
                if re.search(r"respuesta\s*(a\s*)?requerimiento", fn, re.I):
                    d, src = self.file_date(p, folder)
                    out.append(self._ev(e, "Respuesta a requerimiento", d, src, p, folder, "Respuesta de Solcor al requerimiento"))
                elif re.search(r"solicitud|env[ií]o|radicad|pantallazo", fn, re.I) and not re.search(r"carta", fn, re.I):
                    proofs.append(p)
                elif fn.lower().endswith(".pdf"):
                    cartas_pdf.append(p)
                    if not info["municipio"]:
                        self._info_from_text(self.cache.text(p, 1), info)
            base = proofs or cartas_pdf
            if base:
                dated = sorted((self.file_date(p, folder), p) for p in base)
                (d, src), p = dated[0]
                out.append(self._ev(e, "Radicado", d, src, p, folder, "Radicación de la solicitud"))
        if resp:
            for p in walk_files(resp):
                fn = os.path.basename(p)
                if not fn.lower().endswith(".pdf") or re.search(r"plano|imagen|anexo|mapa", fn, re.I):
                    continue
                rel = os.path.relpath(p, resp)
                e = self.entity_in(rel.split(os.sep)[0]) or self.entity_in(fn)
                if not e:
                    continue
                txt = re.sub(r"\s+", " ", unicodedata.normalize("NFC", self.cache.text(p, 4)))
                self._info_from_text(txt, info)
                d = date_from_text(txt[:1500])
                src = "pdf" if d else None
                if not d:
                    d, src = self.file_date(p, folder, "")
                req = bool(RE_REQ.search(txt))
                ev = self._ev(e, "Requerimiento de la entidad" if req else "Respuesta de la entidad", d, src, p, folder,
                              "Requerimiento de información" if req else "Respuesta de la entidad")
                if not req:
                    cuerpo = txt[txt.lower().find("asunto"):] if "asunto" in txt.lower() else txt
                    if RE_FAV.search(cuerpo):
                        ev["resultado"] = "Favorable"
                    elif RE_COND.search(cuerpo):
                        ev["resultado"] = "Con condiciones"
                    elif RE_REMITE.search(cuerpo):
                        ev["resultado"] = "Sin pronunciamiento de fondo"
                        ev["nota"] = "La entidad no certifica: remite a consulta propia (visor / plataforma)"
                    else:
                        ev["resultado"] = ""
                        ev["nota"] = "No se pudo leer el resultado: revisar el PDF"
                    mm = re.search(r"(?:radicad[oa]|rad\.)[^0-9]{0,40}?(\d{8,})", cuerpo, re.I)
                    if mm:
                        ev["radicado_num"] = mm[1]
                out.append(ev)
        return out

    # -------------------------------------------------------------- entregables internos
    ENTREGABLES = [
        # codigo, patron (ruta relativa), descripcion, criterio de fecha
        ("JUR-TITULOS", r"estudio[\s_]*de[\s_]*t[ií]tulos|estudio[\s_]*t[ií]tulos", "Estudio de títulos"),
        ("ING-LAYOUT", r"layout[\s_]*prelim", "Layout preliminar"),
        ("ING-BASICA", r"ingenier[ií]a[\s_]*b[aá]sica", "Diseño de ingeniería básica"),
        ("ING-AUTOCAD", r"autocad|\.dwg$", "Layout en AutoCAD"),
        ("ING-PVSYST", r"pvsyst", "Simulación PVsyst"),
        ("PRE-TOPO", r"topogr[aá]f", "Levantamiento topográfico"),
        ("PRE-HIDRO", r"hidrol[oó]g|hidrogr[aá]f", "Estudio hidrológico e hidrográfico"),
        ("PRE-PULL", r"pull[\s_-]*out", "Pruebas de pull-out"),
        ("SOC-SEG", r"estudio[\s_]*de[\s_]*seguridad|an[aá]lisis[\s_]*de[\s_]*seguridad|orden[\s_]*p[uú]blico", "Estudio de seguridad"),
        ("SOC-SOCIAL", r"estudio[\s_]*social|caracterizaci[oó]n[\s_]*social|socioecon[oó]mic|diagn[oó]stico[\s_]*social", "Estudio social"),
    ]

    RANGO_ORIGEN = {"nombre": 0, "carpeta": 1, "pdf": 2, "modificación": 3}
    ALCANCE = {"JUR-TITULOS": r"^\d*\s*jur[ií]dic"}  # carpeta de primer nivel donde se busca

    def scan_entregables(self, folder, bases=()):
        """Detecta entregables por nombre de carpeta o archivo. Devuelve eventos con _sub = n.º de GD o None (compartido)."""
        files = [p for p in walk_files(folder) if not re.search(r"\.(tmp|lnk|ini)$", p, re.I)]
        out = []
        for cod, pat, desc in self.ENTREGABLES:
            hits = [p for p in files if re.search(pat, strip_acc(os.path.relpath(p, folder)), re.I)]
            if cod in self.ALCANCE:
                hits = [p for p in hits if re.search(self.ALCANCE[cod], strip_acc(os.path.relpath(p, folder).split(os.sep)[0]), re.I)]
            if cod == "ING-PVSYST":
                hits = [p for p in hits if p.lower().endswith(".pdf")]
            if not hits:
                continue
            if cod == "ING-PVSYST":
                # cada reporte se asigna a su GD (o a todos si es conjunto); scan_project deja el más reciente
                for p in hits:
                    d, src = self.file_date(p, folder)
                    ev = self._ev("SOLCOR", "Entrega", d, src, p, folder, f"{desc} – última versión",
                                  codigo=cod, detalle=self._pvsyst(p))
                    ev["_sub"] = self._sub_de(os.path.basename(p), bases)
                    ev["_mtime"] = os.path.getmtime(p)
                    out.append(ev)
                continue
            # prioriza archivos con fecha clara (nombre, carpeta o PDF) sobre la fecha de modificacion
            fechas = sorted(((self.file_date(p, folder), p) for p in hits), key=lambda x: (self.RANGO_ORIGEN[x[0][1]], x[0][0]))
            (d, src), p = fechas[0]
            ultimo = max(fechas, key=lambda x: (self.RANGO_ORIGEN[x[0][1]] < 3, x[0][0]))[1]
            det = f"{len(hits)} archivo(s); último: {os.path.basename(ultimo)}"
            if cod == "JUR-TITULOS" and re.search(r"prelim", os.path.basename(ultimo), re.I):
                det = "Versión preliminar · " + det
            ev = self._ev("SOLCOR", "Entrega", d, src, p, folder, desc, codigo=cod, detalle=det)
            ev["_sub"] = None
            out.append(ev)
        return out

    AREA_COSTO = [(r"conexi|ecs|insumo", "Conexión"), (r"t[ií]tulo|contrato|notar|registro|escritura", "Jurídico"),
                  (r"topogr|hidrol|pull|geotec|suelo", "Predial"), (r"pvsyst|layout|ingenier|dise[nñ]o", "Ingeniería"),
                  (r"licencia|curadur|planeaci", "Licenciamiento"), (r"seguridad|social|socioecon", "Social"), (r"consulta|anla|anm|anh|icanh", "Solapamientos")]

    def scan_costos(self, folder):
        """Comprobantes de pago y facturas: valor, proveedor, fecha y estado."""
        out = []
        for p in walk_files(folder):
            fn = os.path.basename(p)
            if not fn.lower().endswith(".pdf") or not re.search(r"pago|factura|anticipo|cuenta de cobro|comprobante|soporte|\d+\s*pc\b", strip_acc(fn), re.I):
                continue
            txt = re.sub(r"\s+", " ", self.cache.text(p, 2))
            mv = re.search(r"Valor(?: total)?\s*:?\s*(?:COP)?\s*\$\s*([\d.]+(?:,\d{1,2})?)", txt, re.I)
            if not mv:
                continue
            valor = float(mv[1].replace(".", "").replace(",", "."))
            prov = re.search(r"(?:Nombre del destinatario|Proveedor|Raz[oó]n social|Beneficiario)\s*:?\s*([A-Za-zÁÉÍÓÚáéíóúñÑ&.\s]{3,50}?)\s+(?:Identificaci|NIT|Nit|C[eé]dula|Producto)", txt)
            estado = "Pendiente" if re.search(r"Estado del pago\s*Pendiente", txt, re.I) else "Pagado"
            d, src = self.file_date(p, folder)
            concepto = re.sub(r"^\d{6,9}\s*", "", os.path.splitext(fn)[0]).strip()
            area = next((a for pat, a in self.AREA_COSTO if re.search(pat, strip_acc(concepto), re.I)), "")
            out.append({"kind": "costo", "fecha": d, "concepto": concepto, "proveedor": prov[1].strip() if prov else "",
                        "valor": valor, "estado": estado, "area": area, "fuente": os.path.relpath(p, folder)})
        return out

    def centros_layout(self, folder):
        """{n.º de GD: (lat, lon)} con el centro de las mesas 'Mesa GDn-…' del layout KML más reciente."""
        kmls = [p for p in walk_files(folder) if p.lower().endswith(".kml") and re.search(r"layout", strip_acc(p), re.I)]
        kmls.sort(key=lambda p: (bool(re.search(r"detalle", strip_acc(os.path.basename(p)), re.I)), self.file_date(p, folder)[0]))
        for p in reversed(kmls):
            try:
                with open(p, encoding="utf-8", errors="ignore") as f:
                    txt = f.read()
            except OSError:
                continue
            g = {}
            for m in re.finditer(r"<Placemark>.*?</Placemark>", txt, re.S):
                n = re.search(r"<name>\s*Mesa\s*GD\s*(\d+)", m[0], re.I)
                c = re.search(r"<coordinates>(.*?)</coordinates>", m[0], re.S)
                if n and c:
                    for x in c[1].split():
                        lo, la = map(float, x.split(",")[:2])
                        g.setdefault(n[1], []).append((la, lo))
            if g:
                return {k: (round(sum(a for a, _ in v) / len(v), 6), round(sum(b for _, b in v) / len(v), 6)) for k, v in g.items()}
        return {}

    @staticmethod
    def _sub_de(nombre, bases):
        """N.º de GD si el archivo es de un solo GD ('Monsalve 2'); None si es conjunto ('Monsalve_1_2_3') o no lo indica."""
        n = strip_acc(nombre)
        for b in bases:
            m = re.search(rf"{re.escape(strip_acc(b))}[\s_-]*(\d{{1,2}}(?:\s*(?:[_,-]|y)\s*\d{{1,2}})*)(?!\d)", n, re.I)
            if m:
                nums = re.findall(r"\d{1,2}", m[1])
                return nums[0] if len(nums) == 1 else None
        return None

    def _pvsyst(self, path):
        """P50 / P75 / P90 de producción anual del reporte PVsyst, en MWh/año."""
        txt = re.sub(r"\s+", " ", self.cache.text(path, 12))

        def num(s):
            s = s.replace(" ", "")
            if re.fullmatch(r"\d{1,3}(,\d{3})+(\.\d+)?", s):
                s = s.replace(",", "")
            elif re.fullmatch(r"\d{1,3}(\.\d{3})+(,\d+)?", s):
                s = s.replace(".", "").replace(",", ".")
            return float(s.replace(",", "."))

        # el orden de las columnas varía entre versiones (P50 P75 P90 / P50 P90 P75): se leen por rótulo
        m = re.search(r"\((P\d\d)\).{0,60}?\((P\d\d)\).{0,60}?\((P\d\d)\)\s*([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*(kWh|MWh|GWh)", txt)
        if m:
            f = {"kWh": 0.001, "MWh": 1, "GWh": 1000}[m[7]]
            vals = {m[i]: num(m[i + 3]) * f for i in (1, 2, 3)}
        else:
            m = re.search(r"(P\d\d)\s+(P\d\d)\s+(P\d\d)\s+(?:[\d.,]+\s+)?([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*MWh", txt)
            if not m:
                return f"No se encontraron P50/P75/P90 en el reporte ({os.path.basename(path)})"
            vals = {m[i]: num(m[i + 3]) for i in (1, 2, 3)}
        fmt = lambda v: f"{v:,.1f}".replace(",", "X").replace(".", ",").replace("X", ".")
        partes = [f"{k}: {fmt(vals[k])} MWh/año" for k in ("P50", "P75", "P90") if k in vals]
        return " · ".join(partes) + f" ({os.path.basename(path)})"

    def _info_from_text(self, txt, info):
        t = re.sub(r"\s+", " ", txt or "")
        m = re.search(r"municipio\s*de\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ ]{2,30}?)\s*,\s*departamento\s*de\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ ]{2,30}?)[\s.,”\"]", t)
        if m and not info["municipio"]:
            info["municipio"], info["departamento"] = m[1].strip(), match_depto(m[2])
        m = re.search(r"predio\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]{2,30})", t)
        if m and not info["predio"]:
            info["predio"] = m[1]

    # -------------------------------------------------------------- operador de red (por GD)
    def scan_or(self, sdir, folder, data):
        out = []
        tops = [os.path.join(sdir, f) for f in os.listdir(sdir) if os.path.isfile(os.path.join(sdir, f))]
        for p in tops:
            fn = os.path.basename(p)
            if not fn.lower().endswith(".pdf"):
                continue
            if re.search(r"solicitud", fn, re.I):
                txt = self.cache.text(p, 5)
                if re.search(r"Acceso Restringido|bloqueada por el sistema de seguridad|Error 40[34]|Page not found", txt, re.I) or len(txt.strip()) < 400:
                    out.append({"kind": "aviso", "fuente": os.path.relpath(p, folder),
                                "texto": f"«{fn}» no contiene la solicitud (es una página de error del portal o está vacío). "
                                         "Vuelve a descargar la solicitud desde el portal del OR y reemplaza el archivo para registrar la fecha de radicado."})
                    continue
                d = date_from_text(txt[txt.rfind("Fecha"):] if "Firma" in txt else txt) or None
                src = "pdf"
                if not d:
                    d, src = self.file_date(p, folder)
                m = re.search(r"Coordenadas\s*\(\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\)", txt)
                if m:
                    data["lat"], data["lon"] = float(m[1]), float(m[2])
                m = re.search(r"Potencia total en AC \(kW AC\):\s*([\d.,]+)", txt)
                if m:
                    data["capacidad_kw"] = float(m[1].replace(",", ""))
                m = re.search(r"comercializador que lo\s*atiende:\s*([A-Za-z]+)", txt)
                if m and self.or_in(m[1]):
                    data["or_sigla"] = self.or_in(m[1])
                m = re.search(r"Ciudad:\s*([A-Za-zÁÉÍÓÚáéíóúñÑ ]+)", txt)
                if m:
                    data.setdefault("municipio_or", m[1].strip())
                m = re.search(r"circuito al cual\s*se realizar[aá] la conexi[oó]n:\s*(\d+)", txt)
                extra = f" · circuito {m[1]}" if m else ""
                if m:
                    data["circuito"] = m[1]
                out.append(self._ev("@OR", "Radicado", d, src, p, folder, "Solicitud de insumos / disponibilidad" + extra, codigo="OR-DISP"))
            elif re.search(r"observaci|subsanaci", strip_acc(fn), re.I):
                tipo = "Subsanación radicada" if re.search(r"subsanaci", strip_acc(fn), re.I) else "Observaciones del OR"
                d, src = self.file_date(p, folder)
                out.append(self._ev("@OR", tipo, d, src, p, folder, os.path.splitext(fn)[0], codigo="OR-SOL"))
            elif re.search(r"aprob|concepto|viabilidad|fpo", fn, re.I):
                # aprobacion del ECS por el OR: respuesta al ECS y, si aparece, la FPO asignada
                txt = re.sub(r"\s+", " ", self.cache.text(p, 6))
                d = date_from_text(txt[:1500])
                src = "pdf"
                if not d:
                    d, src = self.file_date(p, folder)
                out.append(self._ev("@OR", "Respuesta de la entidad", d, src, p, folder,
                                    "Concepto del OR sobre el estudio de conexión", codigo="OR-SOL",
                                    resultado="Favorable" if re.search(r"aprueb|aprobad|viable", txt, re.I) else ""))
                m = re.search(r"(?:FPO|fecha de puesta en (?:operaci[oó]n|servicio))[^0-9]{0,60}"
                              r"(\d{1,2}[-/ ](?:\d{1,2}|[A-Za-z]{3,10})[-/ ](?:de )?\d{2,4})", txt, re.I)
                if m:
                    fpo = date_from_text(m[1]) or m[1]
                    out.append(self._ev("@OR", "Entrega", d, src, p, folder, "FPO asignada por el OR",
                                        codigo="OR-FPO", detalle=f"FPO: {fpo}"))
            elif re.search(r"insumo", fn, re.I):
                txt = self.cache.text(p, 1)
                d = date_from_text(txt)
                src = "pdf"
                if not d:
                    d, src = self.file_date(p, folder)
                # formato de insumos del OR: circuito de estudio y capacidad de la subestación
                full = re.sub(r"\s+", " ", self.cache.text(p, 4))
                mc = re.search(r"CIRCUITO DE ESTUDIO\s*CAPACIDAD DE LA SE \(MVA\)\s*(\d+)\s*([\d.,]+)", full, re.I)
                if mc:
                    data["circuito"] = data.get("circuito") or mc[1]
                    data["capacidad_se_mva"] = float(mc[2].replace(",", "."))
                m = re.search(r"Solicitud:\s*(\d+)", txt)
                out.append(self._ev("@OR", "Respuesta de la entidad", d, src, p, folder,
                                    "Insumos para el estudio de conexión" + (f" (solicitud {m[1]})" if m else ""),
                                    codigo="OR-DISP", resultado="Favorable", radicado_num=m[1] if m else None))
        for d in os.listdir(sdir):
            p = os.path.join(sdir, d)
            if not os.path.isdir(p):
                continue
            if re.search(r"observaci|subsanaci", strip_acc(d), re.I):
                tipo = "Subsanación radicada" if re.search(r"subsanaci", strip_acc(d), re.I) else "Observaciones del OR"
                fechas = sorted(x for x in (date_from_name(os.path.basename(f)) for f in walk_files(p)) if x)
                fecha = date_from_name(d) or (fechas[0] if fechas else None)
                if fecha:
                    out.append(self._ev("@OR", tipo, fecha, "nombre", p, folder, d, codigo="OR-SOL"))
                continue
            m = re.search(r"enviad[oa]s?\s+a\s+(.+)$", d, re.I)
            if m and self.or_in(m[1]):
                data["or_sigla"] = data["or_sigla"] or self.or_in(m[1])
                files = [f for f in walk_files(p)]
                fechas = sorted(x for x in (date_from_name(os.path.basename(f)) for f in files) if x)
                if fechas:
                    out.append(self._ev("@OR", "Radicado", fechas[-1], "nombre", p, folder,
                                        f"Radicación del estudio de conexión ({len(files)} documentos)", codigo="OR-SOL"))
            elif re.search(r"para cargar|por cargar|pendiente", d, re.I):
                out.append({"kind": "aviso", "texto": f"ECS listo para cargar al OR pero sin radicar: «{d}»",
                            "fuente": os.path.relpath(p, folder)})
        return out

    def _ev(self, ent, tipo, fecha, src, path, folder, desc, codigo=None, **kw):
        if ent.startswith("@"):
            sig, tipo_ent = None, ent[1:]
        else:
            sig, tipo_ent = ent, None
        conf = "alta" if src in ("nombre", "carpeta", "pdf") else "media"
        return {"kind": "evento", "entidad_sigla": sig, "entidad_rol": tipo_ent,
                "codigo": codigo or (CODIGO.get(sig) if sig else ("COEX-CAR" if tipo_ent == "CAR" else None)),
                "tipo": tipo, "fecha": fecha, "origen_fecha": src, "confianza": conf,
                "fuente": os.path.relpath(path, folder), "descripcion": desc,
                **{k: v for k, v in kw.items() if v is not None}}


def scan(con, cfg):
    root = cfg.get("pipeline_root") or DEFAULT_ROOT
    etapas = [e for e in (cfg.get("etapas") or "E3").split(",") if e]
    if not os.path.isdir(root):
        return {"error": f"No se encontró la carpeta del Pipeline: {root}", "proposals": []}
    ents = [dict(r) for r in con.execute("SELECT * FROM entidades")]
    sc = Scanner(ents)
    props = []
    for et in etapas:
        base = os.path.join(root, et)
        if not os.path.isdir(base):
            continue
        for d in sorted(os.listdir(base)):
            p = os.path.join(base, d)
            if os.path.isdir(p) and not d.startswith((".", "_")):
                props += sc.scan_project(p, et, root)
    sc.cache.save()
    # marca lo que ya esta en la base
    projs = {r["sp_ref"]: dict(r) for r in con.execute("SELECT * FROM proyectos WHERE sp_ref IS NOT NULL")}
    fuentes = {(r["proyecto_id"], r["fuente"], r["tipo"]) for r in con.execute(
        "SELECT t.proyecto_id, v.fuente, v.tipo FROM eventos v JOIN tramites t ON t.id=v.tramite_id WHERE v.fuente IS NOT NULL")}
    costos_hechos = {(r["proyecto_id"], r["fuente"]) for r in con.execute("SELECT proyecto_id, fuente FROM costos WHERE fuente IS NOT NULL")}
    for pr in props:
        pr["id"] = hashlib.md5(json.dumps([pr.get("sp_ref"), pr["kind"], pr.get("tipo"), pr.get("fuente"), pr.get("codigo")],
                                          ensure_ascii=False).encode()).hexdigest()[:12]
        ex = projs.get(pr.get("sp_ref"))
        if pr["kind"] == "proyecto":
            pr["existe"] = bool(ex)
            if ex:
                pr["proyecto_id"] = ex["id"]
                pr["cambios"] = {k: v for k, v in pr["data"].items()
                                 if k in ("fecha_contrato", "lat", "lon", "municipio", "departamento", "predio", "capacidad_kw",
                                          "circuito", "capacidad_se_mva")
                                 and v not in (None, "") and ex.get(k) in (None, "")}
                # las coordenadas del layout reemplazan las anteriores cuando cambian
                if pr["data"].get("coord_fuente") == "layout":
                    for k in ("lat", "lon"):
                        if ex.get(k) is None or abs(float(ex[k]) - pr["data"][k]) > 1e-6:
                            pr["cambios"][k] = pr["data"][k]
        elif pr["kind"] == "evento":
            pr["aplicado"] = bool(ex) and (ex["id"], pr["fuente"], pr["tipo"]) in fuentes
        elif pr["kind"] == "costo":
            pr["aplicado"] = bool(ex) and (ex["id"], pr["fuente"]) in costos_hechos
    return {"root": root, "etapas": etapas, "proposals": props}


# ------------------------------------------------------------------ aplicar
def apply(con, items):
    ents = {r["sigla"]: dict(r) for r in con.execute("SELECT * FROM entidades")}
    cat = {r["codigo"]: dict(r) for r in con.execute("SELECT * FROM catalogo")}
    res = {"proyectos": 0, "actualizados": 0, "eventos": 0, "tramites_nuevos": 0}
    touched = set()

    def suggest(tipos, dep):
        c = [e for e in ents.values() if e["tipo"] in tipos and dep in (e["departamentos"] or "").split(",")]
        c.sort(key=lambda e: (0 if (e["departamentos"] or "").split(",")[0] == dep else 1, e["id"]))
        return c[0]["id"] if c else None

    for it in [i for i in items if i["kind"] == "proyecto"]:
        d = it["data"]
        row = con.execute("SELECT * FROM proyectos WHERE sp_ref=?", (it["sp_ref"],)).fetchone()
        if row:
            ch = {k: v for k, v in (it.get("cambios") or {}).items()}
            if ch:
                con.execute(f"UPDATE proyectos SET {','.join(k + '=?' for k in ch)} WHERE id=?", [*ch.values(), row["id"]])
                res["actualizados"] += 1
            continue
        dep = d.get("departamento") or ""
        car_id = ents.get(d.get("car_sigla") or "", {}).get("id") or suggest(("CAR",), dep)
        or_id = ents.get(d.get("or_sigla") or "", {}).get("id") or suggest(("Operador de red",), dep)
        mun_id = None
        if d.get("municipio"):
            sig = f"Alcaldía {d['municipio']}"
            if sig not in ents:
                cur = con.execute("INSERT INTO entidades (sigla,nombre,tipo,departamentos) VALUES (?,?,?,?)",
                                  (sig, f"Alcaldía de {d['municipio']} – Secretaría de Planeación", "Municipal", dep))
                ents[sig] = {"id": cur.lastrowid, "sigla": sig, "tipo": "Municipal", "departamentos": dep}
            mun_id = ents[sig]["id"]
        cur = con.execute(
            """INSERT INTO proyectos (codigo,nombre,figura,capacidad_kw,departamento,municipio,predio,lat,lon,car_id,or_id,
               mun_id,fecha_contrato,etapa,estado,responsable,notas,carpeta,sp_ref,circuito,capacidad_se_mva)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (d.get("codigo"), d["nombre"], d.get("figura", "GD"), d.get("capacidad_kw"), dep or None, d.get("municipio"),
             d.get("predio"), d.get("lat"), d.get("lon"), car_id, or_id, mun_id, d.get("fecha_contrato"), "Desarrollo",
             "Activo", "Desarrollo GD", d.get("notas", ""), it.get("carpeta"), it["sp_ref"], d.get("circuito"), d.get("capacidad_se_mva")))
        pid = cur.lastrowid
        p = {"car_id": car_id, "or_id": or_id, "mun_id": mun_id}
        for c in sorted(cat.values(), key=lambda c: c["orden"]):
            figs = c["figuras"] or "*"
            if not c["base"] or (figs != "*" and d.get("figura", "GD") not in figs.split(",")):
                continue
            eid = _resolve(c, p, ents)
            con.execute("""INSERT INTO tramites (proyecto_id,catalogo_id,entidad_id,nombre,etapa,area,adicional,plazo_dias,tipo_plazo,estado)
                           VALUES (?,?,?,?,?,?,0,?,?, 'Por radicar')""",
                        (pid, c["id"], eid, c["nombre"], c["etapa"], c["area"], c["plazo_dias"], c["tipo_plazo"]))
        res["proyectos"] += 1

    for it in [i for i in items if i["kind"] == "evento"]:
        pr = con.execute("SELECT * FROM proyectos WHERE sp_ref=?", (it["sp_ref"],)).fetchone()
        if not pr:
            continue
        pr = dict(pr)
        if it.get("entidad_sigla"):
            eid = ents.get(it["entidad_sigla"], {}).get("id")
        else:
            eid = {"OR": pr["or_id"], "CAR": pr["car_id"]}.get(it.get("entidad_rol"))
        c = cat.get(it.get("codigo") or "")
        t = None
        if c:
            t = con.execute("SELECT * FROM tramites WHERE proyecto_id=? AND catalogo_id=?", (pr["id"], c["id"])).fetchone()
        if not t and eid:
            t = con.execute("SELECT * FROM tramites WHERE proyecto_id=? AND entidad_id=? ORDER BY id LIMIT 1", (pr["id"], eid)).fetchone()
        if not t:
            sig = it.get("entidad_sigla") or it.get("entidad_rol")
            cur = con.execute(
                """INSERT INTO tramites (proyecto_id,catalogo_id,entidad_id,nombre,etapa,area,adicional,motivo,plazo_dias,tipo_plazo,estado)
                   VALUES (?,?,?,?,?,?,?,?,?,?,'Por radicar')""",
                (pr["id"], c["id"] if c else None, eid, c["nombre"] if c else f"Consulta de coexistencia – {sig}",
                 c["etapa"] if c else "Factibilidad", c["area"] if c else "Solapamientos", 0 if c and c["base"] else 1,
                 "Detectado en SharePoint", c["plazo_dias"] if c else 15, c["tipo_plazo"] if c else "hábiles"))
            t = con.execute("SELECT * FROM tramites WHERE id=?", (cur.lastrowid,)).fetchone()
            res["tramites_nuevos"] += 1
        t = dict(t)
        if eid and t["entidad_id"] is None:
            con.execute("UPDATE tramites SET entidad_id=? WHERE id=?", (eid, t["id"]))
        if con.execute("SELECT 1 FROM eventos WHERE tramite_id=? AND fuente=? AND tipo=?", (t["id"], it["fuente"], it["tipo"])).fetchone():
            continue
        desc = it.get("descripcion", "")
        if it.get("resultado"):
            desc = f"Resultado: {it['resultado']}. {desc}"
        con.execute("INSERT INTO eventos (tramite_id,fecha,tipo,descripcion,fuente) VALUES (?,?,?,?,?)",
                    (t["id"], it["fecha"], it["tipo"], desc, it["fuente"]))
        upd = {}
        if it.get("resultado") and not t["resultado"]:
            upd["resultado"] = it["resultado"]
        if it.get("radicado_num") and not t["radicado_num"]:
            upd["radicado_num"] = it["radicado_num"]
        if it.get("detalle"):
            upd["detalle"] = it["detalle"]
        if upd:
            con.execute(f"UPDATE tramites SET {','.join(k + '=?' for k in upd)} WHERE id=?", [*upd.values(), t["id"]])
        touched.add(t["id"])
        res["eventos"] += 1

    for it in [i for i in items if i["kind"] == "costo"]:
        pr = con.execute("SELECT id FROM proyectos WHERE sp_ref=?", (it["sp_ref"],)).fetchone()
        if not pr or con.execute("SELECT 1 FROM costos WHERE proyecto_id=? AND fuente=?", (pr["id"], it["fuente"])).fetchone():
            continue
        con.execute("INSERT INTO costos (proyecto_id,fecha,concepto,proveedor,area,valor,estado,fuente) VALUES (?,?,?,?,?,?,?,?)",
                    (pr["id"], it["fecha"], it["concepto"], it["proveedor"], it["area"], it["valor"], it["estado"], it["fuente"]))
        res["costos"] = res.get("costos", 0) + 1

    for tid in touched:
        derive(con, tid)
    return res


def _resolve(c, p, ents):
    if c["entidad_tipo"] == "CAR":
        return p["car_id"]
    if c["entidad_tipo"] == "Operador de red":
        return p["or_id"]
    if c["entidad_tipo"] == "Municipal":
        return p["mun_id"]
    if c["entidad_sigla"]:
        return ents.get(c["entidad_sigla"], {}).get("id")
    return None


def derive(con, tid):
    """Recalcula fechas y estado del tramite a partir de su historial."""
    evs = [dict(r) for r in con.execute("SELECT * FROM eventos WHERE tramite_id=? ORDER BY fecha, id", (tid,))]
    t = dict(con.execute("SELECT * FROM tramites WHERE id=?", (tid,)).fetchone())
    rad = [e["fecha"] for e in evs if e["tipo"] == "Radicado"]
    resp = [e["fecha"] for e in evs if e["tipo"] in ("Respuesta de la entidad", "Entrega")]
    u = {}
    if rad:
        u["fecha_radicado"] = min(rad)
    if resp:
        u["fecha_respuesta"] = max(resp)
        u["estado"] = "Respondido"
    elif t["estado"] != "No aplica":
        open_ = False
        for e in evs:
            if e["tipo"] in ("Requerimiento de la entidad", "Observaciones del OR"):
                open_ = True
            elif e["tipo"] in ("Respuesta a requerimiento", "Subsanación radicada"):
                open_ = False
        fr = u.get("fecha_radicado") or t["fecha_radicado"]
        u["estado"] = ("Requerimiento" if open_ else "Radicado") if fr else "Por radicar"
    if u:
        con.execute(f"UPDATE tramites SET {','.join(k + '=?' for k in u)} WHERE id=?", [*u.values(), tid])
