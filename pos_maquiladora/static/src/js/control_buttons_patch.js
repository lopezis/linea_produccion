/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { ControlButtons } from "@point_of_sale/app/screens/product_screen/control_buttons/control_buttons";
import { DeliveryDateButton } from "./delivery_date_button";
import { GeneralNoteButton } from "./general_note_button";

patch(ControlButtons, {
    components: {
        ...ControlButtons.components,
        DeliveryDateButton,
        GeneralNoteButton,
    },
});
