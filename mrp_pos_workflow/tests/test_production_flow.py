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

    def test_action_set_production_stage(self):
        order = self._create_order()
        order.action_set_production_stage("suela")
        self.assertEqual(order.production_stage, "suela")
        order.action_set_production_stage("draft")
        self.assertEqual(order.production_stage, "draft")

    def test_action_set_production_stage_invalid(self):
        order = self._create_order()
        with self.assertRaises(UserError):
            order.action_set_production_stage("inexistente")

    def test_action_save_suela(self):
        order = self._create_order()
        operator = self.env["pos.suela.operator"].create({"name": "Suelero A"})
        order.action_save_suela([
            {"operator_id": operator.id, "quantity": 3},
            {"operator_id": operator.id, "quantity": 2},
        ])
        self.assertEqual(len(order.suela_line_ids), 2)
        info = order.get_suela_info()
        self.assertEqual(len(info["lines"]), 2)

    def test_get_assigned_operators(self):
        order = self._create_order(production_stage="suela")
        config = order.session_id.config_id

        operator_group = self.env.ref(
            "mrp_pos_workflow.group_production_operator"
        )
        stage_group = self.env.ref("mrp_pos_workflow.group_stage_suela")

        user = self.env["res.users"].create({
            "name": "Maria",
            "login": "maria_test",
            "groups_id": [(6, 0, [operator_group.id, stage_group.id])],
            "allowed_pos_config_ids": [(6, 0, [config.id])],
        })

        result = self.PosOrder.get_assigned_operators([order.id])
        self.assertEqual(result[order.id], ["Maria"])

        # Positivo con restricción de POS: no debe listar usuarios de otro POS.
        other_config = self.env["pos.config"].create({"name": "Other POS"})
        user.write({"allowed_pos_config_ids": [(6, 0, [other_config.id])]})
        result = self.PosOrder.get_assigned_operators([order.id])
        self.assertEqual(result[order.id], [])

        # Sin restricción de POS (vacío) vuelve a coincidir.
        user.write({"allowed_pos_config_ids": [(5, 0, 0)]})
        result = self.PosOrder.get_assigned_operators([order.id])
        self.assertEqual(result[order.id], ["Maria"])

    def test_action_save_suela_limit(self):
        order = self._create_order()
        operator = self.env["pos.suela.operator"].create({"name": "Suelero A"})
        with self.assertRaises(UserError):
            order.action_save_suela([
                {"operator_id": operator.id, "quantity": 1},
                {"operator_id": operator.id, "quantity": 1},
                {"operator_id": operator.id, "quantity": 1},
            ])
