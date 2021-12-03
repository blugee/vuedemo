/* globals Cypress: true, cy: true, expect: true, window: true */

describe('Public Design Status Modal', () => {

  before(() => {
    cy.App_loginWithGui('admin');
  })


  it('should not have a public design email button yet', () => {
    cy.get('#public-design-status-btn').should('not.exist');
  });

  it('should expose an access button when the design is a Public Design Candidate', () => {
    cy.window()
      .then(w => {
        w.mcb.store.state.currentDesign.currentRev.publicDesign.isCandidate = true;
        cy.get('#public-design-status-btn').should('exist').click();
      });
  });

  it('It has a schedule switch', () => {
    cy.get('#public-design-email-modal').find('#scheduled-switch').should('exist');
  });

  it('It has a sent switch', () => {
    cy.get('#public-design-email-modal').find('#sent-switch').should('exist');
  });

  it('It has a datepicker', () => {
    cy.get('#public-design-email-modal').find('.input-group.date').should('exist');
  });

  it('It has a close button', () => {
    cy.get('#public-design-email-modal').find('#public-design-email-close-button').should('exist');
  });

  it('It has a apply changes button', () => {
    cy.get('#public-design-email-modal').find('#public-design-email-apply-changes-button').should('exist');
  });
});
