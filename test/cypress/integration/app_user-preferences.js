/* globals Cypress: true, cy: true, expect: true, window: true */

describe('User Preferences', () => {

  before(() => {
    cy.loginWithGui('user');
  });

  beforeEach(() => {
    Cypress.Cookies.preserveOnce('connect.sid');
  });

  it('should have a Settings button', () => {
    cy.get('#left-nav-menu ul.nav-buttons li:not(.divider):not(.unimplemented) span')
      .contains('Settings')
      .parent('a')
      .parent('li')
      .should('exist');
  });

  it('should open the Settings panel when clicked', () => {
    cy.get('#left-nav-menu ul.nav-buttons li:not(.divider):not(.unimplemented) span')
      .contains('Settings')
      .parent('a')
      .parent('li')
      .click();

    cy.get('#sub-nav-menu.active #settings-nav')
      .should('exist')
      .and('be.visible');

    cy.get('#sub-nav-menu.active #settings-nav')
      .within($settings => {
        cy.get('li > p')
          .contains('Settings')
          .should('exist')
          .and('be.visible');

        cy.get('#show-grid-checkbox')
          .should('exist')
          .and('be.visible');

        cy.get('#snap-grid-checkbox')
          .should('exist')
          .and('be.visible');

        cy.get('#depth-grid-checkbox')
          .should('exist')
          .and('be.visible');

        cy.get('#auto-snap-checkbox')
          .should('exist')
          .and('be.visible');

        cy.get('#nudge-spacing-input')
          .should('exist')
          .and('be.visible');

        cy.get('input#inches-setting[type="radio"]')
          .should('exist')
          .and('be.visible');

        cy.get('input#mm-setting[type="radio"]')
          .should('exist')
          .and('be.visible');

        cy.get('select#language')
          .should('exist')
          .and('be.visible');
      });
  });

  it('should change language when the language is changed', () => {
    cy.get('#sub-nav-menu.active #settings-nav')
      .within($settings => {
        cy.get('select#language')
          .select('fr');

        cy.get('li:first-child p')
          .should('have.text', 'Réglages');
      });

      cy.get('select#language')
          .select('en');
  });

  it('should toggle the units when the unit is changed', () => {
    cy.get('#sub-nav-menu.active #settings-nav')
      .within($settings => {
        cy.get('input#inches-setting').check();

        cy.get('input#grid-size-input')
          .type('0.5');

        cy.get('.form-group label')
          .contains('Nudge Spacing')
          .siblings('input.form-control')
          .type('0.0625');

        cy.get('input#mm-setting').check();

        cy.get('input#grid-size-input')
          .should('have.value', '13');

        cy.get('.form-group label')
          .contains('Nudge Spacing')
          .siblings('input.form-control')
          .should('have.value', '2');

        cy.get('input#inches-setting').check();

        cy.get('input#grid-size-input')
          .should('have.value', '0.5');

        cy.get('.form-group label')
          .contains('Nudge Spacing')
          .siblings('input.form-control')
          .should('have.value', '0.0625');
      });
  });

  it('should set nudge spacing when nudge spacing is set', () => {
    cy.get('#sub-nav-menu.active #settings-nav')
      .within($settings => {
        cy.get('.form-group label')
          .contains('Nudge Spacing')
          .siblings('input.form-control')
          .type('0.75');

        cy.window()
          .its('mcb.store.state.nudgeSpacing.value')
          .should('equal', 0.75);
      });
  });

  it('should set grid size when grid size is set', () => {
    cy.get('#sub-nav-menu.active #settings-nav')
      .within($settings => {
        cy.get('input#grid-size-input')
          .type('0.75');

        cy.window()
          .its('mcb.store.state.gridStep')
          .should('equal', 0.75);
      });
  });

  it('should toggle auto snap shapes when auto snap shapes is checked', () => {
    cy.get('#sub-nav-menu.active #settings-nav')
      .within($settings => {
        cy.get('#auto-snap-checkbox')
          .uncheck();

        cy.window()
          .its('mcb.store.state.appSettings.autoSnapShapes')
          .should('equal', false);

        cy.get('#auto-snap-checkbox')
          .check();
      });
  });

  it('should toggle show depth labels when show depth labels is checked', () => {
    cy.get('#sub-nav-menu.active #settings-nav')
      .within($settings => {
        cy.get('#depth-grid-checkbox')
          .uncheck();

        cy.window()
          .its('mcb.store.state.appSettings.showDepthLabels')
          .should('equal', false);

        cy.get('#depth-grid-checkbox')
          .check();
      });
  });

  it('should toggle snap to grid when snap to grid is checked', () => {
    cy.get('#sub-nav-menu.active #settings-nav')
      .within($settings => {
        cy.get('#snap-grid-checkbox')
          .check();

        cy.window()
          .its('mcb.store.state.appSettings.snapToGrid')
          .should('equal', true);

        cy.get('#snap-grid-checkbox')
          .uncheck();
      });
  });

  it('should toggle show grid when show grid is checked', () => {
    cy.get('#sub-nav-menu.active #settings-nav')
      .within($settings => {
        cy.get('#show-grid-checkbox')
          .uncheck();

        cy.window()
          .its('mcb.store.state.appSettings.showGrid')
          .should('equal', false);

        cy.get('#show-grid-checkbox')
          .check();
      });
  });

  it('should persist auto snap shapes state when closing and re-opening the panel', () => {
    // the settings panel is already open from prior test
    cy.get('#sub-nav-menu.active #settings-nav')
      .within($settings => {
        // uncheck Auto Snap Shapes
        cy.get('#auto-snap-checkbox')
          .uncheck();

        // assert the boolean state property is false
        cy.window()
          .its('mcb.store.state.appSettings.autoSnapShapes')
          .should('equal', false);

        // close the panel
        cy.root().parent().find('a.close-sub-nav')
          .click();
      });

      // assert the panel is closed
      cy.get('#sub-nav-menu.active #settings-nav')
        .should('not.exist')
        .and('not.be.visible');

      // open the panel
      cy.get('#left-nav-menu ul.nav-buttons li:not(.divider):not(.unimplemented) span')
        .contains('Settings')
        .parent('a')
        .parent('li')
        .click();

      // assert the panel is open
      cy.get('#sub-nav-menu.active #settings-nav')
        .should('exist')
        .and('be.visible');

      cy.get('#sub-nav-menu.active #settings-nav')
        .within($settings => {

          // assert the checkbox remains unchecked
          cy.get('#auto-snap-checkbox')
            .should('not.be.checked');

          // assert the boolean state property is still false
          cy.window()
            .its('mcb.store.state.appSettings.autoSnapShapes')
            .should('equal', false);

          // check Auto Snap Shapes
          cy.get('#auto-snap-checkbox')
            .check();

          // assert the boolean state property is true
          cy.window()
            .its('mcb.store.state.appSettings.autoSnapShapes')
            .should('equal', true);

          // close the panel
          cy.root().parent().find('a.close-sub-nav')
            .click();
        });

      // assert the panel is closed
      cy.get('#sub-nav-menu.active #settings-nav')
        .should('not.exist')
        .and('not.be.visible');

      // open the panel
      cy.get('#left-nav-menu ul.nav-buttons li:not(.divider):not(.unimplemented) span')
        .contains('Settings')
        .parent('a')
        .parent('li')
        .click();

      // assert the panel is open
      cy.get('#sub-nav-menu.active #settings-nav')
        .should('exist')
        .and('be.visible');

      cy.get('#sub-nav-menu.active #settings-nav')
        .within($settings => {
          // assert the checkbox remains checked
          cy.get('#auto-snap-checkbox')
            .should('be.checked');

          // assert the boolean state property remains true
          cy.window()
            .its('mcb.store.state.appSettings.autoSnapShapes')
            .should('equal', true);
        });
  });

  it('should save settings when remember settings is clicked', () => {
    cy.server();

    cy.route('POST', window.location.origin+'/api/account/app-settings').as('saveSettings');

    cy.get('#sub-nav-menu.active #settings-nav')
      .within($settings => {
        cy.get('a.btn')
          .contains('Remember Settings')
          .click();

          cy.wait('@saveSettings');

          cy.get('@saveSettings').then(function (xhr) {
            expect(xhr.status)
              .to.eq(200);

            expect(xhr.response.body)
              .to.be.an('object')
              .that.has.all.keys('status', 'data');

            expect(xhr.response.body.data)
              .that.has.all.keys('language', 'defaultOptions', 'nudgeSpacing', 'gridStep', 'units', 'autoSnapShapes', 'showDepthLabels', 'snapToGrid','showGrid');

            expect(xhr.response.body.data.language)
              .to.equal('en');

            expect(xhr.response.body.data.nudgeSpacing)
              .to.equal(0.75);

            expect(xhr.response.body.data.gridStep)
              .to.equal(0.75);

            expect(xhr.response.body.data.units)
              .to.equal('inches');

            expect(xhr.response.body.data.autoSnapShapes)
              .to.equal(true);

            expect(xhr.response.body.data.showDepthLabels)
              .to.equal(true);

            expect(xhr.response.body.data.snapToGrid)
              .to.equal(false);

            expect(xhr.response.body.data.showGrid)
              .to.equal(true);

          });
      });
  });
});
