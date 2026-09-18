# Klyvo Admin implementation plan
Approved scope: independent French dashboard, Arabic setup, URL-only media, product/variant CRUD, historical confirmed-order analytics. Existing public checkout and email preserved.
Architecture: native Node HTTP server serves static dashboard and verifies Google ID tokens using google-auth-library. It signs short-lived envelopes to the existing GAS project. GAS rechecks signature and admin allowlist. Shared script lock coordinates admin writes with checkout. No production credentials or deployments in this build.
1. Domain tests first: safe HTML subset, URL delimiter handling, price inheritance, immutable IDs, SKU collisions, historical analytics and repeat buyers.
2. Domain implementation shared by frontend and GAS, separate deterministic tests.
3. GAS adapter: header-based reads, true row numbers, signed auth, allowlist, optimistic revision, formula guards, write journal and compensation. Existing Code.gs retained with narrow routing and reader fixes.
4. Dashboard: overview, products, editor, dynamic image URLs/variants, orders, buyers, settings. Local explicit demo fixtures. No production/demo mixing.
5. Node gateway: auth, body bounds, exact origin, no token persistence, HMAC, configurable endpoints; unit tests against forged/expired envelopes.
6. Test with Sheets/Google mocks and browser if available. Document untested cloud deployment. Package and save deliverable.
No migration of formula IDs or production data is automatic. Signed writes reject sheets containing formulas; instructions preserve values on a copy first. No hard deletion of historical records. Description sanitizer is conservative, with visible preview and confirmation if changed. Storefront sanitizer patch is separate and optional.
