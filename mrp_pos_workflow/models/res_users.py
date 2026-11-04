from odoo import fields, models


class ResUsers(models.Model):
    _inherit = "res.users"

    allowed_pos_config_ids = fields.Many2many(
        "pos.config",
        "res_users_pos_config_rel",
        "user_id",
        "config_id",
        string="Puntos de Venta Permitidos",
        help="Puntos de venta cuyos pedidos puede ver este usuario en el "
        "dashboard de producción. Vacío = sin restricción (solo superusuario).",
    )
