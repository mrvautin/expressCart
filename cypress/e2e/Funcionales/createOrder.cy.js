/* eslint-disable extra-rules/no-commented-out-code */
/* eslint-disable no-undef */
/* eslint-disable quotes */
describe("createOrder", () => {
  beforeEach("newOrder", () => {
    cy.visit("http://localhost:1111/admin");
    cy.get("#email").type("rzagza039@gmail.com");
    cy.get("#password").type("**039##");
    cy.get("#loginForm").click();
    cy.get(":nth-child(5) > .sidebar-link-addon").click({ force: true });
    // cy.get('.float-right > .btn').click()
  });

  it("Name y last name correct", () => {
    cy.get("#orderFirstName").type("samir");
    cy.get("#orderLastName").type("ramos");
    cy.get("#orderFirstName").should("have.value", "samir");
    cy.get("#orderLastName").should("have.value", "ramos");
  });

  it("Name number and last name correct", () => {
    cy.get("#orderFirstName").type("123");
    cy.get("#orderLastName").type("ramos");
    cy.get("#orderFirstName").should("not.have.value", "123");
  });

  it("Name with special character and last name correct", () => {
    cy.get("#orderFirstName").type("#@$");
    cy.get("#orderLastName").type("ramos");
    cy.get("#orderFirstName").should("not.have.value", "#@$");
  });

  it("Name empty adn last name correct", () => {
    cy.get("#orderFirstName").type("");
    cy.get("#orderLastName").type("ramos");
    cy.get("#orderFirstName").should("not.have.value", "");
  });

  it("Name correct and last name number", () => {
    cy.get("#orderFirstName").type("samir");
    cy.get("#orderLastName").type("123");
    cy.get("#orderLastName").should("have.value", "123");
  });

  it("Name correct and last name special character", () => {
    cy.get("#orderFirstName").type("samir");
    cy.get("#orderLastName").type("#@$");
    cy.get("#orderLastName").should("not.have.value", "#@$");
  });

  it("Name correct and no last name", () => {
    cy.get("#orderFirstName").type("samir");
    cy.get("#orderLastName").type("");
    cy.get("#orderLastName").should("not.have.value", "");
  });
});
