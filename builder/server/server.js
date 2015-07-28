Meteor.startup(function () {
    // code to run on server at startup
    //
    
    Meteor.methods({
        getKappa: function(){
            return "Kappa";
        },
        getNamedKappa: function(name) {
            return "Kappa = "+name+" (no space)";
            console.log(getApiKey());
            console.log('?');
        },
        lookupSummoner: function(username, region) {
            
        }
    });
});
