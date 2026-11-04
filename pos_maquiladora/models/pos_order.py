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
            if not order._is_pos_sale_order():
                raise UserError(
                    _(
                        "El pedido %s no es un pedido de venta del punto de venta.",
                        order.name,
                    )
                )

        for order in orders:
            order.write({"production_stage": "pintado_corte"})

        if orders:
            orders._notify_production_channel()
        return True

    def _is_pos_sale_order(self):
        self.ensure_one()
        if not self.pos_reference or self.state == "cancel" or self.amount_total <= 0:
            return False
        if self.lines.filtered("refunded_orderline_id"):
            return False
        return True

    def _recompute_order_amounts(self):
        for order in self:
            order._compute_prices()


class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    @api.model_create_multi
    def create(self, vals_list):
        lines = super().create(vals_list)
        lines.order_id._recompute_order_amounts()
        return lines

    def write(self, vals):
        res = super().write(vals)
        if any(
            field in vals
            for field in ("product_id", "qty", "price_unit", "discount")
        ):
            self.order_id._recompute_order_amounts()
        return res

    @api.onchange("product_id")
    def _onchange_product_id(self):
        if not self.product_id:
            return
        price_unit = self.product_id.list_price
        order = self.order_id
        if order and order.pricelist_id:
            try:
                price_unit = order.pricelist_id._get_product_price(
                    self.product_id,
                    1.0,
                    partner=order.partner_id,
                )
            except Exception:
                pass
        self.price_unit = price_unit
