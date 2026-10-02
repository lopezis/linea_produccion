/** @odoo-module **/

import { Component, useState, xml } from "@odoo/owl";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { Dialog } from "@web/core/dialog/dialog";
import { makeAwaitable } from "@point_of_sale/app/store/make_awaitable_dialog";
import { parseDateTime, serializeDateTime, formatDateTime } from "@web/core/l10n/dates";

const { DateTime } = luxon;

class DeliveryDatePopup extends Component {
    static components = { Dialog };
    static template = xml`
        <Dialog bodyClass="'d-flex flex-column gap-2 p-3'" footer="false" title="props.title">
            <label class="form-label" for="pos_maquiladora_delivery_date_input">Seleccione la fecha y hora de entrega</label>
            <input t-model="state.value" id="pos_maquiladora_delivery_date_input" type="datetime-local" class="form-control"/>
            <div class="d-flex justify-content-end gap-2 mt-3">
                <button class="btn btn-secondary" t-on-click="() => props.close()">Cancelar</button>
                <button class="btn btn-primary" t-on-click="confirm">Aceptar</button>
            </div>
        </Dialog>
    `;
    static props = {
        title: { type: String, optional: true },
        initialValue: { type: Object, optional: true },
        getPayload: Function,
        close: Function,
    };
    setup() {
        const initial = this.props.initialValue || DateTime.now();
        this.state = useState({
            value: initial.toFormat("yyyy-MM-dd'T'HH:mm"),
        });
    }
    confirm() {
        const dt = DateTime.fromISO(this.state.value);
        if (dt.isValid) {
            this.props.getPayload(dt);
        }
        this.props.close();
    }
}

export class DeliveryDateButton extends Component {
    static template = xml`
        <button type="button"
                class="btn btn-light btn-lg lh-lg control-button o_delivery_date_button"
                t-att-class="{'o_delivery_date_set': deliveryDate}"
                t-on-click="onClick">
            <i class="fa fa-calendar me-1" role="img" aria-label="Fecha de Entrega" title="Fecha de Entrega"/>
            <t t-if="deliveryDate">
                <span t-esc="deliveryDateLabel"/>
            </t>
            <t t-else="">Entrega</t>
        </button>
    `;
    setup() {
        this.pos = usePos();
        this.dialog = useService("dialog");
    }
    get currentOrder() {
        return this.pos.get_order();
    }
    get deliveryDate() {
        return this.currentOrder?.delivery_date;
    }
    get deliveryDateLabel() {
        const dt = parseDateTime(this.deliveryDate);
        return dt ? formatDateTime(dt, { format: "dd/MM/yyyy HH:mm" }) : "";
    }
    async onClick() {
        const current = parseDateTime(this.deliveryDate) || DateTime.now();
        const payload = await makeAwaitable(this.dialog, DeliveryDatePopup, {
            title: _t("Fecha de Entrega"),
            initialValue: current,
        });
        if (payload) {
            this.currentOrder.update({ delivery_date: serializeDateTime(payload) });
        }
    }
}
