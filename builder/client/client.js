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
    }
});

Template.passData.events({
    'click #recent-btn': function() {
        Meteor.call('getRecentMatches', $('input[type=text]').val(), 'na', function(err, response) {
            Session.set('matches', response);
            console.log(response);
        });
    },
    'click #ranked-btn': function() {
        Meteor.call('getRankedMatches', $('input[type=text]').val(), 'na', function(err, response) {
            Session.set('matches', response);
        });
    }
});

