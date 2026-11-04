/** @odoo-module **/

import { Component, useState, onWillStart } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { Dialog } from "@web/core/dialog/dialog";

export class AssignDialog extends Component {
    static template = "mrp_pos_workflow.assign_dialog";
    static components = { Dialog };
    static props = {
        orderId: { type: Number },
        orderName: { type: String, optional: true },
        onSaved: { type: Function, optional: true },
        close: { type: Function },
    };

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");

        this.state = useState({
            loading: true,
            saving: false,
            operators: [],
            line1: { operator_id: null, quantity: 0 },
            line2: { operator_id: null, quantity: 0 },
            hasSecondLine: false,
        });

        onWillStart(async () => {
            await this._loadOperators();
            await this._loadSewingInfo();
        });
    }

    async _loadOperators() {
        try {
            const operators = await this.orm.searchRead(
                "pos.sewing.operator",
                [["active", "=", true]],
                ["id", "name"],
                { order: "sequence, id" }
            );
            this.state.operators = operators;
        } catch {
            this.state.operators = [];
        }
    }

    async _loadSewingInfo() {
        const info = await this.orm.call(
            "pos.order",
            "get_sewing_info",
            [[this.props.orderId]]
        );
        const lines = info.lines || [];
        if (lines.length > 0) {
            this.state.line1 = {
                operator_id: lines[0].operator_id,
                quantity: lines[0].quantity,
            };
        }
        if (lines.length > 1) {
            this.state.hasSecondLine = true;
            this.state.line2 = {
                operator_id: lines[1].operator_id,
                quantity: lines[1].quantity,
            };
        }
        this.state.loading = false;
    }

    onOperatorChange(index, ev) {
        const value = ev.target.value;
        const operatorId = value ? parseInt(value, 10) : null;
        if (index === 0) {
            this.state.line1.operator_id = operatorId;
        } else {
            this.state.line2.operator_id = operatorId;
        }
    }

    get canSave() {
        return this.state.line1.operator_id && !this.state.saving;
    }

    async save() {
        if (!this.state.line1.operator_id) {
            this.notification.add(
                _t("Seleccione al menos un costurero/a."),
                { type: "danger" }
            );
            return;
        }
        this.state.saving = true;
        try {
            const lines = [
                {
                    operator_id: this.state.line1.operator_id,
                    quantity: parseFloat(this.state.line1.quantity) || 0,
                },
            ];
            if (this.state.hasSecondLine && this.state.line2.operator_id) {
                lines.push({
                    operator_id: this.state.line2.operator_id,
                    quantity: parseFloat(this.state.line2.quantity) || 0,
                });
            }
            await this.orm.call(
                "pos.order",
                "action_save_sewing",
                [[this.props.orderId]],
                {
                    sewing_lines: lines,
                }
            );
            this.notification.add(
                _t("Asignación de costura guardada."),
                { type: "success" }
            );
            if (this.props.onSaved) {
                this.props.onSaved();
            }
            this.props.close();
        } catch (error) {
            const message =
                (error.data && error.data.message) ||
                error.message ||
                _t("No se pudo guardar la asignación.");
            this.notification.add(message, { type: "danger" });
        } finally {
            this.state.saving = false;
        }
    }
}
