var mongoose = require('mongoose');
var dotenv = require('dotenv');
var User = require('./models/User');
var Case = require('./models/Case');

dotenv.load({ path: '.env' });

mongoose.connect(process.env.MONGODB || process.env.MONGOLAB_URI);

var user = new User({
  email: 'jschatz1@gmail.com',
  password: 'byzantineempire123',
  role: {
    name: 'admin'
  }
});

user.save(function(){
  user = new User({
    email: 'steve@mycasebuilder.com',
    password: 'hatpants',
    role: {
      name: 'user'
    }
  }); 

  user.save(function(){
    process.exit()
  });
});