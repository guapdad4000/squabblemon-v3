# Publishing Squabblemon

Production is https://squabble.today on Netlify project squabblemon-triple-lane.
GitHub main in guapdad4000/squabblemon-v3 is the deployment source. See the root
README for the checked build and authorized manual deployment command.

## Required public origin

Before publishing, add `PUBLIC_ORIGIN` to the Production environment with the
final HTTPS origin that will serve Squabblemon:

```text
PUBLIC_ORIGIN=https://squabble.today
```

Use only the origin: do not include a path, query string, or fragment. The
configured `BASE_PATH` is appended separately.

Squabblemon uses this value to emit absolute `og:url`, `og:image`, and
`twitter:image` metadata for social crawlers. Netlify supplies deployment context, and the production origin is configured
in its environment settings. Keep Clerk and database credentials there.

The deployment build fails when `PUBLIC_ORIGIN` is missing or is not HTTPS.
After the first publish or any domain change, confirm that the live page source
contains the final public URL in all three social metadata fields.