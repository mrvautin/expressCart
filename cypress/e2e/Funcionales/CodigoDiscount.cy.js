/* eslint-disable quotes */
/* eslint-disable no-undef */
describe("template spec", () => {
  beforeEach(() => {
    cy.visit("http://localhost:1111/admin");
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(".mb-2 > :nth-child(4) > .nav-link").click();
    cy.get(":nth-child(1) > .row > .text-right > .btn-outline-success").click();
  });
  it("ClaseValidaTexto", () => {
    cy.get("#discountCode").clear();
    cy.get("#discountCode").type("WCODE25");
    // Verificamos que sea una la clase valida
    cy.get("#discountCode").should("have.value", "WCODE25");

    cy.get("#discountCode").clear();
    cy.get("#discountCode").type("WCODE25");
  });

  it("ClaseLargaText", () => {
    cy.get("#discountCode").clear();
    cy.get("#discountCode").type(
      "CodeImportantMix20Well30ZimaBlue12CodeAgainTpsExpre"
    );
    // Vemos que al intentar tipear este nombre automaticamente le quita una letra
    cy.get("#discountCode").should(
      "have.value",
      "CodeImportantMix20Well30ZimaBlue12CodeAgainTpsExpre"
    );
  });

  it("ClaseVacia", () => {
    cy.get("#discountCode").clear();
    // Vemos que al poner vacio automaticamente desahabilita el boton de actualizar codigo
    cy.get("#discountCode").should("have.value", "");
    cy.get(".float-right > .btn").click();
  });

  // Probando Discount code

  it("ClaseValidaCodigo", () => {
    // 25
    cy.get("#discountValue").clear();
    cy.get("#discountValue").type("25");
    cy.get("#discountValue").should("have.value", "25");
  });

  it("ClaseMayor100C", () => {
    // 101
    cy.get("#discountValue").clear();
    cy.get("#discountValue").type("101");
    cy.get("#discountValue").should("have.value", "101");
    // Aunque deja actualizar el codigo esto no deberia pasar
    cy.get(".float-right > .btn").click();
  });

  it("ClaseNumeroLetra", () => {
    // 25A
    cy.get("#discountValue").clear();
    cy.get("#discountValue").type("25A");
    // automaticamente no pone la A
    cy.get("#discountValue").should("have.value", "25A");
  });

  it("ClaseCodigoVacio", () => {
    // Vacio
    cy.get("#discountValue").clear();
    cy.get("#discountValue").should("have.value", "");
    cy.get(".float-right > .btn").click();
    // Automaticamente no desactiva el boton de actualizar codigo
  });
});
