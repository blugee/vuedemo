var request = require('supertest');
var app = require('../app.js');

var creds = require('./cypress/fixtures/user.json');

describe('api users:', function() {
	const agent = request.agent(app);

	describe('POST /api/users/profile', function() {
	  it('should 302 redirect when were not logged in', function(done) {
		agent
		  .post('/api/users/profile')
		  .expect('Location', '/login')
		  .expect(302, done);
	  });

	  it('should return json when were not logged in and request is xhr', function(done) {
		  agent
			.post('/api/users/profile')
			.set('X-Requested-With', 'XMLHttpRequest')
			.set('Accept', 'application/json')
			.expect('Content-Type', 'application/json; charset=utf-8')
			.expect(403, {
					error: 'not logged in'
				},
				done
			);
	  });

	  it('should be able to log in', function(done) {
		  agent
			.post('/api/auth/login')
			.set('X-Requested-With', 'XMLHttpRequest')
			.set('Accept', 'application/json')
			.send({email: creds.user.account, password: creds.user.password})
			.expect('Content-Type', 'application/json; charset=utf-8')
			.expect(200, done);
	  });

	  it('should succeed when logged in', function(done) {
			agent
				.post('/api/users/profile')
				.set('X-Requested-With', 'XMLHttpRequest')
				.set('Accept', 'application/json')
				.expect('Content-Type', 'application/json; charset=utf-8')
				.expect(200, /"email":.*"name"\:.*"gender"\:.*"location"\:.*"website"\:.*"username"\:.*/, done);
		});
	});

});
