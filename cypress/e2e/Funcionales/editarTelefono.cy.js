/* eslint-disable no-undef */
/* eslint-disable quotes */
describe("Pruebas editar direccion y telefono de cliente", () => {
  beforeEach(() => {
    cy.visit("http://localhost:1111/admin");
  });
  it("Numero aceptable", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(":nth-child(6) > .nav-link").click();
    cy.get("a > .row > .col-sm-6 > div").click();
    cy.get("#phone").clear();
    cy.get("#phone").type("1234567890");
    cy.get("#updateCustomer").click();
    cy.get("#notify_message").should("have.text", "Customer updated");
  });
  it("Letra incluida", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(":nth-child(6) > .nav-link").click();
    cy.get("a > .row > .col-sm-6 > div").click();
    cy.get("#phone").clear();
    cy.get("#phone").type("1234567d90");
    cy.get("#updateCustomer").click();
    cy.get("#notify_message").should("have.text", "Cannot update customer");
  });
  it("Sin numero", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(":nth-child(6) > .nav-link").click();
    cy.get("a > .row > .col-sm-6 > div").click();
    cy.get("#phone").clear();
    cy.get("#updateCustomer").click();
    cy.get("#notify_message").should("have.text", "Cannot update customer");
  });
});
