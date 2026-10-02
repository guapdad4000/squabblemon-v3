# Squabblemon source snapshot — LFS recovery

This is a source-code handoff, not a production release. Do not merge the handoff into `main` or deploy it without separate approval.

## Source snapshot

- Repository: https://github.com/guapdad4000/squabblemon-v3
- Source branch: `handoff/workspace-2026-10-02-beafd262`
- Workspace revision at capture: `beafd26225b51c18015778c6a6833827ef811622`
- Frozen local capture commit: `30191ba9167aaa3af2500b4eb39b3ba5e83f2fbc`
- Exact source Git tree: `9b4f98c28977347c21a19b00c2e3368f794a2126`
- Version-controlled files: 5,159

The snapshot includes the application, API, shared packages, configuration, pnpm lockfile, documentation, runtime assets, and tracked verification/balance evidence. It includes the reviewed, ordering-only change to the tracked component-preview import map. No gameplay changes were made for the handoff.

The published snapshot uses existing GitHub `main` as its history parent, rather than importing the workspace's checkpoint ancestry. The original workspace branch and its history are retained locally. Existing GitHub branches, access settings, and production `main` were not modified.

## Why this recovery branch exists

Eleven tracked evidence JSON files are Git LFS pointers. Their 600,671,624 bytes of object content existed and passed SHA-256 validation in the workspace, but GitHub's LFS download service returned object-not-found for all eleven.

The connected GitHub API can publish ordinary Git objects, but cannot reach the separate `github.com` LFS upload endpoint. Native Git write authentication was unavailable. No credentials were extracted and no repository permissions were changed.

To keep the source branch's Git tree exact while making all its tracked content retrievable, this separate recovery branch supplies the original LFS objects in `handoff-lfs-objects.tar.gz`. The `lfs-manifest.json` file lists every path, object ID, and original size. The bundle is an ordinary Git blob, not another LFS pointer.

- Recovery branch: `handoff/workspace-2026-10-02-beafd262-lfs`
- Bundle size: 17,964,429 bytes
- Bundle SHA-256: `6c3e7e1493875e17471dd1ea9b788bf5936cc49355ede70c2fce661cb1c958cc`

A normal first `git lfs pull` cannot download these objects from GitHub LFS yet. Restore the verified bundle once as below. An authorized operator may later upload the same objects to GitHub LFS using their own authenticated Git LFS client; this handoff did not set up that authentication.

## Retrieve the complete snapshot

Use a new directory. Git, Git LFS, `tar`, and `sha256sum` are required for these Linux commands.

```sh
GIT_LFS_SKIP_SMUDGE=1 git clone \
  --depth=1 --single-branch \
  --branch handoff/workspace-2026-10-02-beafd262 \
  https://github.com/guapdad4000/squabblemon-v3.git squabblemon-handoff
cd squabblemon-handoff
git lfs install --local

# Require the byte-exact source tree, not just a matching branch name.
test "$(git rev-parse HEAD^{tree})" = 9b4f98c28977347c21a19b00c2e3368f794a2126

# Fetch the separate recovery commit without switching the source branch.
git fetch --depth=1 origin handoff/workspace-2026-10-02-beafd262-lfs
git show FETCH_HEAD:handoff-lfs-objects.tar.gz > /tmp/squabblemon-handoff-lfs.tar.gz
printf '%s  %s\n' \
  6c3e7e1493875e17471dd1ea9b788bf5936cc49355ede70c2fce661cb1c958cc \
  /tmp/squabblemon-handoff-lfs.tar.gz | sha256sum --check -

mkdir -p "$(git rev-parse --git-dir)/lfs/objects"
tar -xzf /tmp/squabblemon-handoff-lfs.tar.gz \
  -C "$(git rev-parse --git-dir)/lfs/objects"
git lfs checkout
git lfs fsck --objects HEAD
git status --short
```

For immutable retrieval, use the published source commit and recovery commit linked in the handoff instead of relying on branch names. Before extracting any replacement bundle, check the SHA-256 above.

For local development, use Node 24 and pnpm. See the source repository's README and package documentation for setup. A database and local authentication/payment configuration must be supplied separately where required; neither data nor credentials are part of this snapshot.

## Explicit exclusions and existing limitations

- No tracked source or LFS object content was intentionally omitted.
- Ignored uploads, original media in `attached_assets`, local environment files/credentials, database contents, caches, dependencies, and generated build outputs are not included.
- Historical LFS attribute entries for ignored archive uploads do not make those uploads part of the current tracked snapshot.
- `handoff/SQUABBLEMON_DEV_SOURCE.zip` is an existing, unreadable older prototype archive. It is preserved byte-for-byte from GitHub `main`, not repaired or replaced. The current application's source and assets are tracked directly and do not rely on that archive.
- This is not a claim that existing application build/test failures were fixed, that a production release was validated, or that the live site was updated.