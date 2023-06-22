/* eslint-disable no-undef */
describe('Valor limite', () => {
  it('passes', () => {
    cy.visit('/admin');
    cy.get('#email').type('juan.getial@correounivalle.edu.co');
    cy.get('#password').type('199656');
    cy.get('#loginForm').click();
    cy.get(':nth-child(1) > :nth-child(4) > .nav-link').click();
    cy.get(':nth-child(2) > .top-pad-8 > a').click();
    cy.get(
      '#product_opt_wrapper > :nth-child(2) > .row > :nth-child(3)'
    ).should('contain', '5');

    cy.visit('/');
    cy.get(':nth-child(1) > .thumbnail > p.text-center > .btn').click();
    cy.get('#product_quantity').clear();
    cy.get('#product_quantity').type('0');
    // automaticamente al intentar añadir al carrito con 0 cantidad lo pasa a 1
    cy.get('#product_quantity').should('have.value', '0');

    cy.get('#product_quantity').clear();
    cy.get('#product_quantity').type('1');
    // Si deja agregar correctamente
    cy.get('#product_quantity').should('have.value', '1');

    cy.get('#product_quantity').clear();
    cy.get('#product_quantity').type('2');
    // Si deja agregar correctamente el valor esperado
    cy.get('#product_quantity').should('have.value', '2');

    cy.get('#product_quantity').clear();
    cy.get('#product_quantity').type('4');
    // Si deja agregar correctamente el valor esperado
    cy.get('#product_quantity').should('have.value', '4');

    cy.get('#product_quantity').clear();
    cy.get('#product_quantity').type('5');
    // Si deja agregar correctamente el valor esperado
    cy.get('#product_quantity').should('have.value', '5');

    cy.get('#product_quantity').clear();
    cy.get('#product_quantity').type('6');
    // deja agregar 6 pero no deberai ya que en stock solo hay 5 de cantidad
    cy.get('.btnAddToCart > .btn').click();
    cy.get('#product_quantity').should('have.value', '6');
  });
});
