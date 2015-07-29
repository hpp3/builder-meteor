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
        deriveData: function(currentVersion, data) {
            var championInfo = Meteor.call('getChampionInfo', data.championId)
            var champion = championInfo.name;
            var championImage = 'https://ddragon.leagueoflegends.com/cdn/'+currentVersion+'/img/champion/'+championInfo.image.full;
            var summonerSpells = _.map(data.summonerSpellIds, function(id) {
                var spell = Meteor.call('getSummonerSpellInfo', id);
                return {name:spell.name, image:'https://ddragon.leagueoflegends.com/cdn/'+currentVersion+'/img/spell/'+spell.image.full};
            });
            var items = _.map(data.itemIds, function(id) {
                if (!id) return {name:'none', image:'empty.png'};
                var item = Meteor.call('getItemInfo', id);
                return {name:item.name, image:'https://ddragon.leagueoflegends.com/cdn/'+currentVersion+'/img/item/'+item.image.full};
            });
            return _.extend(data, {champion:champion, championImage:championImage, summonerSpells:summonerSpells, items:items});
        },
        getRecentMatches: function(summonerName, region) {
            var summonerInfo = Meteor.call('getSummonerInfo', summonerName, region);
            var games = Meteor.call('getGames', summonerInfo['id'], region);
            var currentVersion = Meteor.call('getCurrentVersion');
            return _.map(games, function(match) {
                var outcome = match.stats.win ? 'WIN' : 'LOSE';
                var championId = match.championId;
                var mode = match.subType;
                var matchCreation = match.createDate;
                var summonerSpellIds = [match.spell1, match.spell2];
                var itemIds = [match.stats.item0, match.stats.item1, match.stats.item2, match.stats.item3, match.stats.item4, match.stats.item5, match.stats.item6];
                var data = {outcome:outcome, championId:championId, mode:mode, matchCreation:matchCreation, summonerSpellIds:summonerSpellIds, itemIds:itemIds};
                return Meteor.call('deriveData', currentVersion, data);
            });
        },
        getRankedMatches: function(summonerName, region) {
            var summonerInfo = Meteor.call('getSummonerInfo', summonerName, region);
            var matchHistory = Meteor.call('getMatchHistory', summonerInfo['id'], region);
            var currentVersion = Meteor.call('getCurrentVersion');
            return _.map(matchHistory.reverse(), function(match) {
                var outcome = match.participants[0].stats.winner ? 'WIN' : 'LOSE';
                var championId = match.participants[0].championId;
                var mode = match['queueType'];
                var matchCreation = match.matchCreation;
                var summonerSpellIds = [match.participants[0].spell1Id, match.participants[0].spell2Id];
                var itemIds = [match.participants[0].stats.item0, match.participants[0].stats.item1, match.participants[0].stats.item2, match.participants[0].stats.item3, match.participants[0].stats.item4, match.participants[0].stats.item5, match.participants[0].stats.item6];
                var data = {outcome:outcome, championId:championId, mode:mode, matchCreation:matchCreation, summonerSpellIds:summonerSpellIds, itemIds:itemIds};
                return Meteor.call('deriveData', currentVersion, data);
            });
        }
    });
});
