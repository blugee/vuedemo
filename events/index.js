'use strict';

module.exports = function(bayeux) {
  bayeux.on('handshake', function() {
    console.log('handshake');
  });


  bayeux.on('publish', function(clientID, channel, data) {
    console.log('publish', clientID, channel, data);
  });

}
