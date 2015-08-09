// counter starts at 0
Session.setDefault('counter', 0);

Template.hello.helpers({
    counter: function () {
        return Session.get('counter');
    }
});

Template.hello.events({
    'click button': function () {
        Meteor.call('getKappa', function(err, response) {
        Session.set('counter', response)});
    }
});

Template.passData.helpers({
    matches: function () {
        return Session.get('matches');
    },
    regions: function() {
        //br, eune, euw, kr, lan, las, na, oce, ru, tr
        //kr doesn't support lol-status 
        return [
            {code: 'br', default:false},
            {code: 'eune', default:false},
            {code: 'euw', default:false},
            {code: 'kr', default:false},
            {code: 'lan', default:false},
            {code: 'las', default:false},
            {code: 'na', default:true},
            {code: 'oce', default:false},
            {code: 'ru', default:false},
            {code: 'tr', default:false}
        ];
    }
});

function loadRecentMatches() {
    $('#progress').html('pls wait');
    Meteor.call('getRecentMatches', $('#summoner-name').val(), $('#region-select').val(), function(err, response) {
        if (err) {
            $('#progress').html(err.reason);
            Session.set('matches', []);
        } else {
            Session.set('matches', response);
            $('#progress').html('k done');
        }
    });
}

Template.passData.events({
    'keyup #summoner-name': function(e) {
        if (e.keyCode == 13) {
            loadRecentMatches();
            e.preventDefault();
            return false;
        }
    },
    'click #recent-btn': function() {
        loadRecentMatches();
    },
    'click #ranked-btn': function() {
        $('#progress').html('pls wait');
        Meteor.call('getRankedMatches', $('input[type=text]').val(), 'na', function(err, response) {
            Session.set('matches', response);
            $('#progress').html('k done');
        });
    }
});

