# Publishing Squabblemon

## Required public origin

Before publishing, add `PUBLIC_ORIGIN` to the Production environment with the
final HTTPS origin that will serve Squabblemon:

```text
PUBLIC_ORIGIN=https://your-final-domain.example
```

Use only the origin: do not include a path, query string, or fragment. The
configured `BASE_PATH` is appended separately.

Squabblemon uses this value to emit absolute `og:url`, `og:image`, and
`twitter:image` metadata for social crawlers. Replit does not assign the final
`replit.app` or custom-domain URL until publishing, so this value intentionally
comes from the Production environment rather than source control.

The deployment build fails when `PUBLIC_ORIGIN` is missing or is not HTTPS.
After the first publish or any domain change, confirm that the live page source
contains the final public URL in all three social metadata fields.