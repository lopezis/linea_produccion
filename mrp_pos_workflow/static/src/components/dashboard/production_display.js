/** @odoo-module **/

import { Component, useState, onWillStart, onWillUnmount } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { user as userInfo } from "@web/core/user";
import { AssignDialog } from "../assign_dialog/assign_dialog";
import { AssignSuelaDialog } from "../assign_suela_dialog/assign_suela_dialog";

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
    static components = { AssignDialog, AssignSuelaDialog };

    setup() {
        this.orm = useService("orm");
        this.busService = useService("bus_service");
        this.notification = useService("notification");
        this.dialog = useService("dialog");

        this.state = useState({
            columns: [],
            allowedStages: [],
            isAdmin: false,
            isProductionManager: false,
            orders: [],
            loading: false,
            selectedOrder: null,
            detailsLoading: false,
            editingColumnKey: null,
            editingColumnLabel: "",
            draggedOrderId: null,
            dropColumnKey: null,
            allowedConfigIds: null,
        });

        this._onOrderUpdated = this._onOrderUpdated.bind(this);

        onWillStart(async () => {
            await this.loadConfig();
            await this.loadAllowedConfigIds();
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
        this.state.isProductionManager = isManager;
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

    async loadAllowedConfigIds() {
        try {
            const config = await this.orm.call(
                "pos.order",
                "get_dashboard_view_config",
                []
            );
            this.state.allowedConfigIds = config.allowed_config_ids || null;
        } catch {
            this.state.allowedConfigIds = null;
        }
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
        const domain = [
            ["production_stage", "in", stageKeys],
            ["pos_reference", "!=", false],
            ["state", "!=", "cancel"],
            ["amount_total", ">", 0],
            ["lines.refunded_orderline_id", "=", false],
        ];
        if (this.state.allowedConfigIds !== null) {
            domain.push([
                "session_id.config_id",
                "in",
                this.state.allowedConfigIds,
            ]);
        }
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
                domain,
                fields
            );
        } catch {
            orders = await this.orm.searchRead(
                "pos.order",
                domain,
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
        const assignedByOrder = {};
        if (this.state.isProductionManager && orderIds.length) {
            try {
                const assigned = await this.orm.call(
                    "pos.order",
                    "get_assigned_operators",
                    [orderIds]
                );
                for (const [orderId, names] of Object.entries(assigned)) {
                    assignedByOrder[parseInt(orderId, 10)] = names || [];
                }
            } catch {
                // Ignorar y continuar sin la sección de asignación.
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
            assignedLabel: (assignedByOrder[order.id] || []).join(", "),
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

    onDragStart(order, ev) {
        if (!this.state.isAdmin) {
            ev.preventDefault();
            return;
        }
        this.state.draggedOrderId = order.id;
        ev.dataTransfer.effectAllowed = "move";
        ev.dataTransfer.setData("text/plain", String(order.id));
    }

    onDragEnd() {
        setTimeout(() => {
            this.state.draggedOrderId = null;
            this.state.dropColumnKey = null;
        }, 0);
    }

    onDragEnterColumn(column, ev) {
        if (!this.state.isAdmin || !this.state.draggedOrderId) {
            return;
        }
        ev.preventDefault();
        this.state.dropColumnKey = column.key;
    }

    onDragOverColumn(column, ev) {
        if (!this.state.isAdmin || !this.state.draggedOrderId) {
            return;
        }
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
        this.state.dropColumnKey = column.key;
    }

    async onDropColumn(column, ev) {
        ev.preventDefault();
        ev.stopPropagation();
        const orderId = this.state.draggedOrderId;
        this.state.dropColumnKey = null;
        if (!orderId) {
            return;
        }
        const order = this.state.orders.find((o) => o.id === orderId);
        if (!order || order.production_stage === column.key) {
            return;
        }
        try {
            await this.orm.call("pos.order", "action_set_production_stage", [
                [orderId],
                column.key,
            ]);
            await this.loadOrders();
        } catch (error) {
            const message =
                (error.data && error.data.message) ||
                error.message ||
                "No se pudo mover el pedido.";
            this.notification.add(message, { type: "danger" });
        }
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

    openAssignSuelaDialog(order) {
        this.dialog.add(AssignSuelaDialog, {
            orderId: order.id,
            orderName: order.name,
            onSaved: () => this.loadOrders(),
        });
    }

    shareWhatsApp(order) {
        const lines = [];
        lines.push(`*${order.name}*`);
        lines.push(`Cliente: ${order.partner_name}`);
        lines.push(`Pares: ${order.qty}`);
        lines.push(`Entrega: ${order.deliveryDateDisplay.label}`);
        if (order.note) {
            lines.push(`Nota: ${order.note}`);
        }
        for (const lineNote of order.line_notes || []) {
            const parts = [];
            if (lineNote.product_name) {
                parts.push(lineNote.product_name);
            }
            if (lineNote.note) {
                parts.push(lineNote.note);
            }
            if (lineNote.customer_note) {
                parts.push(lineNote.customer_note);
            }
            if (parts.length) {
                lines.push(`- ${parts.join(": ")}`);
            }
        }
        const text = encodeURIComponent(lines.join("\n"));
        window.open(
            `https://wa.me/?text=${text}`,
            "_blank",
            "noopener,noreferrer"
        );
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
