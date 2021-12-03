describe('Backend Designs fileID link', () => {
  let fileID;

  before(() => {
    cy.loginWithGui('admin');
  })

  beforeEach(() => {
    Cypress.Cookies.preserveOnce('page', 'connect.sid')
  })

  it('should have at least one design in the list', () => {
    cy.visit("http://" + Cypress.env('host') + ":" + Cypress.env('port') + "/designs");
    cy.url().should('match', new RegExp("http://" + Cypress.env('host') + ":" + Cypress.env('port') + "/designs"));

    cy.get('.design-link').first().should('exist').then(res => {
      fileID = res.text()
    });
  });

  it('should open the design\'s app url when clicking the fileID link', () => {
    cy.get('.design-link').first().click();
    cy.url().should('match', new RegExp("http://" + Cypress.env('host') + ":" + Cypress.env('port') + "/app"));
    cy.get('[data-cypress=file-status-span-fileID]').should('have.text', fileID);
  });

});
