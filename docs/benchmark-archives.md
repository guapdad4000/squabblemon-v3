# Archived benchmark data

The game and its release build do not require the large historical benchmark
payloads tracked with Git LFS under `scripts/results/`.

Ordinary checkouts intentionally leave **those LFS files only** as pointers.
This keeps game builds from failing before compilation when a historical LFS
payload is unavailable from GitHub's LFS endpoint. Other files, including game
artwork, are not excluded. Existing local benchmark payloads are not removed.

## Running an archived analysis

Restore its LFS payloads first. The complete, hash-verified recovery bundle and
restoration instructions are preserved in the
[immutable recovery branch](https://github.com/guapdad4000/squabblemon-v3/tree/773efeb90426a865009620e1f4e6893d51ce8e44).
Follow its instructions to restore the local LFS object store and check out the
original files. A pointer file is not usable benchmark JSON.

This checkout policy does not rewrite the archived evidence or its checksums.
Once the objects are available through native Git LFS, an explicit
`git lfs pull --include="scripts/results/**" --exclude=""` can download them
instead. Do not remove the scoped exclusion until a fresh checkout confirms
that every required LFS object is downloadable.