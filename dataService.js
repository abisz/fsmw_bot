'use strict';

const data = require('./data.json');

module.exports = {
    
    getPhones: function(context, cb){

        console.log('dataService - getPhones - context:');
        console.log(context);

        var result = [];

        for (let property in context) {
            if (context.hasOwnProperty(property)) {
                
                var filtered = data.filter(function(smartphone){

                    return smartphone[property].trim() == context[property].trim();
                });

                
                result = result.concat(filtered);
            }
        }


        console.log('result from getPhones:');
        console.log(result);
        
        
        cb(null, result);
    }
    
};