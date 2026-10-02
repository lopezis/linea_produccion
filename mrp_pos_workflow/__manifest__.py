{
    "name": "MRP POS Workflow",
    "version": "18.0.1.0.0",
    "category": "Point of Sale",
    "summary": "Línea de producción secuencial conectada al POS",
    "author": "Isaac Lopez",
    "license": "AGPL-3",
    "depends": [
        "point_of_sale",
        "bus",
        "hr",
    ],
    "data": [
        "security/res_groups.xml",
        "security/ir.model.access.csv",
        "views/pos_order_views.xml",
        "views/sewing_operator_views.xml",
        "views/res_config_settings_views.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "mrp_pos_workflow/static/src/components/dashboard/production_display.js",
            "mrp_pos_workflow/static/src/components/dashboard/production_display.xml",
            "mrp_pos_workflow/static/src/components/dashboard/production_display.scss",
            "mrp_pos_workflow/static/src/components/assign_dialog/assign_dialog.js",
            "mrp_pos_workflow/static/src/components/assign_dialog/assign_dialog.xml",
            "mrp_pos_workflow/static/src/components/assign_dialog/assign_dialog.scss",
        ],
    },
    "installable": True,
    "application": False,
    "auto_install": False,
}
