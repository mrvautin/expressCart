/* eslint-disable spaced-comment */
/* eslint-disable extra-rules/no-commented-out-code */
/* eslint-disable no-undef */
/* eslint-disable quotes */
describe("Prueba cambio de nombre de la tienda", () => {
  beforeEach(() => {
    cy.visit("http://localhost:1111/admin");
  });
  it("Campos aceptables", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(".mb-2 > :nth-child(2) > .nav-link").click();
    cy.get("#newNavMenu").type("Contact Us");
    cy.get("#newNavLink").type("/contact");
    cy.get("#settings-menu-new").click();
    cy.get("#notify_message").should("have.text", "Menu created successfully");
  });
  it("Nombre numero y link bien", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(".mb-2 > :nth-child(2) > .nav-link").click();
    cy.get("#newNavMenu").type(12);
    cy.get("#newNavLink").type("/contact");
    cy.get("#settings-menu-new").click();
    cy.get("#notify_message").should("have.text", "Name cannot be a number");
  });
  it("Sin nombre y link bien", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(".mb-2 > :nth-child(2) > .nav-link").click();
    cy.get("#newNavMenu").type("Contact Us");
    // cy.get("#newNavLink").type("");
    cy.get("#settings-menu-new").click();
    cy.get("#notify_message").should("have.text", "Link is empty");
  });
  it("Nombre bien y link numero", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(".mb-2 > :nth-child(2) > .nav-link").click();
    cy.get("#newNavMenu").type("Contact Us");
    cy.get("#newNavLink").type(2);
    cy.get("#settings-menu-new").click();
    cy.get("#notify_message").should("have.text", "Link cannot be a number");
  });
  it("Nombre vacio y link bien", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(".mb-2 > :nth-child(2) > .nav-link").click();
    //cy.get("#newNavMenu").type("");
    cy.get("#newNavLink").type("/contact");
    cy.get("#settings-menu-new").click();
    cy.get("#notify_message").should("have.text", "Name is empty");
  });
});
