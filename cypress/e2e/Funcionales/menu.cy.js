/* eslint-disable no-undef */
/* eslint-disable quotes */
describe("Prueba cambio de nombre de la tienda", () => {
  beforeEach(() => {
    // Cypress starts out with a blank slate for each test
    // so we must tell it to visit our website with the `cy.visit()` command.
    // Since we want to visit the same URL at the start of all our tests,
    // we include it in our beforeEach function so that it runs before each test
    cy.visit("http://localhost:1111/admin");
  });
  it("Campos aceptables", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(".mb-2 > :nth-child(2) > .nav-link").click();
    cy.get("#newNavMenu");
    cy.get("#newNavLink");
    cy.get("#settings-menu-new");
    cy.get("#notify_message");
  });
  it("Sin nombre", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(".mb-2 > :nth-child(2) > .nav-link").click();
    cy.get("#newNavMenu");
    cy.get("#newNavLink");
    cy.get("#settings-menu-new");
    cy.get("#notify_message");
  });
  it("Nombre por fuera de la longitud aceptada", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(".mb-2 > :nth-child(2) > .nav-link").click();
    cy.get("#newNavMenu");
    cy.get("#newNavLink");
    cy.get("#settings-menu-new");
    cy.get("#notify_message");
  });
});
