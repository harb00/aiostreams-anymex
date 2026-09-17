# AIOStreams Bridge for AnymeX / Mangayomi

Personal extension based on [scanplayext/stremio-mangayomi](https://github.com/scanplayext/stremio-mangayomi).

## Install
Add this as a Mangayomi anime repository in AnymeX:

https://raw.githubusercontent.com/harb00/aiostreams-anymex/main/anime_index.json

Update **AIOStreams Bridge harb00**, then paste your private AIOStreams manifest in **Stream manifest URLs**. Anime browsing and search now use AniList directly; no catalog manifest is needed. Cinemeta support and old Cinemeta links have been removed. Re-add old titles from the new catalog and select the source again for existing tracker titles. Old local history/bindings are not migrated.

## Seasons and tracking
Each AniList anime entry is a separate title with its own stable source link. Seasons and parts are separate when AniList lists them separately; we do not invent TV-season divisions for long-running anime. Episodes start at 1 within that entry. Movies also expose Episode 1. AIOStreams receives the entry's MAL ID and local episode number, rather than a combined Cinemeta series ID.

In AnymeX 3.1.7:
- Starting from an AniList/MAL anime page: select the matching season/part from this source. Use Wrong Title if the automatic match is incorrect.
- Starting from the extension catalog: add a tracking binding to the exact AniList/MAL entry in AnymeX. The description includes both reference links. Log in and enable tracking in the app.
- Source entries cannot create tracker bindings or authenticate on your behalf. Tracking without a binding is skipped by AnymeX. Do not reuse the first season's binding for another season.

Episode names are deliberately `Episode N`: AnymeX's Mangayomi runtime extracts progress numbers from the name. Source IDs remain stable if a title or MAL mapping changes. Unknown episode counts produce an empty list; episodes before their announced airing and titles without MAL mappings are not fabricated. Stream availability still depends on AIOStreams and its configured addons.

Animap aligns AniDB episodes with TVDB seasons using mapping rules. This extension does not run an Animap server; it uses AniList's entry boundaries and delegates stream ID mapping to AIOStreams.

## Validation
Run `node tools/anilist-test.mjs` for regression tests, or add `--live` for AniList search/detail checks. Tests cover identity, numbering, movies, unaired episodes, legacy rejection and MAL stream routing. AnymeX 3.1.7 tracking and the Mangayomi number parser were inspected; native iOS playback and authenticated tracker writes still require device verification.

Direct HTTP(S) playback only. Never commit personal manifest URLs or API keys.
