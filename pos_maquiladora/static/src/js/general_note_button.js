/** @odoo-module **/

import { Component, xml } from "@odoo/owl";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { TextInputPopup } from "@point_of_sale/app/utils/input_popups/text_input_popup";
import { makeAwaitable } from "@point_of_sale/app/store/make_awaitable_dialog";

export class GeneralNoteButton extends Component {
    static template = xml`
        <button type="button"
                class="btn btn-light btn-lg lh-lg control-button o_general_note_button"
                t-att-class="{'o_general_note_set': hasNote}"
                t-on-click="onClick">
            <i class="fa fa-sticky-note me-1" role="img" aria-label="Nota" title="Nota"/>
            <t t-if="hasNote">Nota</t>
            <t t-else="">Nota</t>
        </button>
    `;
    setup() {
        this.pos = usePos();
        this.dialog = useService("dialog");
    }
    get currentOrder() {
        return this.pos.get_order();
    }
    get hasNote() {
        return Boolean(this.currentOrder?.general_note);
    }
    async onClick() {
        const order = this.currentOrder;
        if (!order) {
            return;
        }
        const payload = await makeAwaitable(this.dialog, TextInputPopup, {
            title: _t("Nota general"),
            rows: 4,
            startingValue: order.general_note || "",
        });
        if (typeof payload === "string") {
            order.update({ general_note: payload });
        }
    }
}
