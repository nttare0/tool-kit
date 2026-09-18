---
name: Vite HTML metadata
description: Build behavior for canonical metadata in the Toolstack Vite artifact.
---

Root-relative canonical links such as `href="/"` can be interpreted as local asset URLs by this Vite configuration and fail the production build with an EISDIR error. Keep the static HTML build-safe and create/update the canonical link at runtime from the actual browser origin and route.

**Why:** The artifact's production domain is not known from the workspace, and hardcoding one would produce incorrect SEO metadata while also breaking the static build.

**How to apply:** When adding canonical metadata to this artifact, update it from the router using the current origin and route; do not add a guessed production domain or root-relative canonical asset to `index.html`.