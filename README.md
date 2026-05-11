# Stremio Mangayomi

Pure JavaScript Mangayomi anime/video extension that reads Stremio addon manifests on iPhone/iOS.

This project is separate from Olympus Biblioteca. It does not use Dalvik, Android Proxy Server, Java, `127.0.0.1`, `localhost`, or any external proxy.

## Files

```text
stremio-mangayomi/
  anime_index.json
  repo.json
  anime/
    src/
      all/
        stremiobridge.js
  tools/
    stremio-bridge-smoke-test.mjs
```

## Install In Mangayomi

1. Open Mangayomi on iPhone.
2. Go to Extensions / Repositories.
3. Add this anime repository URL:

```text
https://raw.githubusercontent.com/scanplayext/stremio-mangayomi/main/anime_index.json
```

4. Install and enable `Stremio Bridge Direct`.
5. Open source settings:
   - `Catalog manifest URL`: defaults to official Cinemeta for movies/series metadata.
   - `Stream manifest URLs`: paste one or more configured Stremio addon manifest URLs, separated by new lines or commas.
6. Open the source from Browse / Anime.

## Important iOS Notes

The bridge only exposes direct HTTP(S) `stream.url` values. It blocks torrent-only streams, magnets, `externalUrl`, local/private network URLs, `localhost`, and Android proxy patterns.

For iPhone, use Stremio addons that return direct playable URLs. HLS/MP4/M4V/MOV links are ideal, but HTTPS stream URLs without a visible file extension are also accepted when the addon marks them as web-ready.

If Mangayomi says `video list is empty`, it means one of these is happening:

- `Stream manifest URLs` is empty.
- The Stremio addon only returns torrents, magnets, or `infoHash` streams.
- The addon has no stream for that movie/episode ID.
- The configured stream addon needs an account/API token and the pasted manifest URL is incomplete.

## How It Works

- Reads a Stremio manifest from `/manifest.json`.
- Uses catalog endpoints like `/catalog/movie/top/skip=0.json`.
- Uses meta endpoints like `/meta/movie/tt1254207.json`.
- Builds movie entries as one playable episode and series entries as episode lists from `meta.videos`.
- Calls configured stream addons at `/stream/{type}/{videoId}.json`.
- Keeps only direct iOS-compatible streams.

## Dependencies

None. Mangayomi provides `MProvider`, `Client`, `SharedPreferences`, and the JavaScript runtime.

## Local Smoke Test

```bash
node tools/stremio-bridge-smoke-test.mjs
```
