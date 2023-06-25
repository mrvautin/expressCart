/* eslint-disable spaced-comment */
/* eslint-disable extra-rules/no-commented-out-code */
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
    cy.get('[href="/admin/user/edit/6494869c2758c02938f2cbe8"]').click();
  });

  it("test id 1.1", () => {
    cy.get("#usersName").clear();
    cy.get("#usersName").type("samir2");
    // cy.get("#userEmail").type("samir@gmail.com");
    cy.get("#userPassword").type("123456");
    cy.get("#userEditForm > :nth-child(5) > .form-control").type("123456");
    cy.get("#usersName").should("have.value", "samir2");
    cy.get("#btnUserEdit").click();
  });

  it("test id 1.2", () => {
    cy.get("#usersName").clear();
    cy.get("#usersName").type("8");
    //cy.get("#userEmail").type("samir@gmail.com");
    cy.get("#userPassword").type("123456");
    cy.get("#userEditForm > :nth-child(5) > .form-control").type("123456");
    cy.get("#usersName").should("have.value", "samir");
    cy.get("#usersName").should("not.include.value", "8");
    cy.get("#btnUserEdit").click();
  });

  it("test id 1.3", () => {
    cy.get("#usersName").clear();
    cy.get("#usersName").type("@");
    //cy.get("#userEmail").type("samir@gmail.com");
    cy.get("#userPassword").type("123456");
    cy.get("#userEditForm > :nth-child(5) > .form-control").type("123456");
    cy.get("#usersName").should("not.have.value", "@");
    cy.get("#btnUserEdit").click();
  });

  it("test id 1.4", () => {
    cy.get("#usersName").clear();
    //cy.get("#usersName").type("");
    //cy.get("#userEmail").type("samir@gmail.com");
    cy.get("#userPassword").type("123456");
    cy.get("#userEditForm > :nth-child(5) > .form-control").type("123456");
    cy.get("#usersName").should("not.have.value", "");
    cy.get("#btnUserEdit").click();
  });
});
