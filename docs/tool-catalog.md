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

## Additional 1,000 listings

`artifacts/api-server/src/data/additional-tool-catalog.json` adds 1,000 distinct
listings from **Awesome-Selfhosted data**, by the Awesome-Selfhosted contributors,
at pinned commit `80a6ccd60c105a81f7a02b9b731922e76f2aae48`:
https://github.com/awesome-selfhosted/awesome-selfhosted-data

The adapted dataset and summaries are **CC BY-SA 3.0 Unported**:
https://creativecommons.org/licenses/by-sa/3.0/
Original license and author notices are in `docs/licenses/awesome-selfhosted-*`.
This license applies to this adapted catalog data, not to the separately licensed
software being listed or the application's own source code. Public attribution
is available at `/credits` and each imported overview names its source record.

Selection: non-archived entries with usable HTTP(S) website URLs and descriptions,
sorted by upstream star count and name, excluding normalized name/website matches
from the first 200 and within the supplement. Stars are only a deterministic
selection criterion; no popularity claims or ratings are shown in the UI.
Descriptions are retained; source tags are mapped to Toolstack categories. The
snapshot does not guarantee current maintenance, availability, pricing, or links.
Most additions require self-hosting; the listing instructions say this explicitly.

The versioned importer adds eight category definitions (13 total on a fresh DB),
inserts missing tools in batches of 50, and records `additional_catalog_1000_v1`
in the same transaction. Saved listings, including drafts, are never overwritten.
Existing user-created duplicates can reduce the number added. Edits/deletions
after the import persist because the receipt prevents cold-start reinsertion.
A normal 200-tool database becomes 1,200 tools. Do not delete import receipts.

Reproduce the checked-in selection (Python/PyYAML is a development-only utility):

```sh
gh api repos/awesome-selfhosted/awesome-selfhosted-data/tarball/80a6ccd60c105a81f7a02b9b731922e76f2aae48 > /tmp/selfhosted.tar.gz
# Extract into a temporary directory, then pass its source root to:
python scripts/catalog/build-selfhosted.py /tmp/extracted-upstream-root
```

The directory renders 24 results at a time with **Load more tools**. Search and
category filters still cover the full catalog, not only visible cards. This is
client-side display pagination; the API still returns all matching listings.
The expanded catalog test verifies all 1,200 unique entries, 13 categories,
attribution, published status, and preservation of subsequent edits/deletions.
