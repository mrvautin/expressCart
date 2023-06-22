/* eslint-disable no-undef */
/* eslint-disable quotes */
Cypress.on("uncaught:exception", (err, runnable) => {
  return false;
});

describe("newUser", () => {
  beforeEach("get newUser", () => {
    cy.visit("http://localhost:1111/admin");
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(":nth-child(7) > .nav-link").click();
    cy.get(".float-right > .btn").click();
  });
  it("test id UE1", () => {
    cy.get("#usersName").type("samir");
    cy.get("#userEmail").type("samir@gmail.com");
    cy.get("#userPassword").type("123456");
    cy.get("#userNewForm > :nth-child(4) > .form-control").type("123456");
    cy.get("#userEmail").should("have.value", "samir@gmail.com");
    cy.get("#btnUserAdd").click();
  });

  it("test id UE2", () => {
    cy.get("#usersName").type("samir");
    cy.get("#userEmail").type("samir.com");
    cy.get("#userPassword").type("123456");
    cy.get("#userNewForm > :nth-child(4) > .form-control").type("123456");
    cy.get("#userEmail").should("include.value", ".@");
    cy.get("#btnUserAdd").click();
  });

  it("test id UE3", () => {
    cy.get("#usersName").type("samir");
    cy.get("#userEmail").type("samir@");
    cy.get("#userPassword").type("123456");
    cy.get("#userNewForm > :nth-child(4) > .form-control").type("123456");
    cy.get("#userEmail").should("include.value", "com");
    cy.get("#btnUserAdd").click();
  });

  it("test id UE4", () => {
    cy.get("#usersName").type("samir");
    cy.get("#userEmail").type("");
    cy.get("#userPassword").type("123456");
    cy.get("#userNewForm > :nth-child(4) > .form-control").type("123456");
    cy.get("#userEmail").should("not.have.value", "");
    cy.get("#btnUserAdd").click();
  });
});
