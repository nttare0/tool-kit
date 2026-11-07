# Repository browser

- Public page: `/repositories`; main-navigation link: **Repositories**.
- Public JSON: `GET /api/repositories` (array).
- Each item: `id`, `name`, `slug`, `description`, `categoryName`, `categorySlug`,
  `repositoryUrl`, `repositoryPath`, `host`, `licenses`, `tags`, `sourceUrl`.
- Uses source-code metadata from the pinned additional catalog, joined to current
  published database listings. Drafts and deletions are excluded. Metadata is
  only attached when both catalog slug and website match the saved listing.
- Published tools whose website is itself a GitHub/GitLab/Codeberg/Bitbucket repo
  also appear. No source URL is guessed for a tool's ordinary marketing website.
- Repository URLs are HTTPS, have no embedded credentials, and are deduplicated.
  No vendor API requests, access tokens, or live star/activity claims are used.
- Search covers name, description, repository path, source tags, and licenses.
  Category/host filters and 24-card progressive rendering run client-side.
- Source software licenses are snapshot metadata, not independently verified
  legal advice. Catalog credits remain linked on the page and in the footer.

Verification: build the API and run
`node artifacts/api-server/tests/repositories.mjs`.
