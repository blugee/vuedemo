/* globals Cypress: true, cy: true, expect: true, window: true */

const {expect} = require("chai");
const {NodeBaseExport} = require("readable-stream");

describe('Add to Cart Modal Options Processing', () => {
  let basePrice = 0.00;

  before(() => {
    cy.loginWithGui('user');
  });

  beforeEach(() => {
    Cypress.Cookies.preserveOnce('connect.sid');
  });

  it('should have an Add to cart button', () => {
    cy.get('.navbar-nav a#order')
      .should('exist')
      .and('be.visible');
  });

  it('should open the add to cart modal when the Add to cart button is clicked', () => {
    cy.server();

    cy.fixture('order-product-data.json').as('orderProductDataJSON');

    cy.route({
      method: 'GET',
      url: '/api/order/product-data/**',
      response: '@orderProductDataJSON'
    });

    cy.get('.navbar-nav a#order')
      .click();

    cy.wait(250)
      .then(() => {
        cy.get('#order-modal .modal-container')
          .should('exist')
          .and('be.visible');

        cy.get('#order-modal .modal-container')
          .find('[data-cypress=base-price]').last()
          .invoke('text')
          .then(text => {
            basePrice = parseFloat(text.replace('$','').trim());
          });
      });
  });

  it('should reveal options when selecting an order type', () => {
    cy.get('#order-modal .modal-container')
      .within($modal => {
        cy.get('[data-cypress=foam-only-button]').click();

        cy.get('[data-cypress=order-options]')
          .should('exist');
    });
  });

  it('should apply a percentage when selecting a percentage based option', () => {
    cy.get('#order-modal .modal-container')
      .within($modal => {
        // calcualte + 10%
        let targetPrice = (basePrice + (basePrice * 0.1)).toFixed(2);

        cy.get('[data-cypress=order-options]')
          .find('[data-cypress=failsafe-toggle] button')
          .click();

        cy.get('[data-cypress=order-options]')
          .contains('Include Failsafe')
          .click();

        cy.get('[data-cypress=base-price]').last()
          .should( $el => {
            expect($el.text())
              .to.equal('$'+targetPrice);

            basePrice = parseFloat(targetPrice);
          });
      });
  });

  it('should apply an absolute value when selecting absolute value add option', () => {
    cy.get('#order-modal .modal-container')
      .within($modal => {
        // calcualte + absolute value $8.00
        let targetPrice = (basePrice + 8.00).toFixed(2);

        cy.get('[data-cypress=order-options]')
          .find('[placeholder="Add Lid Foam?"]')
          .siblings('button')
          .click();

        cy.get('[data-cypress=order-options]')
          .contains('Solid Ester Lid (+$8.00)')
          .click();

        cy.get('[data-cypress=base-price]').last()
          .should( $el => {
            expect($el.text())
              .to.equal('$'+targetPrice);
          });
      });
  });
});
