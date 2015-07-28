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
    result: function () {
        return Session.get('result');
    }
});

Template.passData.events({
    'click input[type=button]': function() {
        Meteor.call('getNamedKappa', $('input[type=text]').val(), function(err, response) {
            Session.set('result', response);
            console.log(response);
        });
    }
});

