from odoo import fields, models


class PosConfig(models.Model):
    _inherit = "pos.config"

    sewing_operator_ids = fields.Many2many(
        "pos.sewing.operator",
        string="Costureros / Operadores de Costura",
        help="Costureros disponibles en este punto de venta.",
    )

    suela_operator_ids = fields.Many2many(
        "pos.suela.operator",
        string="Operadores de Suela",
        help="Sueleros disponibles en este punto de venta.",
    )
