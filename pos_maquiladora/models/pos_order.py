from odoo import _, api, fields, models
from odoo.exceptions import UserError


class PosOrder(models.Model):
    _inherit = "pos.order"

    production_state = fields.Selection(
        related="production_stage",
        string="Estado de Producción",
        store=False,
    )

    delivery_date = fields.Datetime(string="Fecha de Entrega")

    def action_send_to_production(self):
        orders = self.filtered(lambda order: order.production_stage == "draft")
        for order in self:
            if not order.partner_id:
                raise UserError(
                    _("Seleccione un cliente antes de enviar el pedido %s a producción.", order.name)
                )
            if not order.lines:
                raise UserError(
                    _("El pedido %s no tiene productos. Agregue al menos uno.", order.name)
                )
            if not order.delivery_date:
                raise UserError(
                    _("Seleccione una fecha de entrega para el pedido %s.", order.name)
                )

        for order in orders:
            order.write({"production_stage": "pintado_corte"})

        if orders:
            orders._notify_production_channel()
        return True
