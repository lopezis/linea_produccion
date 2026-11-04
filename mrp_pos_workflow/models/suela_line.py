from odoo import fields, models


class PosOrderSuelaLine(models.Model):
    _name = "pos.order.suela.line"
    _description = "Asignación de suela de una orden POS"
    _order = "id"

    order_id = fields.Many2one(
        "pos.order",
        string="Orden POS",
        required=True,
        ondelete="cascade",
        index=True,
    )

    operator_id = fields.Many2one(
        "pos.suela.operator",
        string="Suelero/a",
        required=True,
        index=True,
    )

    quantity = fields.Float(
        string="Cantidad",
        default=0.0,
        required=True,
    )
