'use strict';

const data = require('./data.json');

module.exports = {
    
    getPhones: function(context, cb){

        var result = [];

        data.forEach(function(smartphone){

            var match = true;

            for (let property in context) {
                
                if(typeof smartphone[property] == 'string' && smartphone[property].trim() != context[property].trim()){
                    match = false;
                }else if(typeof smartphone[property] == 'number' && smartphone[property] > context[property]){
                    match = false;
                }
            }

            if(match){
                result.push(smartphone);
            }

        });
        
        console.log('result from getPhones:');
        console.log(result);

        result = result.slice(0, 10);

        cb(null, result);
    },


    
};