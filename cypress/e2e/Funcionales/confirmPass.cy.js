/* eslint-disable no-undef */
/* eslint-disable quotes */
describe("newUser", () => {
  beforeEach("get newUser", () => {
    cy.visit("http://localhost:1111/admin");
    cy.get("#email").type("juanestebanortizbejarano@gmail.com");
    cy.get("#password").type("admin12");
    cy.get("#loginForm").click();
    cy.get(":nth-child(7) > .nav-link").click();
    cy.get(".float-right > .btn").click();
  });
  it("test id P1", () => {
    cy.get("#usersName").type("samir");
    cy.get("#userEmail").type("samir@gmail.com");
    cy.get("#userPassword").type("123456789");
    cy.get("#userNewForm > :nth-child(4) > .form-control").type("123456789");
    cy.get("#userNewForm > :nth-child(4) > .form-control").should(
      "have.value",
      "123456789"
    );
    cy.get("#btnUserAdd").click();
  });

  it("test id P2", () => {
    cy.get("#usersName").type("samir");
    cy.get("#userEmail").type("samir@gmail");
    cy.get("#userPassword").type("1234");
    cy.get("#userNewForm > :nth-child(4) > .form-control").type("123");
    cy.get("#userNewForm > :nth-child(4) > .form-control").should(
      "have.length.at.least",
      "8"
    );
    cy.get("#btnUserAdd").click();
  });

  it("test id P3", () => {
    cy.get("#usersName").type("samir");
    cy.get("#userEmail").type("samir@gmail");
    cy.get("#userPassword").type("123456789");
    cy.get("#userNewForm > :nth-child(4) > .form-control").type("123456");
    cy.get("#userNewForm > :nth-child(4) > .form-control").should(
      "not.have.value",
      ""
    );
    cy.get("#btnUserAdd").click();
  });
});
