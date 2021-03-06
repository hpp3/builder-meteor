Meteor.startup(function () {
    // code to run on server at startup
    //
    // getApiKey is defined in server/apikey.js as:
    // Meteor.startup(function () {
    //     getApiKey = function() { 
    //         return '[redacted]';
    //     }
    // });
    var apiBaseUrl = {
        'br': 'https://br.api.pvp.net/', 
        'eune': 'https://eune.api.pvp.net/', 
        'euw': 'https://euw.api.pvp.net/', 
        'kr': 'https://kr.api.pvp.net/', 
        'lan': 'https://lan.api.pvp.net/', 
        'las': 'https://las.api.pvp.net/', 
        'na': 'https://na.api.pvp.net/', 
        'oce': 'https://oce.api.pvp.net/', 
        'tr': 'https://tr.api.pvp.net/', 
        'ru': 'https://ru.api.pvp.net/', 
        'global': 'https://global.api.pvp.net/'
    };

    var matchHistoryBaseUrl = {
        'na':'http://matchhistory.na.leagueoflegends.com/en/#match-details/NA1/',
        'euw':'http://matchhistory.euw.leagueoflegends.com/en/#match-details/EUW1/',
    };
    var ddragonBaseUrl = 'https://ddragon.leagueoflegends.com/cdn/';
    var caches = {  
        'summonerInfo':new Mongo.Collection('summonerInfoCache'),
        'summonerName':new Mongo.Collection('summonerNameCache'),
        'championInfo':new Mongo.Collection('championInfoCache'),
        'matchHistory':new Mongo.Collection('matchHistoryCache'),
        'game':new Mongo.Collection('gameCache'),
        'summonerSpellInfo':new Mongo.Collection('summonerSpellInfoCache'),
        'itemInfo':new Mongo.Collection('itemInfoCache'),
        'gameDB':new Mongo.Collection('gameDB'),
        'lastUpdate':new Mongo.Collection('lastUpdateDB'),
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
                if (caches.hasOwnProperty(key)) {
                    caches[key].remove({});
                };
            }
        },
        callApi: function(method, url) {
            try {
                return HTTP.call(method, url).data;
            } catch (err) {
                switch (err.response.statusCode) {
                    case 404:
                        throw new Meteor.Error(err.response.statusCode, "Resource not found"); 
                        break;
                    case 429:
                        console.log('429 Error:');
                        console.log(err.response);
                        console.log(err.response.headers);
                        throw new Meteor.Error(err.response.statusCode, "Rate limit exceeded"); 
                        break;
                    case 401:
                        throw new Meteor.Error(err.response.statusCode, "Unauthorized"); 
                        break;
                    case 500:
                    case 503:
                        throw new Meteor.Error(err.response.statusCode, "Riot API unavailable"); 
                        break;
                    default:
                        console.log(err.response);
                        throw new Meteor.Error(err.response.statusCode, "Unknown Error"); 
                }
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
                console.log('network',api);
                apiData = Meteor.call('callApi', 'GET', url+'&api_key='+getApiKey());
                cache.upsert(args, _.extend(args, {_data:apiData}));
            }
            return apiData;
        },
        getCurrentVersion: function() {
            return Meteor.call('callApi', 'GET', 'https://global.api.pvp.net/api/lol/static-data/na/v1.2/versions?api_key='+getApiKey())[0];
        },
        getItemInfo: function(itemId) {
            var skipCache = false;
            if (itemId in bootsMap) {
                itemId = bootsMap[itemId]
            }
            try {
                var item = Meteor.call('getApiData', 'itemInfo', {itemId:itemId}, apiBaseUrl['global']+'api/lol/static-data/na/v1.2/item/'+itemId+'?itemData=image', skipCache);
            } catch (err) {
                switch (err.error) {
                    case 404:
                        return {name:itemId, image:'/'};
                        break;
                    default:
                        throw err;
                }
            }
            return item;
        },
        getSummonerSpellInfo: function(summonerSpellId) {
            var skipCache = false;
            return Meteor.call('getApiData', 'summonerSpellInfo', {summonerSpellId:summonerSpellId}, apiBaseUrl['global']+'api/lol/static-data/na/v1.2/summoner-spell/'+summonerSpellId+'?spellData=image', skipCache);
        },
        getChampionInfo: function(championId) {
            var skipCache = false;
            return Meteor.call('getApiData', 'championInfo', {championId:championId}, apiBaseUrl['global']+'api/lol/static-data/na/v1.2/champion/'+championId+'?champData=image', skipCache);
        },
        getSummonerInfo: function(summonerName, region) {
            var skipCache = false;
            summonerName = summonerName.toLowerCase().replace(/\s+/g, '');
            return Meteor.call('getApiData', 'summonerInfo', {summonerName:summonerName, region:region}, apiBaseUrl[region]+'api/lol/'+region+'/v1.4/summoner/by-name/'+summonerName+'?_foo=1', skipCache)[summonerName];
        },
        getSummonerNames: function(summonerIds, region) {
            var cache = caches['summonerName'];
            var lookup = [];
            var nameMap = {};
            _.each(summonerIds, function(id){
                var result = cache.findOne({summonerId:id, region:region});
                if (result) {
                    nameMap[result._data.id] = result._data.name;
                } else {
                    lookup.push(id); 
                } 
            });
            if (lookup.length) {
                var ids = lookup.join();
                var result = Meteor.call('callApi', 'GET', apiBaseUrl[region]+'api/lol/'+region+'/v1.4/summoner/'+ids+'?api_key='+getApiKey());
                for (var key in result) {
                    if (result.hasOwnProperty(key)) {
                        nameMap[result[key].id] = result[key].name;
                        cache.upsert({summonerId:result[key].id, region:region}, {$set: {_data: result[key]}});
                    } 
                }
            }
            return nameMap;
        },
        getMatchHistory: function(summonerId, region) {
            var skipCache = false;
            return Meteor.call('getApiData', 'matchHistory', {summonerId:summonerId, region:region}, apiBaseUrl[region]+'api/lol/'+region+'/v2.2/matchhistory/'+summonerId+'?_foo=1', skipCache)['matches'];
        },
        setLastUpdate: function(summonerId, region, gameId) {
            var db = caches['lastUpdate'];
            var timestamp = Date.now(); 
            console.log('last updated', timestamp);
            console.log(db.upsert({summonerId:summonerId, region:region}, {$set:{timestamp:timestamp, gameId:gameId}}));
        },
        getLastUpdate: function(summonerId, region) {
            var db = caches['lastUpdate'];
            var lastUpdate = db.findOne({summonerId:summonerId, region:region});
            if (!lastUpdate) return {timestamp:0, gameId:0};
            return lastUpdate;
        },
        updateGames: function(summonerId, region) {
            var start = new Date();
            var skipCache = false;
            var gameDB = caches['gameDB'];
            var lastUpdate = Meteor.call('getLastUpdate', summonerId, region);
            var staleDuration = 10*60*1000;
            //var staleDuration = 24*60*60*1000;
            var timeSinceUpdate = Date.now() - lastUpdate.timestamp;
            if (skipCache || timeSinceUpdate > staleDuration) {
                console.log('fetching games from api for',summonerId,region);
                try {
                    var recentGames = Meteor.call('callApi', 'GET', apiBaseUrl[region]+'api/lol/'+region+'/v1.3/game/by-summoner/'+summonerId+'/recent?_foo=1&api_key='+getApiKey()).games;
                } catch (err) {
                    switch (err.error) {
                        case 404:
                            throw new Meteor.Error(err.error, "No games found"); 
                            break; 
                        default:
                            throw err;
                    } 
                }
                console.log('lastUpdate:',lastUpdate.gameId, lastUpdate.timestamp);
                _.each(recentGames.reverse(), function(game) {
                    console.log(game.gameId, game.createDate);
                    var start = new Date();
                    if (!gameDB.findOne({region:region, gameId:game.gameId, summonerId:summonerId})) {
                        console.log('add new game');
                        gameDB.insert({summonerId:summonerId, region:region, gameId:game.gameId, game:game, time_inserted:Date.now()});
                    }  
                    var end = new Date();
                    console.log('took',(end-start),'millis');
                });
                if (recentGames) {
                    var lastGameId = recentGames[recentGames.length-1].gameId;
                } else {
                    var lastGameId = lastUpdate.gameId;
                }
                Meteor.call('setLastUpdate', summonerId, region, lastGameId);
            } else {
                console.log('no need to update, because last update was', timeSinceUpdate, 'milliseconds ago');
            }
            console.log('update games took', new Date() - start);
        },
        getGames2: function(summonerId, region) {
            Meteor.call('updateGames', summonerId, region);
            var db = caches['gameDB'];
            var start = new Date();
            var games = db.find({summonerId: summonerId, region: region}, {sort: {time_inserted:-1}, limit:20}).fetch();
            var end = new Date();
            console.log('fetch took',(end-start),'millis');
            return _.map(games, function(game) {
                return game.game;
            });
        },
        getGames: function(summonerId, region) {
            var skipCache = false;
            return Meteor.call('getApiData', 'game', {summonerId:summonerId, region:region}, apiBaseUrl[region]+'api/lol/'+region+'/v1.3/game/by-summoner/'+summonerId+'/recent?_foo=1', skipCache)['games'];
        },
        deriveData: function(currentVersion, data) {
            var start = new Date();
            var championInfo = Meteor.call('getChampionInfo', data.championId);
            var summonerSpells = _.map(data.summonerSpellIds, function(id) {
                var spell = Meteor.call('getSummonerSpellInfo', id);
                return {name:spell.name, image:ddragonBaseUrl+currentVersion+'/img/spell/'+spell.image.full};
            });
            var items = _.map(data.itemIds, function(id) {
                if (!id) return {name:'none', image:'/empty_64.png'};
                if (id == 3350) return {
                    name: 'Greater Totem',
                    image: '/3350_64.png'
                }
                var item = Meteor.call('getItemInfo', id);
                return {name:item.name, image:ddragonBaseUrl+currentVersion+'/img/item/'+item.image.full};
            });
            if (data.deaths) {
                var kda = ((data.kills+data.assists)/data.deaths).toFixed(1);
            } else {
                var kda = 'perfect';
            }
            var summonerIds = _.map(data._teams[0].players.concat(data._teams[1].players), function(player) {
                return player.summonerId; 
            });
            var nameMap = Meteor.call('getSummonerNames', summonerIds, data.region);
            var teams = _.map(data._teams, function(team){
                return {
                    main:team.main,
                    players:_.map(team.players, function(player) {
                        var championImage = Meteor.call('getChampionInfo', player.championId).image.full;
                        return {
                            championImage:ddragonBaseUrl+currentVersion+'/img/champion/'+championImage,
                            name:nameMap[player.summonerId],
                            summonerId:player.summonerId,
                            region:data.region
                        }
                    })
                };
            });
            var derived = {
                champion:championInfo.name,
                championImage:ddragonBaseUrl+currentVersion+'/img/champion/'+championInfo.image.full,
                summonerSpells:summonerSpells,
                items0_3:items.slice(0,3),
                items3_6:items.slice(3,6),
                trinket:items[6],
                kda:kda,
                teams:teams,
                matchHistoryUrl:matchHistoryBaseUrl[data.region] + data.gameId + '/0',
                minutes: Math.floor(data.gameDuration / 60),
                seconds: data.gameDuration % 60 > 9 ? data.gameDuration % 60 : '0'+data.gameDuration % 60
            };
            return _.extend(data, derived);
        },
        getRecentMatches: function(summonerName, region) {
            console.log(summonerName, region);
            var start = new Date();
            try {
                var summonerInfo = Meteor.call('getSummonerInfo', summonerName, region);
            } catch (err) {
                switch (err.error) {
                    case 404:
                        throw new Meteor.Error(err.error, "Summoner not found"); 
                        break;
                    default:
                        throw err;
                }
            }
            var games = Meteor.call('getGames2', summonerInfo.id, region);
            var dd = new Date();
            var currentVersion = Meteor.call('getCurrentVersion');
            console.log('version took', new Date() - dd, 'millis');
            var res = _.map(games, function(match) {
                var teams = {
                    100: {players:[], main:false},
                    200: {players:[], main:false}
                };
                teams[match.stats.team].players.push({summonerId: summonerInfo.id, championId: match.championId});
                teams[match.stats.team].main = true;
                _.each(match.fellowPlayers, function (player) {
                    teams[player.teamId].players.push({championId:player.championId, summonerId:player.summonerId});
                });
                var data = {
                    win: match.stats.win,
                    region:region,
                    championId: match.championId,
                    mode: match.subType,
                    matchCreation: match.createDate,
                    summonerSpellIds: [match.spell1, match.spell2],
                    _teams: [teams[100], teams[200]],
                    itemIds: [match.stats.item0, match.stats.item1, match.stats.item2, match.stats.item3, match.stats.item4, match.stats.item5, match.stats.item6],
                    kills: match.stats.championsKilled || 0,
                    deaths: match.stats.numDeaths || 0,
                    assists: match.stats.assists || 0,
                    gameId: match.gameId,
                    wards: match.stats.wardPlaced || 0,
                    gold: match.stats.goldEarned || 0, 
                    level: match.stats.level,
                    gameDuration: match.stats.timePlayed,
                    cs: (match.stats.minionsKilled || 0) + (match.stats.neutralMinionsKilled || 0)
                };
                return Meteor.call('deriveData', currentVersion, data);
            });
            var end = new Date();
            console.log('total took',(end-start),'millis');
            return res;
        },
        getRankedMatches: function(summonerName, region) {
            //deprecated and not maintained
            var summonerInfo = Meteor.call('getSummonerInfo', summonerName, region);
            var matchHistory = Meteor.call('getMatchHistory', summonerInfo['id'], region);
            var currentVersion = Meteor.call('getCurrentVersion');
            return _.map(matchHistory.reverse(), function(match) {
                var data = {
                    win: match.participants[0].stats.winner ? 'VICTORY' : 'DEFEAT',
                    region:region,
                    championId: match.participants[0].championId,
                    mode: match['queueType'],
                    matchCreation: match.matchCreation,
                    summonerSpellIds: [match.participants[0].spell1Id, match.participants[0].spell2Id],
                    itemIds: [match.participants[0].stats.item0, match.participants[0].stats.item1, match.participants[0].stats.item2, match.participants[0].stats.item3, match.participants[0].stats.item4, match.participants[0].stats.item5, match.participants[0].stats.item6],
                    kills: match.participants[0].stats.kills,
                    deaths: match.participants[0].stats.deaths,
                    assists: match.participants[0].stats.assists,
                    gameId: match.matchId,
                    cs: (match.participants[0].stats.minionsKilled || 0) + (match.participants[0].stats.neutralMinionsKilled || 0)
                };
                return Meteor.call('deriveData', currentVersion, data);
            });
        }
    });
});
