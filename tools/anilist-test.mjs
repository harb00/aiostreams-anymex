import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const prefs = {};
const context = vm.createContext({MProvider: class {}, Client: class {async post(url,headers,body) {assert.equal(typeof body,"object","Mangayomi JSON POST requires an object, not an encoded string");const r=await fetch(url,{method:"POST",headers,body:JSON.stringify(body)});if(!r.ok) throw Error("HTTP "+r.status);return {body:await r.text()};} async get(url) {const r=await fetch(url); if(!r.ok) throw Error('HTTP '+r.status);return {body:await r.text()};}}, assert, SharedPreferences:class {get(k){return prefs[k];}},console});
vm.runInContext(readFileSync(new URL('../anime/src/all/stremiobridge.js',import.meta.url),'utf8')+'\nglobalThis.provider=new DefaultExtension();',context);
const p=context.provider;
const m={id:16498,idMal:16498,title:{romaji:'Season 2'},coverImage:{large:'poster'},status:'FINISHED',format:'TV',episodes:12};
const eps=p.anilistEpisodes(m);
assert.equal(eps.length,12);assert.equal(eps[0].name,'Episode 12');assert.equal(eps[11].name,'Episode 1');
assert.equal(p.unpackRef(eps[11].url).id,'mal:16498:1');
assert.equal(p.anilistItem(m).link,p.anilistItem({...m,idMal:99,title:{romaji:'Changed'}}).link);
assert.notEqual(p.anilistItem(m).link,p.anilistItem({...m,id:99}).link);
assert.equal(p.anilistEpisodes({...m,status:'RELEASING',nextAiringEpisode:{episode:4}}).length,3);
assert.equal(p.anilistEpisodes({...m,status:'NOT_YET_RELEASED'}).length,0);
assert.equal(p.anilistEpisodes({...m,episodes:null}).length,0);
assert.equal(p.anilistEpisodes({...m,nextAiringEpisode:{episode:1}}).length,0);
assert.equal(p.anilistEpisodes({...m,format:'MOVIE',episodes:1})[0].name,'Episode 1');
assert.equal(p.unpackRef(p.anilistEpisodes({...m,format:'MOVIE',episodes:1})[0].url).id,'mal:16498');
assert.throws(()=>p.anilistEpisodes({...m,idMal:null}),/MAL/);
await assert.rejects(()=>p.getDetail(p.packRef({kind:'meta',id:'tt123'})),/AniList/);
await assert.rejects(()=>p.getVideoList(p.packRef({kind:'stream',id:'tt123:2:1'})),/AniList/);
assert(!p.getSourcePreferences().some(x=>/catalog/.test(x.key)));
const original=p.requestJson.bind(p);const requested=[];
prefs.stremio_stream_manifest_urls='https://example.com/config/manifest.json';
p.requestJson=async url=>{requested.push(url);return url.endsWith('manifest.json')?{resources:['stream']}:{streams:[{url:'https://example.com/video.mp4'}]};};
assert.equal((await p.getVideoList(eps[11].url)).length,1);
assert(requested.includes('https://example.com/config/stream/series/mal:16498:1.json'));
p.requestJson=original;
const video=p.videoFromStream({url:'https://example.com/v.mp4',subtitles:[{url:'https://example.com/en.vtt',lang:'en'},{url:'https://example.com/da.srt',lang:'da'},{url:'https://example.com/en.vtt',lang:'en'},null,{url:'file:///tmp/sub.srt'},{url:'http://127.0.0.1/sub.srt'}]},'Test',p.readSettings());
assert.equal(video.subtitles.length,2);assert.equal(video.subtitles[0].file,'https://example.com/en.vtt');assert.equal(video.subtitles[1].label,'da');
assert.equal(p.videoFromStream({url:'https://example.com/v.mp4'},'Test',p.readSettings()).subtitles.length,0);
console.log('PASS: subtitle forwarding, filtering and deduplication; no invented embedded tracks.');
console.log('PASS: separate stable titles, local numbering, aired episodes, movies, missing mappings, legacy rejection, MAL stream routing.');
if(process.argv.includes('--live')) {
 const result=await p.search((await p.getDetail(p.packRef({kind:'anilist',id:20958}))).name,1,[]);
 assert(result.list.length>1);
 const season=result.list.find(x=>p.unpackRef(x.link).id===20958);assert(season);
 const detail=await p.getDetail(season.link);assert.equal(detail.episodes.length,12);
 const first=detail.episodes.at(-1);assert.equal(first.name,'Episode 1');assert.equal(p.unpackRef(first.url).id,'mal:25777:1');
 const mha=await p.getDetail(p.packRef({kind:'anilist',id:104276}));
 assert.equal(mha.episodes.length,25);
 assert.equal(mha.episodes.at(-1).name,'Episode 1');
 assert.equal(p.unpackRef(mha.episodes.at(-1).url).id,'mal:38408:1');
 console.log('PASS live: mapped anime entry -> 25 episodes -> mal:38408:1');
 console.log('PASS live: AniList search -> mapped anime entry -> 12 episodes -> mal:25777:1');
}

assert.equal(p.streamQuality({name:"AIO 1080p",description:"Release title"},"AIOStreams","https://example.com/2160p.mp4"),"AIO 1080p - Release title - [AIOStreams]");
assert.equal(p.streamQuality({name:"Original name"},"","https://example.com/1080p.mp4"),"Original name");
console.log("PASS: source names preserve AIOStreams resolution without adding a prefix.");
const savedJson=p.requestJson.bind(p);
const subtitleManifest={resources:[{name:'subtitles',types:['series'],idPrefixes:['tt']}]};
const calls=[];
p.requestJson=async url=>{calls.push(url);return url.includes('/api/v1/anime')?{data:{mappings:{imdbId:'tt5626028'},imdb:{seasonNumber:4,fromEpisode:1}}}:{subtitles:[{url:'https://example.com/sub.vtt',lang:'en'}]};};
const external=await p.episodeSubtitles('https://example.com/config',subtitleManifest,{type:'series',id:'mal:38408:7'});
assert.equal(external.length,1);assert.equal(calls[1],'https://example.com/config/subtitles/series/tt5626028:4:7.json');
p.requestJson=async()=>({data:{mappings:{imdbId:'tt5626028'},tvdb:{seasonNumber:4},imdb:{}}});
assert.equal((await p.episodeSubtitles('https://example.com/config',subtitleManifest,{type:'series',id:'mal:38408:7'})).length,0);
p.requestJson=async()=>{throw Error('subtitle provider unavailable');};
assert.equal((await p.episodeSubtitles('https://example.com/config',subtitleManifest,{type:'series',id:'mal:38408:7'})).length,0);
p.requestJson=savedJson;
console.log('PASS: separate subtitles resource, IMDb season/episode mapping, no TVDB guessing, optional-provider failure.');

const candidateTracks=[
 {url:'https://example.com/a.srt',subtitleFileName:'[Group-A] Series.S04E07.1080p.srt'},
 {url:'https://example.com/b.srt',movieReleaseName:'[Group-B] Series.S04E07.720p'},
 {url:'https://example.com/c.srt',subtitleFileName:'[Group-A] Series.S04E08.1080p.srt'},
 {url:'https://example.com/d.srt',lang:'en'},
 null
];
const sourceA={behaviorHints:{filename:'[Group-A] Series.S04E07.1080p.mkv'}};
const sourceB={behaviorHints:{filename:'[Group-B] Series.S04E07.720p.mkv'}};
assert.equal(p.matchSubtitles(sourceA,candidateTracks).length,1);
assert.equal(p.matchSubtitles(sourceA,candidateTracks)[0].url,'https://example.com/a.srt');
assert.equal(p.matchSubtitles(sourceB,candidateTracks)[0].url,'https://example.com/b.srt');
assert.equal(p.matchSubtitles({},candidateTracks).length,0);
assert.equal(p.matchSubtitles({behaviorHints:{filename:'Unknown.mkv'}},candidateTracks).length,0);
console.log('PASS: release matching keeps sources separate and excludes mismatched episodes, groups and unknown files.');
