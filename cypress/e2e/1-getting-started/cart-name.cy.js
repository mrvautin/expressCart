/* eslint-disable quotes */
describe("Prueba cambio de nombre de la tienda", () => {
  beforeEach(() => {
    // Cypress starts out with a blank slate for each test
    // so we must tell it to visit our website with the `cy.visit()` command.
    // Since we want to visit the same URL at the start of all our tests,
    // we include it in our beforeEach function so that it runs before each test
    cy.visit("http://localhost:1111/admin");
  });
  it("Nombre aceptable", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(".mb-2 > :nth-child(1) > .nav-link").click();
    cy.get(".col-md-12 > :nth-child(1) > .form-control").clear();
    cy.get(".col-md-12 > :nth-child(1) > .form-control").type("Gucci");
    cy.get("#btnSettingsUpdate").click();
    cy.visit("http://localhost:1111/");
    cy.get(".navbar-brand").should("have.text", "Gucci");
  });
  it("Sin nombre", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(".mb-2 > :nth-child(1) > .nav-link").click();
    cy.get(".col-md-12 > :nth-child(1) > .form-control").clear();
    cy.get("#btnSettingsUpdate").click();
    cy.get("#notify_message").should(
      "have.text",
      "Cannot update the cart name"
    );
  });
  it("Nombre por fuera de la longitud aceptada", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(".mb-2 > :nth-child(1) > .nav-link").click();
    cy.get(".col-md-12 > :nth-child(1) > .form-control").clear();
    cy.get(".col-md-12 > :nth-child(1) > .form-control").type(
      "Cloth maximus for you"
    );
    cy.get("#btnSettingsUpdate").click();
    cy.get("#notify_message").should(
      "have.text",
      "The lenght of the name is too long"
    );
  });
});
