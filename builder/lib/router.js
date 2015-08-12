FlowRouter.route('/', {
    action: function(params) {
        BlazeLayout.render('index'); 
    }
});
FlowRouter.route('/:region/:summonerName', {
    action: function(params) {
        BlazeLayout.render('index', {summonerName:params.summonerName, region:params.region}); 
        Meteor.call('getRecentMatches', params.summonerName, params.region, function(err, response) {
            if (err) {
                $('#progress').html(err.reason);
                Session.set('matches', []);
            } else {
                $('#progress').html('');
                Session.set('matches', response);
            }
        });
    }
});
