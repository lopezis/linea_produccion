from odoo import fields, models


class PosSuelaOperator(models.Model):
    _name = "pos.suela.operator"
    _description = "Operador de Suela (Suelero)"
    _order = "sequence, id"

    name = fields.Char(string="Nombre", required=True, translate=True)

    active = fields.Boolean(string="Activo", default=True)

    sequence = fields.Integer(string="Secuencia", default=10)

    company_id = fields.Many2one(
        "res.company",
        string="Compañía",
        default=lambda self: self.env.company,
    )
