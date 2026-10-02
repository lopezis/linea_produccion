{
    "name": "POS Maquiladora",
    "version": "18.0.1.0.0",
    "category": "Point of Sale",
    "summary": "Captura de fecha de entrega y envío de órdenes a producción desde el POS",
    "author": "Isaac Lopez",
    "license": "AGPL-3",
    "depends": [
        "point_of_sale",
        "bus",
        "mrp_pos_workflow",
    ],
    "data": [
        "security/security.xml",
        "views/pos_order_views.xml",
    ],
    "assets": {
        "point_of_sale._assets_pos": [
            "pos_maquiladora/static/src/js/pos_order_patch.js",
            "pos_maquiladora/static/src/js/delivery_date_button.js",
            "pos_maquiladora/static/src/js/general_note_button.js",
            "pos_maquiladora/static/src/js/control_buttons_patch.js",
            "pos_maquiladora/static/src/xml/control_buttons.xml",
            "pos_maquiladora/static/src/css/control_buttons.css",
        ],
    },
    "installable": True,
    "application": False,
    "auto_install": False,
}
