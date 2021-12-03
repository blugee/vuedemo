/* globals Cypress: true, cy: true, expect: true, window: true */

describe('Exports Modal', () => {

  beforeEach(() => {
    Cypress.Cookies.preserveOnce('connect.sid');
  });

  it('should open the exports modal as an admin user', () => {
    cy.App_loginWithGui('admin');

    cy.get('#admin-exports-btn')
      .should('exist')
      .and('be.visible')
      .click();

    cy.get('#export-pdf-design-modal .modal-container')
      .should('exist')
      .and('be.visible');
  });

  it('should refuse to create PDF when fields are missing', () => {
    cy.get('#export-pdf-design-modal .modal-container .btn')
      .contains('Export PDF')
      .should('have.attr', 'disabled');

    cy.window()
      .then(w => {
        w.mcb.ui.modals.exportPdfDesignModal.vue.validate(true);

        cy.get('#export-pdf-design-modal .modal-container .btn')
          .contains('Export PDF')
          .should('have.attr', 'disabled');
      });
  });

  it('should auto-calculate strap length when there is a plastic tray', () => {
    cy.window()
      .then(w => {
        let tray = w.mcb.main.trayBuilder.currentTray;
        w.mcb.main.trayBuilder.splitTray(tray, () => {
          cy.get('#export-pdf-design-modal .modal-container :input#strap-length')
            .should('exist')
            .and('be.visible')
            .invoke('val')
            .should('not.be.empty');
        });
      });
  });

  it('should start with 18 accessible inputs', () => {
    cy.get('#export-pdf-design-modal .modal-container')
      .within($modal => {
        cy.get(':input')
          .should('have.length', 18);

        cy.get('input#public-design-candidate')
          .should('exist')
          .should('have.attr', 'type')
          .should('equal', 'checkbox');

        cy.get('select#case-type')
          .should('exist')
          .invoke('val')
          .should('be.null');

        cy.get('select#material')
          .should('exist')
          .invoke('val')
          .should('be.null');

        cy.get('select#lid-included')
          .should('exist')
          .invoke('val')
          .should('be.null');

        cy.get('select#cutting-and-stripping')
          .should('exist')
          .invoke('val')
          .should('equal', 'Water Jet');

        cy.get('input#thickness')
          .should('exist')
          .invoke('val')
          .should('be.empty');

        cy.get('textarea#notes')
          .should('exist')
          .invoke('val')
          .should('be.empty');
      });
  });

  it('should show color selector when matierial is TopGuard', () => {
    cy.get('#export-pdf-design-modal .modal-container')
      .within($modal => {
        cy.get('select#material')
          .select('TopGuard (PE) Base Foam');

        cy.get('select#choose-base-foam-color')
          .should('exist')
          .invoke('val')
          .should('be.null');
      });
  });

  it('should not show color selector when matierial is Charcoal Ester', () => {
    cy.get('#export-pdf-design-modal .modal-container')
      .within($modal => {
        cy.get('select#material')
          .select('Charcoal Ester Base Foam');

        cy.get('select#choose-base-foam-color')
          .should('not.exist');
      });
  });

  it('should not show color selector when matierial is ProCell', () => {
    cy.get('#export-pdf-design-modal .modal-container')
      .within($modal => {
        cy.get('select#material')
          .select('ProCell Base Foam');

        cy.get('select#choose-base-foam-color')
          .should('not.exist');
      });
  });

  it('should not show color selector when matierial is URE', () => {
    cy.get('#export-pdf-design-modal .modal-container')
      .within($modal => {
        cy.get('select#material')
          .select('URE Base Foam');

        cy.get('select#choose-base-foam-color')
          .should('not.exist');
      });
  });

  it('should not show color selector when matierial is HILD', () => {
    cy.get('#export-pdf-design-modal .modal-container')
      .within($modal => {
        cy.get('select#material')
          .select('HILD Base Foam');

        cy.get('select#choose-base-foam-color')
          .should('not.exist');
      });
  });

  it('should not show color selector when matierial is 1.7 PE', () => {
    cy.get('#export-pdf-design-modal .modal-container')
      .within($modal => {
        cy.get('select#material')
          .select('1.7 PE Base Foam');

        cy.get('select#choose-base-foam-color')
          .should('exist')
          .invoke('val')
          .should('be.null');
      });
  });

  it('should not show color selector when matierial is 2.2 PE', () => {
    cy.get('#export-pdf-design-modal .modal-container')
      .within($modal => {
        cy.get('select#material')
          .select('2.2 PE Base Foam');

        cy.get('select#choose-base-foam-color')
          .should('exist')
          .invoke('val')
          .should('be.null');
      });
  });

  it('should not show color selector when matierial is 4.0 PE', () => {
    cy.get('#export-pdf-design-modal .modal-container')
      .within($modal => {
        cy.get('select#material')
          .select('4.0 PE Base Foam');

        cy.get('select#choose-base-foam-color')
          .should('exist')
          .invoke('val')
          .should('be.null');
      });
  });

  it('should allow PDF export when required fields are completed', () => {
    cy.get('#export-pdf-design-modal .modal-container')
      .within($modal => {
        cy.get('select#choose-base-foam-color')
          .select('Black');

        cy.get('select#lid-included')
          .select('Solid Char Ester');

        cy.get('input#thickness')
          .first()
          .type(10);

        cy.get('input#thickness')
          .last()
          .type(10);

        cy.window()
          .then(w => {
            w.mcb.ui.modals.exportPdfDesignModal.vue.validate(true);

            cy.get('a.btn')
              .contains('Export PDF')
              .should('not.have.attr', 'disabled');
          });
      });
  });
});
