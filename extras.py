"""Funciones de apoyo: embudo del pipeline, layout del predio y cartas de insistencia."""
import base64
import datetime as dt
import html
import os
import re

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
         "noviembre", "diciembre"]


def fecha_larga(iso):
    if not iso:
        return "—"
    d = dt.date.fromisoformat(iso)
    return f"{d.day} de {MESES[d.month - 1]} de {d.year}"


# ------------------------------------------------------------------ embudo del pipeline
def n_gd(nombre):
    """'Santana 1 y 2' -> 2 · 'Guayupe 1 2 y 3' -> 3 · 'Pasacaballos' -> 1."""
    resto = re.sub(r"^\s*GD\s*\d+\s*", "", nombre, flags=re.I)
    m = re.search(r"(\d{1,2}(?:\s*(?:,|y|-)?\s*\d{1,2})*)\s*$", resto)
    return len(re.findall(r"\d{1,2}", m[1])) if m else 1


def pipeline(root):
    """Etapas = subcarpetas de 01 Pipeline (E1..E4); además Descartados de 02 Archivo.
    Standby no se usa: todo proyecto está en una etapa del pipeline o descartado."""
    out = []
    if not os.path.isdir(root):
        return {"error": f"No se encontró la carpeta {root}", "etapas": []}
    etapas = [(d, os.path.join(root, d)) for d in sorted(os.listdir(root)) if os.path.isdir(os.path.join(root, d))]
    archivo = os.path.join(os.path.dirname(root), "02 Archivo", "Descartados")
    if os.path.isdir(archivo):
        etapas.append(("Descartados", archivo))
    for nombre, ruta in etapas:
        proys = []
        for d in sorted(os.listdir(ruta)):
            if os.path.isdir(os.path.join(ruta, d)) and not d.startswith(("_", ".")):
                proys.append({"carpeta": f"{nombre}/{d}", "nombre": d, "gd": n_gd(d) if re.match(r"\s*GD\s*\d", d, re.I) else 0})
        out.append({"etapa": nombre, "proyectos": proys, "carpetas": len(proys), "gd": sum(p["gd"] for p in proys)})
    return {"etapas": out}


# ------------------------------------------------------------------ layout del predio (KML)
def _walk(folder):
    for dp, dns, fns in os.walk(folder):
        for fn in fns:
            yield os.path.join(dp, fn)


def layout(folder, n_sub=None):
    """Polígonos, líneas y puntos del layout KML más reciente (prefiere 'detalle'). Marca los del GD n_sub."""
    kmls = [p for p in _walk(folder) if p.lower().endswith(".kml") and "layout" in p.lower()]
    if not kmls:
        return {"features": [], "archivo": None}
    kmls.sort(key=lambda p: ("detalle" in os.path.basename(p).lower(), os.path.getmtime(p)))
    path = kmls[-1]
    with open(path, encoding="utf-8", errors="ignore") as f:
        txt = f.read()
    feats = []
    for m in re.finditer(r"<Placemark>.*?</Placemark>", txt, re.S):
        pm = m[0]
        nombre = (re.search(r"<name>(.*?)</name>", pm, re.S) or [None, ""])[1].strip()
        nombre = html.unescape(re.sub(r"<!\[CDATA\[|\]\]>", "", nombre))
        gd = re.search(r"GD\s*(\d+)", nombre, re.I)
        tipo = "Polygon" if "<Polygon" in pm else "LineString" if "<LineString" in pm else "Point"
        c = re.search(r"<coordinates>(.*?)</coordinates>", pm, re.S)
        if not c:
            continue
        coords = []
        for x in c[1].split():
            parts = x.split(",")
            if len(parts) >= 2:
                coords.append([float(parts[1]), float(parts[0])])
        mesa = nombre.lower().startswith("mesa")
        feats.append({"nombre": nombre, "tipo": tipo, "coords": coords, "mesa": mesa,
                      "propio": bool(gd and n_sub and gd[1] == str(n_sub)), "gd": gd[1] if gd else None})
    return {"features": feats, "archivo": os.path.basename(path)}


# ------------------------------------------------------------------ cartas
def _logo_b64(static_dir):
    p = os.path.join(static_dir, "logo-solcor.png")
    try:
        with open(p, "rb") as f:
            return base64.b64encode(f.read()).decode()
    except OSError:
        return ""


def carta(tipo, t, p, ent, cfg, eventos, static_dir):
    """Documento Word (HTML) de insistencia por vencimiento o de queja ante la SSPD contra el OR."""
    e = lambda s: html.escape(str(s or ""))
    hoy = dt.date.today().isoformat()
    rad = t.get("radicado_num") or "[n.º de radicado]"
    reqs = [v for v in eventos if v["tipo"] == "Requerimiento de la entidad"]
    req_txt = (f" La entidad formuló requerimiento de información el {fecha_larga(reqs[0]['fecha'])}, que fue atendido oportunamente."
               if reqs else "")
    proyecto = f"“{e(p['nombre'])}”, predio {e(p.get('predio') or '')}, municipio de {e(p.get('municipio') or '')}, departamento de {e(p.get('departamento') or '')}"
    if tipo == "sspd":
        destinatario = "Superintendencia de Servicios Públicos Domiciliarios – SSPD<br>Delegada para Energía y Gas Combustible"
        asunto = (f"Queja por falta de respuesta del operador de red {e(ent['sigla'])} a la solicitud radicada con el n.º {e(rad)} "
                  f"del {fecha_larga(t.get('fecha_radicado'))} – proyecto de Generación Distribuida {e(p['nombre'])}")
        cuerpo = f"""
<p>{e(cfg['firmante_nombre'])}, en calidad de {e(cfg['firmante_cargo']).lower()} de {e(cfg['empresa'])}, NIT {e(cfg['nit'])}, presento
queja contra {e(ent['nombre'])} ({e(ent['sigla'])}) por no responder dentro del término establecido la solicitud
“{e(t['nombre'])}” radicada el {fecha_larga(t.get('fecha_radicado'))} bajo el n.º {e(rad)}, para el proyecto {proyecto}.{req_txt}</p>
<p>A la fecha han transcurrido más días de los previstos en la Resolución CREG 174 de 2021 y en el artículo 14 de la Ley 1437 de 2011,
sustituido por la Ley 1755 de 2015, sin que el operador de red haya emitido respuesta de fondo.</p>
<p><b>Solicitudes</b></p>
<ol><li>Requerir a {e(ent['sigla'])} para que responda de fondo la solicitud en el menor tiempo posible.</li>
<li>Verificar el cumplimiento de los plazos del procedimiento de conexión de generación distribuida establecidos por la CREG.</li>
<li>Informar a esta sociedad las actuaciones adelantadas.</li></ol>"""
    else:
        destinatario = f"{e(ent['nombre'])} – {e(ent['sigla'])}<br>Atención al ciudadano / PQRSD"
        asunto = (f"Insistencia – Derecho de petición radicado con el n.º {e(rad)} del {fecha_larga(t.get('fecha_radicado'))} "
                  f"– proyecto de Generación Distribuida {e(p['nombre'])}")
        cuerpo = f"""
<p>{e(cfg['firmante_nombre'])}, en calidad de {e(cfg['firmante_cargo']).lower()} de {e(cfg['empresa'])}, NIT {e(cfg['nit'])},
me permito reiterar la petición “{e(t['nombre'])}” radicada ante esa entidad el {fecha_larga(t.get('fecha_radicado'))} bajo el
n.º {e(rad)}, relacionada con el proyecto {proyecto}.{req_txt}</p>
<p>De acuerdo con el artículo 14 de la Ley 1437 de 2011, sustituido por el artículo 1 de la Ley 1755 de 2015, las peticiones deben
resolverse dentro de los quince (15) días hábiles siguientes a su recepción, término que a la fecha se encuentra vencido sin que se
haya recibido respuesta. Si no es posible resolver en ese plazo, la entidad debe informarlo y señalar la fecha en que dará respuesta
(parágrafo del artículo 14).</p>
<p><b>Petición</b></p>
<ol><li>Dar respuesta de fondo a la solicitud radicada con el n.º {e(rad)}.</li>
<li>En caso de requerir información adicional, indicarla expresamente para aportarla de inmediato.</li></ol>
<p>Recordamos que la falta de atención a las peticiones dentro de los términos legales constituye falta para el servidor público
(artículo 31 de la Ley 1437 de 2011, sustituido por la Ley 1755 de 2015).</p>"""
    logo = _logo_b64(static_dir)
    return f"""<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>{asunto}</title>
<style>body{{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.35}} p{{text-align:justify;margin:0 0 10pt}}
.asunto{{font-weight:bold}} .firma{{margin-top:36pt}}</style></head><body>
{f'<p><img src="data:image/png;base64,{logo}" width="170"></p>' if logo else ''}
<p>Bogotá D.C., {fecha_larga(hoy)}</p>
<p>Señores<br>{destinatario}</p>
<p class="asunto">Asunto: {asunto}</p>
<p>Respetados señores:</p>
{cuerpo}
<p><b>Notificaciones</b><br>Correo electrónico: {e(cfg['correo'])} · Teléfono: {e(cfg['telefono'])} · Dirección: {e(cfg['direccion'])}</p>
<p>Cordialmente,</p>
<p class="firma"><b>{e(cfg['firmante_nombre'])}</b><br>{e(cfg['firmante_cargo'])}<br>{e(cfg['empresa'])}</p>
</body></html>"""
