.. image:: https://img.shields.io/badge/licence-AGPL--3-blue.svg
   :target: https://www.gnu.org/licenses/agpl-3.0-standalone.html
   :alt: License: AGPL-3

====================================
MRP POS Workflow
====================================

Gestión de una línea de producción secuencial conectada al Punto de Venta.

Cada pedido confirmado en el POS entra automáticamente en la línea de
producción y avanza de forma estricta a través de las etapas: *Pintado y Corte*,
*Plantilla*, *Diseño*, *Suela*, *Logistica* y *Pagado*.

.. contents::
   :local:

Configuration
=============

Para habilitar el acceso al dashboard de producción:

#. Instale el módulo *MRP POS Workflow*.
#. Asigne el grupo **Operador de Producción** a los usuarios que deban
   gestionar la línea de producción (*Ajustes > Usuarios*).

Usage
=====

#. Confirme un pedido desde el Punto de Venta; el pedido pasa automáticamente
   a la etapa **Pintado y Corte**.
#. Abra el menú *Línea de Producción > Dashboard de Producción*.
#. Utilice el botón **Liberar** de cada tarjeta para avanzar el pedido a la
   siguiente etapa. El avance es secuencial y no se puede saltar etapas.
#. Haga clic en el nombre de una columna para renombrarla; el nuevo nombre se
   guarda y se conserva en las próximas sesiones.

Bug Tracker
===========

Bugs are tracked on `GitHub Issues <https://github.com/OCA/{repo_name}/issues>`_.
In case of trouble, please check there if your issue has already been reported.
If you spotted it first, help us to smash it by providing a detailed and welcomed
`feedback <https://github.com/OCA/{repo_name}/issues/new?body=module:%20mrp_pos_workflow%0Aversion:%2018.0%0A%0A**Steps%20to%20reproduce**%0A-%20...%0A%0A**Current%20behavior**%0A%0A**Expected%20behavior**>`_.

Do not contact contributors directly about support or help with technical issues.

Credits
=======

Authors
~~~~~~~

* OCA

Contributors
~~~~~~~~~~~~

* OCA

Maintainers
~~~~~~~~~~~

This module is maintained by the OCA.

.. image:: https://github.com/OCA/maintainer-tools/raw/master/template/module/static/description/icon.svg
   :alt: Odoo Community Association
   :target: https://odoo-community.org

OCA, or the Odoo Community Association, is a nonprofit organization whose
mission is to support the collaborative development of Odoo features and
promote its widespread use.

This module is part of the `OCA/{repo_name} <https://github.com/OCA/{repo_name}>`_
project on GitHub.

You are welcome to contribute. To learn how please visit
https://odoo-community.org/page/Contribute.
