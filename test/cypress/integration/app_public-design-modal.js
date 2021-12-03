/* globals Cypress: true, cy: true, expect: true, window: true */

describe('Public Design Modal', () => {
  let theDesign;

  it('should be able to setup a public design candidate as a user', () => {
    Cypress.Cookies.preserveOnce('connect.sid');

    cy.App_loginWithGui('user');

	  cy.server();

    cy.route('PUT', "http://" + Cypress.env('host') + ":" + Cypress.env('port') + '/api/designs/snapshot/**')
      .as('saveRevision');

    cy.window()
      .then(w => {
        w.mcb.store.state.currentDesign.currentRev.publicDesign.isCandidate = true;
        w.mcb.main.oh.dispatchEvent('setstate');

      theDesign = w.mcb.store.state.currentDesign;

		  cy.wait('@saveRevision');

      cy.get('@saveRevision').then(function (xhr) {
        expect(xhr.status)
          .to.eq(200);
      });
    });
  });

  it('should be able to access a public design url as a user', () => {
    Cypress.Cookies.preserveOnce('connect.sid');

    cy.visit("http://" + Cypress.env('host') + ":" + Cypress.env('port') + "/app?mode=publicdesign&fileids="+theDesign.currentRev.fileID);

    cy.get('#public-design-modal .modal-container')
      .should('exist')
      .and('be.visible');
  });

  it('should be able to access a public design url as a admin', () => {
    cy.loginWithGui('admin');

    cy.visit("http://" + Cypress.env('host') + ":" + Cypress.env('port') + "/app?mode=publicdesign&fileids="+theDesign.currentRev.fileID);

    cy.get('#public-design-modal .modal-container')
      .should('exist')
      .and('be.visible');
  });
});
