from odoo import fields, models


class PosOrderSewingLine(models.Model):
    _name = "pos.order.sewing.line"
    _description = "Asignación de costura de una orden POS"
    _order = "id"

    order_id = fields.Many2one(
        "pos.order",
        string="Orden POS",
        required=True,
        ondelete="cascade",
        index=True,
    )

    operator_id = fields.Many2one(
        "pos.sewing.operator",
        string="Costurero/a",
        required=True,
        index=True,
    )

    quantity = fields.Float(
        string="Cantidad",
        default=0.0,
        required=True,
    )
