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
    cy.get(":nth-child(3) > .nav-link");
    cy.get(".float-right > .btn");
    cy.get("#pageName");
    cy.get("#pageSlug");
    cy.get("#pageSlug");
    cy.get("#btnPageUpdate");
    cy.get("#notify_message").should("have.text", "Customer updated");
  });
  it("Letra incluida", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(":nth-child(3) > .nav-link");
    cy.get(".float-right > .btn");
    cy.get("#pageName");
    cy.get("#pageSlug");
    cy.get("#pageSlug");
    cy.get("#btnPageUpdate");
    cy.get("#notify_message").should("have.text", "Customer updated");
  });
  it("Sin numero", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(":nth-child(3) > .nav-link");
    cy.get(".float-right > .btn");
    cy.get("#pageName");
    cy.get("#pageSlug");
    cy.get("#pageSlug");
    cy.get("#btnPageUpdate");
    cy.get("#notify_message").should("have.text", "Customer updated");
  });
});
