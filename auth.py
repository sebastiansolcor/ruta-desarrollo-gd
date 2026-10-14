"""Inicio de sesión con correo y contraseña.

- Contraseñas guardadas con PBKDF2-SHA256 (sal aleatoria, 240 000 iteraciones); nunca en texto plano.
- Sesiones con token aleatorio en cookie HttpOnly; se guarda solo el hash del token.
- Roles: admin (todo + usuarios), editor (registra y edita), lector (solo consulta).
"""
import datetime as dt
import hashlib
import hmac
import os
import re
import secrets

ITER = 240_000
SESION_DIAS = 7
ROLES = ("admin", "editor", "lector")

SCHEMA = """
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, nombre TEXT, hash TEXT NOT NULL,
  rol TEXT DEFAULT 'editor', activo INTEGER DEFAULT 1, creado TEXT DEFAULT (datetime('now')), ultimo_ingreso TEXT);
CREATE TABLE IF NOT EXISTS sesiones (
  token_hash TEXT PRIMARY KEY, usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, expira TEXT NOT NULL);
"""


def init(con):
    con.executescript(SCHEMA)
    con.execute("DELETE FROM sesiones WHERE expira < ?", (dt.datetime.now().isoformat(),))


def hash_password(pw):
    sal = os.urandom(16)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), sal, ITER)
    return f"pbkdf2${ITER}${sal.hex()}${h.hex()}"


def check_password(pw, guardado):
    try:
        _, it, sal, h = guardado.split("$")
        calc = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), bytes.fromhex(sal), int(it))
        return hmac.compare_digest(calc.hex(), h)
    except (ValueError, AttributeError):
        return False


def validar(email, pw=None):
    email = (email or "").strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise ValueError("Correo no válido")
    if pw is not None and len(pw) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres")
    return email


def _th(token):
    return hashlib.sha256(token.encode()).hexdigest()


def hay_usuarios(con):
    return con.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0] > 0


def publico(u):
    return {k: u[k] for k in ("id", "email", "nombre", "rol", "activo", "creado", "ultimo_ingreso")} if u else None


def crear_usuario(con, email, nombre, pw, rol="editor"):
    email = validar(email, pw)
    if rol not in ROLES:
        raise ValueError("Rol no válido")
    if con.execute("SELECT 1 FROM usuarios WHERE email=?", (email,)).fetchone():
        raise ValueError("Ya existe un usuario con ese correo")
    cur = con.execute("INSERT INTO usuarios (email, nombre, hash, rol) VALUES (?,?,?,?)",
                      (email, (nombre or "").strip() or email.split("@")[0], hash_password(pw), rol))
    return dict(con.execute("SELECT * FROM usuarios WHERE id=?", (cur.lastrowid,)).fetchone())


def login(con, email, pw):
    u = con.execute("SELECT * FROM usuarios WHERE email=? AND activo=1", ((email or "").strip().lower(),)).fetchone()
    if not u or not check_password(pw or "", u["hash"]):
        return None, None
    token = secrets.token_urlsafe(32)
    expira = (dt.datetime.now() + dt.timedelta(days=SESION_DIAS)).isoformat()
    con.execute("INSERT INTO sesiones (token_hash, usuario_id, expira) VALUES (?,?,?)", (_th(token), u["id"], expira))
    con.execute("UPDATE usuarios SET ultimo_ingreso=datetime('now') WHERE id=?", (u["id"],))
    return token, dict(u)


def usuario_de(con, token):
    if not token:
        return None
    r = con.execute("""SELECT u.* FROM sesiones s JOIN usuarios u ON u.id=s.usuario_id
                       WHERE s.token_hash=? AND s.expira>? AND u.activo=1""", (_th(token), dt.datetime.now().isoformat())).fetchone()
    return dict(r) if r else None


def logout(con, token):
    if token:
        con.execute("DELETE FROM sesiones WHERE token_hash=?", (_th(token),))


def cambiar_password(con, uid, nueva):
    validar("x@x.co", nueva)
    con.execute("UPDATE usuarios SET hash=? WHERE id=?", (hash_password(nueva), uid))
    con.execute("DELETE FROM sesiones WHERE usuario_id=?", (uid,))  # cierra las demás sesiones
