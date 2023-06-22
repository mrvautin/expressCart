/* eslint-disable no-undef */
/* eslint-disable quotes */
describe("Pruebas editar direccion y telefono de cliente", () => {
  beforeEach(() => {
    cy.visit("http://localhost:1111/admin");
  });
  it("Direccion aceptable", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(":nth-child(6) > .nav-link").click();
    cy.get("a > .row > .col-sm-6 > div").click();
    cy.get("#address1").clear();
    cy.get("#address1").type("Calle 122 #23-12");
    cy.get("#updateCustomer").click();
    cy.get("#notify_message").should("have.text", "Customer updated");
  });
  it("Direccion corta", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(":nth-child(6) > .nav-link").click();
    cy.get("a > .row > .col-sm-6 > div").click();
    cy.get("#address1").clear();
    cy.get("#address1").type("Calle");
    cy.get("#updateCustomer").click();
    cy.get("#notify_message").should("have.text", "Cannot update customer");
  });
  it("Sin direccion", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(":nth-child(6) > .nav-link").click();
    cy.get("a > .row > .col-sm-6 > div").click();
    cy.get("#address1").clear();
    cy.get("#updateCustomer").click();
    cy.get("#notify_message").should("have.text", "Cannot update customer");
  });
});
