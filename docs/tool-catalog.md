# Starter tool catalog

`artifacts/api-server/src/data/tool-catalog.json` contains 200 named products,
40 in each of the five existing categories. This is a manually assembled starter
catalog, not a live vendor feed. Official URLs and product summaries have not
been individually live-verified in this restricted workspace. Review listings
in Admin; pricing is deliberately `See website` and no ratings are invented.

On the next API initialization, the importer adds missing listings as published.
Existing slugs and website URLs are skipped, including draft listings; no saved
fields are overwritten. On the standard four-tool seed, this adds 196 listings,
for 200 total. Other pre-existing listings can increase the final total.

The import runs in the initialization transaction and writes a durable receipt
(`starter_catalog_200_v1`) in the activity log. Subsequent cold starts skip it,
so later edits and deletions remain intact. Keep the receipt to prevent reimport.
Screenshot availability depends on external screenshot services and target sites.

Validation:

```sh
pnpm --filter @workspace/api-server run build
node artifacts/api-server/tests/tool-catalog.mjs
```

The test uses disposable SQLite and verifies counts, unique names/URLs,
published status, idempotence, and preservation of later edits/deletions.
