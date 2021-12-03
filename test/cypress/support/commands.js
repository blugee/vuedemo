// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })

Cypress.Commands.add("getUser", (userLevel, options) => {
  return cy.fixture('user.json').then(users => users[userLevel]);
});

Cypress.Commands.add("App_loginWithGui", (userLevel, options) => {
  cy.clearCookie('connect.sid');

  cy.getUser(userLevel).then((user) => {
    let roleBool = 'is';

    if (userLevel === 'admin') {
      roleBool += 'Admin';
    } else {
      roleBool += 'User';
    }

    cy.visit("http://" + Cypress.env('host') + ":" + Cypress.env('port') + "/app")
      .then(() => {
        cy.url().should('match', new RegExp("http://" + Cypress.env('host') + ":" + Cypress.env('port') + "/app"));

        cy.get('#login-modal-open-btn').should('exist').click();

        cy.server();

        cy.route({
          method: 'GET',
          url: "http://" + Cypress.env('host') + ":" + Cypress.env('port') + '/api/designs**'
        })
        .as('getDesigns');

        cy.route({
          method: 'POST',
          url: "http://" + Cypress.env('host') + ":" + Cypress.env('port') + '/api/auth/login'
        })
        .as('postLogin');

        cy.get('#email-login').should('exist').type(user.account);
        cy.get('#login-password').should('exist').type(user.password);
        cy.get('#login-modal-login-btn').should('exist').click();

        cy.wait('@postLogin').then(function (xhr) {
          expect(xhr.status)
            .to.eq(200);

          cy.wait('@getDesigns').then(function (xhr) {
            expect(xhr.status)
              .to.eq(200);

            cy.window()
              .its('mcb.store.state.currentUser.'+roleBool)
              .should('equal', true);

            cy.get('li.prevs-container > ul.prevs > li.prev').first().click();
          });
        });
      });
  });
});

Cypress.Commands.add("App_logoutWithGui", (options) => {
  cy.server();

  cy.route({
    method: 'POST',
    url: "http://" + Cypress.env('host') + ":" + Cypress.env('port') + '/api/auth/logout'
  })
  .as('postLogout');

  cy.get('[data-cypress=app-user-menu]')
    .click()
    .parent()
    .find('ul.dropdown-menu')
    .should('exist').and('be.visible');

  cy.get('[data-cypress=logout]').click();

  cy.wait('@postLogout').then(function (xhr) {
    expect(xhr.status)
      .to.eq(200);
  });
});


Cypress.Commands.add("logoutWithGui", (options) => {
  cy.get('[data-cypress=user-menu]')
    .click()
    .parent()
    .find('ul.dropdown-menu')
    .should('exist').and('be.visible');

  cy.get('[data-cypress=logout]').click();
  cy.url().should('eq', "http://" + Cypress.env('host') + ":" + Cypress.env('port') + "/");
});

Cypress.Commands.add("logoutWithUrl", (options) => {
  cy.visit("http://" + Cypress.env('host') + ":" + Cypress.env('port') + "/logout");
  cy.url().should('eq', "http://" + Cypress.env('host') + ":" + Cypress.env('port') + "/");
});


Cypress.Commands.add("loginWithGui", (userLevel, options) => {
  cy.clearCookie('connect.sid');

  cy.getUser(userLevel).then((user) => {
    cy.visit("http://" + Cypress.env('host') + ":" + Cypress.env('port') + "/login");
    cy.get('#email').should('exist').type(user.account);
    cy.get('#password').should('exist').type(user.password);
    cy.get('#login-btn').should('exist').click();
    cy.url().should('match', new RegExp("http://" + Cypress.env('host') + ":" + Cypress.env('port') + "/app"));
  })
});
