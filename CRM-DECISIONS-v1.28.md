# CRM Decisions v1.28: Calling view performance

Date: 2026-10-18
Status: Implemented and ready for release

- Calling rows, filters, tab results, and daily metrics are memoized so typing, expanding a result, or switching tabs does not rebuild the full list repeatedly.
- Search uses a deferred value so the interface remains responsive while the caller types.
- Calling history and open follow-up queries have targeted additive indexes.
- The existing 30-row calling page, call button, copy button, inline result form, automatic row removal, and activity logging behavior remain unchanged.
