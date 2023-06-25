/* eslint-disable extra-rules/no-commented-out-code */
/* eslint-disable spaced-comment */
/* eslint-disable no-undef */
/* eslint-disable quotes */
describe("newUser", () => {
  beforeEach("get newUser", () => {
    cy.visit("http://localhost:1111/admin");
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(":nth-child(7) > .nav-link").click();
    cy.get('[href="/admin/user/edit/6494869c2758c02938f2cbe8"]').click();
  });

  it("test id 3.1", () => {
    cy.get("#usersName").type("samir");
    //cy.get("#userEmail").type("samir@gmail.com");
    cy.get("#userPassword").type("123456");
    cy.get("#userEditForm > :nth-child(5) > .form-control").type("123456");
    cy.get("#userPassword").should("have.value", "123456");
    cy.get("#btnUserEdit").click();
  });

  it("test id 3.2", () => {
    cy.get("#usersName").type("8");
    //cy.get("#userEmail").type("samir@gmail5");
    cy.get("#userPassword").type("123456");
    cy.get("#userEditForm > :nth-child(5) > .form-control").type("123456");
    cy.get("#userPassword").should("have.length.at.least", "8");
    cy.get("#btnUserEdit").click();
  });

  it("test id 3.3", () => {
    cy.get("#usersName").type("samir");
    // cy.get("#userEmail").type("samir@gmail.com");
    cy.get("#userPassword").type("");
    cy.get("#userEditForm > :nth-child(5) > .form-control").type("123456");
    cy.get("#userPassword").should("not.have.value", "");
    cy.get("#btnUserEdit").click();
  });
});
