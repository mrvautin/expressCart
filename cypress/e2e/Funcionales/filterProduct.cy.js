/* eslint-disable no-undef */
/* eslint-disable quotes */
describe("newUser", () => {
  beforeEach("get newUser", () => {
    cy.visit("http://localhost:1111/admin");
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(":nth-child(1) > :nth-child(4) > .nav-link").click();
  });

  it("test id 1", () => {
    cy.get("#product_filter").type("Camiseta");
    cy.get("#btn_product_filter").click();
    cy.get(".top-pad-8 > a").should("have.text", "Camiseta");
  });

  it("test id 2", () => {
    // cy.get("#product_filter").type("");
    cy.get("#btn_product_filter").click();
    cy.get(".top-pad-8").should("not.have.value", "");
  });
});
