import logging

from odoo import _, api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class PosOrder(models.Model):
    _inherit = "pos.order"

    # Canal WebSocket (bus.bus) para la sincronización en tiempo real del dashboard.
    PRODUCTION_CHANNEL = "mrp_pos_workflow_channel"

    PRODUCTION_STAGES = [
        ("draft", "Borrador"),
        ("pintado_corte", "Pintado y Corte"),
        ("plantilla", "Plantilla"),
        ("diseno", "Diseño"),
        ("suela", "Suela"),
        ("logistica", "Logistica"),
        ("paid", "Pagado"),
    ]

    DASHBOARD_STAGES = [
        "pintado_corte",
        "plantilla",
        "diseno",
        "suela",
        "logistica",
        "paid",
    ]

    STAGE_GROUP_MAPPING = {
        "pintado_corte": "mrp_pos_workflow.group_stage_pintado_corte",
        "plantilla": "mrp_pos_workflow.group_stage_plantilla",
        "diseno": "mrp_pos_workflow.group_stage_diseno",
        "suela": "mrp_pos_workflow.group_stage_suela",
        "logistica": "mrp_pos_workflow.group_stage_logistica",
    }

    production_stage = fields.Selection(
        selection=PRODUCTION_STAGES,
        string="Etapa de Producción",
        default="draft",
        required=True,
        tracking=True,
    )

    sewing_line_ids = fields.One2many(
        "pos.order.sewing.line",
        "order_id",
        string="Asignaciones de Costura",
    )

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if not vals.get("production_stage"):
                vals["production_stage"] = "draft"
            vals.pop("production_state", None)
        return super().create(vals_list)

    def write(self, vals):
        if "production_stage" in vals and not vals.get("production_stage"):
            vals.pop("production_stage")
        vals.pop("production_state", None)
        return super().write(vals)

    @api.model
    def _process_order(self, order, existing_order):
        order.pop("production_state", None)
        order.pop("sewing_line_ids", None)
        if existing_order:
            order.pop("production_stage", None)
        elif not order.get("production_stage"):
            order["production_stage"] = "draft"
        return super()._process_order(order, existing_order)

    def _notify_production_channel(self):
        for order in self:
            payload = {
                "order_id": order.id,
                "order_name": order.name,
                "production_stage": order.production_stage,
                "action": "stage_changed",
            }
            _logger.info(
                ">>> BUS SENT: channel=%s message_type=production_stage_changed payload=%s",
                self.PRODUCTION_CHANNEL,
                payload,
            )
            order.env["bus.bus"]._sendone(
                self.PRODUCTION_CHANNEL,
                "production_stage_changed",
                payload,
            )
            _logger.info(
                ">>> BUS SENT OK: order=%s stage=%s",
                order.name,
                order.production_stage,
            )

    def action_next_stage(self):
        for order in self:
            stages = [stage[0] for stage in self.PRODUCTION_STAGES]
            current_index = stages.index(order.production_stage)
            if current_index >= len(stages) - 1:
                raise UserError(
                    _("El pedido %s ya se encuentra en la etapa final.", order.name)
                )
            next_stage = stages[current_index + 1]
            order.write({"production_stage": next_stage})
            order._notify_production_channel()
        return True

    def action_generate_invoice(self):
        self.action_pos_order_invoice()
        return True

    @api.model
    def get_production_columns(self):
        get_param = self.env["ir.config_parameter"].sudo().get_param
        stage_labels = dict(self.PRODUCTION_STAGES)
        columns = []
        for key in self.DASHBOARD_STAGES:
            label = get_param(
                f"mrp_pos_workflow.production_column_label.{key}",
                stage_labels.get(key, key),
            )
            columns.append({"key": key, "label": label})
        return columns

    @api.model
    def set_production_column_label(self, key, label):
        if key not in self.DASHBOARD_STAGES:
            raise UserError(_("Etapa de producción no válida: %s", key))
        self.env["ir.config_parameter"].sudo().set_param(
            f"mrp_pos_workflow.production_column_label.{key}", label
        )
        return True

    @api.model
    def get_dashboard_view_config(self):
        """Devuelve el modo de visualización del dashboard para el usuario.

        - Administrador: ve el pipeline completo.
        - Encargado de área: ve únicamente las columnas para las que tiene grupo.
        """
        user = self.env.user
        is_admin = user.has_group("base.group_system") or user.has_group(
            "mrp_pos_workflow.group_production_manager"
        )
        allowed_stages = []
        for stage, xmlid in self.STAGE_GROUP_MAPPING.items():
            if user.has_group(xmlid):
                allowed_stages.append(stage)
        return {"is_admin": is_admin, "allowed_stages": allowed_stages}

    def get_sewing_info(self):
        self.ensure_one()
        return {
            "lines": [
                {
                    "id": line.id,
                    "operator_id": line.operator_id.id,
                    "operator_name": line.operator_id.name,
                    "quantity": line.quantity,
                }
                for line in self.sewing_line_ids
            ],
        }

    def action_save_sewing(self, sewing_lines):
        sewing_lines = sewing_lines or []
        if len(sewing_lines) > 2:
            raise UserError(
                _("Solo se permiten hasta 2 asignaciones de costura por orden.")
            )
        for order in self:
            commands = [(5, 0, 0)]
            for line in sewing_lines:
                operator_id = line.get("operator_id")
                if not operator_id:
                    continue
                commands.append(
                    (
                        0,
                        0,
                        {
                            "operator_id": operator_id,
                            "quantity": float(line.get("quantity") or 0.0),
                        },
                    )
                )
            values = {"sewing_line_ids": commands}
            order.write(values)
            order._notify_production_channel()
        return True
