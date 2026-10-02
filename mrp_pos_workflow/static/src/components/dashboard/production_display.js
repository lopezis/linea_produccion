/** @odoo-module **/

import { Component, useState, onWillStart, onWillUnmount } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { user as userInfo } from "@web/core/user";
import { AssignDialog } from "../assign_dialog/assign_dialog";

const PRODUCTION_CHANNEL = "mrp_pos_workflow_channel";

const STAGE_GROUP_MAPPING = {
    pintado_corte: "mrp_pos_workflow.group_stage_pintado_corte",
    plantilla: "mrp_pos_workflow.group_stage_plantilla",
    diseno: "mrp_pos_workflow.group_stage_diseno",
    suela: "mrp_pos_workflow.group_stage_suela",
    logistica: "mrp_pos_workflow.group_stage_logistica",
};

export class ProductionDisplay extends Component {
    static template = "mrp_pos_workflow.production_display";
    static components = { AssignDialog };

    setup() {
        this.orm = useService("orm");
        this.busService = useService("bus_service");
        this.notification = useService("notification");
        this.dialog = useService("dialog");

        this.state = useState({
            columns: [],
            allowedStages: [],
            isAdmin: false,
            orders: [],
            loading: false,
            selectedOrder: null,
            detailsLoading: false,
            editingColumnKey: null,
            editingColumnLabel: "",
        });

        this._onOrderUpdated = this._onOrderUpdated.bind(this);

        onWillStart(async () => {
            await this.loadConfig();
            await this.loadColumns();
            await this.loadOrders();
            console.log(
                ">>> BUS SUBSCRIBE: subscribing to channel:",
                PRODUCTION_CHANNEL
            );
            this.busService.addChannel(PRODUCTION_CHANNEL);
            this.busService.subscribe(
                PRODUCTION_CHANNEL,
                this._onOrderUpdated
            );
        });

        onWillUnmount(() => {
            this.busService.deleteChannel(PRODUCTION_CHANNEL);
        });
    }

    get userName() {
        return userInfo.name || "";
    }

    get columns() {
        if (this.state.isAdmin) {
            return this.state.columns;
        }
        const allowed = new Set(this.state.allowedStages);
        return this.state.columns.filter((column) => allowed.has(column.key));
    }

    get canRenameColumns() {
        return this.state.isAdmin;
    }

    get ordersByStage() {
        const grouped = {};
        for (const column of this.columns) {
            grouped[column.key] = this.state.orders.filter(
                (order) => order.production_stage === column.key
            );
        }
        return grouped;
    }

    _onOrderUpdated(message) {
        console.log(">>> BUS RECEIVED:", message);
        if (!message || !message.order_id) {
            console.log(">>> BUS RECEIVED: no order_id, reloading all orders");
            this.loadOrders();
            return;
        }
        const existingIndex = this.state.orders.findIndex(
            (o) => o.id === message.order_id
        );
        if (existingIndex >= 0) {
            const order = this.state.orders[existingIndex];
            if (order.production_stage !== message.production_stage) {
                console.log(
                    ">>> BUS RECEIVED: order",
                    message.order_name,
                    "moved from",
                    order.production_stage,
                    "to",
                    message.production_stage
                );
                this.state.orders.splice(existingIndex, 1);
            } else {
                console.log(
                    ">>> BUS RECEIVED: order",
                    message.order_name,
                    "unchanged, skipping"
                );
                return;
            }
        }
        this.loadOrders();
        const orderName =
            message.order_name || `Orden #${message.order_id}`;
        this.notification.add(`Orden actualizada: ${orderName}`, {
            type: "info",
        });
    }

    async loadConfig() {
        const isAdmin = await userInfo.hasGroup("base.group_system");
        const isManager = await userInfo.hasGroup(
            "mrp_pos_workflow.group_production_manager"
        );
        this.state.isAdmin = isAdmin || isManager;
        if (!this.state.isAdmin) {
            const allowed = [];
            for (const [stage, group] of Object.entries(STAGE_GROUP_MAPPING)) {
                if (await userInfo.hasGroup(group)) {
                    allowed.push(stage);
                }
            }
            this.state.allowedStages = allowed;
        }
    }

    async loadColumns() {
        this.state.columns = await this.orm.call(
            "pos.order",
            "get_production_columns",
            []
        );
    }

    startEditColumn(column) {
        if (!this.canRenameColumns) {
            return;
        }
        this.state.editingColumnKey = column.key;
        this.state.editingColumnLabel = column.label;
    }

    cancelEditColumn() {
        this.state.editingColumnKey = null;
        this.state.editingColumnLabel = "";
    }

    async saveColumnLabel() {
        const key = this.state.editingColumnKey;
        const label = this.state.editingColumnLabel.trim();
        if (!key || !label) {
            return;
        }
        await this.orm.call(
            "pos.order",
            "set_production_column_label",
            [key, label]
        );
        this.state.editingColumnKey = null;
        this.state.editingColumnLabel = "";
        await this.loadColumns();
    }

    onEditKeydown(ev) {
        if (ev.key === "Enter") {
            this.saveColumnLabel();
        } else if (ev.key === "Escape") {
            this.cancelEditColumn();
        }
    }

    async loadOrders() {
        this.state.loading = true;
        const stageKeys = this.state.columns.map((column) => column.key);
        const baseFields = [
            "id",
            "name",
            "partner_id",
            "amount_total",
            "production_stage",
            "general_note",
        ];
        const fields = [...baseFields, "delivery_date"];
        let orders;
        try {
            orders = await this.orm.searchRead(
                "pos.order",
                [["production_stage", "in", stageKeys]],
                fields
            );
        } catch {
            orders = await this.orm.searchRead(
                "pos.order",
                [["production_stage", "in", stageKeys]],
                baseFields
            );
        }
        const orderIds = orders.map((order) => order.id);
        const quantityByOrder = {};
        const lineNotesByOrder = {};
        if (orderIds.length) {
            const groups = await this.orm.readGroup(
                "pos.order.line",
                [["order_id", "in", orderIds]],
                ["qty:sum"],
                ["order_id"]
            );
            for (const group of groups) {
                quantityByOrder[group.order_id[0]] = group.qty;
            }
            let linesWithNotes;
            try {
                linesWithNotes = await this.orm.searchRead(
                    "pos.order.line",
                    [
                        ["order_id", "in", orderIds],
                        "|",
                        ["note", "!=", false],
                        ["customer_note", "!=", false],
                    ],
                    [
                        "order_id",
                        "product_id",
                        "full_product_name",
                        "note",
                        "customer_note",
                    ]
                );
            } catch {
                linesWithNotes = [];
            }
            for (const line of linesWithNotes) {
                const note = (line.note || "").trim();
                const customerNote = (line.customer_note || "").trim();
                if (!note && !customerNote) {
                    continue;
                }
                const orderId = line.order_id[0];
                if (!lineNotesByOrder[orderId]) {
                    lineNotesByOrder[orderId] = [];
                }
                lineNotesByOrder[orderId].push({
                    product_name:
                        line.full_product_name ||
                        (line.product_id ? line.product_id[1] : ""),
                    note,
                    customer_note: customerNote,
                });
            }
        }
        this.state.orders = orders.map((order) => ({
            ...order,
            partner_name: order.partner_id
                ? order.partner_id[1]
                : "Sin cliente",
            qty: quantityByOrder[order.id] || 0,
            note: order.general_note || "",
            line_notes: lineNotesByOrder[order.id] || [],
            deliveryDateDisplay: this.getDeliveryDateDisplay(
                order.delivery_date
            ),
        }));
        this.state.loading = false;
    }

    getDeliveryDateDisplay(value) {
        if (!value) {
            return { label: "Sin fecha", urgent: false, past: false };
        }
        const stringValue = String(value);
        const parsed = new Date(stringValue.replace(" ", "T") + "Z");
        if (Number.isNaN(parsed.getTime())) {
            return { label: stringValue, urgent: false, past: false };
        }
        const diffHours = (parsed.getTime() - Date.now()) / 3600000;
        const label = this.formatDeliveryDate(stringValue);
        if (diffHours < 0) {
            return { label, urgent: true, past: true };
        }
        if (diffHours <= 48) {
            return { label, urgent: true, past: false };
        }
        return { label, urgent: false, past: false };
    }

    formatDeliveryDate(value) {
        const [datePart, timePart] = String(value).split(" ");
        const [year, month, day] = (datePart || "").split("-");
        const [hour, minute] = (timePart || "").split(":");
        const label = [day, month, year].filter(Boolean).join("/");
        if (hour !== undefined && minute !== undefined) {
            return `${label} ${hour}:${minute}`;
        }
        return label;
    }

    async liberateOrder(order) {
        await this.orm.call("pos.order", "action_next_stage", [[order.id]]);
        await this.loadOrders();
    }

    async generateInvoice(order) {
        try {
            await this.orm.call("pos.order", "action_generate_invoice", [
                [order.id],
            ]);
            this.notification.add("Factura generada correctamente.", {
                type: "success",
            });
        } catch (error) {
            const message =
                (error.data && error.data.message) ||
                error.message ||
                "No se pudo generar la factura.";
            this.notification.add(message, { type: "danger" });
        }
        await this.loadOrders();
    }

    openAssignDialog(order) {
        this.dialog.add(AssignDialog, {
            orderId: order.id,
            orderName: order.name,
            onSaved: () => this.loadOrders(),
        });
    }

    async showDetails(order) {
        this.state.detailsLoading = true;
        this.state.selectedOrder = { ...order, lines: [] };
        const lineFields = [
            "id",
            "product_id",
            "full_product_name",
            "qty",
            "price_unit",
            "price_subtotal",
            "note",
            "customer_note",
        ];
        let lines;
        try {
            lines = await this.orm.searchRead(
                "pos.order.line",
                [["order_id", "=", order.id]],
                lineFields
            );
        } catch {
            lines = await this.orm.searchRead(
                "pos.order.line",
                [["order_id", "=", order.id]],
                [
                    "id",
                    "product_id",
                    "full_product_name",
                    "qty",
                    "price_unit",
                    "price_subtotal",
                ]
            );
        }
        this.state.selectedOrder = {
            ...order,
            lines: lines.map((line) => ({
                ...line,
                product_name:
                    line.full_product_name ||
                    (line.product_id ? line.product_id[1] : "Sin producto"),
                note: line.note || "",
                customer_note: line.customer_note || "",
            })),
        };
        this.state.detailsLoading = false;
    }

    closeDetails() {
        this.state.selectedOrder = null;
        this.state.detailsLoading = false;
    }
}

registry.category("actions").add(
    "mrp_pos_workflow.production_display_action",
    ProductionDisplay
);
