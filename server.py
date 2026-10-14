"""Ruta Desarrollo de GD - servidor local.

Servidor HTTP + API REST sobre SQLite usando solo la libreria estandar de Python.
Ejecutar:  python server.py   (abre http://127.0.0.1:8765)
"""
import csv
import io
import json
import os
import sqlite3
import sys
import threading
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import re
import time
from http.cookies import SimpleCookie
from urllib.parse import parse_qs, quote, urlparse

import auth
import claude_runner
import tickets
import extras
import seed
import sync

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE, "data")
DB_PATH = os.path.join(DATA_DIR, "ruta_rtb.db")
STATIC = os.path.join(BASE, "static")
HOST, PORT = "127.0.0.1", int(os.environ.get("PORT", "8765"))

# Columnas editables por tabla (id es autoincremental)
TABLES = {
    "entidades": ["sigla", "nombre", "tipo", "departamentos", "activo", "notas"],
    "catalogo": ["codigo", "nombre", "entidad_tipo", "entidad_sigla", "etapa", "plazo_dias",
                 "tipo_plazo", "base_legal", "figuras", "base", "motivo", "orden", "notas"],
    "proyectos": ["codigo", "nombre", "figura", "capacidad_kw", "departamento", "municipio",
                  "predio", "lat", "lon", "car_id", "or_id", "mun_id", "fecha_contrato", "etapa",
                  "rtb_objetivo", "estado", "responsable", "notas", "demo"],
    "tramites": ["proyecto_id", "catalogo_id", "entidad_id", "nombre", "etapa", "adicional",
                 "motivo", "radicado_num", "fecha_radicado", "fecha_respuesta", "estado",
                 "resultado", "plazo_dias", "tipo_plazo", "notas"],
    "eventos": ["tramite_id", "fecha", "tipo", "descripcion", "fuente", "usuario"],
}
TABLES["proyectos"] += ["carpeta", "sp_ref", "circuito", "subestacion", "capacidad_se_mva", "presupuesto", "causa_descarte"]
TABLES["catalogo"] += ["area", "clase", "vigencia_meses"]
TABLES["tramites"] += ["area", "detalle", "vigencia_hasta", "responsable", "compromiso"]
TABLES["circuitos"] = ["codigo", "or_id", "subestacion", "capacidad_disp_kw", "notas"]
TABLES["costos"] = ["proyecto_id", "fecha", "concepto", "proveedor", "area", "valor", "estado", "fuente", "notas"]
TABLES["pipeline_notas"] = ["carpeta", "causa", "notas"]

CONFIG_DEFAULT = {
    "pipeline_root": sync.DEFAULT_ROOT, "etapas": "E3", "auto": "1", "intervalo_min": "30",
    "sharepoint_base": "https://solcorsas.sharepoint.com/sites/SolcorColombiaS.A.S/Documentos%20compartidos/Desarrollo%20GD/01%20Pipeline",
    "firmante_nombre": "Jonatan Quintero Gamez", "firmante_cargo": "Coordinador de Desarrollo de Proyectos",
    "empresa": "SOLCOR COLOMBIA S.A.S.", "nit": "901.582.696-0", "direccion": "Carrera 13 # 90-17, Bogotá D.C.",
    "correo": "tramites@solcor.com.co", "telefono": "312 529 9870",
}
SYNC_STATUS = {"ultima": None, "resultado": None, "error": None, "avisos": []}


def get_config(con):
    cfg = dict(CONFIG_DEFAULT)
    cfg.update({r["clave"]: r["valor"] for r in con.execute("SELECT clave, valor FROM config")})
    return cfg


def run_auto_sync():
    """Escanea y aplica solo lo de confianza alta (fechas tomadas del nombre, carpeta o PDF)."""
    import datetime as _dt
    try:
        with _lock, connect() as con:
            r = sync.scan(con, get_config(con))
            if r.get("error"):
                raise RuntimeError(r["error"])
            # un tramite con alguna fecha dudosa queda completo para revision manual
            dudosos = {(p["sp_ref"], p.get("codigo"), p.get("entidad_sigla")) for p in r["proposals"]
                       if p["kind"] == "evento" and p["confianza"] != "alta"}
            items = [p for p in r["proposals"] if p["kind"] in ("proyecto", "costo") or
                     (p["kind"] == "evento" and not p.get("aplicado") and
                      (p["sp_ref"], p.get("codigo"), p.get("entidad_sigla")) not in dudosos)]
            avisos = [{"sp_ref": p.get("sp_ref"), "texto": p["texto"], "fuente": p.get("fuente")} for p in r["proposals"] if p["kind"] == "aviso"]
            avisos += [{"sp_ref": p["sp_ref"], "texto": f"Fecha dudosa sin aplicar: {p['tipo']} ({p.get('nota') or p['origen_fecha']})", "fuente": p["fuente"]}
                       for p in r["proposals"] if p["kind"] == "evento" and not p.get("aplicado") and p["confianza"] != "alta"]
            SYNC_STATUS.update(resultado=sync.apply(con, items), error=None, avisos=avisos)
    except Exception as e:  # noqa: BLE001
        SYNC_STATUS.update(error=str(e))
    SYNC_STATUS["ultima"] = _dt.datetime.now().isoformat(timespec="seconds")


def auto_sync_loop():
    import time
    while True:
        try:
            with connect() as con:
                cfg = get_config(con)
            if cfg.get("auto") == "1":
                run_auto_sync()
            wait = max(5, int(cfg.get("intervalo_min") or 30)) * 60
        except Exception:  # noqa: BLE001
            wait = 1800
        time.sleep(wait)

SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS entidades (
  id INTEGER PRIMARY KEY AUTOINCREMENT, sigla TEXT NOT NULL, nombre TEXT, tipo TEXT,
  departamentos TEXT DEFAULT '', activo INTEGER DEFAULT 1, notas TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS catalogo (
  id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT, nombre TEXT, entidad_tipo TEXT,
  entidad_sigla TEXT, etapa TEXT, plazo_dias INTEGER, tipo_plazo TEXT DEFAULT 'hábiles',
  base_legal TEXT DEFAULT '', figuras TEXT DEFAULT '*', base INTEGER DEFAULT 0,
  motivo TEXT DEFAULT '', orden INTEGER DEFAULT 0, notas TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS proyectos (
  id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT, nombre TEXT NOT NULL, figura TEXT,
  capacidad_kw REAL, departamento TEXT, municipio TEXT, predio TEXT, lat REAL, lon REAL,
  car_id INTEGER, or_id INTEGER, mun_id INTEGER, fecha_contrato TEXT, etapa TEXT,
  rtb_objetivo TEXT, estado TEXT DEFAULT 'Activo', responsable TEXT, notas TEXT DEFAULT '',
  demo INTEGER DEFAULT 0, creado TEXT DEFAULT (date('now')));
CREATE TABLE IF NOT EXISTS tramites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  catalogo_id INTEGER, entidad_id INTEGER, nombre TEXT, etapa TEXT, adicional INTEGER DEFAULT 0,
  motivo TEXT DEFAULT '', radicado_num TEXT DEFAULT '', fecha_radicado TEXT, fecha_respuesta TEXT,
  estado TEXT DEFAULT 'Por radicar', resultado TEXT DEFAULT '', plazo_dias INTEGER,
  tipo_plazo TEXT DEFAULT 'hábiles', notas TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tramite_id INTEGER NOT NULL REFERENCES tramites(id) ON DELETE CASCADE,
  fecha TEXT, tipo TEXT, descripcion TEXT DEFAULT '');
"""

_lock = threading.Lock()


def connect():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def fin_ejecucion_claude(tid, codigo, cambio_backend, log):
    """Al terminar una ejecución de Claude: deja constancia en el tiquet y recarga el servidor si cambió código Python."""
    try:
        with _lock, connect() as con:
            t = tickets.uno(con, tid)
            ok = codigo == 0
            registro = claude_runner.leer_log(tid, 4000)
            if not ok and re.search(r"authenticate|OAuth|not logged in|/login", registro, re.I):
                txt = ("Claude no pudo empezar: la línea de comandos de Claude Code no tiene sesión iniciada en el PC del servidor. "
                       "Solución: abre CMD, escribe «claude», inicia sesión en el navegador y escribe /exit. Luego pulsa de nuevo «Ejecutar con Claude».")
            else:
                txt = (f"Ejecución de Claude terminada ({'correcta' if ok else 'con error: ' + str(codigo)}). "
                       + ("El tiquet quedó en «" + t["estado"] + "»." if t["estado"] != "En desarrollo"
                          else "Claude no cerró el tiquet: revisa el registro de la ejecución y sus comentarios.")
                       + (" El servidor se reinicia para cargar los cambios." if cambio_backend else ""))
            if t["estado"] == "En desarrollo":
                # Claude no lo dejó listo (error o pregunta pendiente): vuelve a la cola para reintentar o responder
                con.execute("UPDATE tickets SET estado='Aceptado', actualizado=? WHERE id=?", (tickets.ahora(), tid))
                txt += " El tiquet volvió a «Aceptado»."
            tickets.nota(con, tid, "Plataforma", txt)
    except Exception as e:  # noqa: BLE001
        sys.stderr.write(f"No se pudo registrar el fin de la ejecución: {e}" + chr(10))
    if cambio_backend:
        claude_runner.reiniciar_servidor()


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    with connect() as con:
        con.executescript(SCHEMA)
        auth.init(con)
        tickets.init(con)
        # migraciones: columnas nuevas para la sincronizacion con SharePoint
        for table, col in (("proyectos", "carpeta TEXT"), ("proyectos", "sp_ref TEXT"), ("eventos", "fuente TEXT"),
                           ("catalogo", "area TEXT"), ("catalogo", "clase TEXT DEFAULT 'consulta'"),
                           ("tramites", "area TEXT"), ("tramites", "detalle TEXT DEFAULT ''")):
            try:
                con.execute(f"ALTER TABLE {table} ADD COLUMN {col}")
            except sqlite3.OperationalError:
                pass
        con.execute("CREATE TABLE IF NOT EXISTS config (clave TEXT PRIMARY KEY, valor TEXT)")
        # migracion v2: los proyectos entran en Desarrollo (Factibilidad -> Licenciamiento -> RTB)
        mig = con.execute("SELECT valor FROM config WHERE clave='mig_etapas_v2'").fetchone()
        if not mig:
            con.execute("UPDATE catalogo SET codigo='MUN-LIC-CER', nombre='Licencia de construcción para cerramiento' WHERE codigo='MUN-LIC'")
            con.execute("UPDATE catalogo SET nombre='Certificado de uso del suelo' WHERE codigo='MUN-USO'")
            for cod, nom in (("MUN-LIC-CER", "Licencia de construcción para cerramiento"), ("MUN-USO", "Certificado de uso del suelo")):
                con.execute("UPDATE tramites SET nombre=? WHERE catalogo_id IN (SELECT id FROM catalogo WHERE codigo=?)", (nom, cod))
            for t in ("catalogo", "tramites"):
                con.execute(f"UPDATE {t} SET etapa='Factibilidad' WHERE etapa='Prefactibilidad'")
            con.execute("UPDATE proyectos SET etapa='Factibilidad' WHERE etapa IS NULL OR etapa IN ('', 'Prefactibilidad')")
        # agrega entidades y tipos de tramite nuevos del catalogo sin tocar lo ya editado
        seed.seed_catalog(con)
        if not mig:
            bas = con.execute("SELECT * FROM catalogo WHERE codigo='MUN-LIC-BAS'").fetchone()
            for p in con.execute("SELECT id, mun_id FROM proyectos").fetchall():
                if bas and not con.execute("SELECT 1 FROM tramites WHERE proyecto_id=? AND catalogo_id=?", (p["id"], bas["id"])).fetchone():
                    con.execute("""INSERT INTO tramites (proyecto_id,catalogo_id,entidad_id,nombre,etapa,adicional,plazo_dias,tipo_plazo,estado)
                                   VALUES (?,?,?,?,?,0,?,?,'Por radicar')""",
                                (p["id"], bas["id"], p["mun_id"], bas["nombre"], bas["etapa"], bas["plazo_dias"], bas["tipo_plazo"]))
            con.execute("INSERT OR REPLACE INTO config (clave, valor) VALUES ('mig_etapas_v2', '1')")
        # migracion v3: Factibilidad (5 areas paralelas) y Licenciamiento en paralelo; RTB = ambas completas
        if not con.execute("SELECT 1 FROM config WHERE clave='mig_desarrollo_v3'").fetchone():
            seed.sync_catalog(con)
            con.execute("""UPDATE tramites SET
                             area=(SELECT c.area FROM catalogo c WHERE c.id=tramites.catalogo_id),
                             etapa=(SELECT c.etapa FROM catalogo c WHERE c.id=tramites.catalogo_id),
                             nombre=(SELECT c.nombre FROM catalogo c WHERE c.id=tramites.catalogo_id)
                           WHERE catalogo_id IN (SELECT id FROM catalogo)""")
            con.execute("UPDATE tramites SET area='Solapamientos', etapa='Factibilidad' WHERE area IS NULL OR area=''")
            con.execute("UPDATE proyectos SET etapa='Desarrollo' WHERE etapa IS NULL OR etapa <> 'RTB alcanzado'")
            ents = {r["sigla"]: r["id"] for r in con.execute("SELECT id, sigla FROM entidades")}
            nuevos = [dict(r) for r in con.execute(
                "SELECT * FROM catalogo WHERE base=1 AND codigo IN ('JUR-CONTRATO','JUR-TITULOS','OR-FPO','ING-LAYOUT',"
                "'ING-BASICA','ING-AUTOCAD','ING-PVSYST','PRE-TOPO','PRE-HIDRO','PRE-PULL')")]
            for p in [dict(r) for r in con.execute("SELECT * FROM proyectos")]:
                for c in nuevos:
                    if con.execute("SELECT 1 FROM tramites WHERE proyecto_id=? AND catalogo_id=?", (p["id"], c["id"])).fetchone():
                        continue
                    eid = p["or_id"] if c["entidad_tipo"] == "Operador de red" else ents.get(c["entidad_sigla"])
                    hecho = c["codigo"] == "JUR-CONTRATO" and p["fecha_contrato"]
                    cur = con.execute(
                        """INSERT INTO tramites (proyecto_id,catalogo_id,entidad_id,nombre,etapa,area,adicional,plazo_dias,
                           tipo_plazo,estado,fecha_respuesta) VALUES (?,?,?,?,?,?,0,?,?,?,?)""",
                        (p["id"], c["id"], eid, c["nombre"], c["etapa"], c["area"], c["plazo_dias"], c["tipo_plazo"],
                         "Respondido" if hecho else "Por radicar", p["fecha_contrato"] if hecho else None))
                    if hecho:
                        con.execute("INSERT INTO eventos (tramite_id,fecha,tipo,descripcion) VALUES (?,?,'Entrega',?)",
                                    (cur.lastrowid, p["fecha_contrato"], "Contrato firmado (fecha registrada en el proyecto)"))
            con.execute("INSERT OR REPLACE INTO config (clave, valor) VALUES ('mig_desarrollo_v3', '1')")
        # v4: circuitos, vigencias, responsables, costos y notas del embudo
        for table, col in (("proyectos", "circuito TEXT"), ("proyectos", "subestacion TEXT"), ("proyectos", "capacidad_se_mva REAL"),
                           ("proyectos", "presupuesto REAL"), ("proyectos", "causa_descarte TEXT"),
                           ("catalogo", "vigencia_meses INTEGER"), ("tramites", "vigencia_hasta TEXT"),
                           ("tramites", "responsable TEXT"), ("tramites", "compromiso TEXT"), ("eventos", "usuario TEXT")):
            try:
                con.execute(f"ALTER TABLE {table} ADD COLUMN {col}")
            except sqlite3.OperationalError:
                pass
        con.executescript("""
            CREATE TABLE IF NOT EXISTS circuitos (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT, or_id INTEGER,
              subestacion TEXT, capacidad_disp_kw REAL, notas TEXT DEFAULT '');
            CREATE TABLE IF NOT EXISTS costos (id INTEGER PRIMARY KEY AUTOINCREMENT,
              proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE, fecha TEXT, concepto TEXT,
              proveedor TEXT, area TEXT, valor REAL, estado TEXT DEFAULT 'Pagado', fuente TEXT, notas TEXT DEFAULT '');
            CREATE TABLE IF NOT EXISTS pipeline_notas (id INTEGER PRIMARY KEY AUTOINCREMENT, carpeta TEXT, causa TEXT, notas TEXT DEFAULT '');
        """)
        # v5: área Social (estudio de seguridad y estudio social) en todos los proyectos existentes, sin iniciar
        if not con.execute("SELECT 1 FROM config WHERE clave='mig_social_v5'").fetchone():
            ents = {r["sigla"]: r["id"] for r in con.execute("SELECT id, sigla FROM entidades")}
            for c in [dict(r) for r in con.execute("SELECT * FROM catalogo WHERE codigo IN ('SOC-SEG','SOC-SOCIAL')")]:
                for p in [dict(r) for r in con.execute("SELECT id FROM proyectos")]:
                    if not con.execute("SELECT 1 FROM tramites WHERE proyecto_id=? AND catalogo_id=?", (p["id"], c["id"])).fetchone():
                        con.execute("""INSERT INTO tramites (proyecto_id,catalogo_id,entidad_id,nombre,etapa,area,adicional,estado)
                                       VALUES (?,?,?,?,?,?,0,'Por radicar')""",
                                    (p["id"], c["id"], ents.get("SOLCOR"), c["nombre"], c["etapa"], c["area"]))
            con.execute("INSERT OR REPLACE INTO config (clave, valor) VALUES ('mig_social_v5', '1')")
        if not con.execute("SELECT 1 FROM config WHERE clave='mig_v4'").fetchone():
            # vigencia de las licencias urbanísticas: 24 meses (Decreto 1077 de 2015, prorrogables)
            con.execute("UPDATE catalogo SET vigencia_meses=24 WHERE codigo IN ('MUN-LIC-CER','MUN-LIC-BAS') AND vigencia_meses IS NULL")
            con.execute("INSERT OR REPLACE INTO config (clave, valor) VALUES ('mig_v4', '1')")
        if not con.execute("SELECT 1 FROM config WHERE clave='mig_v6'").fetchone():
            # vigencia de los insumos del operador de red: 5 meses desde la respuesta (CREG 174 de 2021)
            con.execute("UPDATE catalogo SET vigencia_meses=5 WHERE codigo='OR-DISP' AND vigencia_meses IS NULL")
            con.execute("INSERT OR REPLACE INTO config (clave, valor) VALUES ('mig_v6', '1')")


def rows(con, table):
    return [dict(r) for r in con.execute(f"SELECT * FROM {table} ORDER BY id")]


def insert(con, table, data):
    cols = [c for c in TABLES[table] if c in data]
    cur = con.execute(
        f"INSERT INTO {table} ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})",
        [data[c] for c in cols])
    return dict(con.execute(f"SELECT * FROM {table} WHERE id=?", (cur.lastrowid,)).fetchone())


def update(con, table, rid, data):
    cols = [c for c in TABLES[table] if c in data]
    if cols:
        con.execute(f"UPDATE {table} SET {','.join(c + '=?' for c in cols)} WHERE id=?",
                    [data[c] for c in cols] + [rid])
    row = con.execute(f"SELECT * FROM {table} WHERE id=?", (rid,)).fetchone()
    return dict(row) if row else None


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):  # silencio en consola salvo errores
        if "/api/" in (args[0] if args else "") and not str(args[1]).startswith("2"):
            sys.stderr.write("%s\n" % (fmt % args))

    # ---------- utilidades ----------
    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}") if n else {}

    def parts(self):
        return [p for p in urlparse(self.path).path.split("/") if p]

    def end_headers(self):
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    # ---------- autenticación ----------
    def token(self):
        c = SimpleCookie(self.headers.get("Cookie") or "")
        return c["sid"].value if "sid" in c else None

    def set_cookie(self, token, max_age):
        seguro = "; Secure" if os.environ.get("COOKIE_SECURE") == "1" else ""  # activar en la nube (https)
        self.send_header("Set-Cookie", f"sid={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age={max_age}{seguro}")

    def send_json_cookie(self, obj, token, max_age, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.set_cookie(token, max_age)
        self.end_headers()
        self.wfile.write(body)

    def auth_routes(self, method, p):
        """Rutas de /api/auth y /api/usuarios. Devuelve True si atendió la petición."""
        if p[1:2] == ["auth"]:
            accion = p[2] if len(p) > 2 else ""
            with _lock, connect() as con:
                if method == "GET" and accion == "estado":
                    return self.send_json({"configurar": not auth.hay_usuarios(con), "usuario": auth.publico(auth.usuario_de(con, self.token()))}) or True
                data = self.read_json() if method == "POST" else {}
                if accion == "configurar":  # primer administrador, solo si aún no hay usuarios
                    if auth.hay_usuarios(con):
                        return self.send_json({"error": "La plataforma ya tiene usuarios"}, 403) or True
                    auth.crear_usuario(con, data.get("email"), data.get("nombre"), data.get("password") or "", "admin")
                    accion = "login"
                if accion == "login":
                    token, u = auth.login(con, data.get("email"), data.get("password"))
                    if not token:
                        time.sleep(1)  # frena intentos repetidos
                        return self.send_json({"error": "Correo o contraseña incorrectos"}, 401) or True
                    return self.send_json_cookie({"usuario": auth.publico(u)}, token, auth.SESION_DIAS * 86400) or True
                if accion == "logout":
                    auth.logout(con, self.token())
                    return self.send_json_cookie({"ok": True}, "", 0) or True
                if accion == "password":
                    u = auth.usuario_de(con, self.token())
                    if not u or not auth.check_password(data.get("actual") or "", u["hash"]):
                        return self.send_json({"error": "La contraseña actual no es correcta"}, 400) or True
                    auth.cambiar_password(con, u["id"], data.get("nueva") or "")
                    token, u = auth.login(con, u["email"], data.get("nueva"))
                    return self.send_json_cookie({"ok": True}, token, auth.SESION_DIAS * 86400) or True
            return self.send_json({"error": "no encontrado"}, 404) or True
        if p[1:2] == ["usuarios"]:
            if self.usuario["rol"] != "admin":
                return self.send_json({"error": "Solo un administrador puede gestionar usuarios"}, 403) or True
            with _lock, connect() as con:
                if method == "GET":
                    return self.send_json([auth.publico(dict(r)) for r in con.execute("SELECT * FROM usuarios ORDER BY nombre")]) or True
                data = self.read_json()
                if method == "POST":
                    u = auth.crear_usuario(con, data.get("email"), data.get("nombre"), data.get("password") or "", data.get("rol") or "editor")
                    return self.send_json(auth.publico(u), 201) or True
                if method == "PUT" and len(p) == 3:
                    uid = int(p[2])
                    if uid == self.usuario["id"] and (data.get("activo") in (0, "0") or data.get("rol", "admin") != "admin"):
                        return self.send_json({"error": "No puedes quitarte el rol de administrador ni desactivarte"}, 400) or True
                    for k in ("nombre", "rol", "activo"):
                        if k in data:
                            if k == "rol" and data[k] not in auth.ROLES:
                                raise ValueError("Rol no válido")
                            con.execute(f"UPDATE usuarios SET {k}=? WHERE id=?", (data[k], uid))
                    if data.get("activo") in (0, "0"):
                        con.execute("DELETE FROM sesiones WHERE usuario_id=?", (uid,))
                    if data.get("password"):
                        auth.cambiar_password(con, uid, data["password"])
                    u = con.execute("SELECT * FROM usuarios WHERE id=?", (uid,)).fetchone()
                    return self.send_json(auth.publico(dict(u))) or True
            return self.send_json({"error": "no encontrado"}, 404) or True
        return False

    def dispatch(self, method):
        p = self.parts()
        if p[:1] != ["api"]:
            return super().do_GET() if method == "GET" else self.send_json({"error": "no encontrado"}, 404)
        try:
            if p[1:2] != ["auth"]:
                with connect() as con:
                    self.usuario = auth.usuario_de(con, self.token())
                if not self.usuario:
                    return self.send_json({"error": "Debes iniciar sesión", "login": True}, 401)
                if method != "GET" and self.usuario["rol"] == "lector" and p[1:2] not in (["usuarios"], ["abrir"], ["tickets"]):
                    return self.send_json({"error": "Tu usuario es de solo lectura"}, 403)
            if self.auth_routes(method, p):
                return
            if p[1:2] == ["tickets"]:
                claude_runner.DB = DB_PATH
                with _lock, connect() as con:
                    return tickets.handle(self, method, p, con, self.usuario, claude_runner, fin_ejecucion_claude)
        except ValueError as e:
            return self.send_json({"error": str(e)}, 400)
        except Exception as e:  # noqa: BLE001
            return self.send_json({"error": str(e)}, 500)
        return {"GET": self._get, "POST": self._post, "PUT": self._put, "DELETE": self._delete}[method]()

    def do_GET(self):
        self.dispatch("GET")

    def do_POST(self):
        self.dispatch("POST")

    def do_PUT(self):
        self.dispatch("PUT")

    def do_DELETE(self):
        self.dispatch("DELETE")

    # ---------- GET ----------
    def _get(self):
        p = self.parts()
        try:
            with connect() as con:
                if p[1:] == ["state"]:
                    return self.send_json({t: rows(con, t) for t in TABLES})
                if p[1:] == ["backup"]:
                    data = {t: rows(con, t) for t in TABLES}
                    body = json.dumps(data, ensure_ascii=False, indent=1).encode("utf-8")
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Disposition", 'attachment; filename="ruta_rtb_respaldo.json"')
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    return self.wfile.write(body)
                if p[1:] == ["export", "tramites.csv"]:
                    return self.export_csv(con)
                if p[1:] == ["sync", "config"]:
                    cfg = get_config(con)
                    root = cfg["pipeline_root"]
                    cfg["existe"] = os.path.isdir(root)
                    cfg["carpetas"] = sorted(d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d))) if cfg["existe"] else []
                    return self.send_json({"config": cfg, "estado": SYNC_STATUS})
                q = parse_qs(urlparse(self.path).query)
                cfg = get_config(con)
                if p[1:] == ["pipeline"]:
                    resp = extras.pipeline(cfg["pipeline_root"])
                    resp["causas"] = [dict(r) for r in con.execute(
                        "SELECT causa, COUNT(*) AS cantidad FROM pipeline_notas WHERE causa IS NOT NULL AND causa<>'' "
                        "GROUP BY causa ORDER BY cantidad DESC")]
                    return self.send_json(resp)
                if p[1:] == ["layout"]:
                    pr = con.execute("SELECT * FROM proyectos WHERE id=?", (int(q["proyecto"][0]),)).fetchone()
                    if not pr or not pr["carpeta"]:
                        return self.send_json({"features": [], "archivo": None})
                    n = re.search(r"(\d+)$", pr["sp_ref"] or "")
                    return self.send_json(extras.layout(os.path.join(cfg["pipeline_root"], pr["carpeta"]), n[1] if n else None))
                if p[1:] == ["carta"]:
                    t = dict(con.execute("SELECT * FROM tramites WHERE id=?", (int(q["tramite"][0]),)).fetchone())
                    pr = dict(con.execute("SELECT * FROM proyectos WHERE id=?", (t["proyecto_id"],)).fetchone())
                    en = dict(con.execute("SELECT * FROM entidades WHERE id=?", (t["entidad_id"],)).fetchone())
                    evs = [dict(r) for r in con.execute("SELECT * FROM eventos WHERE tramite_id=? ORDER BY fecha", (t["id"],))]
                    tipo = q.get("tipo", ["insistencia"])[0]
                    body = extras.carta(tipo, t, pr, en, cfg, evs, STATIC).encode("utf-8")
                    nombre = f"{'Queja SSPD' if tipo == 'sspd' else 'Insistencia'} {en['sigla']} {pr['nombre']}.doc"
                    self.send_response(200)
                    self.send_header("Content-Type", "application/msword; charset=utf-8")
                    self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{quote(nombre)}")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    return self.wfile.write(body)
            self.send_json({"error": "no encontrado"}, 404)
        except Exception as e:  # noqa: BLE001
            self.send_json({"error": str(e)}, 500)

    def export_csv(self, con):
        q = """
        SELECT p.codigo AS proyecto_codigo, p.nombre AS proyecto, p.figura, p.capacidad_kw,
               p.departamento, p.municipio, p.estado AS estado_proyecto,
               t.etapa, t.area, t.nombre AS tramite, e.sigla AS entidad, e.tipo AS tipo_entidad, t.detalle,
               t.adicional, t.motivo, t.radicado_num, t.fecha_radicado, t.fecha_respuesta,
               t.estado, t.resultado, t.plazo_dias, t.tipo_plazo,
               (SELECT COUNT(*) FROM eventos v WHERE v.tramite_id=t.id
                  AND v.tipo='Requerimiento de la entidad') AS requerimientos,
               t.notas
        FROM tramites t JOIN proyectos p ON p.id=t.proyecto_id
        LEFT JOIN entidades e ON e.id=t.entidad_id
        ORDER BY p.id, t.id"""
        cur = con.execute(q)
        buf = io.StringIO()
        w = csv.writer(buf, delimiter=";")
        w.writerow([d[0] for d in cur.description])
        w.writerows(cur.fetchall())
        body = ("﻿" + buf.getvalue()).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", 'attachment; filename="ruta_rtb_tramites.csv"')
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ---------- POST ----------
    def _post(self):
        p = self.parts()
        try:
            data = self.read_json()
            with _lock, connect() as con:
                if p[1:] == ["proyectos", "completo"]:
                    proj = insert(con, "proyectos", data["proyecto"])
                    trams = []
                    for t in data.get("tramites", []):
                        t["proyecto_id"] = proj["id"]
                        trams.append(insert(con, "tramites", t))
                    return self.send_json({"proyecto": proj, "tramites": trams}, 201)
                if p[1:] == ["demo"]:
                    seed.load_demo(con)
                    return self.send_json({"ok": True})
                if p[1:] == ["sync", "config"]:
                    for k, v in data.items():
                        if k in CONFIG_DEFAULT:
                            con.execute("INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)", (k, str(v)))
                    return self.send_json({"ok": True})
                if p[1:] == ["sync", "scan"]:
                    return self.send_json(sync.scan(con, get_config(con)))
                if p[1:] == ["sync", "apply"]:
                    return self.send_json(sync.apply(con, data.get("items", [])))
                if p[1:] == ["abrir"]:
                    # abre en este PC un documento de la carpeta del Pipeline (solo rutas dentro de esa carpeta)
                    root = os.path.realpath(get_config(con)["pipeline_root"])
                    ruta = os.path.realpath(os.path.join(root, data.get("ruta", "")))
                    if not ruta.startswith(root + os.sep) or not os.path.exists(ruta):
                        return self.send_json({"error": "El archivo no existe en la carpeta sincronizada"}, 404)
                    os.startfile(ruta)  # noqa: S606 - abre con la aplicación predeterminada de Windows
                    return self.send_json({"ok": True})
                if p[1:] == ["restaurar"]:
                    orden = ["entidades", "catalogo", "proyectos", "tramites", "eventos", "circuitos", "costos", "pipeline_notas"]
                    for t in reversed(orden):
                        con.execute(f"DELETE FROM {t}")
                    for t in orden:
                        for r in data.get(t, []):
                            cols = ["id"] + [c for c in TABLES[t] if c in r]
                            con.execute(
                                f"INSERT INTO {t} ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})",
                                [r[c] for c in cols])
                    return self.send_json({"ok": True})
                if len(p) == 2 and p[1] in TABLES:
                    if p[1] == "eventos":
                        data["usuario"] = self.usuario["email"]
                    return self.send_json(insert(con, p[1], data), 201)
            self.send_json({"error": "no encontrado"}, 404)
        except Exception as e:  # noqa: BLE001
            self.send_json({"error": str(e)}, 400)

    # ---------- PUT ----------
    def _put(self):
        p = self.parts()
        try:
            if len(p) == 3 and p[1] in TABLES:
                data = self.read_json()
                with _lock, connect() as con:
                    row = update(con, p[1], int(p[2]), data)
                return self.send_json(row) if row else self.send_json({"error": "no existe"}, 404)
            self.send_json({"error": "no encontrado"}, 404)
        except Exception as e:  # noqa: BLE001
            self.send_json({"error": str(e)}, 400)

    # ---------- DELETE ----------
    def _delete(self):
        p = self.parts()
        try:
            with _lock, connect() as con:
                if p[1:] == ["demo"]:
                    con.execute("DELETE FROM proyectos WHERE demo=1")
                    return self.send_json({"ok": True})
                if len(p) == 3 and p[1] in TABLES:
                    con.execute(f"DELETE FROM {p[1]} WHERE id=?", (int(p[2]),))
                    return self.send_json({"ok": True})
            self.send_json({"error": "no encontrado"}, 404)
        except Exception as e:  # noqa: BLE001
            self.send_json({"error": str(e)}, 400)


def main():
    init_db()
    srv = None
    for _ in range(40):  # tras un reinicio automático, espera a que la instancia anterior libere el puerto
        try:
            srv = ThreadingHTTPServer((HOST, PORT), partial(Handler, directory=STATIC))
            break
        except OSError:
            time.sleep(0.5)
    if srv is None:
        sys.exit(f"El puerto {PORT} está ocupado")
    url = f"http://{HOST}:{PORT}/"
    print(f"Ruta Desarrollo de GD corriendo en {url}  (Ctrl+C para detener)")
    print(f"Base de datos: {DB_PATH}")
    threading.Thread(target=auto_sync_loop, daemon=True).start()
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
