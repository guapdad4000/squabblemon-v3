---
name: Social identity compatibility
description: The intent behind replacing visible friend codes without invalidating existing relationships or shared links.
---

The Fadebook request to replace friend codes is a discovery and presentation change, not permission to invalidate existing contacts or shared links.

**Why:** The user wanted recognizable usernames and portrait/name confirmation. Existing friendships and previously shared links still need to identify the same account after its public names change.

**How to apply:** Hide opaque codes from ordinary social UI while retaining compatibility behind links and actions. Do not migrate relationships onto mutable usernames merely to remove codes from the screen.

Social setup must not be a prerequisite for being discoverable by an existing public player name.

**Why:** Existing players could be invisible until they first used a social feature. Tests that created social identities for every fixture missed this lifecycle gap.

**How to apply:** Treat absent social metadata as an uninitialized identity, not a privacy opt-out. Resolve only bounded, unblocked search matches without changing chosen handles. Verify discovery with two independent accounts before social setup and again after renaming.