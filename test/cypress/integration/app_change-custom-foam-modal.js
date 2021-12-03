/* globals Cypress: true, cy: true, expect: true, window: true */

describe('Change Custom Foam Modal', () => {

  before(() => {
    cy.loginWithGui('user');
  });

  beforeEach(() => {
    Cypress.Cookies.preserveOnce('connect.sid');
  });

  it('should open the change case modal on click case edit', () => {
    cy.server()

    cy.route({
      method: 'GET',
      url: "http://" + Cypress.env('host') + ":" + Cypress.env('port') + '/cases/search**'
    })
    .as('getCases');

    cy.get('[data-cypress=case-edit]')
      .click();

    cy.wait('@getCases').then(function (xhr) {
      expect(xhr.status)
        .to.eq(200);

      cy.get('#change-case-modal .modal-container')
        .should('exist').and('be.visible');
    });
  });

  it('should switch to custom size foam options when custom size foam is checked', () => {
    cy.get('#change-case-modal .modal-container')
      .within($modal => {
        cy.get('input[type=search]')
          .should('exist').and('be.visible');

        cy.get('.change-cases table')
          .contains('PZ 4')
          .should('exist')
          .scrollIntoView()
          .and('be.visible');

        cy.get('[data-cypress=custom-size-foam-option] input[type=checkbox]')
          .should('exist').and('be.visible')
          .check();

        cy.get('input[type=search]')
          .should('not.be.visible');

        cy.get('.change-cases table tbody td')
          .should('not.be.visible');

        cy.get('[data-cypress=custom-size-foam-settings-upper]')
          .should('exist').and('be.visible');

        cy.get('[data-cypress=custom-size-foam-settings-lower]')
          .should('exist').and('be.visible');

        cy.get('[data-cypress=use-custom-size-foam-action]')
          .should('exist').and('be.visible');
      });
  });

  it('should not contain the same upper dimensions as lower dimensions', () => {
    cy.get('#change-case-modal .modal-container')
      .within($modal => {
        cy.get('[data-cypress=custom-size-foam-settings-upper] input#upperLength').invoke('val')
          .then(upperLength => {
            cy.get('[data-cypress=custom-size-foam-settings-lower] input#lowerLength').should('not.have.value', upperLength);
          });

        cy.get('[data-cypress=custom-size-foam-settings-upper] input#upperWidth').invoke('val')
          .then(upperWidth => {
            cy.get('[data-cypress=custom-size-foam-settings-lower] input#lowerWidth').should('not.have.value', upperWidth);
          });
      });
  });
});
