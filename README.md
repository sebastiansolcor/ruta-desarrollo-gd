# Ruta Desarrollo de GD – Plataforma de habilitación de proyectos

Seguimiento de proyectos GD, comunidades energéticas y autogeneración remota
desde el contrato firmado hasta RTB: trámites, tiempos reales por entidad y
comparativo de OR, CAR y entidades nacionales.

## Ejecutar en local

Requiere solo Python 3.10+ (sin librerías adicionales).

```
python server.py
```

o doble clic en `iniciar.bat`. Abre http://127.0.0.1:8765.
La base de datos queda en `data/ruta_rtb.db` (SQLite).

## Módulos

| Vista | Para qué |
|---|---|
| Tablero | KPIs, alertas de trámites vencidos / por vencer, mapa y entidades más lentas |
| Proyectos | Registro y detalle: avance por etapa, viabilidad, RTB estimado, línea de tiempo y trámites |
| Planificador de ruta | Simula la ruta de un proyecto nuevo y estima su RTB con los tiempos reales registrados |
| Comparativo entidades | Tiempos promedio, mediana, % en plazo y % con requerimiento por entidad o tipo de trámite |
| Catálogo | Entidades (33 CAR, autoridades urbanas, nacionales, OR, operadores de hidrocarburos, ductos…) y tipos de trámite con plazo legal |
| Datos | Exportar CSV para el análisis, respaldo/restauración JSON, datos de ejemplo |

## Cómo se miden los tiempos

- Días desde el día siguiente al radicado hasta la respuesta (u hoy si sigue pendiente).
- Días hábiles de Colombia: sin sábados, domingos ni festivos (Ley Emiliani y Semana Santa calculados automáticamente).
- Se descuenta el tiempo suspendido entre "Requerimiento de la entidad" y "Respuesta a requerimiento" (Ley 1755/2015, art. 17).
- **Los plazos del catálogo son referenciales**: validarlos en el diagnóstico normativo y ajustarlos en Catálogo → Tipos de trámite.

## Flujo de uso

1. Proyecto con contrato firmado → **+ Nuevo proyecto** (se generan los trámites base según la figura y la capacidad; la CAR, el OR y la alcaldía se asignan según el departamento y el municipio).
2. En cada trámite → **Registrar evento**: Radicado, Requerimiento, Respuesta a requerimiento, Respuesta de la entidad (con resultado).
3. Cuando una respuesta revele un hallazgo (solapamiento con un bloque ANH, un ducto, un título minero…) → **+ Agregar consulta** con la consulta adicional (Ecopetrol, Cenit, Ocensa, titular minero…).

## Sincronización con SharePoint (`sync.py`)

Lee `Desarrollo GD/01 Pipeline/<E1..E4>` desde la copia sincronizada con OneDrive (pestaña **SharePoint**).
Por cada carpeta de proyecto:

| Carpeta | Qué extrae |
|---|---|
| `4 Conexión/ECS/<GD n>` | Un proyecto por GD (comparten predio y consultas). Del PDF *Solicitud*: fecha, coordenadas, kW AC, OR y circuito. *Insumos* = respuesta del OR. `Documentos enviados a <OR>` = ECS radicado. `para cargar a` = aviso de pendiente |
| `2 Consultas/Cartas solicitud…/<entidad>` | Radicado: fecha del pantallazo de envío o de la carta (nombre `AAAAMMDD`, o la carpeta). `…respuesta requerimiento` = respuesta de Solcor al requerimiento |
| `2 Consultas/Respuesta…/<entidad>` | Fecha oficial del oficio (leída del PDF), radicado de la entidad, requerimiento o respuesta final y resultado (favorable / con condiciones) |
| `3 Jurídico/Contrato…` | Fecha del primer PDF firmado (`signed`) = fecha de contrato (entregable Jurídico) |
| `3 Jurídico/…títulos…` | Estudio de títulos (fecha del primer archivo; indica si es versión preliminar) |
| Carpetas o archivos con *layout preliminar*, *ingeniería básica*, *AutoCAD* / `.dwg`, *topografía*, *hidrología / hidrografía*, *pull-out* | Entregables de Ingeniería y Predial |
| Archivos con *PVsyst* (PDF) | Siempre el reporte más reciente de cada GD; extrae P50, P75 y P90 (MWh/año) |
| `4 Conexión/ECS/<GD n>` con *aprobación / concepto / FPO* | Aprobación del ECS y fecha de puesta en operación (FPO) |

### Estructura de la fase de Desarrollo
Prefactibilidad se supera con la firma del contrato. Desde ahí avanzan **en paralelo**:
- **Factibilidad**, con 6 áreas paralelas: Solapamientos, Jurídico, Conexión, Ingeniería, Predial y Social (su % es el promedio de las 6 áreas).
- **Licenciamiento**: uso del suelo, licencias de cerramiento y bases, incentivos UPME y permisos que apliquen.
- **RTB** se declara cuando ambas están al 100 % y sin resultados desfavorables.

- Cada evento guarda el archivo de origen y no se duplica al volver a sincronizar.
- La sincronización automática (cada 30 min por defecto y al iniciar) aplica solo lo que tiene fecha clara; lo dudoso (fecha de modificación, respuesta anterior al radicado, resultado no legible) queda en la pestaña SharePoint para revisión.

## Herramientas de coordinación

| Función | Dónde |
|---|---|
| Circuito, capacidad de la subestación y GD de Solcor por circuito (alerta de saturación) | Red y circuitos · detalle del proyecto |
| Vigencia de documentos obtenidos (licencias: 24 meses por defecto) | Tablero · editar trámite |
| Abrir el documento de origen en SharePoint o en el PC | Historial de cada trámite |
| Calidad de datos (inconsistencias y faltantes) | Tablero |
| Carta de insistencia (Word) y queja ante la SSPD cuando el OR no responde | Trámite vencido |
| Responsable, fecha compromiso, Mis pendientes y resumen semanal | Mis pendientes |
| Embudo E1 → E4, Descartados, causas de descarte y ubicación de carpetas | Embudo del pipeline |
| Layout del predio sobre imagen satelital | Detalle del proyecto |
| Costos de desarrollo (lee comprobantes de pago) y presupuesto | Detalle del proyecto |

## Soporte y tiquets

- Botón **?** (abajo a la derecha) y pestaña **Soporte**: asistente con respuestas sobre la plataforma y creación de tiquets (mejora, error, duda, dato incorrecto). Cualquier usuario con sesión puede crearlos y comentarlos.
- Solo un **administrador** acepta, rechaza, prioriza o cierra. Flujo: Nuevo → Aceptado → En desarrollo → Listo para revisar → Resuelto (o Rechazado).
- Los tiquets **Aceptados** son la cola de Claude: `python tickets_cli.py pendientes`. La tarea programada “Tiquets – Ruta Desarrollo de GD” los implementa, hace copia de la base antes de cada cambio y los deja en “Listo para revisar”; nunca los cierra.

## Paso a la nube (siguiente fase)

- En la nube, `sync.py` se conecta a SharePoint con Microsoft Graph (registro de app en Entra ID) en lugar de la carpeta de OneDrive; las reglas de lectura son las mismas.

- El backend es una API REST simple (`/api/state`, `/api/<tabla>`, `/api/proyectos/completo`, `/api/export/tramites.csv`, `/api/backup`).
- Opción rápida: desplegar `server.py` en un servicio con disco persistente (Azure App Service / Render / Railway) y agregar autenticación (por ejemplo, Microsoft Entra ID, ya que Solcor usa Microsoft 365).
- Opción robusta: migrar SQLite a PostgreSQL y el servidor a FastAPI; el frontend (`static/`) se mantiene igual.
- Migrar los datos con **Datos → Descargar respaldo** y restaurarlo en la nueva instancia.
