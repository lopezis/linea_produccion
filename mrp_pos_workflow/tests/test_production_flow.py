from odoo.exceptions import UserError
from odoo.tests import TransactionCase


class TestProductionFlow(TransactionCase):

    def setUp(self):
        super().setUp()
        self.PosOrder = self.env["pos.order"]

    def _create_order(self, production_stage="draft"):
        config = self.env["pos.config"].create({"name": "Test POS Config"})
        session = self.env["pos.session"].create({"config_id": config.id})
        pricelist = self.env.ref("product.list0")
        order = self.PosOrder.create({
            "session_id": session.id,
            "pricelist_id": pricelist.id,
        })
        if production_stage != "draft":
            order.production_stage = production_stage
        return order

    def test_order_created_in_draft_stage(self):
        order = self._create_order()
        self.assertEqual(order.production_stage, "draft")

    def test_advance_through_all_stages(self):
        order = self._create_order()
        expected_stages = [
            "pintado_corte",
            "plantilla",
            "diseno",
            "suela",
            "logistica",
            "paid",
        ]
        for expected in expected_stages:
            order.action_next_stage()
            self.assertEqual(order.production_stage, expected)

        notifications = self.env["bus.bus"].search([
            ("channel", "=", "mrp_pos_workflow_channel"),
        ])
        self.assertEqual(len(notifications), len(expected_stages))

    def test_advance_past_paid_raises(self):
        order = self._create_order(production_stage="paid")
        with self.assertRaises(UserError):
            order.action_next_stage()

    def test_get_production_columns(self):
        columns = self.PosOrder.get_production_columns()
        self.assertEqual(
            [column["key"] for column in columns],
            ["pintado_corte", "plantilla", "diseno", "suela", "logistica", "paid"],
        )
        self.assertEqual(columns[0]["label"], "Pintado y Corte")

    def test_set_production_column_label(self):
        self.PosOrder.set_production_column_label("plantilla", "Plantilla 2")
        columns = self.PosOrder.get_production_columns()
        labels = {column["key"]: column["label"] for column in columns}
        self.assertEqual(labels["plantilla"], "Plantilla 2")

    def test_set_production_column_label_invalid_stage(self):
        with self.assertRaises(UserError):
            self.PosOrder.set_production_column_label("inexistente", "X")
