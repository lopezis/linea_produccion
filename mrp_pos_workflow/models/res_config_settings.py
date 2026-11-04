from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    pos_sewing_operator_ids = fields.Many2many(
        related="pos_config_id.sewing_operator_ids",
        string="Costureros / Operadores de Costura",
        readonly=False,
    )

    pos_suela_operator_ids = fields.Many2many(
        related="pos_config_id.suela_operator_ids",
        string="Operadores de Suela",
        readonly=False,
    )
