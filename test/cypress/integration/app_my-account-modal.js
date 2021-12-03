/* globals Cypress: true, cy: true, expect: true, window: true */

describe('My Account Modal', () => {

  before(() => {
    cy.loginWithGui('user');
  });

  beforeEach(() => {
    Cypress.Cookies.preserveOnce('connect.sid');
  });

  it('should be accessible via a user menu option', () => {
    cy.get('.user-status li.dropdown:not(.unimplemented) a[data-toggle="dropdown"]').should('exist').click();
    cy.get('.user-status ul.dropdown-menu a[href="#my-account"]').should('exist').click();
  });

  it('should open the modal when use menu is clicked', () => {
    cy.get('#account-profile-modal').find('.modal-container').should('exist').and('be.visible');
  });

  it('has a close button', () => {
    cy.get('#account-profile-modal').find('.modal-container a.close-modal').should('exist');
  });

  it('should contain these fields', () => {
    cy.get('#account-profile-modal').find('.form-horizontal input#email').should('exist');
    cy.get('#account-profile-modal').find('.form-horizontal input#name').should('exist');
  });

  it('email field should require a valid email', () => {
    cy.get('#account-profile-modal').find('.form-horizontal input#email')
      .invoke('val')
      .then(original => {
        cy.get('#account-profile-modal').find('.form-horizontal input#email').clear().type('foo');
        cy.get('#account-profile-modal').find('.form-horizontal input#email').parents('.form-group').first().should('have.class', 'has-error');
        cy.get('#account-profile-modal').find('.form-horizontal input#email').clear().type(original);
        cy.get('#account-profile-modal').find('.form-horizontal input#email').parents('.form-group').first().should('not.have.class', 'has-error');
      });
  });

  it('has a save button', () => {
    cy.get('#account-profile-modal').find('.modal-footer button.btn').should('exist');
  });

  it('saves changes w/ out error', () => {
    cy.server();

    cy.route('POST', window.location.origin+'/api/users/profile').as('saveProfile');

    cy.get('#account-profile-modal').find('.form-horizontal input#email').clear().type('testerUser@test.local');
    cy.get('#account-profile-modal').find('.form-horizontal input#name').clear().type('Test Tester');
    cy.get('#account-profile-modal').find('.modal-footer button.btn').click();

    cy.wait('@saveProfile');

    cy.get('@saveProfile').then(function (xhr) {
      expect(xhr.status)
        .to.eq(200);

      expect(xhr.response.body)
        .to.be.an('object')
        .that.has.all.keys('email', 'name', 'gender', 'location', 'website', 'username');

      expect(xhr.response.body.email)
        .to.equal('testeruser@test.local');

      expect(xhr.response.body.name)
        .to.equal('Test Tester');
    });
  });

  it('can login w/ new email', () => {
    cy.server();
    cy.route('POST', window.location.origin+'/api/auth/login').as('postLogin');
    cy.route('GET', window.location.origin+'/api/designs**').as('getDesigns');
    cy.clearCookie('connect.sid');

    cy.getUser('user').then((user) => {
      cy.visit("http://" + Cypress.env('host') + ":" + Cypress.env('port') + "/app");
      cy.url().should('match', new RegExp("http://" + Cypress.env('host') + ":" + Cypress.env('port') + "/app"));

      cy.get('#login-modal-open-btn').should('exist').click();

      cy.get('#email-login').should('exist').type('testeruser@test.local');
      cy.get('#login-password').should('exist').type(user.password);

      cy.get('#login-modal-login-btn').should('exist').click();

      cy.wait('@postLogin');

      cy.get('@postLogin').then(function (xhr) {
        expect(xhr.status)
          .to.eq(200);

        cy.wait('@getDesigns');

        cy.get('@getDesigns').then(function (xhr) {
          expect(xhr.status)
            .to.eq(200);

          cy.window()
            .its('mcb.store.state.currentUser.isUser')
            .should('equal', true);

          cy.get('li.prevs-container > ul.prevs > li.prev').first().click();
        });
      });
    });
  });

  it('reset to original credentials', () => {
    cy.getUser('user').then((original) => {
      cy.server();

      cy.route('POST', window.location.origin+'/api/users/profile').as('saveProfile');

      cy.get('.user-status li.dropdown:not(.unimplemented) a[data-toggle="dropdown"]').should('exist').click();
      cy.get('.user-status ul.dropdown-menu a[href="#my-account"]').should('exist').click();

      cy.get('#account-profile-modal').find('.modal-container').should('exist').and('be.visible');

      cy.get('#account-profile-modal').find('.form-horizontal input#email').clear().type(original.account);
      cy.get('#account-profile-modal').find('.form-horizontal input#name').clear();
      cy.get('#account-profile-modal').find('.modal-footer button.btn').click();

      cy.wait('@saveProfile');

      cy.get('@saveProfile').then(function (xhr) {
        expect(xhr.status)
          .to.eq(200);

        expect(xhr.response.body)
          .to.be.an('object')
          .that.has.all.keys('email', 'name', 'gender', 'location', 'website', 'username');

        expect(xhr.response.body.email)
          .to.equal('testuser@test.local');

        expect(xhr.response.body.name)
          .to.equal('');

        cy.logoutWithUrl();
      });
    });
  });

  it('can login with original credentials', () => {
    cy.logoutWithUrl();
    cy.loginWithGui('user');
  });

});
