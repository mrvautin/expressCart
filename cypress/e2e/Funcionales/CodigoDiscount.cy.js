/* eslint-disable no-undef */
describe('template spec', () => {
  it('passes', () => {
    cy.visit('/admin');
    cy.get('#email').type('juan.getial@correounivalle.edu.co');
    cy.get('#password').type('199656');
    cy.get('#loginForm').click();
    cy.get('.mb-2 > :nth-child(4) > .nav-link').click();
    cy.get(':nth-child(1) > .row > .text-right > .btn-outline-success').click();
    cy.get('#discountCode').clear();
    cy.get('#discountCode').type('WCODE25');
    // Verificamos que sea una la clase valida
    cy.get('#discountCode').should('have.value', 'WCODE25');

    cy.get('#discountCode').clear();
    cy.get('#discountCode').type(
      'CodeImportantMix20Well30ZimaBlue12CodeAgainTpsExpre'
    );
    // Vemos que al intentar tipear este nombre automaticamente le quita una letra
    cy.get('#discountCode').should(
      'have.value',
      'CodeImportantMix20Well30ZimaBlue12CodeAgainTpsExpr'
    );

    cy.get('#discountCode').clear();
    // Vemos que al poner vacio automaticamente desahabilita el boton de actualizar codigo
    cy.get('#discountCode').should('have.value', '');
    cy.get('.float-right > .btn').click();

    // Probando Discount code
    cy.get('#discountCode').type('WCODE25');

    // 25
    cy.get('#discountValue').clear();
    cy.get('#discountValue').type('25');
    cy.get('#discountValue').should('have.value', '25');
    // 101
    cy.get('#discountValue').clear();
    cy.get('#discountValue').type('101');
    cy.get('#discountValue').should('have.value', '101');
    // Aunque deja actualizar el codigo esto no deberia pasar
    cy.get('.float-right > .btn').click();
    // 25A
    cy.get('#discountValue').clear();
    cy.get('#discountValue').type('25A');
    // automaticamente no pone la A
    cy.get('#discountValue').should('have.value', '25');
    // Vacio
    cy.get('#discountValue').clear();
    cy.get('#discountValue').should('have.value', '');
    cy.get('.float-right > .btn').click();
    // Automaticamente no desactiva el boton de actualizar codigo
  });
});
