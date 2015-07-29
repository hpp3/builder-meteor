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
    summonerInfoCache = new Mongo.Collection('summonerInfoCache');
    championInfoCache = new Mongo.Collection('championInfoCache');
    matchHistoryCache = new Mongo.Collection('matchHistoryCache');
    caches = {'summonerInfo':summonerInfoCache,
              'championInfo':championInfoCache,
              'matchHistory':matchHistoryCache}
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
        getChampionInfo: function(championId) {
            var skipCache = false;
            return Meteor.call('getApiData', 'championInfo', {championId:championId}, base_url['global']+'api/lol/static-data/na/v1.2/champion/'+championId+'?champData=image', skipCache);
        },
        getSummonerInfo: function(summonerName, region) {
            var skipCache = false;
            return Meteor.call('getApiData', 'summonerInfo', {summonerName:summonerName, region:region}, base_url[region]+'api/lol/'+region+'/v1.4/summoner/by-name/'+summonerName+'?_foo=1', skipCache)[summonerName];
        },
        getMatchHistory: function(summonerId, region) {
            var skipCache = false;
            return Meteor.call('getApiData', 'matchHistory', {summonerId:summonerId, region:region}, base_url[region]+'api/lol/'+region+'/v2.2/matchhistory/'+summonerId+'?_foo=1', skipCache)['matches'];
        },
        getMatchStats: function(summonerName, region) {
            //var summonerInfo = Meteor.apply('getSummonerInfo', [summonerName, region, false]);
            var summonerInfo = Meteor.call('getSummonerInfo', summonerName, region);
            //var matchHistory = Meteor.apply('getMatchHistory', [summonerInfo['id'], region, false]);
            var matchHistory = Meteor.call('getMatchHistory', summonerInfo['id'], region);
            var currentVersion = Meteor.call('getCurrentVersion');
            return _.map(matchHistory, function(match) {
                var outcome = match.participants[0].stats.winner ? 'WIN' : 'LOSE';
                var championInfo = Meteor.call('getChampionInfo', match.participants[0].championId)
                var champion = championInfo.name;
                var mode = match['queueType'];
                var championImage = 'http://ddragon.leagueoflegends.com/cdn/'+currentVersion+'/img/champion/'+championInfo.image.full;
                var matchCreation = match.matchCreation;
                return {champion:champion, mode:mode, outcome:outcome, championImage:championImage, matchCreation:matchCreation};
            });
        }
    });
});
