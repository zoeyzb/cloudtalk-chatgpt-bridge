# Sierra Call Bridge

Goal: keep the user's existing ChatGPT web Voice and BlackHole audio while detecting CloudTalk call context and marking contacts. No Realtime API replacement, new hosting, credential extraction, automated dialing, or desktop-app scraping.

Architecture: extension control tab embeds the documented CloudTalk phone. Origin and iframe source are validated. A Manifest V3 worker holds session-only state and binds one exact GPT conversation tab and one authenticated CloudTalk Control tab. GPT receives bounded context through its ordinary composer. The authenticated private Site proxies fixed contact API operations; credentials stay server-side.

Acceptance criteria:
- Number, contact ID/name, UUID and lifecycle update from provider events without spoken operator input.
- Cross-origin forged events, overlapping calls, stale outcomes and navigation to another GPT chat fail closed.
- Between calls GPT tab output is muted. Only answered calls may unmute it. Stop restores its previous mute setting.
- Existing human drafts are never overwritten. Delivery requires a visible transcript acknowledgment; uncertain submission is never automatically retried.
- An approved session can write one bounded note and selected existing tag for an ended call, with contact/number checks at the bridge. Partial or uncertain writes remain visible and are not retried.
- No secrets, arbitrary API paths, transcript history, remote code, analytics or customer calls in tests.
- An installation ZIP includes all runtime files, setup instructions and evidence. Actual Mac audio and provider-event tests remain explicitly pending until tested on that Mac.

Slices: validated lifecycle; extension delivery/control; bounded outcome capture and private Site API; mocked integration/security tests; browser selector check, deployment and packaging.

Reference influence: installed incremental-implementation skill provides the small-slice workflow associated with addyosmani/agent-skills. Specification and acceptance-criteria structure follows github/spec-kit's approach; project code is newly written, with no repository code copied. Browser integration uses official Chrome APIs and CloudTalk's documented iframe event pattern. No extra libraries.
