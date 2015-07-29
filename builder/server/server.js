Meteor.startup(function () {
    // code to run on server at startup
    //
    // getApiKey is defined in server/apikey.js as:
    // Meteor.startup(function () {
    //     getApiKey = function() { 
    //         return '[redacted]';
    //     }
    // });
    base_url = {'na': 'https://na.api.pvp.net/', 'global': 'https://global.api.pvp.net/'};
    caches = {  
        'summonerInfo':new Mongo.Collection('summonerInfoCache'),
        'championInfo':new Mongo.Collection('championInfoCache'),
        'matchHistory':new Mongo.Collection('matchHistoryCache'),
        'game':new Mongo.Collection('gameCache'),
        'summonerSpellInfo':new Mongo.Collection('summonerSpellInfoCache'),
        'itemInfo':new Mongo.Collection('itemInfoCache'),
        'dummy':new Mongo.Collection('dummyCache')
    };
    Meteor.methods({
        getKappa: function(){
           summonerInfoCache.remove({});
           matchHistoryCache.remove({});
        },
        getNamedKappa: function(name) {
            return "Kappa = "+name+" (no space)";
        },
        getApiData: function(api, args, url, skipCache) {
            console.log('want to use', url);
            var apiData;
            var cache = caches[api];
            var cached = skipCache ? false : cache.findOne(args);
            if (cached) {
                console.log('cache has match');
                apiData = cached['_data'];
            }
            else {
                console.log('calling API');
                apiData = HTTP.call('GET', url+'&api_key='+getApiKey()).data;
                console.log(cache.upsert(args, _.extend(args, {_data:apiData})));
            }
            return apiData;
        },
        getCurrentVersion: function() {
            return HTTP.call('GET', 'https://global.api.pvp.net/api/lol/static-data/na/v1.2/versions?api_key='+getApiKey()).data[0]; 
        },
        getItemInfo: function(itemId) {
            var skipCache = false;
            return Meteor.call('getApiData', 'itemInfo', {itemId:itemId}, base_url['global']+'api/lol/static-data/na/v1.2/item/'+itemId+'?itemData=image', skipCache);
        },
        getSummonerSpellInfo: function(summonerSpellId) {
            var skipCache = false;
            return Meteor.call('getApiData', 'summonerSpellInfo', {summonerSpellId:summonerSpellId}, base_url['global']+'api/lol/static-data/na/v1.2/summoner-spell/'+summonerSpellId+'?spellData=image', skipCache);
        },
        getChampionInfo: function(championId) {
            var skipCache = false;
            return Meteor.call('getApiData', 'championInfo', {championId:championId}, base_url['global']+'api/lol/static-data/na/v1.2/champion/'+championId+'?champData=image', skipCache);
        },
        getSummonerInfo: function(summonerName, region) {
            var skipCache = true;
            return Meteor.call('getApiData', 'summonerInfo', {summonerName:summonerName, region:region}, base_url[region]+'api/lol/'+region+'/v1.4/summoner/by-name/'+summonerName+'?_foo=1', skipCache)[summonerName.toLowerCase().replace(/\s+/g, '')];
        },
        getMatchHistory: function(summonerId, region) {
            var skipCache = false;
            return Meteor.call('getApiData', 'matchHistory', {summonerId:summonerId, region:region}, base_url[region]+'api/lol/'+region+'/v2.2/matchhistory/'+summonerId+'?_foo=1', skipCache)['matches'];
        },
        getGames: function(summonerId, region) {
            var skipCache = false;
            return Meteor.call('getApiData', 'game', {summonerId:summonerId, region:region}, base_url[region]+'api/lol/'+region+'/v1.3/game/by-summoner/'+summonerId+'/recent?_foo=1', skipCache)['games'];
        },
        getRecentMatches: function(summonerName, region) {
            var summonerInfo = Meteor.call('getSummonerInfo', summonerName, region);
            var games = Meteor.call('getGames', summonerInfo['id'], region);
            var currentVersion = Meteor.call('getCurrentVersion');
            return _.map(games, function(match) {
                var outcome = match.stats.win ? 'WIN' : 'LOSE';
                var championInfo = Meteor.call('getChampionInfo', match.championId)
                var champion = championInfo.name;
                var mode = match.subType;
                var championImage = 'https://ddragon.leagueoflegends.com/cdn/'+currentVersion+'/img/champion/'+championInfo.image.full;
                var matchCreation = match.createDate;
                var summonerSpellIds = [match.spell1, match.spell2];
                var summonerSpells = _.map(summonerSpellIds, function(id) {
                    var spell = Meteor.call('getSummonerSpellInfo', id);
                    return {name:spell.name, image:'https://ddragon.leagueoflegends.com/cdn/'+currentVersion+'/img/spell/'+spell.image.full};
                });
                var itemIds = [match.stats.item0, match.stats.item1, match.stats.item2, match.stats.item3, match.stats.item4, match.stats.item5, match.stats.item6];
                var items = _.map(itemIds, function(id) {
                    if (!id) return {name:'none', image:'empty.png'};
                    var item = Meteor.call('getItemInfo', id);
                    return {name:item.name, image:'https://ddragon.leagueoflegends.com/cdn/'+currentVersion+'/img/item/'+item.image.full};
                });
                return {champion:champion, mode:mode, outcome:outcome, championImage:championImage, matchCreation:matchCreation, summonerSpells:summonerSpells, items:items};
            });
        },
        getRankedMatches: function(summonerName, region) {
            var summonerInfo = Meteor.call('getSummonerInfo', summonerName, region);
            var matchHistory = Meteor.call('getMatchHistory', summonerInfo['id'], region);
            var currentVersion = Meteor.call('getCurrentVersion');
            return _.map(matchHistory.reverse(), function(match) {
                var outcome = match.participants[0].stats.winner ? 'WIN' : 'LOSE';
                var championInfo = Meteor.call('getChampionInfo', match.participants[0].championId)
                var champion = championInfo.name;
                var mode = match['queueType'];
                var championImage = 'https://ddragon.leagueoflegends.com/cdn/'+currentVersion+'/img/champion/'+championInfo.image.full;
                var matchCreation = match.matchCreation;
                return {champion:champion, mode:mode, outcome:outcome, championImage:championImage, matchCreation:matchCreation};
            });
        }
    });
});
