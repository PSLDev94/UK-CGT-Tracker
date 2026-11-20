# Fixture provenance

All files in this directory are synthetic examples created for this project. They contain no customer data and are not broker-export certification evidence.

`canonical-trades.csv` exercises the internal documented interchange format: USD acquisition converted at GBP 0.80 per USD, GBP disposal, and an explicitly excluded cash dividend. Independent expected acquisition cost is GBP 808; the half disposal costs GBP 404, net proceeds are GBP 795, and gain is GBP 391.

Real export fixtures must be anonymised without changing column names, quoting, date conventions, currencies, transaction codes, fee semantics, record relationships or numerical edge cases. Record broker, export type, format date, export settings, source permission, expected totals and reviewed limitations. Do not commit personal identifiers, account numbers, or unredacted customer exports.
