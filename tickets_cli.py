"""Cola de tiquets para Claude (uso desde la terminal o desde la tarea programada).

  python tickets_cli.py pendientes                 -> tiquets "Aceptado" en JSON (la cola de trabajo)
  python tickets_cli.py ver <id>                   -> un tiquet con sus notas
  python tickets_cli.py estado <id> <estado> "<nota>"
        estados: "En desarrollo" | "Listo para revisar"   (Claude no puede marcar Resuelto ni Rechazado)
  python tickets_cli.py nota <id> "<texto>"
"""
import json
import os
import sqlite3
import sys

import tickets

DB = os.environ.get("RUTA_DB") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "ruta_rtb.db")
AUTOR = "Claude (asistente de desarrollo)"
PERMITIDOS = {"En desarrollo", "Listo para revisar"}


def con():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys = ON")
    tickets.init(c)
    return c


def main(a):
    if not a:
        print(__doc__)
        return 1
    with con() as c:
        if a[0] == "pendientes":
            print(json.dumps(tickets.listar(c, ["Aceptado"]), ensure_ascii=False, indent=1))
        elif a[0] == "ver" and len(a) > 1:
            print(json.dumps(tickets.uno(c, int(a[1])), ensure_ascii=False, indent=1))
        elif a[0] == "estado" and len(a) > 2:
            if a[2] not in PERMITIDOS:
                print(f"Claude solo puede usar: {', '.join(sorted(PERMITIDOS))}")
                return 1
            t = tickets.uno(c, int(a[1]))
            c.execute("UPDATE tickets SET estado=?, actualizado=? WHERE id=?", (a[2], tickets.ahora(), t["id"]))
            tickets.nota(c, t["id"], AUTOR, f"Estado: {t['estado']} → {a[2]}" + (f". {a[3]}" if len(a) > 3 else ""))
            print("ok")
        elif a[0] == "nota" and len(a) > 2:
            tickets.nota(c, int(a[1]), AUTOR, a[2])
            print("ok")
        else:
            print(__doc__)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
