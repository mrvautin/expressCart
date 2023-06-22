/* eslint-disable extra-rules/no-commented-out-code */
/* eslint-disable keyword-spacing */
/* eslint-disable space-before-blocks */
/* eslint-disable no-undef */

describe('Tipo de envio', () => {
  /* beforeEach(() => {
    // reset and seed the database prior to every test
    cy.exec('mongod && npm start');
  }); */
  it('asserts', () => {
    cy.visit('/');

    // Tipo de envio

    // Caso envio 10 Euros
    cy.get(':nth-child(4) > .thumbnail > p.text-center > .btn').click();
    cy.contains('Cart').click();
    cy.get('.cart-contents-shipping > :nth-child(1)').should(
      'contain',
      'Estimated shipping :£10.00'
    );
    // cy.get('.my-auto').should('contain', '25.00');

    // Caso mayor de 100 euros

    for (let i = 0; i < 3; i++) {
      cy.contains('+').click();
    }
    cy.get('.cart-contents-shipping > :nth-child(1)').should(
      'contain',
      'FREE shipping'
    );

    cy.get('.col-4 > .btn').click();
    cy.get('.pushy-link').click();

    // Caso Producto subcription

    cy.visit('http://localhost:1111/product/asrqwe134232');
    cy.get('.btnAddToCart > .btn').click();
    cy.get('.navbar-nav > :nth-child(3) > .btn').click();
    cy.get('#shipping-amount').should('contain', 'FREE shipping');

    cy.visit('/admin');
    cy.get('#email').type('juan.getial@correounivalle.edu.co');
    cy.get('#password').type('199656');
    cy.get('#loginForm').click();
    cy.get(':nth-child(5) > .sidebar-link-addon').click();
    cy.get('#orderStatus').select('Completed');
    // first name
    cy.get('#orderFirstName').type('Juan');
    // second name
    cy.get('#orderLastName').type('David');
    // address
    cy.get('#orderAddress1').type('Av 6 #21-22');
    // Country
    cy.get('#orderCountry').select('Colombia');
    // state
    cy.get('#orderState').type('Cali');
    // postalCode
    cy.get('#orderPostcode').type('123321');
    // Phone number
    cy.get('#orderPhone').type('3159421713');

    cy.get('#orderStatus').should('have.value', 'Completed');
    // En el reporte de pruebas poner que a pesar de poner todos los campos el sistema arroja un error y se cae la pagina
  });
});

/* describe('Clase Orden', () => {
  it('Orden', () => {
    cy.visit('/');
  });
}); */
