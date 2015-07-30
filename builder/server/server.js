Meteor.startup(function () {
    // code to run on server at startup
    //
    // getApiKey is defined in server/apikey.js as:
    // Meteor.startup(function () {
    //     getApiKey = function() { 
    //         return '[redacted]';
    //     }
    // });
    var baseUrl = {'na': 'https://na.api.pvp.net/', 'global': 'https://global.api.pvp.net/'};
    var ddragon = 'https://ddragon.leagueoflegends.com/cdn/';
    var caches = {  
        'summonerInfo':new Mongo.Collection('summonerInfoCache'),
        'championInfo':new Mongo.Collection('championInfoCache'),
        'matchHistory':new Mongo.Collection('matchHistoryCache'),
        'game':new Mongo.Collection('gameCache'),
        'summonerSpellInfo':new Mongo.Collection('summonerSpellInfoCache'),
        'itemInfo':new Mongo.Collection('itemInfoCache'),
        'gameDB':new Mongo.Collection('gameDB'),
        'rankedDB':new Mongo.Collection('matchHistoryDB'),
        'dummy':new Mongo.Collection('dummyCache')
    };
    var bootsMap = {
        3280:1309, 3282:1305, 3281:1307, 3284:1306, 3283:1308, 
        3278:1333, 3279:1331, 3250:1304, 3251:1302, 3254:1301, 
        3255:1314, 3252:1300, 3253:1303, 3263:1318, 3264:1316, 
        3265:1324, 3266:1322, 3260:1319, 3261:1317, 3262:1315, 
        3257:1310, 3256:1312, 3259:1311, 3258:1313, 3276:1332, 
        3277:1330, 3274:1326, 3275:1334, 3272:1325, 3273:1328, 
        3270:1329, 3271:1327, 3269:1321, 3268:1323, 3267:1320
    };
    Meteor.methods({
        getKappa: function(){
            console.log('DESTROYING DATABASES!');
            for (key in caches) {
                caches[key].remove({});
            }
        },
        getApiData: function(api, args, url, skipCache) {
            var apiData;
            var cache = caches[api];
            var cached = skipCache ? false : cache.findOne(args);
            if (cached) {
                apiData = cached['_data'];
            }
            else {
                apiData = HTTP.call('GET', url+'&api_key='+getApiKey()).data;
            }
            return apiData;
        },
        getCurrentVersion: function() {
            return HTTP.call('GET', 'https://global.api.pvp.net/api/lol/static-data/na/v1.2/versions?api_key='+getApiKey()).data[0]; 
        },
        getItemInfo: function(itemId) {
            var skipCache = false;
            if (itemId in bootsMap) {
                itemId = bootsMap[itemId]
            }
            return Meteor.call('getApiData', 'itemInfo', {itemId:itemId}, baseUrl['global']+'api/lol/static-data/na/v1.2/item/'+itemId+'?itemData=image', skipCache);
        },
        getSummonerSpellInfo: function(summonerSpellId) {
            var skipCache = false;
            return Meteor.call('getApiData', 'summonerSpellInfo', {summonerSpellId:summonerSpellId}, baseUrl['global']+'api/lol/static-data/na/v1.2/summoner-spell/'+summonerSpellId+'?spellData=image', skipCache);
        },
        getChampionInfo: function(championId) {
            var skipCache = false;
            return Meteor.call('getApiData', 'championInfo', {championId:championId}, baseUrl['global']+'api/lol/static-data/na/v1.2/champion/'+championId+'?champData=image', skipCache);
        },
        getSummonerInfo: function(summonerName, region) {
            var skipCache = true;
            return Meteor.call('getApiData', 'summonerInfo', {summonerName:summonerName, region:region}, baseUrl[region]+'api/lol/'+region+'/v1.4/summoner/by-name/'+summonerName+'?_foo=1', skipCache)[summonerName.toLowerCase().replace(/\s+/g, '')];
        },
        getMatchHistory: function(summonerId, region) {
            var skipCache = false;
            return Meteor.call('getApiData', 'matchHistory', {summonerId:summonerId, region:region}, baseUrl[region]+'api/lol/'+region+'/v2.2/matchhistory/'+summonerId+'?_foo=1', skipCache)['matches'];
        },
        getGames: function(summonerId, region) {
            var skipCache = false;
            return Meteor.call('getApiData', 'game', {summonerId:summonerId, region:region}, baseUrl[region]+'api/lol/'+region+'/v1.3/game/by-summoner/'+summonerId+'/recent?_foo=1', skipCache)['games'];
        },
        deriveData: function(currentVersion, data) {
            var championInfo = Meteor.call('getChampionInfo', data.championId)
            var champion = championInfo.name;
            var championImage = ddragon+currentVersion+'/img/champion/'+championInfo.image.full;
            var summonerSpells = _.map(data.summonerSpellIds, function(id) {
                var spell = Meteor.call('getSummonerSpellInfo', id);
                return {name:spell.name, image:ddragon+currentVersion+'/img/spell/'+spell.image.full};
            });
            var items = _.map(data.itemIds, function(id) {
                if (!id) return {name:'none', image:'empty.png'};
                var item = Meteor.call('getItemInfo', id);
                return {name:item.name, image:ddragon+currentVersion+'/img/item/'+item.image.full};
            });
            if (data.deaths) {
                var kda = ((data.kills+data.assists)/data.deaths).toFixed(1);
            } else {
                var kda = 'infinity';
            }
            return _.extend(data, {champion:champion, championImage:championImage, summonerSpells:summonerSpells, items:items, kda:kda});
        },
        getRecentMatches: function(summonerName, region) {
            var summonerInfo = Meteor.call('getSummonerInfo', summonerName, region);
            var games = Meteor.call('getGames', summonerInfo['id'], region);
            var currentVersion = Meteor.call('getCurrentVersion');
            return _.map(games, function(match) {
                var data = {
                    outcome: match.stats.win ? 'VICTORY' : 'DEFEAT',
                    championId: match.championId,
                    mode: match.subType,
                    matchCreation: match.createDate,
                    summonerSpellIds: [match.spell1, match.spell2],
                    itemIds: [match.stats.item0, match.stats.item1, match.stats.item2, match.stats.item3, match.stats.item4, match.stats.item5, match.stats.item6],
                    kills: match.stats.championsKilled,
                    deaths: match.stats.numDeaths,
                    assists: match.stats.assists,
                    cs: (match.stats.minionsKilled || 0) + (match.stats.neutralMinionsKilled || 0)
                };
                return Meteor.call('deriveData', currentVersion, data);
            });
        },
        getRankedMatches: function(summonerName, region) {
            var summonerInfo = Meteor.call('getSummonerInfo', summonerName, region);
            var matchHistory = Meteor.call('getMatchHistory', summonerInfo['id'], region);
            var currentVersion = Meteor.call('getCurrentVersion');
            return _.map(matchHistory.reverse(), function(match) {
                var data = {
                    outcome: match.participants[0].stats.winner ? 'VICTORY' : 'DEFEAT',
                    championId: match.participants[0].championId,
                    mode: match['queueType'],
                    matchCreation: match.matchCreation,
                    summonerSpellIds: [match.participants[0].spell1Id, match.participants[0].spell2Id],
                    itemIds: [match.participants[0].stats.item0, match.participants[0].stats.item1, match.participants[0].stats.item2, match.participants[0].stats.item3, match.participants[0].stats.item4, match.participants[0].stats.item5, match.participants[0].stats.item6],
                    kills: match.participants[0].stats.kills,
                    deaths: match.participants[0].stats.deaths,
                    assists: match.participants[0].stats.assists,
                    cs: (match.participants[0].stats.minionsKilled || 0) + (match.participants[0].stats.neutralMinionsKilled || 0)
                };
                return Meteor.call('deriveData', currentVersion, data);
            });
        }
    });
});
