# Línea de Producción (linea_produccion)

Conjunto de módulos para **Odoo 18** que conectan el Punto de Venta (POS) con una
línea de producción secuencial tipo *maquiladora*: desde la captura del pedido y su
fecha de entrega en el POS, hasta el avance del pedido etapa por etapa en un
dashboard de producción en tiempo real.

## Índice de módulos

| Módulo | Tipo | Descripción |
|---|---|---|
| `mrp_pos_workflow` | Propio | Núcleo de la línea de producción: etapas, dashboard en tiempo real, grupos de seguridad y asignación de costureros. |
| `pos_maquiladora` | Propio | Extensión del POS: captura de fecha de entrega, notas y botón "Enviar a Producción". |
| `web_favicon` | OCA (`OCA/web`) | Favicon (shortcut icon) personalizable por compañía. |
| `web_responsive` | OCA (`OCA/web`) | Cliente web responsivo, útil para operar el dashboard desde tablets/celulares en planta. |

---

## mrp_pos_workflow

Gestiona una línea de producción secuencial alimentada por los pedidos del POS.

**Etapas (avance estricto, sin saltos):**

`Borrador → Pintado y Corte → Plantilla → Diseño → Suela → Logística → Pagado`

**Características:**

- Dashboard de producción tipo columnas (kanban) en el backend, con sincronización
  en tiempo real vía `bus.bus` (canal `mrp_pos_workflow_channel`): cuando un pedido
  avanza de etapa, todas las pantallas abiertas se actualizan sin recargar.
- Botón **Liberar** en cada tarjeta para pasar el pedido a la siguiente etapa.
- Columnas renombrables: el nombre personalizado se guarda en
  `ir.config_parameter` y persiste entre sesiones.
- Vista del dashboard según rol:
  - **Administrador de Línea de Producción**: pipeline completo.
  - **Operadores por etapa**: únicamente las columnas de su grupo
    (Pintado y Corte, Plantilla, Diseño, Suela, Logística).
- Asignación de costureros por pedido (máximo 2 asignaciones con cantidad),
  con diálogo de asignación y modelos `pos.sewing.operator` /
  `pos.order.sewing.line`.
- Costureros disponibles configurables por punto de venta (`pos.config`).
- Generación de factura desde el pedido POS (`action_generate_invoice`).

**Seguridad:** categoría *Línea de Producción* con los grupos
`Operador de Producción`, `Administrador de Línea de Producción` y un grupo por
etapa (define `mrp_pos_workflow/security/res_groups.xml`).

**Dependencias:** `point_of_sale`, `bus`, `hr`. **Licencia:** AGPL-3.

## pos_maquiladora

Extiende la interfaz del POS para el flujo de maquila:

- Botón **Fecha de Entrega** en la pantalla de ticket (dialogo date/time).
- Botón de **nota general** y parches de los botones de control del POS.
- Botón **Enviar a Producción**, que valida antes de liberar el pedido:
  - cliente seleccionado,
  - al menos una línea de producto,
  - fecha de captura de entrega definida.

Al cumplir las validaciones, el pedido pasa de `Borrador` a **Pintado y Corte** y
se notifica al dashboard por el bus.

**Dependencias:** `point_of_sale`, `bus`, `mrp_pos_workflow`. **Licencia:** AGPL-3.

## web_favicon y web_responsive

Módulos tomados de `OCA/web` (versión 18.0) sin cambios funcionales relevantes:
permiten personalizar el favicon de la instancia y usar el backend desde
dispositivos móviles/tablets en la línea de producción.
Licencias: AGPL-3 (`web_favicon`) y LGPL-3 (`web_responsive`).

---

## Instalación

1. Añadir esta carpeta (o sus subcarpetas) al `addons_path` de Odoo 18:

   ```ini
   addons_path = /path/to/linea_produccion
   ```

2. Instalar los módulos desde *Aplicaciones* (o vía CLI):

   ```bash
   odoo-bin -d <bd> -i mrp_pos_workflow,pos_maquiladora,web_responsive,web_favicon --stop-after-init
   ```

   > `pos_maquiladora` depende de `mrp_pos_workflow`, por lo que puede instalarse
   > solo este último y Odoo resolverá la cadena.

3. Actualizar el navegador del POS (limpiar caché de assets) tras cada actualización
   de módulo (`-u pos_maquiladora,mrp_pos_workflow`).

## Configuración

1. **Usuarios y grupos** (*Ajustes > Usuarios*): asignar
   *Operador de Producción* al personal de planta y el grupo de su etapa
   (Pintado y Corte, Plantilla, Diseño, Suela, Logística);
   *Administrador de Línea de Producción* para ver el pipeline completo.
2. **Punto de venta** (*Ajustes > Punto de Venta*): registrar los
   *Costureros / Operadores de Costura* disponibles en la configuración del POS.
3. Abrir *Línea de Producción > Dashboard de Producción* en las pantallas de cada
   área y dejarlo abierto: se actualiza solo.

## Flujo de uso

1. En el POS, crear el ticket, capturar **Fecha de Entrega** (y notas si aplica),
   seleccionar cliente y pulsar **Enviar a Producción**.
2. El pedido entra a la columna **Pintado y Corte** del dashboard en tiempo real.
3. Cada área pulsa **Liberar** al terminar su etapa; el pedido avanza de forma
   secuencial hasta **Logística → Pagado**.
4. Desde el pedido (o el diálogo de asignación) se asignan hasta 2 costureros con
   cantidades.

## Pruebas

```bash
odoo-bin -d <bd_test> -i mrp_pos_workflow --test-tags /mrp_pos_workflow --stop-after-init
odoo-bin -d <bd_test> -i web_favicon,web_responsive --test-tags /web_favicon,/web_responsive --stop-after-init
```

## Licencia

- `mrp_pos_workflow`, `pos_maquiladora`, `web_favicon`: AGPL-3.
- `web_responsive`: LGPL-3 (OCA).
