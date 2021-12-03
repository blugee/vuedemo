/* globals Cypress: true, cy: true, expect: true, window: true */

describe('Add Basic Shapes', () => {

  before(() => {
    cy.loginWithGui('user');
  });

  beforeEach(() => {
    Cypress.Cookies.preserveOnce('connect.sid');
  });

  it('should have an add Rect button', () => {
    cy.get('#left-nav-menu ul.nav-buttons li:not(.divider):not(.unimplemented)').eq(2).should('exist');
  });

  it('should have an add Circle button', () => {
    cy.get('#left-nav-menu ul.nav-buttons li:not(.divider):not(.unimplemented)').eq(3).should('exist');
  });

  it('should open the add circle panel when clicked', () => {
    cy.get('#left-nav-menu ul.nav-buttons li:not(.divider):not(.unimplemented)').eq(3).click();
    cy.get('#sub-nav-menu.active #circle-nav').should('exist').and('be.visible');
  });

  it('should not add a shape equal to the foam depth without warning', () => {
    cy.visit("http://" + Cypress.env('host') + ":" + Cypress.env('port') + "/app?case=skb-3i-1309-6&l=en");

    cy.get('#left-nav-menu ul.nav-buttons li:not(.divider):not(.unimplemented)').eq(3).click();
    cy.get('#sub-nav-menu.active #circle-nav').should('exist').and('be.visible');

    cy.get('#sub-nav-menu.active #circle-nav :input#circle-diameter-input').clear().type('3');
    cy.get('#sub-nav-menu.active #circle-nav :input#circle-depth-input').clear().type('5');
    cy.get('#sub-nav-menu.active #circle-nav select#fingerNotchCircle').select('left');
    cy.get('#sub-nav-menu.active #circle-nav li a.btn.btn-primary').click();

    // the depth warning error modal exists
    cy.get('.bootbox.modal.error.depth-option .modal-content').should('exist').and('be.visible');
    cy.get('#sub-nav-menu.active #circle-nav :input#circle-depth-input').parent().should('have.class', 'has-error');
  });

  it('should add a shape equal to the foam depth when the case is custom', () => {
    cy.visit("http://" + Cypress.env('host') + ":" + Cypress.env('port') + "/app?store=149&case=undefined&switch-custom&unit=in&l=en");
    cy.get('#change-case-modal .modal-body').should('exist').and('be.visible');
    cy.get('#change-case-modal .modal-body :input[data-prop="depth"]').clear().type('5');
    cy.get('#change-case-modal .modal-body :input.btn[type="submit"]').click();

    cy.get('#left-nav-menu ul.nav-buttons li:not(.divider):not(.unimplemented)').eq(3).click();
    cy.get('#sub-nav-menu.active #circle-nav').should('exist').and('be.visible');

    cy.get('#sub-nav-menu.active #circle-nav :input#circle-diameter-input').clear().type('3');
    cy.get('#sub-nav-menu.active #circle-nav :input#circle-depth-input').clear().type('5');
    cy.get('#sub-nav-menu.active #circle-nav select#fingerNotchCircle').select('left');
    cy.get('#sub-nav-menu.active #circle-nav li a.btn.btn-primary').click();

    // the depth warning error modal exists
    cy.get('.bootbox.modal.error.depth-option .modal-content').should('exist').and('be.visible');
    cy.get('#sub-nav-menu.active #circle-nav :input#circle-depth-input').parent().should('have.class', 'has-error');
    cy.wait(500);

    cy.get('.bootbox.modal.error.depth-option .modal-content').find('.modal-footer button.btn[data-bb-handler="cutThrough"]').click();
    cy.get('#sub-nav-menu.active #circle-nav').should('not.exist').and('not.be.visible');
  });
});
