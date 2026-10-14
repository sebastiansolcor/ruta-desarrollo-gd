"""Ejecuta Claude Code en segundo plano para implementar un tiquet aceptado.

Lo dispara un administrador desde la plataforma (botón "Ejecutar con Claude").
- Una sola ejecución a la vez.
- Antes de empezar: copia de seguridad de la base y tiquet en "En desarrollo".
- Claude trabaja en modo no interactivo, solo dentro de esta carpeta: puede leer y editar archivos
  del proyecto y ejecutar comandos de Python; todo lo demás queda denegado.
- Al terminar: nota en el tiquet y, si cambió código del servidor, reinicio automático.
"""
import datetime as dt
import glob
import os
import shutil
import subprocess
import sys
import threading

BASE = os.path.dirname(os.path.abspath(__file__))
LOGS = os.path.join(BASE, "data", "claude_ejecuciones")
DB = os.path.join(BASE, "data", "ruta_rtb.db")  # el servidor lo actualiza con su base activa
ESTADO = {"activo": False, "ticket_id": None, "inicio": None, "fin": None, "codigo": None, "log": None, "por": None}
_lock = threading.Lock()


def cli():
    for c in (os.environ.get("CLAUDE_CLI"), shutil.which("claude"),
              os.path.join(os.path.expanduser("~"), ".local", "bin", "claude.exe")):
        if c and os.path.exists(c):
            return c
    return None


def mtimes():
    return {f: os.path.getmtime(f) for f in glob.glob(os.path.join(BASE, "*.py"))}


def prompt(tid):
    return f"""Eres el desarrollador de la plataforma local "Ruta Desarrollo de GD" de Solcor Colombia (seguimiento de proyectos
de generación distribuida solar desde el contrato hasta RTB). Un administrador te pidió desde la plataforma implementar el
TIQUET #{tid}. Trabaja solo sobre ese tiquet. Escribe todo en español con buena ortografía (tildes).

CONTEXTO
- Carpeta del proyecto (directorio actual): {BASE}. Windows. Python 3 (librería estándar, pypdf y pymupdf). No hay Node.
- Backend: server.py (http.server + SQLite en data/ruta_rtb.db), sync.py (lectura de SharePoint), seed.py (catálogo),
  auth.py, tickets.py, extras.py, claude_runner.py. Frontend: static/index.html, static/app.js (SPA en JS puro; vistas vXxx y render()),
  static/styles.css (marca SOLCOR: azul #2D3A45, verdes #44D52D a #D3DD07; modo claro y oscuro). Lee README.md primero.
- El servidor ya hizo una copia de seguridad de la base y puso el tiquet "En desarrollo".

PASOS
1. Lee el tiquet: python tickets_cli.py ver {tid}  (descripción, pantalla, notas y comentarios del administrador).
2. Si es ambiguo, o pide borrar datos, cambiar inicio de sesión o permisos, manejar contraseñas o claves, enviar correos,
   publicar algo fuera del PC, instalar programas o escribir en SharePoint/OneDrive: NO lo implementes. Deja una pregunta
   concreta con: python tickets_cli.py nota {tid} "<pregunta>"  y termina.
3. Implementa el cambio mínimo y limpio que cumple lo pedido, siguiendo el estilo existente. Si necesitas columnas nuevas,
   agrégalas con una migración idempotente en init_db() de server.py (ALTER TABLE en try/except); nunca borres datos.
4. Verifica: python -c "import ast,glob;[ast.parse(open(f,encoding='utf-8').read()) for f in glob.glob('*.py')]"
   Revisa con cuidado la sintaxis de static/app.js (comillas invertidas, llaves y paréntesis balanceados).
   NO reinicies el servidor: se reinicia solo cuando termines.
5. Cierra con: python tickets_cli.py estado {tid} "Listo para revisar" "<resumen en lenguaje sencillo: qué cambió, dónde verlo
   en la plataforma y qué archivos modificaste>"
6. Si algo falla y no puedes arreglarlo, deja el código como estaba y explica el problema con
   python tickets_cli.py nota {tid} "<explicación>".

REGLAS: no marques el tiquet como Resuelto ni Rechazado; no uses git; no toques las tablas usuarios ni sesiones;
no modifiques archivos fuera de esta carpeta. Al final responde con un resumen de 3 a 5 líneas."""


def iniciar(con, tickets_mod, tid, usuario, al_terminar):
    """Lanza la ejecución. Devuelve el estado o lanza ValueError si no es posible."""
    exe = cli()
    if not exe:
        raise ValueError("No se encontró Claude Code en este PC (claude.exe)")
    with _lock:
        if ESTADO["activo"]:
            raise ValueError(f"Claude ya está trabajando en el tiquet #{ESTADO['ticket_id']}; espera a que termine")
        t = tickets_mod.uno(con, tid)
        if t["estado"] not in ("Aceptado", "En desarrollo"):
            raise ValueError("Solo se pueden ejecutar tiquets aceptados")
        os.makedirs(LOGS, exist_ok=True)
        ahora = dt.datetime.now()
        shutil.copy(DB, os.path.join(os.path.dirname(DB), f"ruta_rtb_antes_tiquet_{tid}.db"))
        con.execute("UPDATE tickets SET estado='En desarrollo', actualizado=? WHERE id=?", (tickets_mod.ahora(), tid))
        con.execute("INSERT INTO ticket_notas (ticket_id, fecha, autor, texto) VALUES (?,?,?,?)",
                    (tid, tickets_mod.ahora(), usuario["email"],
                     f"Estado: {t['estado']} → En desarrollo. Ejecución de Claude iniciada desde la plataforma."))
        log = os.path.join(LOGS, f"tiquet_{tid}_{ahora:%Y%m%d_%H%M%S}.log")
        ESTADO.update(activo=True, ticket_id=tid, inicio=ahora.isoformat(timespec="seconds"), fin=None, codigo=None,
                      log=log, por=usuario["email"])
    antes = mtimes()
    cmd = [exe, "-p", prompt(tid), "--permission-mode", "acceptEdits",
           "--allowedTools", "Read", "Edit", "Write", "Glob", "Grep", "Bash(python *)", "Bash(python:*)",
           "--output-format", "text"]

    def correr():
        codigo = -1
        try:
            with open(log, "w", encoding="utf-8") as f:
                f.write(f"Inicio: {ESTADO['inicio']} · tiquet #{tid} · ordenado por {usuario['email']}\n\n")
                f.flush()
                env = dict(os.environ, RUTA_DB=DB, PYTHONIOENCODING="utf-8")
                p = subprocess.run(cmd, cwd=BASE, env=env, stdout=f, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                                   creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0), timeout=60 * 60)
                codigo = p.returncode
        except subprocess.TimeoutExpired:
            codigo = "tiempo agotado (60 min)"
        except Exception as e:  # noqa: BLE001
            with open(log, "a", encoding="utf-8") as f:
                f.write(f"\nError al ejecutar: {e}\n")
        cambio_backend = mtimes() != antes
        ESTADO.update(activo=False, fin=dt.datetime.now().isoformat(timespec="seconds"), codigo=codigo)
        al_terminar(tid, codigo, cambio_backend, log)

    threading.Thread(target=correr, daemon=True).start()
    return dict(ESTADO)


def leer_log(tid, max_chars=12000):
    logs = sorted(glob.glob(os.path.join(LOGS, f"tiquet_{tid}_*.log")))
    if not logs:
        return ""
    with open(logs[-1], encoding="utf-8", errors="ignore") as f:
        txt = f.read()
    return txt[-max_chars:]


def reiniciar_servidor():
    """Inicia una nueva instancia del servidor y cierra la actual (para cargar código nuevo de Python)."""
    flags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    subprocess.Popen([sys.executable, os.path.join(BASE, "server.py"), "--no-browser"], cwd=BASE, creationflags=flags,
                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, close_fds=True)
    threading.Timer(1.5, lambda: os._exit(0)).start()
