/* eslint-disable quotes */
describe("Prueba logueo de usuario", () => {
  beforeEach(() => {
    cy.visit("http://localhost:1111/customer/login");
  });
  it("Correo y contraseña correctos", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.url().should("eq", "http://localhost:1111/");
  });
  it("Correo sin @", () => {
    cy.get("#email").type("juanestebanortizbejaranogmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get("#notify_message").should("have.text", "@ not found");
  });
  it("Sin correo", () => {
    cy.get("#email").clear();
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get("#notify_message").should("have.text", "Please enter a email");
  });
  it("Sin contraseña", () => {
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#loginForm").click();
    cy.get("#notify_message").should("have.text", "Please enter a password");
  });
});
