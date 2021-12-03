/* globals Cypress: true, cy: true, expect: true, window: true */

describe('Draw Modal', () => {

  before(() => {
    cy.loginWithGui('user');
  });

  beforeEach(() => {
    Cypress.Cookies.preserveOnce('connect.sid');
  });

  it('should have a Draw button', () => {
    cy.get('#left-nav-menu ul.nav-buttons li:not(.divider):not(.unimplemented) span')
      .contains('Draw')
      .parent('a')
      .parent('li')
      .should('exist')
      .and('be.visible');
  });

  it('should open the Draw shape modal when the is Draw button is clicked', () => {
    cy.get('#left-nav-menu ul.nav-buttons li:not(.divider):not(.unimplemented) span')
      .contains('Draw')
      .parent('a')
      .parent('li')
      .click();

    cy.get('#photo-draw-modal .modal-container')
      .should('exist')
      .and('be.visible');

    cy.get('#photo-draw-modal .modal-container')
      .within($draw => {
        cy.get('input#grid-size-input')
          .should('exist')
          .and('be.visible');

        cy.get('input.form-control[aria-label="depth"]')
          .should('exist')
          .and('be.visible');
      });
  });

  it('should initialize with the grid size value from global', () => {
    let mcb;

    cy.window()
      .then( w => mcb = w.mcb )
      .then( () => {
        cy.get('#photo-draw-modal .modal-container')
          .within($draw => {
            cy.get('input#grid-size-input')
              .should('have.value', mcb.store.state.gridStep);
          });
      });
  });

  it('should not change global value when changing its grid size value', () => {
    cy.get('#photo-draw-modal .modal-container')
      .within($draw => {
        cy.get('input#grid-size-input')
          .clear()
          .type('3.1415');

        cy.window()
          .its('mcb.store.state.gridStep')
          .should('not.equal', '3.1415');
      });
  });

  it('should persist the last value when re-opening the Draw shape modal', () => {
    cy.get('#photo-draw-modal .modal-container a.close-modal').click();
    cy.get('.bootbox.bootbox-confirm.modal .modal-footer button.btn').contains('Yes').click();

    cy.get('#photo-draw-modal .modal-container')
      .should('not.be.visible');

    cy.get('#left-nav-menu ul.nav-buttons li:not(.divider):not(.unimplemented) span')
      .contains('Draw')
      .parent('a')
      .parent('li')
      .click();

    cy.get('#photo-draw-modal .modal-container')
      .should('exist')
      .and('be.visible');

    cy.get('#photo-draw-modal .modal-container')
      .within($draw => {
        cy.get('input#grid-size-input')
          .should('have.value', '3.1415');

        cy.window()
          .its('mcb.store.state.gridStep')
          .should('not.equal', '3.1415');
      });
  });

});
