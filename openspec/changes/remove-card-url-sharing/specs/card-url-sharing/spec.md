## REMOVED Requirements

### Requirement: Export the current card as a URL
**Reason**: The account-free `?card=` URL sharing mechanism is being retired in favor of the single, server-backed, revocable share-link flow. Maintaining two parallel sharing mechanisms doubled the surface area and froze the URL payload schema forever.
**Migration**: To share a card, save it (signed in) and mint a share link via the share-link flow. The `encodeCardToUrl` function and the "Copy card link" UI are removed.

### Requirement: Restore exact card state from an exported URL
**Reason**: With URL export removed, there is no encoded payload to restore. The app no longer reads the `?card=` query parameter.
**Migration**: Existing `?card=` links are silently ignored — the app loads normally with an empty/default card. There is no redirect or lookup table; recipients of old links must obtain a share link instead.

### Requirement: Handle missing or invalid card data in the URL gracefully
**Reason**: This requirement governed decoding of `?card=` payloads. With decoding removed entirely, there is no payload to validate or fall back from.
**Migration**: None. The `?card=` parameter is no longer inspected; any value (present, absent, or malformed) results in the normal empty/default editor state.

### Requirement: URL sharing remains available without an account
**Reason**: This requirement codified the architectural guarantee that URL sharing was permanent and account-free. That guarantee is being deliberately reversed: sharing now requires an account, and the URL path no longer exists.
**Migration**: Account-free card generation, randomize, print, and PNG export remain. Sharing requires signing in and minting a share link.
