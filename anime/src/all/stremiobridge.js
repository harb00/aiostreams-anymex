const mangayomiSources = [
    {
        "name": "AIOStreams Bridge harb00",
        "id": 928410664,
        "baseUrl": "https://anilist.co",
        "apiUrl": "",
        "lang": "all",
        "typeSource": "single",
        "iconUrl": "https://www.stremio.com/website/stremio-logo-small.png",
        "itemType": 1,
        "isManga": false,
        "isNsfw": false,
        "version": "0.2.6",
        "dateFormat": "",
        "dateFormatLocale": "",
        "pkgPath": "anime/src/all/stremiobridge.js",
        "pkgName": "anime/src/all/stremiobridge.js"
    }
];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
        this.manifestCache = {};
        this.manifestCacheTime = {};
        this.manifestCacheTtlMs = 1000 * 60 * 15;
        this.userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    }

    get supportsLatest() {
        return true;
    }

    getHeaders() {
        return {
            "User-Agent": this.userAgent,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
        };
    }

    async getPopular(page) { return this.anilistCatalog("", page, "POPULARITY_DESC"); }

    async getLatestUpdates(page) { return this.anilistCatalog("", page, "START_DATE_DESC"); }

    async search(query, page, filters) { return this.anilistCatalog(query, page, "SEARCH_MATCH"); }

    async getDetail(url) {
        const ref = this.unpackRef(url);
        if (ref.kind !== "anilist") throw new Error("Open this anime from the AniList catalog and bind its tracker in AnymeX.");
        return this.anilistDetail(ref, url);
    }

    async getVideoList(url) {
        const ref = this.unpackRef(url);
        if (!ref.anilistId || ref.kind !== "stream") throw new Error("Select an episode from the AniList catalog.");
        const settings = this.readSettings();
        const type = ref.type || "movie";
        const id = ref.id || ref.parentId || "";
        const providers = this.videoProviderUrls(ref, settings);
        const videos = [];
        const seen = {};

        if (!id || providers.length === 0) {
            return videos;
        }

        for (const manifestUrl of providers) {
            const baseUrl = this.manifestBaseUrl(manifestUrl);
            if (!baseUrl || this.isLocalUrl(baseUrl)) {
                continue;
            }

            let manifest = null;
            try {
                manifest = await this.getManifest(manifestUrl);
            } catch (error) {
                manifest = null;
            }
            if (manifest && !this.manifestHasResource(manifest, "stream")) {
                continue;
            }

            try {
                const streamUrl = this.resourceUrl(baseUrl, "stream", type, id, null);
                const json = await this.requestJson(streamUrl);
                const streams = json && Array.isArray(json.streams) ? json.streams : [];
                const addonName = manifest && manifest.name ? manifest.name : this.hostLabel(baseUrl);

                for (const stream of streams) {
                    const video = this.videoFromStream(stream, addonName, settings);
                    if (!video || seen[video.url]) {
                        continue;
                    }
                    seen[video.url] = true;
                    videos.push(video);
                    if (settings.maxStreams !== "all" && videos.length >= Number(settings.maxStreams || 20)) {
                        return this.sortVideos(videos);
                    }
                }
            } catch (error) {
                continue;
            }
        }

        return this.sortVideos(videos);
    }

    getFilterList() { return []; }

    getSourcePreferences() {
        return [
            {
                "key": "stremio_stream_manifest_urls",
                "editTextPreference": {
                    "title": "Stream manifest URLs",
                    "summary": "One or more Stremio stream manifests, separated by new lines or commas. Direct HTTP(S) streams only.",
                    "value": "",
                    "dialogTitle": "Stream manifest URLs",
                    "dialogMessage": "Paste configured Stremio addon manifest URLs. Torrent/magnet/infoHash/local streams are always ignored."
                }
            },
            {
                "key": "stremio_max_streams",
                "listPreference": {
                    "title": "Max streams",
                    "summary": "Lower values make video loading faster on iPhone.",
                    "valueIndex": 2,
                    "entries": [
                        "5",
                        "10",
                        "20",
                        "All"
                    ],
                    "entryValues": [
                        "5",
                        "10",
                        "20",
                        "all"
                    ]
                }
            },
            {
                "key": "stremio_strict_ios_streams",
                "switchPreferenceCompat": {
                    "title": "Prefer iOS-safe streams",
                    "summary": "Block obvious non-video files while allowing direct HTTPS streams.",
                    "value": true
                }
            },
            {
                "key": "stremio_allow_http_streams",
                "switchPreferenceCompat": {
                    "title": "Allow non-HTTPS streams",
                    "summary": "Disabled by default for iOS compatibility and privacy.",
                    "value": false
                }
            }
        ];
    }

    anilistFields() {
        return "id idMal format episodes status isAdult title{romaji english native} coverImage{large extraLarge} description genres nextAiringEpisode{episode} startDate{year month day}";
    }

    async anilistQuery(query, variables) {
        // Mangayomi serializes application/json bodies in its Dart HTTP bridge.
        // Pass an object; a JSON string would be encoded a second time.
        const response = await this.client.post("https://graphql.anilist.co",
            Object.assign({}, this.getHeaders(), { "Content-Type": "application/json" }),
            { query, variables });
        const json = response && response.body ? JSON.parse(response.body) : null;
        if (!json || json.errors || !json.data) {
            throw new Error("AniList lookup failed. Try again later.");
        }
        return json.data;
    }

    async anilistCatalog(query, page, sort) {
        const search = this.cleanText(query);
        const data = await this.anilistQuery(
            "query($page:Int,$search:String,$sort:[MediaSort]){Page(page:$page,perPage:30){pageInfo{hasNextPage}media(type:ANIME,isAdult:false,search:$search,sort:$sort){" + this.anilistFields() + "}}}",
            { page: this.safePage(page), search: search || null, sort: [search ? "SEARCH_MATCH" : (sort === "SEARCH_MATCH" ? "POPULARITY_DESC" : sort)] }
        );
        return {
            list: data.Page.media.map(media => this.anilistItem(media)),
            hasNextPage: Boolean(data.Page.pageInfo.hasNextPage)
        };
    }

    anilistItem(media) {
        return {
            name: media.title.romaji || media.title.english || media.title.native,
            imageUrl: media.coverImage.extraLarge || media.coverImage.large,
            // Only the AniList ID defines identity. Titles, MAL mappings and settings can change.
            link: this.packRef({ kind: "anilist", id: media.id }),
            description: this.cleanText(media.description),
            genre: media.genres || []
        };
    }

    async anilistDetail(ref, url) {
        const data = await this.anilistQuery(
            "query($id:Int!){Media(id:$id,type:ANIME){" + this.anilistFields() + "}}",
            { id: Number(ref.id) }
        );
        const media = data.Media;
        if (!media) throw new Error("AniList could not resolve this anime.");
        const item = this.anilistItem(media);
        const ids = "AniList: https://anilist.co/anime/" + media.id +
            (media.idMal ? "\nMyAnimeList: https://myanimelist.net/anime/" + media.idMal : "");
        return Object.assign({}, item, {
            link: url,
            description: item.description + "\n\n" + ids +
                "\nTracking: bind this exact anime entry in AnymeX. Episode numbers are local to this entry.",
            status: media.status === "FINISHED" ? 1 : (media.status === "RELEASING" ? 0 : 5),
            episodes: this.anilistEpisodes(media)
        });
    }

    anilistEpisodes(media) {
        if (media.status === "NOT_YET_RELEASED" || media.status === "CANCELLED") return [];
        if (!media.idMal) throw new Error("This anime has no MAL mapping for AIOStreams yet.");
        let count = media.episodes || 0;
        if (media.nextAiringEpisode && media.nextAiringEpisode.episode > 0) {
            const aired = media.nextAiringEpisode.episode - 1;
            count = count ? Math.min(count, aired) : aired;
        }
        if (!count && media.format === "MOVIE" && media.status === "FINISHED") count = 1;
        const type = media.format === "MOVIE" ? "movie" : "series";
        const episodes = [];
        for (let number = count; number >= 1; number--) {
            episodes.push({
                // AnymeX's Mangayomi bridge parses the number from this name.
                // No season/title numbers precede it, including for movies.
                name: "Episode " + number,
                url: this.packRef({
                    kind: "stream", anilistId: media.id, type,
                    id: "mal:" + media.idMal + (type === "movie" ? "" : ":" + number)
                })
            });
        }
        return episodes;
    }

    async getManifest(manifestUrl) {
        const normalized = this.manifestUrl(manifestUrl);
        const now = Date.now();
        if (this.manifestCache[normalized] && now - this.manifestCacheTime[normalized] < this.manifestCacheTtlMs) {
            return this.manifestCache[normalized];
        }

        const json = await this.requestJson(normalized);
        this.manifestCache[normalized] = json;
        this.manifestCacheTime[normalized] = now;
        return json;
    }

    async requestJson(url) {
        if (!url || this.isLocalUrl(url)) {
            throw new Error(`Blocked local or empty URL: ${url}`);
        }
        const response = await this.client.get(url, this.getHeaders());
        if (!response || !response.body) {
            throw new Error(`Empty Stremio response: ${url}`);
        }
        return JSON.parse(response.body);
    }

    videoFromStream(stream, addonName, settings) {
        if (!stream || stream.magnet || stream.nzbUrl || stream.rarUrls || stream.zipUrls || stream.externalUrl) {
            return null;
        }
        if (!stream.url && (stream.infoHash || stream.fileIdx !== undefined)) {
            return null;
        }
        const url = this.absoluteUrl(stream.url || "");
        if (!this.isPlayableDirectUrl(url, settings, stream)) {
            return null;
        }

        const hints = stream.behaviorHints || {};
        const headers = hints.proxyHeaders && hints.proxyHeaders.request ? hints.proxyHeaders.request : undefined;
        const quality = this.streamQuality(stream, addonName, url);
        const video = {
            url,
            originalUrl: url,
            quality
        };
        if (headers) {
            video.headers = headers;
        }
        return video;
    }

    isPlayableDirectUrl(url, settings, stream) {
        if (!url || this.isLocalUrl(url)) {
            return false;
        }
        const lower = String(url).toLowerCase();
        if (lower.indexOf("magnet:") === 0 || lower.indexOf(".torrent") !== -1) {
            return false;
        }
        if (lower.indexOf("https://") !== 0) {
            if (lower.indexOf("http://") !== 0 || !settings.allowHttpStreams) {
                return false;
            }
        }
        if (!settings.strictIosStreams) {
            return true;
        }

        const path = lower.split("?")[0].split("#")[0];
        if (/\.(zip|rar|7z|tar|gz|nzb|torrent|srt|vtt|ass|ssa|html?)$/i.test(path)) {
            return false;
        }

        const hints = stream && stream.behaviorHints ? stream.behaviorHints : {};
        if (hints.notWebReady === true) {
            return lower.indexOf(".m3u8") !== -1 ||
                lower.indexOf(".mp4") !== -1 ||
                lower.indexOf(".m4v") !== -1 ||
                lower.indexOf(".mov") !== -1 ||
                lower.indexOf("/hls") !== -1 ||
                lower.indexOf("playlist") !== -1 ||
                lower.indexOf("master") !== -1 ||
                lower.indexOf("manifest") !== -1;
        }

        return true;
    }

    streamQuality(stream, addonName, url) {
        const parts = [];
        if (stream.name) {
            parts.push(this.cleanText(stream.name));
        }
        if (stream.title || stream.description) {
            parts.push(this.cleanText(stream.title || stream.description));
        }
        if (addonName) {
            parts.push(`[${this.cleanText(addonName)}]`);
        }
        return parts.join(" - ").replace(/\s+/g, " ").trim() || "Direct stream";
    }

    sortVideos(videos) {
        const rank = value => {
            const text = String(value.quality || "").toLowerCase();
            if (text.indexOf("4k") !== -1 || text.indexOf("2160") !== -1) return 5;
            if (text.indexOf("1080") !== -1) return 4;
            if (text.indexOf("720") !== -1) return 3;
            if (text.indexOf("480") !== -1) return 2;
            if (text.indexOf("360") !== -1) return 1;
            return 0;
        };
        return videos.sort((a, b) => rank(b) - rank(a));
    }

    manifestHasResource(manifest, resourceName) {
        const resources = manifest && Array.isArray(manifest.resources) ? manifest.resources : [];
        return resources.some(resource => {
            if (typeof resource === "string") {
                return resource === resourceName;
            }
            return resource && resource.name === resourceName;
        });
    }

    streamManifestUrls(settings) {
        const urls = this.splitUrls(settings.streamManifestUrls)
            .map(url => this.manifestUrl(url))
            .filter(url => url && !this.isLocalUrl(url));
        return this.unique(urls);
    }

    videoProviderUrls(ref, settings) { return this.streamManifestUrls(settings); }

    splitUrls(value) {
        return String(value || "")
            .split(/[\n,;]+/)
            .map(item => item.trim())
            .filter(Boolean);
    }

    resourceUrl(baseUrl, resource, type, id, extra) {
        const base = String(baseUrl || "").replace(/\/+$/, "");
        let url = `${base}/${resource}/${this.encodePathSegment(type)}/${this.encodePathSegment(id)}`;
        const extraPath = this.extraPath(extra);
        if (extraPath) {
            url += `/${extraPath}`;
        }
        return `${url}.json`;
    }

    extraPath(extra) {
        if (!extra) {
            return "";
        }
        const parts = [];
        Object.keys(extra).forEach(key => {
            const value = extra[key];
            if (value !== undefined && value !== null && String(value).length > 0) {
                parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
            }
        });
        return parts.join("&");
    }

    encodePathSegment(value) {
        return encodeURIComponent(String(value || ""))
            .replace(/%3A/g, ":")
            .replace(/%2C/g, ",");
    }

    manifestUrl(value) {
        const base = this.manifestBaseUrl(value);
        return base ? `${base}/manifest.json` : "";
    }

    manifestBaseUrl(value) {
        let url = String(value || "").trim();
        if (!url) {
            return "";
        }
        url = url.replace(/^stremio:\/\//i, "https://");
        url = url.replace(/\/+$/, "");
        url = url.replace(/\/manifest\.json$/i, "");
        url = url.replace(/\/manifest$/i, "");
        if (url.indexOf("http://") !== 0 && url.indexOf("https://") !== 0) {
            url = `https://${url}`;
        }
        return url;
    }

    absoluteUrl(value) {
        const url = String(value || "").trim();
        if (!url) {
            return "";
        }
        if (url.indexOf("//") === 0) {
            return `https:${url}`;
        }
        return url;
    }

    isLocalUrl(value) {
        const lower = String(value || "").toLowerCase();
        const match = lower.match(/^[a-z]+:\/\/\[?([^\]\/:]+)/);
        const host = match ? match[1] : lower;
        return host === "localhost" ||
            host === "::1" ||
            host === "0.0.0.0" ||
            host === "127.0.0.1" ||
            /^127\./.test(host) ||
            /^10\./.test(host) ||
            /^192\.168\./.test(host) ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
            /\.local$/.test(host);
    }

    packRef(ref) {
        return `stremio-bridge|${encodeURIComponent(JSON.stringify(ref || {}))}`;
    }

    unpackRef(value) {
        const text = String(value || "");
        if (text.indexOf("stremio-bridge|") !== 0) {
            return {};
        }
        try {
            return JSON.parse(decodeURIComponent(text.substring("stremio-bridge|".length)));
        } catch (error) {
            return {};
        }
    }

    readSettings() {
        const preferences = new SharedPreferences();
        return {
            streamManifestUrls: this.preference(preferences, "stremio_stream_manifest_urls", ""),
            maxStreams: this.preference(preferences, "stremio_max_streams", "20"),
            strictIosStreams: this.boolPreference(preferences, "stremio_strict_ios_streams", true),
            allowHttpStreams: this.boolPreference(preferences, "stremio_allow_http_streams", false)
        };
    }

    preference(preferences, key, fallback) {
        const value = preferences.get(key);
        if (value === undefined || value === null || String(value).length === 0) {
            return fallback;
        }
        return value;
    }

    boolPreference(preferences, key, fallback) {
        const value = preferences.get(key);
        if (value === undefined || value === null || value === "") {
            return fallback;
        }
        return value === true || value === "true";
    }

    normalizeImageUrl(url) {
        if (!url || typeof url !== "string") {
            return "";
        }
        try {
            return encodeURI(url)
                .replace(/\(/g, "%28")
                .replace(/\)/g, "%29")
                .replace(/'/g, "%27");
        } catch (error) {
            return url;
        }
    }

    safePage(page) {
        const value = Number(page || 1);
        return value > 0 ? value : 1;
    }

    unique(values) {
        const seen = {};
        return values.filter(value => {
            if (!value || seen[value]) {
                return false;
            }
            seen[value] = true;
            return true;
        });
    }

    hostLabel(url) {
        const match = String(url || "").match(/^https?:\/\/([^/]+)/i);
        return match ? match[1] : "Stremio";
    }

    cleanText(value) {
        if (value === null || value === undefined) {
            return "";
        }
        return String(value)
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, "\"")
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'")
            .replace(/\s+/g, " ")
            .trim();
    }


}
