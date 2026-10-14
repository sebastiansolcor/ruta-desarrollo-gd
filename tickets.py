"""Tiquets de soporte y mejoras.

Flujo: Nuevo -> (admin) Aceptado -> En desarrollo -> Listo para revisar -> (admin) Resuelto
       Nuevo -> (admin) Rechazado
Cualquier usuario con sesión (incluido "solo lectura") puede crear tiquets y comentar.
Solo un administrador puede aceptar, rechazar, priorizar o cerrar.
Los tiquets "Aceptado" forman la cola que Claude lee con tickets_cli.py para implementar la mejora.
"""
import base64
import datetime as dt
import mimetypes
import os
import re
import uuid
from urllib.parse import quote

ESTADOS = ["Nuevo", "Aceptado", "En desarrollo", "Listo para revisar", "Resuelto", "Rechazado"]
TIPOS = ["Mejora", "Error", "Duda", "Dato incorrecto"]
PRIORIDADES = ["Baja", "Media", "Alta"]

ADJUNTOS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "adjuntos")
MAX_ADJUNTO = 15 * 1024 * 1024  # 15 MB
EXT_BLOQUEADAS = {"exe", "bat", "cmd", "sh", "ps1", "psm1", "vbs", "vbe", "js", "jse", "wsf", "wsh",
                   "msi", "com", "scr", "cpl", "jar", "apk", "dll", "pif", "reg"}

SCHEMA = """
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT, titulo TEXT NOT NULL, descripcion TEXT DEFAULT '',
  tipo TEXT DEFAULT 'Mejora', prioridad TEXT DEFAULT 'Media', estado TEXT DEFAULT 'Nuevo', pagina TEXT DEFAULT '',
  creado_por TEXT, creado TEXT, actualizado TEXT, revisado_por TEXT, nota_admin TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS ticket_notas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE, fecha TEXT, autor TEXT, texto TEXT);
CREATE TABLE IF NOT EXISTS ticket_adjuntos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  nombre TEXT, tipo TEXT DEFAULT '', tamano INTEGER DEFAULT 0, archivo TEXT, autor TEXT, fecha TEXT);
"""


def ahora():
    return dt.datetime.now().isoformat(timespec="seconds")


def init(con):
    con.executescript(SCHEMA)


def listar(con, estados=None):
    q = "SELECT * FROM tickets" + (f" WHERE estado IN ({','.join('?' * len(estados))})" if estados else "") + " ORDER BY id DESC"
    ts = [dict(r) for r in con.execute(q, estados or [])]
    notas = {}
    for r in con.execute("SELECT * FROM ticket_notas ORDER BY fecha, id"):
        notas.setdefault(r["ticket_id"], []).append(dict(r))
    adjuntos = {}
    for r in con.execute("SELECT id, ticket_id, nombre, tipo, tamano, autor, fecha FROM ticket_adjuntos ORDER BY fecha, id"):
        adjuntos.setdefault(r["ticket_id"], []).append(dict(r))
    for t in ts:
        t["notas"] = notas.get(t["id"], [])
        t["adjuntos"] = adjuntos.get(t["id"], [])
    return ts


def uno(con, tid):
    t = con.execute("SELECT * FROM tickets WHERE id=?", (tid,)).fetchone()
    if not t:
        raise ValueError("El tiquet no existe")
    t = dict(t)
    t["notas"] = [dict(r) for r in con.execute("SELECT * FROM ticket_notas WHERE ticket_id=? ORDER BY fecha, id", (tid,))]
    t["adjuntos"] = [dict(r) for r in con.execute(
        "SELECT id, nombre, tipo, tamano, autor, fecha FROM ticket_adjuntos WHERE ticket_id=? ORDER BY fecha, id", (tid,))]
    return t


def _nombre_seguro(nombre):
    nombre = os.path.basename((nombre or "").strip().replace("\\", "/").split("/")[-1])
    nombre = re.sub(r'[\x00-\x1f<>:"|?*]', "_", nombre) or "archivo"
    return nombre[:150]


def adjuntar(con, tid, autor, data):
    """Guarda un archivo adjunto (pantallazo, PDF, KML…) en disco y lo asocia al tiquet."""
    uno(con, tid)
    nombre = _nombre_seguro(data.get("nombre"))
    ext = nombre.rsplit(".", 1)[-1].lower() if "." in nombre else ""
    if ext in EXT_BLOQUEADAS:
        raise ValueError("Ese tipo de archivo no se puede adjuntar por seguridad")
    bruto = data.get("datos") or ""
    if bruto.strip().lower().startswith("data:") and "," in bruto:
        bruto = bruto.split(",", 1)[1]
    try:
        contenido = base64.b64decode(bruto, validate=True)
    except Exception:
        raise ValueError("El archivo no se pudo leer")
    if not contenido:
        raise ValueError("El archivo está vacío")
    if len(contenido) > MAX_ADJUNTO:
        raise ValueError("El archivo supera el tamaño máximo permitido (15 MB)")
    carpeta = os.path.join(ADJUNTOS_DIR, str(tid))
    os.makedirs(carpeta, exist_ok=True)
    archivo = f"{uuid.uuid4().hex}_{nombre}"
    with open(os.path.join(carpeta, archivo), "wb") as f:
        f.write(contenido)
    tipo = (data.get("tipo") or mimetypes.guess_type(nombre)[0] or "application/octet-stream")[:100]
    con.execute("""INSERT INTO ticket_adjuntos (ticket_id, nombre, tipo, tamano, archivo, autor, fecha)
                   VALUES (?,?,?,?,?,?,?)""", (tid, nombre, tipo, len(contenido), archivo, autor, ahora()))
    con.execute("INSERT INTO ticket_notas (ticket_id, fecha, autor, texto) VALUES (?,?,?,?)",
                (tid, ahora(), autor, f"Adjuntó el archivo «{nombre}»"))
    con.execute("UPDATE tickets SET actualizado=? WHERE id=?", (ahora(), tid))
    return uno(con, tid)


def eliminar_adjunto(con, tid, aid, usuario):
    a = con.execute("SELECT * FROM ticket_adjuntos WHERE id=? AND ticket_id=?", (aid, tid)).fetchone()
    if not a:
        raise ValueError("El archivo no existe")
    if usuario["rol"] != "admin" and a["autor"] != usuario["email"]:
        raise ValueError("Solo quien subió el archivo o un administrador puede eliminarlo")
    con.execute("DELETE FROM ticket_adjuntos WHERE id=?", (aid,))
    try:
        ruta = os.path.join(ADJUNTOS_DIR, str(tid), a["archivo"])
        if os.path.isfile(ruta):
            os.remove(ruta)
    except OSError:
        pass
    return uno(con, tid)


def _servir_adjunto(h, con, tid, aid):
    a = con.execute("SELECT * FROM ticket_adjuntos WHERE id=? AND ticket_id=?", (aid, tid)).fetchone()
    if not a:
        return h.send_json({"error": "El archivo no existe"}, 404)
    ruta = os.path.join(ADJUNTOS_DIR, str(tid), a["archivo"])
    if not os.path.isfile(ruta):
        return h.send_json({"error": "El archivo ya no está en el servidor"}, 404)
    with open(ruta, "rb") as f:
        body = f.read()
    tipo = a["tipo"] or "application/octet-stream"
    disposicion = "inline" if tipo.startswith("image/") or tipo == "application/pdf" else "attachment"
    h.send_response(200)
    h.send_header("Content-Type", tipo)
    h.send_header("Content-Disposition", f"{disposicion}; filename*=UTF-8''{quote(a['nombre'])}")
    h.send_header("Content-Length", str(len(body)))
    h.end_headers()
    h.wfile.write(body)


def crear(con, data, autor):
    titulo = (data.get("titulo") or "").strip()
    if len(titulo) < 5:
        raise ValueError("Escribe un título de al menos 5 caracteres")
    tipo = data.get("tipo") if data.get("tipo") in TIPOS else "Mejora"
    cur = con.execute("""INSERT INTO tickets (titulo, descripcion, tipo, prioridad, estado, pagina, creado_por, creado, actualizado)
                         VALUES (?,?,?,?,?,?,?,?,?)""",
                      (titulo, (data.get("descripcion") or "").strip(), tipo, "Media", "Nuevo",
                       (data.get("pagina") or "")[:200], autor, ahora(), ahora()))
    return uno(con, cur.lastrowid)


def nota(con, tid, autor, texto):
    texto = (texto or "").strip()
    if not texto:
        raise ValueError("La nota está vacía")
    uno(con, tid)
    con.execute("INSERT INTO ticket_notas (ticket_id, fecha, autor, texto) VALUES (?,?,?,?)", (tid, ahora(), autor, texto))
    con.execute("UPDATE tickets SET actualizado=? WHERE id=?", (ahora(), tid))
    return uno(con, tid)


def subsanar(con, tid, autor, texto):
    """Solicitud de subsanación: cualquier usuario (incluido 'lector') reabre un tiquet
    Resuelto/Rechazado explicando qué quedó incompleto, con trazabilidad en los comentarios."""
    texto = (texto or "").strip()
    if not texto:
        raise ValueError("Cuéntanos qué quedó incompleto para poder reabrir el tiquet")
    t = uno(con, tid)
    if t["estado"] not in ("Resuelto", "Rechazado"):
        raise ValueError("Solo se puede solicitar subsanación de un tiquet resuelto o rechazado")
    con.execute("INSERT INTO ticket_notas (ticket_id, fecha, autor, texto) VALUES (?,?,?,?)",
                (tid, ahora(), autor, f"Solicitud de subsanación: {texto}"))
    con.execute("INSERT INTO ticket_notas (ticket_id, fecha, autor, texto) VALUES (?,?,?,?)",
                (tid, ahora(), autor, f"Estado: {t['estado']} → Nuevo (solicitud de subsanación)"))
    con.execute("UPDATE tickets SET estado='Nuevo', actualizado=? WHERE id=?", (ahora(), tid))
    return uno(con, tid)


def actualizar(con, tid, data, usuario):
    t = uno(con, tid)
    es_admin = usuario["rol"] == "admin"
    cambios = {}
    if es_admin:
        if "estado" in data:
            if data["estado"] not in ESTADOS:
                raise ValueError("Estado no válido")
            cambios["estado"] = data["estado"]
            cambios["revisado_por"] = usuario["email"]
        if data.get("prioridad") in PRIORIDADES:
            cambios["prioridad"] = data["prioridad"]
        if "nota_admin" in data:
            cambios["nota_admin"] = data["nota_admin"]
    if (es_admin or (t["creado_por"] == usuario["email"] and t["estado"] == "Nuevo")):
        for k in ("titulo", "descripcion", "tipo"):
            if k in data:
                cambios[k] = data[k]
    elif any(k in data for k in ("titulo", "descripcion", "tipo", "estado", "prioridad")):
        raise ValueError("Solo un administrador puede cambiar el estado; el autor puede editar mientras el tiquet esté en “Nuevo”")
    if not cambios:
        return t
    cambios["actualizado"] = ahora()
    con.execute(f"UPDATE tickets SET {','.join(k + '=?' for k in cambios)} WHERE id=?", [*cambios.values(), tid])
    if "estado" in cambios and cambios["estado"] != t["estado"]:
        txt = f"Estado: {t['estado']} → {cambios['estado']}" + (f". {data['nota_admin']}" if data.get("nota_admin") else "")
        con.execute("INSERT INTO ticket_notas (ticket_id, fecha, autor, texto) VALUES (?,?,?,?)", (tid, ahora(), usuario["email"], txt))
    return uno(con, tid)


def handle(h, method, p, con, usuario, runner=None, al_terminar=None):
    """Atiende /api/tickets…; h es el handler HTTP."""
    if method == "GET" and len(p) == 2:
        return h.send_json({"tickets": listar(con), "estados": ESTADOS, "tipos": TIPOS, "prioridades": PRIORIDADES,
                            "ejecucion": dict(runner.ESTADO) if runner else None, "claude_disponible": bool(runner and runner.cli())})
    if len(p) == 5 and p[3] == "adjuntos":
        if method == "GET":
            return _servir_adjunto(h, con, int(p[2]), int(p[4]))
        if method == "DELETE":
            return h.send_json(eliminar_adjunto(con, int(p[2]), int(p[4]), usuario))
    if len(p) == 4 and p[3] in ("ejecutar", "registro"):
        if usuario["rol"] != "admin":
            raise ValueError("Solo un administrador puede ordenar o revisar la ejecución de Claude")
        if p[3] == "registro" and method == "GET":
            return h.send_json({"registro": runner.leer_log(int(p[2])), "ejecucion": dict(runner.ESTADO)})
        if p[3] == "ejecutar" and method == "POST":
            tid = int(p[2])
            if uno(con, tid)["estado"] == "Nuevo":  # "Aceptar y ejecutar"
                actualizar(con, tid, {"estado": "Aceptado"}, usuario)
            return h.send_json(runner.iniciar(con, __import__("tickets"), tid, usuario, al_terminar))
    data = h.read_json() if method in ("POST", "PUT") else {}
    if method == "POST" and len(p) == 2:
        return h.send_json(crear(con, data, usuario["email"]), 201)
    if method == "POST" and len(p) == 4 and p[3] == "notas":
        return h.send_json(nota(con, int(p[2]), usuario["email"], data.get("texto")))
    if method == "POST" and len(p) == 4 and p[3] == "adjuntos":
        return h.send_json(adjuntar(con, int(p[2]), usuario["email"], data), 201)
    if method == "POST" and len(p) == 4 and p[3] == "subsanar":
        return h.send_json(subsanar(con, int(p[2]), usuario["email"], data.get("texto")))
    if method == "PUT" and len(p) == 3:
        return h.send_json(actualizar(con, int(p[2]), data, usuario))
    return h.send_json({"error": "no encontrado"}, 404)
